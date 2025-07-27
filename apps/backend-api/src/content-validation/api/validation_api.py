from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import datetime
import structlog

from database.database import get_db, get_redis_client
from sqlalchemy.ext.asyncio import AsyncSession
from core.reputation_service import ReputationService
from core.consensus_mechanism import ConsensusMechanism
from core.validation_service import ValidationService
from core.content_model import (
    ContentSubmission, ContentResponse, 
    ValidatorRegistration, ValidatorResponse,
    ValidationVote, ValidationRecordResponse,
    ContentDisputeSubmission, ContentDisputeResponse
)
from database.models import Content, Validator, ValidationRecord, ContentDispute

logger = structlog.get_logger(__name__)

router = APIRouter()

# Dependency injection for services
async def get_reputation_service():
    return ReputationService()

async def get_consensus_mechanism(reputation_service: ReputationService = Depends(get_reputation_service)):
    return ConsensusMechanism(reputation_service)

async def get_validation_service(
    reputation_service: ReputationService = Depends(get_reputation_service),
    consensus_mechanism: ConsensusMechanism = Depends(get_consensus_mechanism)
):
    return ValidationService(reputation_service, consensus_mechanism)

# --- Content Endpoints ---
@router.post("/v1/content/submit", response_model=ContentResponse, status_code=status.HTTP_201_CREATED, summary="Submit new content for validation")
async def submit_content(
    content_data: ContentSubmission,
    db: AsyncSession = Depends(get_db),
    validation_service: ValidationService = Depends(get_validation_service)
):
    content = await validation_service.submit_content_for_validation(
        db,
        title=content_data.title,
        text=content_data.text,
        source_url=content_data.source_url,
        author_id=content_data.author_id
    )
    # Immediately assign to validators (or this could be a background task)
    await validation_service.assign_content_to_validators(db, content.id)
    return content

@router.get("/v1/content/{content_uuid}", response_model=ContentResponse, summary="Get content details by UUID")
async def get_content_details(
    content_uuid: str,
    db: AsyncSession = Depends(get_db),
    validation_service: ValidationService = Depends(get_validation_service)
):
    content = await validation_service.get_content_details(db, content_uuid)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    return content

@router.get("/v1/content", response_model=List[ContentResponse], summary="Get content by validation status")
async def get_content_by_status(
    status: str = "PENDING",
    db: AsyncSession = Depends(get_db),
    validation_service: ValidationService = Depends(get_validation_service)
):
    content_list = await validation_service.get_content_by_status(db, status)
    return content_list

# --- Validator Endpoints ---
@router.post("/v1/validators/register", response_model=ValidatorResponse, status_code=status.HTTP_201_CREATED, summary="Register a new validator node")
async def register_validator(
    validator_data: ValidatorRegistration,
    db: AsyncSession = Depends(get_db),
    reputation_service: ReputationService = Depends(get_reputation_service)
):
    try:
        validator = await reputation_service.register_validator(
            db,
            validator_id=validator_data.validator_id,
            name=validator_data.name,
            organization=validator_data.organization,
            specialties=validator_data.specialties
        )
        return validator
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/v1/validators/{validator_id}/reputation", summary="Get validator reputation score")
async def get_validator_reputation(
    validator_id: str,
    db: AsyncSession = Depends(get_db),
    reputation_service: ReputationService = Depends(get_reputation_service)
):
    reputation = await reputation_service.get_validator_reputation(db, validator_id)
    if reputation is None:
        raise HTTPException(status_code=404, detail="Validator not found")
    return {"validator_id": validator_id, "reputation_score": reputation}

@router.get("/v1/validators", response_model=List[ValidatorResponse], summary="Get all registered validators")
async def get_all_validators(
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Validator))
    validators = result.scalars().all()
    return validators

# --- Validation Vote Endpoints ---
@router.post("/v1/validation/vote", response_model=ValidationRecordResponse, status_code=status.HTTP_201_CREATED, summary="Submit a validation vote for content")
async def submit_validation_vote(
    vote_data: ValidationVote,
    db: AsyncSession = Depends(get_db),
    validation_service: ValidationService = Depends(get_validation_service)
):
    try:
        record = await validation_service.submit_validation_vote(
            db,
            content_uuid=vote_data.content_id,
            validator_uuid=vote_data.validator_id,
            is_accurate=vote_data.is_accurate,
            is_plagiarized=vote_data.is_plagiarized,
            bias_score=vote_data.bias_score,
            comments=vote_data.comments
        )
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/v1/validation/records/{content_uuid}", response_model=List[ValidationRecordResponse], summary="Get all validation records for a content item")
async def get_validation_records_for_content(
    content_uuid: str,
    db: AsyncSession = Depends(get_db)
):
    content = await db.execute(select(Content).where(Content.content_id == content_uuid)).scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    result = await db.execute(select(ValidationRecord).where(ValidationRecord.content_id == content.id))
    records = result.scalars().all()
    return records

# --- Dispute Endpoints ---
@router.post("/v1/disputes/submit", response_model=ContentDisputeResponse, status_code=status.HTTP_201_CREATED, summary="Submit a dispute for content validation")
async def submit_dispute(
    dispute_data: ContentDisputeSubmission,
    db: AsyncSession = Depends(get_db),
    validation_service: ValidationService = Depends(get_validation_service)
):
    try:
        dispute = await validation_service.submit_content_dispute(
            db,
            content_uuid=dispute_data.content_id,
            disputer_id=dispute_data.disputer_id,
            reason=dispute_data.reason
        )
        return dispute
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/v1/disputes/{dispute_id}/resolve", response_model=ContentDisputeResponse, summary="Resolve a content dispute")
async def resolve_dispute(
    dispute_id: int,
    new_status: str,
    resolved_by: str,
    db: AsyncSession = Depends(get_db),
    validation_service: ValidationService = Depends(get_validation_service)
):
    try:
        dispute = await validation_service.resolve_content_dispute(
            db, dispute_id, new_status, resolved_by
        )
        if not dispute:
            raise HTTPException(status_code=404, detail="Dispute not found")
        return dispute
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/v1/disputes", response_model=List[ContentDisputeResponse], summary="Get all content disputes")
async def get_all_disputes(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    query = select(ContentDispute)
    if status:
        query = query.where(ContentDispute.status == status)
    result = await db.execute(query)
    disputes = result.scalars().all()
    return disputes
