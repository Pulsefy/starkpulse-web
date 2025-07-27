from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import datetime

Base = declarative_base()

class Content(Base):
    __tablename__ = 'contents'
    
    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(String, unique=True, index=True, nullable=False) # UUID for content
    title = Column(String, nullable=False)
    text = Column(Text, nullable=False)
    source_url = Column(String)
    author_id = Column(String, index=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Validation status
    validation_status = Column(String, default='PENDING') # PENDING, IN_REVIEW, APPROVED, REJECTED, DISPUTED
    approved_by_consensus = Column(Boolean, default=False)
    consensus_score = Column(Float, default=0.0) # Percentage of validators who approved
    validated_at = Column(DateTime(timezone=True))

    validation_records = relationship("ValidationRecord", back_populates="content")

class Validator(Base):
    __tablename__ = 'validators'
    
    id = Column(Integer, primary_key=True, index=True)
    validator_id = Column(String, unique=True, index=True, nullable=False) # Unique ID for the validator node
    name = Column(String, nullable=False)
    reputation_score = Column(Float, default=100.0)
    is_active = Column(Boolean, default=True)
    last_seen = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    registered_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # For conflict of interest (simplified)
    organization = Column(String)
    specialties = Column(JSON) # e.g., ["finance", "politics"]

    validation_records = relationship("ValidationRecord", back_populates="validator")

class ValidationRecord(Base):
    __tablename__ = 'validation_records'
    
    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey('contents.id'), nullable=False)
    validator_id = Column(Integer, ForeignKey('validators.id'), nullable=False)
    
    # Validator's assessment
    is_accurate = Column(Boolean, nullable=False) # True if validator believes content is accurate
    is_plagiarized = Column(Boolean, nullable=False)
    bias_score = Column(Float, nullable=False) # 0.0 (neutral) to 1.0 (highly biased)
    comments = Column(Text)
    
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Outcome of this specific vote in relation to final consensus
    voted_with_consensus = Column(Boolean)
    reputation_change = Column(Float)

    content = relationship("Content", back_populates="validation_records")
    validator = relationship("Validator", back_populates="validation_records")

class ContentDispute(Base):
    __tablename__ = 'content_disputes'
    
    id = Column(Integer, primary_key=True, index=True)
    content_id = Column(Integer, ForeignKey('contents.id'), nullable=False)
    disputer_id = Column(String, nullable=False) # User ID or Validator ID
    reason = Column(Text, nullable=False)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status = Column(String, default='OPEN') # OPEN, UNDER_REVIEW, RESOLVED
    resolved_by = Column(String)
    resolved_at = Column(DateTime(timezone=True))

    content = relationship("Content")
