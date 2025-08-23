import pytest
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit_service import AuditService
from database.models import AuditLog

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
def audit_service(mock_db_session):
    """Create audit service instance"""
    return AuditService(mock_db_session)

@pytest.mark.asyncio
async def test_log_activity_success(audit_service, mock_db_session):
    """Test successful activity logging"""
    # Mock the last hash query
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = "previous_hash_123"
    mock_db_session.execute.return_value = mock_result
    
    # Test logging activity
    audit_id = await audit_service.log_activity(
        action="CREATE_USER",
        resource_type="USER",
        user_id="user123",
        resource_id="resource456",
        before_data={"status": "inactive"},
        after_data={"status": "active"},
        metadata={"source": "api"},
        ip_address="192.168.1.1",
        user_agent="TestAgent/1.0",
        session_id="session789",
        compliance_relevant=True
    )
    
    # Verify database operations
    assert mock_db_session.add.called
    assert mock_db_session.commit.called
    assert audit_id is not None

@pytest.mark.asyncio
async def test_log_activity_with_encryption(audit_service, mock_db_session):
    """Test activity logging with encryption enabled"""
    # Enable encryption for this test
    audit_service.cipher_suite = MagicMock()
    audit_service.cipher_suite.encrypt.return_value = b"encrypted_data"
    
    # Mock the last hash query
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result
    
    audit_id = await audit_service.log_activity(
        action="UPDATE_PROFILE",
        resource_type="USER",
        user_id="user123",
        after_data={"email": "new@example.com"}
    )
    
    # Verify encryption was called
    assert audit_service.cipher_suite.encrypt.called
    assert audit_id is not None

@pytest.mark.asyncio
async def test_get_audit_trail_with_filters(audit_service, mock_db_session):
    """Test getting audit trail with filters"""
    # Mock audit logs
    mock_log = MagicMock()
    mock_log.id = "log123"
    mock_log.timestamp = datetime.now(timezone.utc)
    mock_log.user_id = "user123"
    mock_log.action = "CREATE_USER"
    mock_log.resource_type = "USER"
    mock_log.resource_id = "resource456"
    mock_log.before_data = {"status": "inactive"}
    mock_log.after_data = {"status": "active"}
    mock_log.metadata = {"source": "api"}
    mock_log.hash_value = "hash123"
    mock_log.encrypted_data = None
    mock_log.compliance_relevant = True
    mock_log.ip_address = "192.168.1.1"
    mock_log.user_agent = "TestAgent/1.0"
    mock_log.session_id = "session789"
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_log]
    mock_db_session.execute.return_value = mock_result
    
    # Test getting audit trail
    trail = await audit_service.get_audit_trail(
        resource_type="USER",
        user_id="user123",
        limit=10
    )
    
    # Verify results
    assert len(trail) == 1
    assert trail[0]['id'] == "log123"
    assert trail[0]['action'] == "CREATE_USER"
    assert trail[0]['user_id'] == "user123"

@pytest.mark.asyncio
async def test_verify_integrity_valid_chain(audit_service, mock_db_session):
    """Test integrity verification with valid chain"""
    # Mock audit logs with valid hash chain
    mock_logs = []
    for i in range(3):
        log = MagicMock()
        log.id = f"log{i}"
        log.timestamp = datetime.now(timezone.utc) + timedelta(seconds=i)
        log.hash_value = f"hash{i}"
        log.previous_hash = f"hash{i-1}" if i > 0 else None
        log.user_id = "user123"
        log.action = "TEST_ACTION"
        log.resource_type = "TEST"
        log.resource_id = "resource123"
        log.before_data = {}
        log.after_data = {}
        log.metadata = {}
        mock_logs.append(log)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_logs
    mock_db_session.execute.return_value = mock_result
    
    # Mock hash calculation to return expected values
    audit_service._calculate_hash = MagicMock(side_effect=lambda log: log.hash_value)
    
    integrity_status = await audit_service.verify_integrity()
    
    # Verify integrity check results
    assert integrity_status['is_valid'] == True
    assert integrity_status['total_logs'] == 3
    assert integrity_status['verified_logs'] == 3
    assert len(integrity_status['broken_chains']) == 0
    assert len(integrity_status['hash_mismatches']) == 0

