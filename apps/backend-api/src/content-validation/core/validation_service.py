import datetime
import uuid
from typing import List, Dict, Any, Optional
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database.models import Content, Validator, ValidationRecord, ContentDispute
from core.reputation_service import ReputationService
from core.consensus_mechanism import ConsensusMechanism
from config import config

logger = structlog.get_logger(__name__)

class ValidationService:
    def __init__(self, reputation_service: ReputationService, consensus_mechanism: ConsensusMechanism):
        self.reputation_service = reputation_service
        self.consensus_mechanism = consensus_mechanism
        logger.info("ValidationService initialized.")

    async def submit_content_for_validation(
        self, 
        db: AsyncSession, 
        title: str, 
        text: str, 
        source_url: Optional[str] = None, 
        author_id: Optional[str] = None
    ) -> Content:
        """Submits new content to the network for validation."""
        content_id = str(uuid.uuid4())
        new_content = Content(
            content_id=content_id,
            title=title,
            text=text,
            source_url=source_url,
            author_id=author_id,
            validation_status='PENDING'
        )
        db.add(new_content)
        await db.commit()
        await db.refresh(new_content)
        logger.info(f"Content {content_id} submitted for validation.")
        return new_content

    async def assign_content_to_validators(self, db: AsyncSession, content_db_id: int):
        """
        Assigns content to a set of eligible validators for review.
        In a real system, this would involve notifying validator nodes.
        """
        content = await db.execute(select(Content).where(Content.id == content_db_id)).scalar_one_or_none()
        if not content:
            logger.error(f"Content with ID {content_db_id} not found for assignment.")
            return

        eligible_validators = await self.reputation_service.get_eligible_validators(
            db, config.min_validators_per_content
        )

        if len(eligible_validators) < config.min_validators_per_content:
            logger.warning(
                f"Not enough eligible validators ({len(eligible_validators)}) "
                f"to assign content {content_db_id}. Required: {config.min_validators_per_content}"
            )
            content.validation_status = 'PENDING_VALIDATORS'
            await db.commit()
            return

        # In a real system, this would trigger a message to each validator node
        # to fetch the content and start validation.
        logger.info(f"Assigned content {content.content_id} to {len(eligible_validators)} validators.")
        content.validation_status = 'IN_REVIEW'
        await db.commit()
        
        # For demonstration, we'll simulate the validator nodes submitting votes
        # This part would typically be handled by the validator_node.py logic
        # and external communication.
        
        # Store assigned validators in Redis or a temporary table if needed for tracking
        # For now, we just log and expect votes to come in.

    async def submit_validation_vote(
        self, 
        db: AsyncSession, 
        content_uuid: str, 
        validator_uuid: str, 
        is_accurate: bool, 
        is_plagiarized: bool, 
        bias_score: float, 
        comments: Optional[str] = None
    ) -> ValidationRecord:
        """Records a validator's vote on content."""
        content = await db.execute(select(Content).where(Content.content_id == content_uuid)).scalar_one_or_none()
        validator = await db.execute(select(Validator).where(Validator.validator_id == validator_uuid)).scalar_one_or_none()

        if not content:
            raise ValueError(f"Content with UUID {content_uuid} not found.")
        if not validator:
            raise ValueError(f"Validator with UUID {validator_uuid} not found.")

        # Check if validator already voted for this content
        existing_vote = await db.execute(
            select(ValidationRecord).where(
                ValidationRecord.content_id == content.id,
                ValidationRecord.validator_id == validator.id
            )
        ).scalar_one_or_none()

        if existing_vote:
            logger.warning(f"Validator {validator_uuid} already voted for content {content_uuid}.")
            raise ValueError("Validator has already submitted a vote for this content.")

        # Simulate content verification algorithms (simplified)
        # In a real system, these would be complex ML models or external APIs
        if is_plagiarized and bias_score > config.bias_detection_threshold:
            logger.warning(f"Validator {validator_uuid} flagged content {content_uuid} as plagiarized and biased.")
        
        new_record = ValidationRecord(
            content_id=content.id,
            validator_id=validator.id,
            is_accurate=is_accurate,
            is_plagiarized=is_plagiarized,
            bias_score=bias_score,
            comments=comments
        )
        db.add(new_record)
        await db.commit()
        await db.refresh(new_record)
        
        logger.info(f"Vote submitted for content {content_uuid} by validator {validator_uuid}.")
        
        # Check if enough votes are in to trigger consensus evaluation
        num_votes = await db.execute(
            select(func.count(ValidationRecord.id)).where(ValidationRecord.content_id == content.id)
        )
        current_votes_count = num_votes.scalar_one()

        if current_votes_count >= config.min_validators_per_content:
            logger.info(f"Enough votes for content {content_uuid}, triggering consensus evaluation.")
            await self.evaluate_content_and_update_status(db, content.id)
        
        return new_record

    async def evaluate_content_and_update_status(self, db: AsyncSession, content_db_id: int):
        """Evaluates consensus and updates content status."""
        content = await db.execute(select(Content).where(Content.id == content_db_id)).scalar_one_or_none()
        if not content:
            logger.error(f"Content with ID {content_db_id} not found for evaluation.")
            return

        is_approved, consensus_score = await self.consensus_mechanism.evaluate_content_consensus(db, content_db_id)

        content.approved_by_consensus = is_approved
        content.consensus_score = consensus_score
        content.validation_status = 'APPROVED' if is_approved else 'REJECTED'
        content.validated_at = datetime.datetime.now(datetime.timezone.utc)
        
        await db.commit()
        await db.refresh(content)
        logger.info(f"Content {content.content_id} final status: {content.validation_status} (Score: {consensus_score:.2f}%)")

    async def submit_content_dispute(
        self, 
        db: AsyncSession, 
        content_uuid: str, 
        disputer_id: str, 
        reason: str
    ) -> ContentDispute:
        """Allows a user or validator to dispute content validation."""
        content = await db.execute(select(Content).where(Content.content_id == content_uuid)).scalar_one_or_none()
        if not content:
            raise ValueError(f"Content with UUID {content_uuid} not found for dispute.")

        new_dispute = ContentDispute(
            content_id=content.id,
            disputer_id=disputer_id,
            reason=reason,
            status='OPEN'
        )
        db.add(new_dispute)
        await db.commit()
        await db.refresh(new_dispute)
        
        # Update content status to disputed
        content.validation_status = 'DISPUTED'
        await db.commit()
        
        logger.info(f"Dispute submitted for content {content_uuid} by {disputer_id}.")
        return new_dispute

    async def resolve_content_dispute(
        self, 
        db: AsyncSession, 
        dispute_id: int, 
        new_status: str, 
        resolved_by: str
    ) -> Optional[ContentDispute]:
        """Resolves a content dispute."""
        dispute = await db.execute(select(ContentDispute).where(ContentDispute.id == dispute_id)).scalar_one_or_none()
        if not dispute:
            raise ValueError(f"Dispute with ID {dispute_id} not found.")

        dispute.status = new_status
        dispute.resolved_by = resolved_by
        dispute.resolved_at = datetime.datetime.now(datetime.timezone.utc)
        await db.commit()
        await db.refresh(dispute)
        
        logger.info(f"Dispute {dispute_id} resolved to {new_status} by {resolved_by}.")
        return dispute

    async def get_content_by_status(self, db: AsyncSession, status: str) -> List[Content]:
        """Retrieves content by its validation status."""
        stmt = select(Content).where(Content.validation_status == status)
        result = await db.execute(stmt)
        return result.scalars().all()

    async def get_content_details(self, db: AsyncSession, content_uuid: str) -> Optional[Content]:
        """Retrieves full details of a content item."""
        stmt = select(Content).where(Content.content_id == content_uuid)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
