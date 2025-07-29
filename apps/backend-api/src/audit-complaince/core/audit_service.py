import hashlib
import json
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from cryptography.fernet import Fernet
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from prometheus_client import Counter, Histogram, Gauge

from database.models import AuditLog
from config import config

logger = structlog.get_logger(__name__)

class AuditService:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
        self.encryption_key = config.encryption_key.encode()[:32]  # Ensure 32 bytes
        self.cipher_suite = Fernet(Fernet.generate_key()) if config.enable_audit_encryption else None
        
        # Metrics
        self.audit_logs_created = Counter(
            'audit_logs_created_total',
            'Total audit logs created',
            ['action', 'resource_type']
        )
        self.audit_query_duration = Histogram(
            'audit_query_duration_seconds',
            'Audit query duration',
            ['query_type']
        )
        self.audit_chain_integrity = Gauge(
            'audit_chain_integrity_status',
            'Audit chain integrity status (1=valid, 0=invalid)'
        )
    
    async def log_activity(
        self,
        action: str,
        resource_type: str,
        user_id: Optional[str] = None,
        resource_id: Optional[str] = None,
        before_data: Optional[Dict[str, Any]] = None,
        after_data: Optional[Dict[str, Any]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        session_id: Optional[str] = None,
        compliance_relevant: bool = False
    ) -> str:
        """Log an activity with full audit trail"""
        try:
            # Get the last audit log for hash chaining
            previous_hash = await self._get_last_hash()
            
            # Create audit log entry
            audit_log = AuditLog(
                timestamp=datetime.now(timezone.utc),
                user_id=user_id,
                session_id=session_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                ip_address=ip_address,
                user_agent=user_agent,
                before_data=before_data,
                after_data=after_data,
                metadata=metadata,
                previous_hash=previous_hash,
                compliance_relevant=compliance_relevant,
                retention_until=datetime.now(timezone.utc) + timedelta(days=config.audit_retention_days)
            )
            
            # Calculate hash for integrity
            audit_log.hash_value = self._calculate_hash(audit_log)
            
            # Encrypt sensitive data if enabled
            if config.enable_audit_encryption and self.cipher_suite:
                sensitive_data = {
                    'before_data': before_data,
                    'after_data': after_data,
                    'metadata': metadata
                }
                audit_log.encrypted_data = self.cipher_suite.encrypt(
                    json.dumps(sensitive_data).encode()
                ).decode()
                
                # Clear original data
                audit_log.before_data = None
                audit_log.after_data = None
                audit_log.metadata = {'encrypted': True}
            
            # Save to database
            self.db_session.add(audit_log)
            await self.db_session.commit()
            
            # Update metrics
            self.audit_logs_created.labels(
                action=action,
                resource_type=resource_type
            ).inc()
            
            logger.info(
                "Audit log created",
                audit_id=str(audit_log.id),
                action=action,
                resource_type=resource_type,
                user_id=user_id
            )
            
            return str(audit_log.id)
            
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")
            await self.db_session.rollback()
            raise
    
    async def get_audit_trail(
        self,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        user_id: Optional[str] = None,
        action: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Retrieve audit trail with filtering"""
        start_time = asyncio.get_event_loop().time()
        
        try:
            query = select(AuditLog)
            
            # Apply filters
            conditions = []
            if resource_type:
                conditions.append(AuditLog.resource_type == resource_type)
            if resource_id:
                conditions.append(AuditLog.resource_id == resource_id)
            if user_id:
                conditions.append(AuditLog.user_id == user_id)
            if action:
                conditions.append(AuditLog.action == action)
            if start_date:
                conditions.append(AuditLog.timestamp >= start_date)
            if end_date:
                conditions.append(AuditLog.timestamp <= end_date)
            
            if conditions:
                query = query.where(and_(*conditions))
            
            # Order by timestamp descending
            query = query.order_by(desc(AuditLog.timestamp))
            query = query.limit(limit).offset(offset)
            
            result = await self.db_session.execute(query)
            audit_logs = result.scalars().all()
            
            # Convert to dict and decrypt if necessary
            trail = []
            for log in audit_logs:
                log_dict = {
                    'id': str(log.id),
                    'timestamp': log.timestamp.isoformat(),
                    'user_id': log.user_id,
                    'session_id': log.session_id,
                    'action': log.action,
                    'resource_type': log.resource_type,
                    'resource_id': log.resource_id,
                    'ip_address': log.ip_address,
                    'user_agent': log.user_agent,
                    'compliance_relevant': log.compliance_relevant,
                    'hash_value': log.hash_value
                }
                
                # Decrypt data if encrypted
                if log.encrypted_data and self.cipher_suite:
                    try:
                        decrypted_data = json.loads(
                            self.cipher_suite.decrypt(log.encrypted_data.encode()).decode()
                        )
                        log_dict.update(decrypted_data)
                    except Exception as e:
                        logger.error(f"Failed to decrypt audit data: {e}")
                        log_dict['decryption_error'] = True
                else:
                    log_dict.update({
                        'before_data': log.before_data,
                        'after_data': log.after_data,
                        'metadata': log.metadata
                    })
                
                trail.append(log_dict)
            
            # Update metrics
            duration = asyncio.get_event_loop().time() - start_time
            self.audit_query_duration.labels(query_type='get_trail').observe(duration)
            
            return trail
            
        except Exception as e:
            logger.error(f"Failed to retrieve audit trail: {e}")
            raise
    
    async def verify_integrity(self, start_date: Optional[datetime] = None) -> Dict[str, Any]:
        """Verify the integrity of the audit chain"""
        try:
            query = select(AuditLog).order_by(AuditLog.timestamp)
            if start_date:
                query = query.where(AuditLog.timestamp >= start_date)
            
            result = await self.db_session.execute(query)
            audit_logs = result.scalars().all()
            
            integrity_status = {
                'is_valid': True,
                'total_logs': len(audit_logs),
                'verified_logs': 0,
                'broken_chains': [],
                'hash_mismatches': []
            }
            
            previous_hash = None
            for log in audit_logs:
                # Verify hash chain
                if previous_hash and log.previous_hash != previous_hash:
                    integrity_status['is_valid'] = False
                    integrity_status['broken_chains'].append({
                        'log_id': str(log.id),
                        'expected_previous_hash': previous_hash,
                        'actual_previous_hash': log.previous_hash
                    })
                
                # Verify log hash
                calculated_hash = self._calculate_hash(log)
                if calculated_hash != log.hash_value:
                    integrity_status['is_valid'] = False
                    integrity_status['hash_mismatches'].append({
                        'log_id': str(log.id),
                        'expected_hash': calculated_hash,
                        'actual_hash': log.hash_value
                    })
                else:
                    integrity_status['verified_logs'] += 1
                
                previous_hash = log.hash_value
            
            # Update metrics
            self.audit_chain_integrity.set(1 if integrity_status['is_valid'] else 0)
            
            logger.info(
                "Audit integrity verification completed",
                is_valid=integrity_status['is_valid'],
                total_logs=integrity_status['total_logs'],
                verified_logs=integrity_status['verified_logs']
            )
            
            return integrity_status
            
        except Exception as e:
            logger.error(f"Failed to verify audit integrity: {e}")
            raise
    
    async def export_audit_data(
        self,
        format_type: str = 'json',
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        filters: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Export audit data in various formats"""
        try:
            # Get audit trail
            trail = await self.get_audit_trail(
                start_date=start_date,
                end_date=end_date,
                limit=10000,  # Large limit for export
                **(filters or {})
            )
            
            export_data = {
                'export_timestamp': datetime.now(timezone.utc).isoformat(),
                'format': format_type,
                'total_records': len(trail),
                'filters_applied': filters or {},
                'data': trail
            }
            
            if format_type == 'csv':
                # Convert to CSV format
                import csv
                import io
                
                output = io.StringIO()
                if trail:
                    writer = csv.DictWriter(output, fieldnames=trail[0].keys())
                    writer.writeheader()
                    writer.writerows(trail)
                
                export_data['csv_data'] = output.getvalue()
                output.close()
            
            logger.info(
                "Audit data exported",
                format=format_type,
                records=len(trail)
            )
            
            return export_data
            
        except Exception as e:
            logger.error(f"Failed to export audit data: {e}")
            raise
    
    async def cleanup_old_logs(self) -> Dict[str, int]:
        """Clean up old audit logs based on retention policy"""
        try:
            cutoff_date = datetime.now(timezone.utc) - timedelta(days=config.audit_retention_days)
            
            # Count logs to be deleted
            count_query = select(AuditLog).where(AuditLog.retention_until < cutoff_date)
            result = await self.db_session.execute(count_query)
            logs_to_delete = len(result.scalars().all())
            
            # Delete old logs
            delete_query = AuditLog.__table__.delete().where(AuditLog.retention_until < cutoff_date)
            result = await self.db_session.execute(delete_query)
            await self.db_session.commit()
            
            cleanup_result = {
                'deleted_logs': result.rowcount,
                'cutoff_date': cutoff_date.isoformat()
            }
            
            logger.info(
                "Audit log cleanup completed",
                deleted_logs=cleanup_result['deleted_logs'],
                cutoff_date=cutoff_date
            )
            
            return cleanup_result
            
        except Exception as e:
            logger.error(f"Failed to cleanup old audit logs: {e}")
            await self.db_session.rollback()
            raise
    
    def _calculate_hash(self, audit_log: AuditLog) -> str:
        """Calculate hash for audit log integrity"""
        hash_data = {
            'timestamp': audit_log.timestamp.isoformat() if audit_log.timestamp else '',
            'user_id': audit_log.user_id or '',
            'action': audit_log.action,
            'resource_type': audit_log.resource_type,
            'resource_id': audit_log.resource_id or '',
            'before_data': audit_log.before_data,
            'after_data': audit_log.after_data,
            'metadata': audit_log.metadata,
            'previous_hash': audit_log.previous_hash or ''
        }
        
        hash_string = json.dumps(hash_data, sort_keys=True, default=str)
        return hashlib.sha256(hash_string.encode()).hexdigest()
    
    async def _get_last_hash(self) -> Optional[str]:
        """Get the hash of the last audit log for chaining"""
        try:
            query = select(AuditLog.hash_value).order_by(desc(AuditLog.timestamp)).limit(1)
            result = await self.db_session.execute(query)
            last_hash = result.scalar_one_or_none()
            return last_hash
        except Exception:
            return None