@pytest.mark.asyncio
async def test_verify_integrity_broken_chain(audit_service, mock_db_session):
    """Test integrity verification with broken chain"""
    # Mock audit logs with broken hash chain
    mock_logs = []
    for i in range(3):
        log = MagicMock()
        log.id = f"log{i}"
        log.timestamp = datetime.now(timezone.utc) + timedelta(seconds=i)
        log.hash_value = f"hash{i}"
        # Break the chain at index 1
        log.previous_hash = "wrong_hash" if i == 1 else (f"hash{i-1}" if i > 0 else None)
        log.user_id = "user123"
        log.action = "TEST_ACTION"
        log.resource_type = "TEST"
        log.resource_id = "resource123"
        log.before_data = {}
        log.after_data = {}
        log.metadata = {}
        mock_logs.append(log)
    
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = mock_logs
    mock_db_session.execute.return_value = mock_result
    
    # Mock hash calculation
    audit_service._calculate_hash = MagicMock(side_effect=lambda log: log.hash_value)
    
    integrity_status = await audit_service.verify_integrity()
    
    # Verify broken chain is detected
    assert integrity_status['is_valid'] == False
    assert len(integrity_status['broken_chains']) == 1
    assert integrity_status['broken_chains'][0]['log_id'] == "log1"

@pytest.mark.asyncio
async def test_export_audit_data_json(audit_service, mock_db_session):
    """Test exporting audit data in JSON format"""
    # Mock audit trail
    mock_trail = [
        {
            'id': 'log123',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': 'CREATE_USER',
            'user_id': 'user123'
        }
    ]
    
    # Mock get_audit_trail method
    audit_service.get_audit_trail = AsyncMock(return_value=mock_trail)
    
    export_data = await audit_service.export_audit_data(
        format_type='json',
        start_date=datetime.now(timezone.utc) - timedelta(days=1),
        end_date=datetime.now(timezone.utc)
    )
    
    # Verify export data
    assert export_data['format'] == 'json'
    assert export_data['total_records'] == 1
    assert len(export_data['data']) == 1
    assert export_data['data'][0]['id'] == 'log123'

@pytest.mark.asyncio
async def test_export_audit_data_csv(audit_service, mock_db_session):
    """Test exporting audit data in CSV format"""
    # Mock audit trail
    mock_trail = [
        {
            'id': 'log123',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'action': 'CREATE_USER',
            'user_id': 'user123'
        }
    ]
    
    # Mock get_audit_trail method
    audit_service.get_audit_trail = AsyncMock(return_value=mock_trail)
    
    export_data = await audit_service.export_audit_data(
        format_type='csv',
        start_date=datetime.now(timezone.utc) - timedelta(days=1),
        end_date=datetime.now(timezone.utc)
    )
    
    # Verify export data
    assert export_data['format'] == 'csv'
    assert 'csv_data' in export_data
    assert 'id,timestamp,action,user_id' in export_data['csv_data']

@pytest.mark.asyncio
async def test_cleanup_old_logs(audit_service, mock_db_session):
    """Test cleanup of old audit logs"""
    # Mock count query result
    mock_count_result = MagicMock()
    mock_count_result.scalars.return_value.all.return_value = ['log1', 'log2', 'log3']
    
    # Mock delete query result
    mock_delete_result = MagicMock()
    mock_delete_result.rowcount = 3
    
    mock_db_session.execute.side_effect = [mock_count_result, mock_delete_result]
    
    cleanup_result = await audit_service.cleanup_old_logs()
    
    # Verify cleanup results
    assert cleanup_result['deleted_logs'] == 3
    assert 'cutoff_date' in cleanup_result
    assert mock_db_session.commit.called

@pytest.mark.asyncio
async def test_calculate_hash_consistency(audit_service):
    """Test hash calculation consistency"""
    # Create mock audit log
    audit_log = MagicMock()
    audit_log.timestamp = datetime.now(timezone.utc)
    audit_log.user_id = "user123"
    audit_log.action = "CREATE_USER"
    audit_log.resource_type = "USER"
    audit_log.resource_id = "resource456"
    audit_log.before_data = {"status": "inactive"}
    audit_log.after_data = {"status": "active"}
    audit_log.metadata = {"source": "api"}
    audit_log.previous_hash = "previous_hash_123"
    
    # Calculate hash twice
    hash1 = audit_service._calculate_hash(audit_log)
    hash2 = audit_service._calculate_hash(audit_log)
    
    # Verify consistency
    assert hash1 == hash2
    assert len(hash1) == 64  # SHA-256 produces 64-character hex string

@pytest.mark.asyncio
async def test_log_activity_error_handling(audit_service, mock_db_session):
    """Test error handling in log_activity"""
    # Mock database error
    mock_db_session.commit.side_effect = Exception("Database error")
    
    with pytest.raises(Exception) as exc_info:
        await audit_service.log_activity(
            action="CREATE_USER",
            resource_type="USER"
        )
    
    # Verify error handling
    assert "Database error" in str(exc_info.value)
    assert mock_db_session.rollback.called
