import pytest
import asyncio
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from core.compliance_service import ComplianceService, RiskAssessment
from core.audit_service import AuditService
from database.models import ComplianceRule, ComplianceViolation, SanctionsList

@pytest.fixture
async def mock_db_session():
    """Mock database session"""
    session = AsyncMock(spec=AsyncSession)
    session.add = MagicMock()
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    session.execute = AsyncMock()
    return session

@pytest.fixture
def mock_audit_service():
    """Mock audit service"""
    audit_service = AsyncMock(spec=AuditService)
    audit_service.log_activity = AsyncMock()
    return audit_service

@pytest.fixture
def compliance_service(mock_db_session, mock_audit_service):
    """Create compliance service instance"""
    return ComplianceService(mock_db_session, mock_audit_service)

@pytest.mark.asyncio
async def test_create_compliance_rule(compliance_service, mock_db_session, mock_audit_service):
    """Test creating a compliance rule"""
    rule_id = await compliance_service.create_compliance_rule(
        name="Test AML Rule",
        description="Test rule for AML compliance",
        rule_type="AML",
        jurisdiction="US",
        conditions={"amount_threshold": 10000},
        actions={"alert": True, "block": False},
        severity="HIGH",
        created_by="admin"
    )
    
    # Verify database operations
    assert mock_db_session.add.called
    assert mock_db_session.commit.called
    assert mock_audit_service.log_activity.called
    assert rule_id is not None

@pytest.mark.asyncio
async def test_aml_compliance_check_low_risk(compliance_service, mock_db_session):
    """Test AML compliance check with low risk transaction"""
    transaction_data = {
        "amount": 5000,
        "daily_transaction_count": 3,
        "country": "US",
        "is_round_amount": False,
        "rapid_movement": False
    }
    
    assessment = await compliance_service.check_aml_compliance(
        entity_type="USER",
        entity_id="user123",
        transaction_data=transaction_data
    )
    
    # Verify low risk assessment
    assert isinstance(assessment, RiskAssessment)
    assert assessment.entity_id == "user123"
    assert assessment.entity_type == "USER"
    assert assessment.risk_score &lt; 0.7  # Below threshold
    assert len(assessment.risk_factors) >= 0

@pytest.mark.asyncio
async def test_aml_compliance_check_high_risk(compliance_service, mock_db_session):
    """Test AML compliance check with high risk transaction"""
    transaction_data = {
        "amount": 15000,  # Large amount
        "daily_transaction_count": 15,  # High frequency
        "country": "AF",  # High-risk country
        "is_round_amount": True,
        "rapid_movement": True
    }
    
    # Mock rule query for violation creation
    mock_rule = MagicMock()
    mock_rule.id = "rule123"
    mock_rule.severity = "HIGH"
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_rule
    mock_db_session.execute.return_value = mock_result
    
    assessment = await compliance_service.check_aml_compliance(
        entity_type="USER",
        entity_id="user123",
        transaction_data=transaction_data
    )
    
    # Verify high risk assessment
    assert assessment.risk_score >= 0.7  # Above threshold
    assert "LARGE_TRANSACTION" in assessment.risk_factors
    assert "HIGH_FREQUENCY" in assessment.risk_factors
    assert "HIGH_RISK_GEOGRAPHY" in assessment.risk_factors
    assert len(assessment.recommendations) > 0

@pytest.mark.asyncio
async def test_sanctions_compliance_check_no_match(compliance_service, mock_db_session):
    """Test sanctions check with no matches"""
    entity_data = {
        "id": "entity123",
        "name": "John Smith",
        "aliases": [],
        "addresses": [],
        "identifiers": {}
    }
    
    # Mock empty sanctions list
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db_session.execute.return_value = mock_result
    
    result = await compliance_service.check_sanctions_compliance(
        entity_type="INDIVIDUAL",
        entity_data=entity_data
    )
    
    # Verify no sanctions match
    assert result['is_sanctioned'] == False
    assert len(result['matches']) == 0
    assert result['total_lists_checked'] == 0

@pytest.mark.asyncio
async def test_sanctions_compliance_check_with_match(compliance_service, mock_db_session):
    """Test sanctions check with match found"""
    entity_data = {
        "id": "entity123",
        "name": "John Doe",
        "aliases": ["Johnny Doe"],
        "addresses": [{"street": "123 Main St", "city": "Anytown"}],
        "identifiers": {"passport": "P123456"}
    }
    
    # Mock sanctions entry
    mock_sanctions_entry = MagicMock()
    mock_sanctions_entry.id = "sanction123"
    mock_sanctions_entry.name = "John Doe"
    mock_sanctions_entry.list_name = "OFAC SDN"
    mock_sanctions_entry.source = "OFAC"
    mock_sanctions_entry.aliases = ["Johnny Doe"]
    mock_sanctions_entry.addresses = [{"street": "123 Main St", "city": "Anytown"}]
    mock_sanctions_entry.identifiers = {"passport": "P123456"}
    mock_sanctions_entry.is_active = True
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_sanctions_entry]
    mock_db_session.execute.return_value = mock_result
    
    # Mock rule for violation creation
    mock_rule = MagicMock()
    mock_rule.id = "rule123"
    mock_rule.severity = "CRITICAL"
    mock_rule_result = MagicMock()
    mock_rule_result.scalar_one_or_none.return_value = mock_rule
    mock_db_session.execute.side_effect = [mock_result, mock_rule_result]
    
    result = await compliance_service.check_sanctions_compliance(
        entity_type="INDIVIDUAL",
        entity_data=entity_data
    )
    
    # Verify sanctions match
    assert result['is_sanctioned'] == True
    assert len(result['matches']) > 0
    assert result['matches'][0]['list_name'] == "OFAC SDN"

