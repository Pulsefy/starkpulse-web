import datetime
from typing import List, Dict, Any, Tuple
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from database.models import Content, ValidationRecord
from core.reputation_service import ReputationService
from config import config

logger = structlog.get_logger(__name__)

class ConsensusMechanism:
    def __init__(self, reputation_service: ReputationService):
        self.reputation_service = reputation_service
        logger.info("ConsensusMechanism initialized.")

    async def evaluate_content_consensus(self, db: AsyncSession, content_db_id: int) -> Tuple[bool, float]:
        """
        Evaluates the consensus for a given content based on submitted validation records.
        Returns (is_approved, consensus_score).
        """
        stmt = select(ValidationRecord).where(ValidationRecord.content_id == content_db_id)
        result = await db.execute(stmt)
        records = result.scalars().all()

        if not records:
            logger.warning(f"No validation records found for content ID {content_db_id}.")
            return False, 0.0

        total_votes = len(records)
        accurate_votes = sum(1 for r in records if r.is_accurate)
        
        consensus_score = (accurate_votes / total_votes) * 100 if total_votes > 0 else 0.0
        is_approved = consensus_score >= config.consensus_threshold_percent * 100

        logger.info(
            f"Consensus evaluation for content {content_db_id}: "
            f"Total votes: {total_votes}, Accurate votes: {accurate_votes}, "
            f"Consensus score: {consensus_score:.2f}%, Approved: {is_approved}"
        )

        # Update validator reputations based on this consensus
        await self._update_validator_reputations(db, records, is_approved)

        return is_approved, consensus_score

    async def _update_validator_reputations(self, db: AsyncSession, records: List[ValidationRecord], final_approval: bool):
        """
        Updates the reputation of validators based on whether their vote aligned with the final consensus.
        """
        for record in records:
            voted_with_consensus = (record.is_accurate == final_approval)
            
            # For simplicity, we're not implementing complex malicious detection here.
            # A malicious flag could be set if a validator consistently votes against consensus
            # or submits obviously false data.
            is_malicious = False 

            new_reputation = await self.reputation_service.update_reputation(
                db, record.validator.validator_id, voted_with_consensus, is_malicious
            )
            
            # Store the outcome in the validation record
            record.voted_with_consensus = voted_with_consensus
            # Calculate actual reputation change for the record (current - old)
            # This would require fetching old reputation or passing it. For simplicity,
            # we'll just store the new reputation and assume the change is implied.
            # A more robust solution would calculate and store the delta.
            record.reputation_change = new_reputation # Storing new score for simplicity
            
            await db.merge(record) # Merge to update the record
        await db.commit()
        logger.info("Validator reputations updated based on consensus outcome.")
