import asyncio
import httpx
import structlog
import datetime
import random

from database.database import get_db
from core.reputation_service import ReputationService
from core.validation_service import ValidationService
from core.consensus_mechanism import ConsensusMechanism
from core.content_model import ValidationVote
from config import config

logger = structlog.get_logger(__name__)

class ValidatorNode:
    def __init__(self, validator_id: str, api_url: str):
        self.validator_id = validator_id
        self.api_url = api_url # URL of the main validation API
        self.http_client = httpx.AsyncClient()
        self.is_running = False
        self.reputation_service: ReputationService = None
        self.validation_service: ValidationService = None
        self.consensus_mechanism: ConsensusMechanism = None
        logger.info(f"ValidatorNode {self.validator_id} initialized.")

    async def initialize_services(self):
        """Initializes internal services for the validator node."""
        # These services would typically be injected or initialized once at startup
        # For a single node running everything, they are shared.
        # For a truly distributed setup, each validator node would have its own instances
        # and communicate with the main API for content/vote submission.
        self.reputation_service = ReputationService()
        self.consensus_mechanism = ConsensusMechanism(self.reputation_service)
        self.validation_service = ValidationService(self.reputation_service, self.consensus_mechanism)
        logger.info(f"ValidatorNode {self.validator_id} services initialized.")

    async def register_self(self):
        """Registers this validator node with the main API."""
        async for db_session in get_db():
            try:
                # Check if already registered
                existing_validator = await db_session.execute(
                    select(Validator).where(Validator.validator_id == self.validator_id)
                ).scalar_one_or_none()

                if not existing_validator:
                    await self.reputation_service.register_validator(
                        db_session,
                        validator_id=self.validator_id,
                        name=f"Validator {self.validator_id}",
                        organization="StarkPulse Network",
                        specialties=["finance", "tech", "news"]
                    )
                    logger.info(f"Validator {self.validator_id} registered successfully.")
                else:
                    logger.info(f"Validator {self.validator_id} already registered. Updating last seen.")
                    existing_validator.last_seen = datetime.datetime.now(datetime.timezone.utc)
                    await db_session.commit()

            except Exception as e:
                logger.error(f"Failed to register validator {self.validator_id}: {e}")
                raise

    async def start_monitoring_loop(self):
        """
        Starts the main loop for the validator node to fetch and validate content.
        In a real system, this would be event-driven (e.g., message queue).
        """
        self.is_running = True
        logger.info(f"ValidatorNode {self.validator_id} starting monitoring loop.")
        while self.is_running:
            try:
                async for db_session in get_db():
                    # Fetch content awaiting validation
                    # In a distributed system, this would be a pull from a queue
                    # or an API endpoint for content assigned to this validator.
                    pending_content = await self.validation_service.get_content_by_status(db_session, 'PENDING')
                    
                    if not pending_content:
                        pending_content = await self.validation_service.get_content_by_status(db_session, 'PENDING_VALIDATORS')

                    if pending_content:
                        # For simplicity, pick one content to process
                        content_to_validate = random.choice(pending_content)
                        logger.info(f"Validator {self.validator_id} picked content {content_to_validate.content_id} for validation.")
                        
                        # Simulate validation process
                        await self._perform_validation(db_session, content_to_validate)
                        
                        # Assign more validators if needed (this would be done by a central orchestrator)
                        # await self.validation_service.assign_content_to_validators(db_session, content_to_validate.id)
                    else:
                        logger.debug(f"Validator {self.validator_id} found no pending content. Waiting...")
                
                await asyncio.sleep(10) # Poll every 10 seconds
            except asyncio.CancelledError:
                logger.info(f"ValidatorNode {self.validator_id} monitoring loop cancelled.")
                break
            except Exception as e:
                logger.error(f"Error in validator node loop for {self.validator_id}: {e}")
                await asyncio.sleep(30) # Wait longer on error

    async def _perform_validation(self, db: AsyncSession, content: Content):
        """Simulates the validation process and submits a vote."""
        logger.info(f"Performing validation for content {content.content_id}...")
        
        # Simulate fact-checking, plagiarism, bias detection
        # These are highly simplified placeholders.
        is_accurate = random.choice([True, True, False]) # More likely to be accurate
        is_plagiarized = random.random() < 0.05 # 5% chance of plagiarism
        bias_score = random.uniform(0.0, 0.9) # Random bias score

        # Adjust accuracy based on simulated checks
        if is_plagiarized or bias_score > config.bias_detection_threshold:
            is_accurate = False # If plagiarized or highly biased, mark as inaccurate

        comments = "Content reviewed by automated validator."
        if not is_accurate:
            comments += " Found potential issues."
        
        vote_data = ValidationVote(
            content_id=content.content_id,
            validator_id=self.validator_id,
            is_accurate=is_accurate,
            is_plagiarized=is_plagiarized,
            bias_score=bias_score,
            comments=comments
        )

        try:
            # Submit vote to the main API (or directly to ValidationService if co-located)
            # If running as a separate process, this would be an HTTP POST to /api/v1/validation/vote
            # For this integrated example, we call the service directly.
            await self.validation_service.submit_validation_vote(
                db,
                content_uuid=vote_data.content_id,
                validator_uuid=vote_data.validator_id,
                is_accurate=vote_data.is_accurate,
                is_plagiarized=vote_data.is_plagiarized,
                bias_score=vote_data.bias_score,
                comments=vote_data.comments
            )
            logger.info(f"Validator {self.validator_id} submitted vote for content {content.content_id}.")
        except Exception as e:
            logger.error(f"Validator {self.validator_id} failed to submit vote for content {content.content_id}: {e}")

    async def stop(self):
        """Stops the validator node's monitoring loop."""
        self.is_running = False
        if self.http_client:
            await self.http_client.aclose()
        logger.info(f"ValidatorNode {self.validator_id} stopped.")

from database.models import Validator # Import here to avoid circular dependency
