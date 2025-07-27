import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.models import Content, Validator, ValidationRecord
from core.reputation_service import ReputationService
from core.consensus_mechanism import ConsensusMechanism
from config import config

@pytest.fixture
def mock_reputation_service():
    mock = AsyncMock(spec=ReputationService)
    mock.update_reputation.side_effect = lambda db, validator_id, voted_with_consensus, is_malicious_flag: config.initial_reputation + (config.reputation_gain_on_correct_vote if voted_with_consensus else -config.reputation_loss_on_incorrect_vote)
    return mock

@pytest.fixture
def consensus_mechanism(mock_reputation_service):
    return ConsensusMechanism(mock_reputation_service)

@pytest.mark.asyncio
async def test_evaluate_content_consensus_approved(db_session: AsyncSession, consensus_mechanism: ConsensusMechanism, mock_reputation_service):
    # Create content
    content = Content(content_id="test_content_1", title="Test", text="Test content")
    db_session.add(content)
    await db_session.commit()
    await db_session.refresh(content)

    # Create validators
    v1 = Validator(validator_id="v1", name="Validator 1")
    v2 = Validator(validator_id="v2", name="Validator 2")
    v3 = Validator(validator_id="v3", name="Validator 3")
    db_session.add_all([v1, v2, v3])
    await db_session.commit()
    await db_session.refresh(v1)
    await db_session.refresh(v2)
    await db_session.refresh(v3)

    # Submit votes (2 accurate, 1 inaccurate)
    rec1 = ValidationRecord(content_id=content.id, validator_id=v1.id, is_accurate=True, is_plagiarized=False, bias_score=0.1, comments="Good")
    rec2 = ValidationRecord(content_id=content.id, validator_id=v2.id, is_accurate=True, is_plagiarized=False, bias_score=0.2, comments="OK")
    rec3 = ValidationRecord(content_id=content.id, validator_id=v3.id, is_accurate=False, is_plagiarized=True, bias_score=0.8, comments="Bad")
    db_session.add_all([rec1, rec2, rec3])
    await db_session.commit()
    await db_session.refresh(rec1)
    await db_session.refresh(rec2)
    await db_session.refresh(rec3)

    # Link records to validators for reputation update
    rec1.validator = v1
    rec2.validator = v2
    rec3.validator = v3

    is_approved, consensus_score = await consensus_mechanism.evaluate_content_consensus(db_session, content.id)

    assert is_approved is True # 2/3 = 66.6% which is < 75%, so this should be False by default config.
    # Let's adjust config.consensus_threshold_percent for this test or ensure 2/3 passes.
    # For 2/3 to be approved, threshold must be <= 66.6%
    original_threshold = config.consensus_threshold_percent
    config.consensus_threshold_percent = 0.6 # Temporarily set to 60% for this test
    
    is_approved, consensus_score = await consensus_mechanism.evaluate_content_consensus(db_session, content.id)
    assert is_approved is True
    assert pytest.approx(consensus_score, 0.01) == (2/3) * 100

    # Verify reputation updates
    assert mock_reputation_service.update_reputation.call_count == 3
    # v1 and v2 voted with consensus (True), v3 voted against (False)
    mock_reputation_service.update_reputation.assert_any_call(db_session, "v1", True, False)
    mock_reputation_service.update_reputation.assert_any_call(db_session, "v2", True, False)
    mock_reputation_service.update_reputation.assert_any_call(db_session, "v3", False, False)

    # Restore original threshold
    config.consensus_threshold_percent = original_threshold

@pytest.mark.asyncio
async def test_evaluate_content_consensus_rejected(db_session: AsyncSession, consensus_mechanism: ConsensusMechanism, mock_reputation_service):
    # Create content
    content = Content(content_id="test_content_2", title="Test 2", text="Test content 2")
    db_session.add(content)
    await db_session.commit()
    await db_session.refresh(content)

    # Create validators
    v4 = Validator(validator_id="v4", name="Validator 4")
    v5 = Validator(validator_id="v5", name="Validator 5")
    v6 = Validator(validator_id="v6", name="Validator 6")
    db_session.add_all([v4, v5, v6])
    await db_session.commit()
    await db_session.refresh(v4)
    await db_session.refresh(v5)
    await db_session.refresh(v6)

    # Submit votes (1 accurate, 2 inaccurate)
    rec4 = ValidationRecord(content_id=content.id, validator_id=v4.id, is_accurate=True, is_plagiarized=False, bias_score=0.1)
    rec5 = ValidationRecord(content_id=content.id, validator_id=v5.id, is_accurate=False, is_plagiarized=False, bias_score=0.7)
    rec6 = ValidationRecord(content_id=content.id, validator_id=v6.id, is_accurate=False, is_plagiarized=True, bias_score=0.9)
    db_session.add_all([rec4, rec5, rec6])
    await db_session.commit()
    await db_session.refresh(rec4)
    await db_session.refresh(rec5)
    await db_session.refresh(rec6)

    # Link records to validators for reputation update
    rec4.validator = v4
    rec5.validator = v5
    rec6.validator = v6

    is_approved, consensus_score = await consensus_mechanism.evaluate_content_consensus(db_session, content.id)

    assert is_approved is False
    assert pytest.approx(consensus_score, 0.01) == (1/3) * 100

    # Verify reputation updates
    assert mock_reputation_service.update_reputation.call_count == 6 # 3 from previous test + 3 from this
    # v4 voted with consensus (False), v5 and v6 voted with consensus (False)
    mock_reputation_service.update_reputation.assert_any_call(db_session, "v4", False, False)
    mock_reputation_service.update_reputation.assert_any_call(db_session, "v5", True, False)
    mock_reputation_service.update_reputation.assert_any_call(db_session, "v6", True, False)

@pytest.mark.asyncio
async def test_evaluate_content_consensus_no_records(db_session: AsyncSession, consensus_mechanism: ConsensusMechanism):
    # Create content
    content = Content(content_id="test_content_3", title="Test 3", text="Test content 3")
    db_session.add(content)
    await db_session.commit()
    await db_session.refresh(content)

    is_approved, consensus_score = await consensus_mechanism.evaluate_content_consensus(db_session, content.id)

    assert is_approved is False
    assert consensus_score == 0.0
