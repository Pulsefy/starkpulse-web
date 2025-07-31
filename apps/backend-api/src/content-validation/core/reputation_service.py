import datetime
from typing import Dict, Any
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database.models import Validator, ValidationRecord
from config import config

logger = structlog.get_logger(__name__)

class ReputationService:
    def __init__(self):
        logger.info("ReputationService initialized.")

    async def get_validator_reputation(self, db: AsyncSession, validator_id: str) -> float:
        """Retrieves the current reputation score for a validator."""
        stmt = select(Validator.reputation_score).where(Validator.validator_id == validator_id)
        result = await db.execute(stmt)
        reputation = result.scalar_one_or_none()
        if reputation is None:
            logger.warning(f"Validator {validator_id} not found, returning initial reputation.")
            return config.initial_reputation
        return reputation

    async def update_reputation(
        self, 
        db: AsyncSession, 
        validator_id: str, 
        voted_with_consensus: bool, 
        is_malicious_flag: bool = False
    ) -> float:
        """
        Updates a validator's reputation based on their vote outcome.
        Applies slashing for malicious activity.
        """
        stmt = select(Validator).where(Validator.validator_id == validator_id)
        result = await db.execute(stmt)
        validator = result.scalar_one_or_none()

        if not validator:
            logger.error(f"Cannot update reputation: Validator {validator_id} not found.")
            return config.initial_reputation # Or raise error

        reputation_change = 0.0
        if is_malicious_flag:
            reputation_change = -config.reputation_loss_on_malicious_activity
            logger.warning(f"Validator {validator_id} flagged as malicious, slashing reputation by {reputation_change}.")
        elif voted_with_consensus:
            reputation_change = config.reputation_gain_on_correct_vote
            logger.info(f"Validator {validator_id} voted with consensus, gaining reputation by {reputation_change}.")
        else:
            reputation_change = -config.reputation_loss_on_incorrect_vote
            logger.info(f"Validator {validator_id} voted against consensus, losing reputation by {reputation_change}.")

        validator.reputation_score = max(0.0, validator.reputation_score + reputation_change)
        await db.commit()
        await db.refresh(validator)
        
        logger.debug(f"Reputation for {validator_id} updated to {validator.reputation_score} (change: {reputation_change}).")
        return validator.reputation_score

    async def register_validator(
        self, 
        db: AsyncSession, 
        validator_id: str, 
        name: str, 
        organization: str = None, 
        specialties: List[str] = None
    ) -> Validator:
        """Registers a new validator with an initial reputation score."""
        existing_validator = await db.execute(select(Validator).where(Validator.validator_id == validator_id))
        if existing_validator.scalar_one_or_none():
            logger.warning(f"Validator {validator_id} already registered.")
            raise ValueError("Validator already registered.")

        new_validator = Validator(
            validator_id=validator_id,
            name=name,
            reputation_score=config.initial_reputation,
            organization=organization,
            specialties=specialties if specialties is not None else []
        )
        db.add(new_validator)
        await db.commit()
        await db.refresh(new_validator)
        logger.info(f"Validator {validator_id} registered with initial reputation {config.initial_reputation}.")
        return new_validator

    async def get_eligible_validators(self, db: AsyncSession, count: int) -> List[Validator]:
        """
        Selects a specified number of eligible validators based on reputation.
        In a real system, this would involve more complex staking/selection logic.
        """
        stmt = select(Validator).where(
            Validator.is_active == True,
            Validator.reputation_score >= config.min_reputation_for_selection
        ).order_by(Validator.reputation_score.desc()).limit(count)
        
        result = await db.execute(stmt)
        validators = result.scalars().all()
        logger.debug(f"Selected {len(validators)} eligible validators.")
        return validators
