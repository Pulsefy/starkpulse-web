from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, Float, JSON, Index, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid

Base = declarative_base()

class AuditLog(Base):
    __tablename__ = 'audit_logs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    user_id = Column(String(255), nullable=True)
    session_id = Column(String(255), nullable=True)
    action = Column(String(255), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(255), nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Audit data
    before_data = Column(JSON, nullable=True)
    after_data = Column(JSON, nullable=True)
    metadata = Column(JSON, nullable=True)
    
    # Integrity and security
    hash_value = Column(String(64), nullable=False)
    previous_hash = Column(String(64), nullable=True)
    encrypted_data = Column(Text, nullable=True)
    
    # Compliance flags
    compliance_relevant = Column(Boolean, default=False)
    retention_until = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_audit_timestamp', 'timestamp'),
        Index('idx_audit_user_id', 'user_id'),
        Index('idx_audit_action', 'action'),
        Index('idx_audit_resource', 'resource_type', 'resource_id'),
        Index('idx_audit_compliance', 'compliance_relevant'),
        Index('idx_audit_hash_chain', 'hash_value', 'previous_hash'),
    )

class ComplianceRule(Base):
    __tablename__ = 'compliance_rules'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    rule_type = Column(String(50), nullable=False)  # AML, KYC, SANCTIONS, TRANSACTION
    jurisdiction = Column(String(10), nullable=False)
    
    # Rule configuration
    conditions = Column(JSON, nullable=False)
    actions = Column(JSON, nullable=False)
    severity = Column(String(20), default='MEDIUM')  # LOW, MEDIUM, HIGH, CRITICAL
    
    # Status and lifecycle
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))
    created_by = Column(String(255), nullable=False)
    
    # Relationships
    violations = relationship("ComplianceViolation", back_populates="rule")

class ComplianceViolation(Base):
    __tablename__ = 'compliance_violations'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    rule_id = Column(UUID(as_uuid=True), ForeignKey('compliance_rules.id'), nullable=False)
    
    # Violation details
    entity_type = Column(String(50), nullable=False)  # USER, TRANSACTION, ACCOUNT
    entity_id = Column(String(255), nullable=False)
    violation_data = Column(JSON, nullable=False)
    risk_score = Column(Float, nullable=True)
    
    # Status and resolution
    status = Column(String(20), default='OPEN')  # OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE
    resolution_notes = Column(Text, nullable=True)
    resolved_by = Column(String(255), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    detected_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Relationships
    rule = relationship("ComplianceRule", back_populates="violations")
    
    __table_args__ = (
        Index('idx_violation_rule', 'rule_id'),
        Index('idx_violation_entity', 'entity_type', 'entity_id'),
        Index('idx_violation_status', 'status'),
        Index('idx_violation_detected', 'detected_at'),
    )

class RegulatoryReport(Base):
    __tablename__ = 'regulatory_reports'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    report_type = Column(String(50), nullable=False)  # SAR, CTR, OFAC, GDPR
    jurisdiction = Column(String(10), nullable=False)
    
    # Report details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    
    # Report data and files
    report_data = Column(JSON, nullable=False)
    file_path = Column(String(500), nullable=True)
    file_hash = Column(String(64), nullable=True)
    
    # Status and submission
    status = Column(String(20), default='DRAFT')  # DRAFT, GENERATED, SUBMITTED, ACKNOWLEDGED
    generated_at = Column(DateTime(timezone=True), nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    submitted_by = Column(String(255), nullable=True)
    
    # Metadata
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    created_by = Column(String(255), nullable=False)
    
    __table_args__ = (
        Index('idx_report_type', 'report_type'),
        Index('idx_report_jurisdiction', 'jurisdiction'),
        Index('idx_report_period', 'period_start', 'period_end'),
        Index('idx_report_status', 'status'),
    )

class SanctionsList(Base):
    __tablename__ = 'sanctions_lists'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    list_name = Column(String(100), nullable=False)
    source = Column(String(100), nullable=False)  # OFAC, EU, UN, etc.
    
    # Entity details
    entity_type = Column(String(50), nullable=False)  # INDIVIDUAL, ENTITY, VESSEL
    name = Column(String(500), nullable=False)
    aliases = Column(JSON, nullable=True)
    addresses = Column(JSON, nullable=True)
    identifiers = Column(JSON, nullable=True)  # SSN, Passport, etc.
    
    # List metadata
    list_date = Column(DateTime(timezone=True), nullable=True)
    last_updated = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    is_active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('idx_sanctions_name', 'name'),
        Index('idx_sanctions_source', 'source'),
        Index('idx_sanctions_type', 'entity_type'),
        Index('idx_sanctions_active', 'is_active'),
    )

class WhistleblowerReport(Base):
    __tablename__ = 'whistleblower_reports'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Report details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String(50), nullable=False)  # FRAUD, CORRUPTION, SAFETY, etc.
    severity = Column(String(20), default='MEDIUM')
    
    # Reporter information (optional for anonymous reports)
    reporter_id = Column(String(255), nullable=True)
    reporter_contact = Column(String(255), nullable=True)
    is_anonymous = Column(Boolean, default=True)
    
    # Evidence and attachments
    evidence_data = Column(JSON, nullable=True)
    attachments = Column(JSON, nullable=True)
    
    # Status and investigation
    status = Column(String(20), default='SUBMITTED')  # SUBMITTED, REVIEWING, INVESTIGATING, RESOLVED
    assigned_to = Column(String(255), nullable=True)
    investigation_notes = Column(Text, nullable=True)
    resolution = Column(Text, nullable=True)
    
    # Timestamps
    submitted_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), onupdate=lambda: datetime.now(timezone.utc))
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    
    __table_args__ = (
        Index('idx_whistleblower_status', 'status'),
        Index('idx_whistleblower_category', 'category'),
        Index('idx_whistleblower_submitted', 'submitted_at'),
    )

class ComplianceMetrics(Base):
    __tablename__ = 'compliance_metrics'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    metric_name = Column(String(100), nullable=False)
    metric_type = Column(String(50), nullable=False)  # COUNTER, GAUGE, HISTOGRAM
    
    # Metric data
    value = Column(Float, nullable=False)
    labels = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    
    # Metadata
    source = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    __table_args__ = (
        Index('idx_metrics_name', 'metric_name'),
        Index('idx_metrics_timestamp', 'timestamp'),
        Index('idx_metrics_source', 'source'),
    )
