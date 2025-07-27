from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import datetime

# --- Request/Response Models ---

class ContentSubmission(BaseModel):
    title: str
    text: str
    source_url: Optional[str] = None
    author_id: Optional[str] = None

class ContentResponse(ContentSubmission):
    id: int
    content_id: str
    submitted_at: datetime.datetime
    validation_status: str
    approved_by_consensus: bool
    consensus_score: float
    validated_at: Optional[datetime.datetime]

    class Config:
        orm_mode = True

class ValidatorRegistration(BaseModel):
    validator_id: str
    name: str
    organization: Optional[str] = None
    specialties: Optional[List[str]] = None

class ValidatorResponse(ValidatorRegistration):
    id: int
    reputation_score: float
    is_active: bool
    last_seen: datetime.datetime
    registered_at: datetime.datetime

    class Config:
        orm_mode = True

class ValidationVote(BaseModel):
    content_id: str # The UUID of the content
    validator_id: str # The UUID of the validator
    is_accurate: bool
    is_plagiarized: bool
    bias_score: float # 0.0 (neutral) to 1.0 (highly biased)
    comments: Optional[str] = None

class ValidationRecordResponse(ValidationVote):
    id: int
    submitted_at: datetime.datetime
    voted_with_consensus: Optional[bool]
    reputation_change: Optional[float]

    class Config:
        orm_mode = True

class ContentDisputeSubmission(BaseModel):
    content_id: str # The UUID of the content
    disputer_id: str # User ID or Validator ID
    reason: str

class ContentDisputeResponse(ContentDisputeSubmission):
    id: int
    submitted_at: datetime.datetime
    status: str
    resolved_by: Optional[str]
    resolved_at: Optional[datetime.datetime]

    class Config:
        orm_mode = True
