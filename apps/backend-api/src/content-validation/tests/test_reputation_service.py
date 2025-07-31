import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.models import Validator
from core.reputation_service import ReputationService
from config import config

@pytest.fixture
def reputation_service():
    return ReputationService()

@pytest.mark.asyncio
async def test_register_validator(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "test_validator_1"
    name = "Test Validator One"
    
    validator = await reputation_service.register_validator(db_session, validator_id, name)
    
    assert validator.validator_id == validator_id
    assert validator.name == name
    assert validator.reputation_score == config.initial_reputation
    assert validator.is_active is True
    
    # Verify in DB
    stmt = select(Validator).where(Validator.validator_id == validator_id)
    retrieved_validator = (await db_session.execute(stmt)).scalar_one()
    assert retrieved_validator.name == name

@pytest.mark.asyncio
async def test_register_validator_already_exists(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "existing_validator"
    await reputation_service.register_validator(db_session, validator_id, "Existing Validator")
    await db_session.commit()

    with pytest.raises(ValueError, match="Validator already registered."):
        await reputation_service.register_validator(db_session, validator_id, "Another Name")

@pytest.mark.asyncio
async def test_get_validator_reputation(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "rep_validator_1"
    await reputation_service.register_validator(db_session, validator_id, "Reputation Test")
    await db_session.commit()

    reputation = await reputation_service.get_validator_reputation(db_session, validator_id)
    assert reputation == config.initial_reputation

    # Test for non-existent validator
    reputation_non_existent = await reputation_service.get_validator_reputation(db_session, "non_existent")
    assert reputation_non_existent == config.initial_reputation # Returns initial for not found

@pytest.mark.asyncio
async def test_update_reputation_correct_vote(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "update_validator_1"
    await reputation_service.register_validator(db_session, validator_id, "Update Test")
    await db_session.commit()

    initial_reputation = await reputation_service.get_validator_reputation(db_session, validator_id)
    new_reputation = await reputation_service.update_reputation(db_session, validator_id, voted_with_consensus=True)
    
    assert new_reputation == initial_reputation + config.reputation_gain_on_correct_vote
    assert (await reputation_service.get_validator_reputation(db_session, validator_id)) == new_reputation

@pytest.mark.asyncio
async def test_update_reputation_incorrect_vote(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "update_validator_2"
    await reputation_service.register_validator(db_session, validator_id, "Update Test 2")
    await db_session.commit()

    initial_reputation = await reputation_service.get_validator_reputation(db_session, validator_id)
    new_reputation = await reputation_service.update_reputation(db_session, validator_id, voted_with_consensus=False)
    
    assert new_reputation == initial_reputation - config.reputation_loss_on_incorrect_vote
    assert (await reputation_service.get_validator_reputation(db_session, validator_id)) == new_reputation

@pytest.mark.asyncio
async def test_update_reputation_malicious_activity(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "update_validator_3"
    await reputation_service.register_validator(db_session, validator_id, "Update Test 3")
    await db_session.commit()

    initial_reputation = await reputation_service.get_validator_reputation(db_session, validator_id)
    new_reputation = await reputation_service.update_reputation(db_session, validator_id, voted_with_consensus=False, is_malicious_flag=True)
    
    assert new_reputation == initial_reputation - config.reputation_loss_on_malicious_activity
    assert (await reputation_service.get_validator_reputation(db_session, validator_id)) == new_reputation

@pytest.mark.asyncio
async def test_update_reputation_cannot_go_below_zero(db_session: AsyncSession, reputation_service: ReputationService):
    validator_id = "update_validator_4"
    validator = await reputation_service.register_validator(db_session, validator_id, "Update Test 4")
    validator.reputation_score = 10.0 # Set low initial score
    await db_session.commit()

    new_reputation = await reputation_service.update_reputation(db_session, validator_id, voted_with_consensus=False, is_malicious_flag=True)
    
    assert new_reputation == 0.0
    assert (await reputation_service.get_validator_reputation(db_session, validator_id)) == 0.0

@pytest.mark.asyncio
async def test_get_eligible_validators(db_session: AsyncSession, reputation_service: ReputationService):
    # Create some validators with varying reputations
    await reputation_service.register_validator(db_session, "eligible_1", "Eligible One") # 100
    v2 = await reputation_service.register_validator(db_session, "eligible_2", "Eligible Two")
    v2.reputation_score = config.min_reputation_for_selection + 10
    await db_session.merge(v2)

    v3 = await reputation_service.register_validator(db_session, "ineligible_1", "Ineligible One")
    v3.reputation_score = config.min_reputation_for_selection - 10
    await db_session.merge(v3)

    v4 = await reputation_service.register_validator(db_session, "inactive_1", "Inactive One")
    v4.is_active = False
    await db_session.merge(v4)
    await db_session.commit()

    eligible_validators = await reputation_service.get_eligible_validators(db_session, 10)
    
    assert len(eligible_validators) >= 2 # At least eligible_1 and eligible_2
    assert all(v.reputation_score >= config.min_reputation_for_selection for v in eligible_validators)
    assert all(v.is_active is True for v in eligible_validators)
    assert "ineligible_1" not in [v.validator_id for v in eligible_validators]
    assert "inactive_1" not in [v.validator_id for v in eligible_validators]

    # Test limit
    eligible_validators_limited = await reputation_service.get_eligible_validators(db_session, 1)
    assert len(eligible_validators_limited) == 1