@pytest.mark.asyncio
async def test_transaction_pattern_monitoring_structuring(compliance_service, mock_db_session):
    """Test transaction pattern monitoring for structuring"""
    transactions = [
        {"amount": 9500, "timestamp": 1640995200, "country": "US"},
        {"amount": 9800, "timestamp": 1640995300, "country": "US"},
        {"amount": 9200, "timestamp": 1640995400, "country": "US"},
        {"amount": 9900, "timestamp": 1640995500, "country": "US"}
    ]
    
    # Mock rule for violation creation
    mock_rule = MagicMock()
    mock_rule.id = "rule123"
    mock_rule.severity = "HIGH"
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_rule
    mock_db_session.execute.return_value = mock_result
    
    result = await compliance_service.monitor_transaction_patterns(
        user_id="user123",
        transactions=transactions
    )
    
    # Verify structuring detection
    assert "STRUCTURING" in result['suspicious_patterns']
    assert result['risk_score'] >= 0.6
    assert "File Suspicious Activity Report (SAR)" in result['recommendations']

@pytest.mark.asyncio
async def test_get_compliance_violations(compliance_service, mock_db_session):
    """Test getting compliance violations"""
    # Mock violation
    mock_violation = MagicMock()
    mock_violation.id = "violation123"
    mock_violation.rule_id = "rule123"
    mock_violation.entity_type = "USER"
    mock_violation.entity_id = "user123"
    mock_violation.violation_data = {"risk_score": 0.8}
    mock_violation.risk_score = 0.8
    mock_violation.status = "OPEN"
    mock_violation.detected_at = datetime.now(timezone.utc)
    mock_violation.resolution_notes = None
    mock_violation.resolved_by = None
    mock_violation.resolved_at = None
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_violation]
    mock_db_session.execute.return_value = mock_result
    
    violations = await compliance_service.get_compliance_violations(
        status="OPEN",
        limit=10
    )
    
    # Verify violations data
    assert len(violations) == 1
    assert violations[0]['id'] == "violation123"
    assert violations[0]['status'] == "OPEN"
    assert violations[0]['entity_type'] == "USER"

@pytest.mark.asyncio
async def test_resolve_violation(compliance_service, mock_db_session, mock_audit_service):
    """Test resolving a compliance violation"""
    # Mock violation
    mock_violation = MagicMock()
    mock_violation.id = "violation123"
    mock_violation.status = "OPEN"
    
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_violation
    mock_db_session.execute.return_value = mock_result
    
    success = await compliance_service.resolve_violation(
        violation_id="violation123",
        resolution_notes="False positive - verified legitimate transaction",
        resolved_by="analyst123",
        status="RESOLVED"
    )
    
    # Verify resolution
    assert success == True
    assert mock_violation.status == "RESOLVED"
    assert mock_violation.resolution_notes == "False positive - verified legitimate transaction"
    assert mock_violation.resolved_by == "analyst123"
    assert mock_db_session.commit.called
    assert mock_audit_service.log_activity.called

@pytest.mark.asyncio
async def test_resolve_violation_not_found(compliance_service, mock_db_session):
    """Test resolving a non-existent violation"""
    # Mock no violation found
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result
    
    with pytest.raises(ValueError) as exc_info:
        await compliance_service.resolve_violation(
            violation_id="nonexistent",
            resolution_notes="Test",
            resolved_by="analyst123"
        )
    
    assert "not found" in str(exc_info.value)

@pytest.mark.asyncio
async def test_fuzzy_match_exact(compliance_service):
    """Test fuzzy matching with exact match"""
    result = compliance_service._fuzzy_match("John Doe", "John Doe")
    assert result == True

@pytest.mark.asyncio
async def test_fuzzy_match_similar(compliance_service):
    """Test fuzzy matching with similar strings"""
    result = compliance_service._fuzzy_match("John Doe", "Jon Doe")
    assert result == True  # Should match due to similarity

@pytest.mark.asyncio
async def test_fuzzy_match_different(compliance_service):
    """Test fuzzy matching with different strings"""
    result = compliance_service._fuzzy_match("John Doe", "Jane Smith")
    assert result == False

@pytest.mark.asyncio
async def test_address_match(compliance_service):
    """Test address matching"""
    addr1 = {"street": "123 Main Street", "city": "New York"}
    addr2 = {"street": "123 Main St", "city": "New York"}
    
    result = compliance_service._address_match(addr1, addr2)
    assert result == True
