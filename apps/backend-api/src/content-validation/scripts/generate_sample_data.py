import asyncio
import sys
import os
import datetime
import random
import uuid
import structlog

# Add the parent directory to the sys.path to allow imports from config and database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.database import get_db, init_db, init_redis, close_redis, get_redis_client
from core.reputation_service import ReputationService
from core.consensus_mechanism import ConsensusMechanism
from core.validation_service import ValidationService
from config import config

logger = structlog.get_logger(__name__)

async def generate_validators(reputation_service: ReputationService, db_session, num_validators: int = 5):
    logger.info(f"Generating {num_validators} sample validators...")
    organizations = ["Independent Analysts", "Blockchain Research", "Media Watchdog", "AI Insights Inc."]
    specialties = [["finance"], ["politics"], ["tech"], ["health"], ["finance", "tech"]]

    for i in range(num_validators):
        validator_id = f"validator_{uuid.uuid4().hex[:8]}"
        name = f"Validator Node {i+1}"
        org = random.choice(organizations)
        spec = random.choice(specialties)
        
        await reputation_service.register_validator(db_session, validator_id, name, org, spec)
    await db_session.commit()
    logger.info(f"Finished generating {num_validators} sample validators.")

async def generate_content_and_votes(validation_service: ValidationService, db_session, num_content: int = 10):
    logger.info(f"Generating {num_content} sample content items and votes...")
    authors = ["author_A", "author_B", "author_C"]
    sample_titles = [
        "The Future of Decentralized Finance",
        "Impact of AI on Global Job Markets",
        "Climate Change: A Scientific Consensus",
        "Understanding Cryptocurrency Volatility",
        "New Breakthroughs in Medical Research"
    ]
    sample_texts = [
        "Decentralized finance (DeFi) is rapidly transforming the financial landscape...",
        "Artificial intelligence is poised to reshape industries, leading to both opportunities and challenges...",
        "The scientific community overwhelmingly agrees that climate change is real and human-caused...",
        "Cryptocurrency markets are known for their extreme price swings, driven by various factors...",
        "Recent discoveries in gene editing and personalized medicine promise a new era of healthcare..."
    ]
    
    # Get all registered validators
    validators = await db_session.execute(select(Validator)).scalars().all()
    if not validators:
        logger.warning("No validators found. Please run generate_validators first.")
        return

    for i in range(num_content):
        title = random.choice(sample_titles)
        text = random.choice(sample_texts)
        source_url = f"http://example.com/article/{uuid.uuid4().hex[:10]}"
        author_id = random.choice(authors)

        content = await validation_service.submit_content_for_validation(
            db_session, title, text, source_url, author_id
        )
        
        # Assign to validators (this is done by submit_content_for_validation now)
        # await validation_service.assign_content_to_validators(db_session, content.id)
        
        # Simulate votes from a subset of validators
        num_votes_to_simulate = random.randint(config.min_validators_per_content, len(validators))
        selected_validators = random.sample(validators, num_votes_to_simulate)

        for validator in selected_validators:
            is_accurate = random.choice([True, True, True, False]) # 75% chance of accurate vote
            is_plagiarized = random.random() < 0.02 # Low chance
            bias_score = random.uniform(0.0, 0.5) # Mostly low bias
            comments = "Automated vote."

            if not is_accurate:
                comments = "Automated vote: Detected potential inaccuracies."
            if is_plagiarized:
                comments += " Possible plagiarism detected."
            if bias_score > 0.7:
                comments += " High bias score."

            try:
                await validation_service.submit_validation_vote(
                    db_session,
                    content_uuid=content.content_id,
                    validator_uuid=validator.validator_id,
                    is_accurate=is_accurate,
                    is_plagiarized=is_plagiarized,
                    bias_score=bias_score,
                    comments=comments
                )
            except ValueError as e:
                logger.warning(f"Skipping vote for {content.content_id} by {validator.validator_id}: {e}")
        
        logger.debug(f"Generated content {content.content_id} and {num_votes_to_simulate} votes.")
    await db_session.commit()
    logger.info(f"Finished generating {num_content} sample content items and votes.")

async def main():
    structlog.configure(
        processors=[
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    logger.info("Starting sample data generation for Content Validation Network...")
    
    # Initialize DB and Redis
    await init_db()
    await init_redis()

    async for db_session in get_db():
        reputation_service = ReputationService()
        consensus_mechanism = ConsensusMechanism(reputation_service)
        validation_service = ValidationService(reputation_service, consensus_mechanism)

        await generate_validators(reputation_service, db_session, num_validators=config.min_validators_per_content + 2) # Ensure enough validators
        await generate_content_and_votes(validation_service, db_session, num_content=15)

    await close_redis()
    logger.info("Sample data generation complete.")

if __name__ == "__main__":
    asyncio.run(main())
