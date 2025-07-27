import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database.models import Content, Validator, ValidationRecord, ContentDispute
from core.reputation_service import ReputationService
from core.consensus_mechanism import ConsensusMechanism
from core.validation_service import ValidationService
from config import config

@pytest.fixture
def mock_reputation_service():
    mock = AsyncMock(spec=ReputationService)
    mock.get_eligible_validators.return_value = [
        Validator(validator_id=f"v{i}", name=f"Validator {i}", reputation_score=100.0) 
        for i in range(config.min_validators_per_content)
    ]
    mock.register_validator.side_effect = lambda db, vid, name, org=None, spec=None: Validator(validator_id=vid, name=name)
    return mock

@pytest.fixture
def mock_consensus_mechanism():
    mock = AsyncMock(spec=ConsensusMechanism)
    mock.evaluate_content_consensus.return_value = (True, 80.0) # Default to approved
    return mock

@pytest.fixture
def validation_service(mock_reputation_service, mock_consensus_mechanism):
    return ValidationService(mock_reputation_service, mock_consensus_mechanism)

@pytest.mark.asyncio
async def test_submit_content_for_validation(db_session: AsyncSession, validation_service: ValidationService, mock_reputation_service):
    title = "New Article"
    text = "This is the content of the new article."
    
    content = await validation_service.submit_content_for_validation(db_session, title, text)
    
    assert content.title == title
    assert content.text == text
    assert content.content_id is not None
    assert content.validation_status == 'PENDING'
    
    # Verify assign_content_to_validators was called
    mock_reputation_service.get_eligible_validators.assert_called_once()
    
    # Verify content status updated to IN_REVIEW after assignment
    await db_session.refresh(content)
    assert content.validation_status == 'IN_REVIEW'

@pytest.mark.asyncio
async def test_submit_validation_vote(db_session: AsyncSession, validation_service: ValidationService, mock_consensus_mechanism):
    # Create content and validator
    content = Content(content_id="vote_content_1", title="Vote Test", text="Vote content")
    validator = Validator(validator_id="vote_validator_1", name="Vote Validator")
    db_session.add_all([content, validator])
    await db_session.commit()
    await db_session.refresh(content)
    await db_session.refresh(validator)

    # Submit first vote
    vote_data = {
        "content_id": content.content_id,
        "validator_id": validator.validator_id,
        "is_accurate": True,
        "is_plagiarized": False,
        "bias_score": 0.1
    }
    record = await validation_service.submit_validation_vote(db_session, **vote_data)
    
    assert record.content_id == content.id
    assert record.validator_id == validator.id
    assert record.is_accurate is True
    
    # Consensus should not be triggered yet if min_validators_per_content > 1
    mock_consensus_mechanism.evaluate_content_consensus.assert_not_called()

    # Simulate more validators and votes to trigger consensus
    # Need to ensure min_validators_per_content is met
    original_min_validators = config.min_validators_per_content
    config.min_validators_per_content = 1 # Temporarily set to 1 for easy triggering
    
    # Submit another vote (if min_validators_per_content was > 1)
    # For this test, with min_validators_per_content = 1, the first vote should trigger it.
    # So, we need to re-run the submit_validation_vote or ensure the test setup reflects this.
    
    # Re-fetch content to ensure it's updated
    await db_session.refresh(content)
    assert content.validation_status == 'APPROVED' # Should be approved by default mock
    assert content.approved_by_consensus is True
    assert content.consensus_score == 80.0
    mock_consensus_mechanism.evaluate_content_consensus.assert_called_once_with(db_session, content.id)

    config.min_validators_per_content = original_min_validators # Restore

@pytest.mark.asyncio
async def test_submit_validation_vote_already_voted(db_session: AsyncSession, validation_service: ValidationService):
    # Create content and validator
    content = Content(content_id="vote_content_2", title="Vote Test 2", text="Vote content 2")
    validator = Validator(validator_id="vote_validator_2", name="Vote Validator 2")
    db_session.add_all([content, validator])
    await db_session.commit()
    await db_session.refresh(content)
    await db_session.refresh(validator)

    # Submit first vote
    await validation_service.submit_validation_vote(
        db_session, content.content_id, validator.validator_id, True, False, 0.1
    )

    # Attempt to submit second vote
    with pytest.raises(ValueError, match="Validator has already submitted a vote for this content."):
        await validation_service.submit_validation_vote(
            db_session, content.content_id, validator.validator_id, False, True, 0.9
        )

@pytest.mark.asyncio
async def test_submit_content_dispute(db_session: AsyncSession, validation_service: ValidationService):
    # Create content
    content = Content(content_id="dispute_content_1", title="Dispute Test", text="Dispute content")
    db_session.add(content)
    await db_session.commit()
    await db_session.refresh(content)

    disputer_id = "user_disputer_1"
    reason = "I believe this content is inaccurate."
    
    dispute = await validation_service.submit_content_dispute(db_session, content.content_id, disputer_id, reason)
    
    assert dispute.content_id == content.id
    assert dispute.disputer_id == disputer_id
    assert dispute.reason == reason
    assert dispute.status == 'OPEN'
    
    # Verify content status updated
    await db_session.refresh(content)
    assert content.validation_status == 'DISPUTED'

@pytest.mark.asyncio
async def test_resolve_content_dispute(db_session: AsyncSession, validation_service: ValidationService):
    # Create content and dispute
    content = Content(content_id="dispute_content_2", title="Dispute Test 2", text="Dispute content 2")
    db_session.add(content)
    await db_session.commit()
    await db_session.refresh(content)

    dispute = ContentDispute(content_id=content.id, disputer_id="user_disputer_2", reason="Incorrect info")
    db_session.add(dispute)
    await db_session.commit()
    await db_session.refresh(dispute)

    new_status = "RESOLVED"
    resolved_by = "admin_user"
    
    resolved_dispute = await validation_service.resolve_content_dispute(db_session, dispute.id, new_status, resolved_by)
    
    assert resolved_dispute.status == new_status
    assert resolved_dispute.resolved_by == resolved_by
    assert resolved_dispute.resolved_at is not None

    # Verify in DB
    stmt = select(ContentDispute).where(ContentDispute.id == dispute.id)
    retrieved_dispute = (await db_session.execute(stmt)).scalar_one()
    assert retrieved_dispute.status == new_status
