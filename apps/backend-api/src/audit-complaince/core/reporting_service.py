import asyncio
import json
import csv
import io
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from pathlib import Path
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, desc
from prometheus_client import Counter, Histogram

from database.models import RegulatoryReport, ComplianceViolation, AuditLog, ComplianceRule
from core.audit_service import AuditService
from config import config

logger = structlog.get_logger(__name__)

class ReportingService:
    def __init__(self, db_session: AsyncSession, audit_service: AuditService):
        self.db_session = db_session
        self.audit_service = audit_service
        self.reports_path = Path(config.report_storage_path)
        self.reports_path.mkdir(parents=True, exist_ok=True)
        
        # Metrics
        self.reports_generated = Counter(
            'compliance_reports_generated_total',
            'Total compliance reports generated',
            ['report_type', 'jurisdiction']
        )
        self.report_generation_duration = Histogram(
            'compliance_report_generation_duration_seconds',
            'Report generation duration',
            ['report_type']
        )
    
    async def generate_sar_report(
        self,
        period_start: datetime,
        period_end: datetime,
        jurisdiction: str = 'US'
    ) -> str:
        """Generate Suspicious Activity Report (SAR)"""
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Get high-risk violations
            query = select(ComplianceViolation).join(ComplianceRule).where(
                and_(
                    ComplianceViolation.detected_at >= period_start,
                    ComplianceViolation.detected_at <= period_end,
                    ComplianceViolation.risk_score >= 0.7,
                    ComplianceRule.rule_type.in_(['AML', 'TRANSACTION_MONITORING'])
                )
            )
            
            result = await self.db_session.execute(query)
            violations = result.scalars().all()
            
            # Compile report data
            suspicious_activities = []
            for violation in violations:
                activity = {
                    'violation_id': str(violation.id),
                    'entity_type': violation.entity_type,
                    'entity_id': violation.entity_id,
                    'risk_score': violation.risk_score,
                    'detected_at': violation.detected_at.isoformat(),
                    'violation_details': violation.violation_data,
                    'status': violation.status
                }
                suspicious_activities.append(activity)
            
            report_data = {
                'report_type': 'SAR',
                'jurisdiction': jurisdiction,
                'period_start': period_start.isoformat(),
                'period_end': period_end.isoformat(),
                'total_suspicious_activities': len(suspicious_activities),
                'activities': suspicious_activities,
                'summary': {
                    'high_risk_count': len([a for a in suspicious_activities if a['risk_score'] >= 0.9]),
                    'medium_risk_count': len([a for a in suspicious_activities if 0.7 <= a['risk_score'] < 0.9]),
                    'resolved_count': len([a for a in suspicious_activities if a['status'] == 'RESOLVED']),
                    'open_count': len([a for a in suspicious_activities if a['status'] == 'OPEN'])
                }
            }
            
            # Create report record
            report = RegulatoryReport(
                report_type='SAR',
                jurisdiction=jurisdiction,
                title=f'Suspicious Activity Report - {period_start.strftime("%Y-%m")}',
                description=f'SAR for period {period_start.date()} to {period_end.date()}',
                period_start=period_start,
                period_end=period_end,
                report_data=report_data,
                created_by='system'
            )
            
            self.db_session.add(report)
            await self.db_session.commit()
            
            # Generate report file
            file_path = await self._save_report_file(report, report_data)
            report.file_path = str(file_path)
            report.generated_at = datetime.now(timezone.utc)
            report.status = 'GENERATED'
            
            await self.db_session.commit()
            
            # Update metrics
            duration = asyncio.get_event_loop().time() - start_time
            self.report_generation_duration.labels(report_type='SAR').observe(duration)
            self.reports_generated.labels(report_type='SAR', jurisdiction=jurisdiction).inc()
            
            # Log report generation
            await self.audit_service.log_activity(
                action='GENERATE_SAR_REPORT',
                resource_type='REGULATORY_REPORT',
                resource_id=str(report.id),
                after_data={
                    'report_type': 'SAR',
                    'period_start': period_start.isoformat(),
                    'period_end': period_end.isoformat(),
                    'activities_count': len(suspicious_activities)
                },
                compliance_relevant=True
            )
            
            logger.info(
                "SAR report generated",
                report_id=str(report.id),
                activities_count=len(suspicious_activities),
                jurisdiction=jurisdiction
            )
            
            return str(report.id)
            
        except Exception as e:
            logger.error(f"Failed to generate SAR report: {e}")
            raise
    
    async def generate_ctr_report(
        self,
        period_start: datetime,
        period_end: datetime,
        jurisdiction: str = 'US'
    ) -> str:
        """Generate Currency Transaction Report (CTR)"""
        start_time = asyncio.get_event_loop().time()
        
        try:
            # Get large transactions (>$10,000)
            query = select(AuditLog).where(
                and_(
                    AuditLog.timestamp >= period_start,
                    AuditLog.timestamp <= period_end,
                    AuditLog.action == 'TRANSACTION',
                    AuditLog.after_data['amount'].astext.cast(float) > 10000
                )
            )
            
            result = await self.db_session.execute(query)
            transactions = result.scalars().all()
            
            # Compile report data
            large_transactions = []
            for tx in transactions:
                transaction_data = tx.after_data or {}
                large_tx = {
                    'transaction_id': tx.resource_id,
                    'user_id': tx.user_id,
                    'amount': transaction_data.get('amount'),
                    'currency': transaction_data.get('currency', 'USD'),
                    'timestamp': tx.timestamp.isoformat(),
                    'transaction_type': transaction_data.get('type'),
                    'counterparty': transaction_data.get('counterparty')
                }
                large_transactions.append(large_tx)
            
            report_data = {
                'report_type': 'CTR',
                'jurisdiction': jurisdiction,
                'period_start': period_start.isoformat(),
                'period_end': period_end.isoformat(),
                'total_transactions': len(large_transactions),
                'transactions': large_transactions,
                'summary': {
                    'total_amount': sum(tx.get('amount', 0) for tx in large_transactions),
                    'unique_users': len(set(tx.get('user_id') for tx in large_transactions if tx.get('user_id'))),
                    'transaction_types': {}
                }
            }
            
            # Calculate transaction type breakdown
            for tx in large_transactions:
                tx_type = tx.get('transaction_type', 'UNKNOWN')
                report_data['summary']['transaction_types'][tx_type] = \
                    report_data['summary']['transaction_types'].get(tx_type, 0) + 1
            
            # Create report record
            report = RegulatoryReport(
                report_type='CTR',
                jurisdiction=jurisdiction,
                title=f'Currency Transaction Report - {period_start.strftime("%Y-%m")}',
                description=f'CTR for period {period_start.date()} to {period_end.date()}',
                period_start=period_start,
                period_end=period_end,
                report_data=report_data,
                created_by='system'
            )
            
            self.db_session.add(report)
            await self.db_session.commit()
            
            # Generate report file
            file_path = await self._save_report_file(report, report_data)
            report.file_path = str(file_path)
            report.generated_at = datetime.now(timezone.utc)
            report.status = 'GENERATED'
            
            await self.db_session.commit()
            
            # Update metrics
            duration = asyncio.get_event_loop().time() - start_time
            self.report_generation_duration.labels(report_type='CTR').observe(duration)
            self.reports_generated.labels(report_type='CTR', jurisdiction=jurisdiction).inc()
            
            logger.info(
                "CTR report generated",
                report_id=str(report.id),
                transactions_count=len(large_transactions),
                jurisdiction=jurisdiction
            )
            
            return str(report.id)
            
        except Exception as e:
            logger.error(f"Failed to generate CTR report: {e}")
            raise
    
    async def generate_compliance_dashboard_data(self) -> Dict[str, Any]:
        """Generate data for compliance dashboard"""
        try:
            # Get violation statistics
            violation_stats = await self._get_violation_statistics()
            
            # Get audit statistics
            audit_stats = await self._get_audit_statistics()
            
            # Get recent violations
            recent_violations = await self._get_recent_violations(limit=10)
            
            # Get compliance metrics
            compliance_metrics = await self._get_compliance_metrics()
            
            dashboard_data = {
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'violation_statistics': violation_stats,
                'audit_statistics': audit_stats,
                'recent_violations': recent_violations,
                'compliance_metrics': compliance_metrics,
                'system_health': {
                    'audit_chain_integrity': True,  # Would be calculated
                    'last_sanctions_update': datetime.now(timezone.utc).isoformat(),
                    'active_rules_count': await self._count_active_rules()
                }
            }
            
            return dashboard_data
            
        except Exception as e:
            logger.error(f"Failed to generate dashboard data: {e}")
            raise
    
    async def _get_violation_statistics(self) -> Dict[str, Any]:
        """Get violation statistics for dashboard"""
        try:
            # Total violations by status
            status_query = select(
                ComplianceViolation.status,
                func.count(ComplianceViolation.id).label('count')
            ).group_by(ComplianceViolation.status)
            
            result = await self.db_session.execute(status_query)
            status_counts = {row.status: row.count for row in result}
            
            # Violations by rule type
            type_query = select(
                ComplianceRule.rule_type,
                func.count(ComplianceViolation.id).label('count')
            ).join(ComplianceViolation).group_by(ComplianceRule.rule_type)
            
            result = await self.db_session.execute(type_query)
            type_counts = {row.rule_type: row.count for row in result}
            
            # Recent trend (last 30 days)
            thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
            trend_query = select(func.count(ComplianceViolation.id)).where(
                ComplianceViolation.detected_at >= thirty_days_ago
            )
            result = await self.db_session.execute(trend_query)
            recent_count = result.scalar() or 0
            
            return {
                'by_status': status_counts,
                'by_type': type_counts,
                'recent_30_days': recent_count,
                'total_violations': sum(status_counts.values())
            }
            
        except Exception as e:
            logger.error(f"Failed to get violation statistics: {e}")
            return {}
    
    async def _get_audit_statistics(self) -> Dict[str, Any]:
        """Get audit statistics for dashboard"""
        try:
            # Total audit logs
            total_query = select(func.count(AuditLog.id))
            result = await self.db_session.execute(total_query)
            total_logs = result.scalar() or 0
            
            # Logs by action type (top 10)
            action_query = select(
                AuditLog.action,
                func.count(AuditLog.id).label('count')
            ).group_by(AuditLog.action).order_by(desc('count')).limit(10)
            
            result = await self.db_session.execute(action_query)
            action_counts = {row.action: row.count for row in result}
            
            # Recent activity (last 24 hours)
            yesterday = datetime.now(timezone.utc) - timedelta(days=1)
            recent_query = select(func.count(AuditLog.id)).where(
                AuditLog.timestamp >= yesterday
            )
            result = await self.db_session.execute(recent_query)
            recent_activity = result.scalar() or 0
            
            return {
                'total_logs': total_logs,
                'by_action': action_counts,
                'recent_24h': recent_activity
            }
            
        except Exception as e:
            logger.error(f"Failed to get audit statistics: {e}")
            return {}
    
    async def _get_recent_violations(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get recent violations for dashboard"""
        try:
            query = select(ComplianceViolation).join(ComplianceRule).order_by(
                desc(ComplianceViolation.detected_at)
            ).limit(limit)
            
            result = await self.db_session.execute(query)
            violations = result.scalars().all()
            
            recent_violations = []
            for violation in violations:
                recent_violations.append({
                    'id': str(violation.id),
                    'entity_type': violation.entity_type,
                    'entity_id': violation.entity_id,
                    'risk_score': violation.risk_score,
                    'status': violation.status,
                    'detected_at': violation.detected_at.isoformat()
                })
            
            return recent_violations
            
        except Exception as e:
            logger.error(f"Failed to get recent violations: {e}")
            return []
    
    async def _get_compliance_metrics(self) -> Dict[str, Any]:
        """Get compliance metrics for dashboard"""
        try:
            # Calculate compliance score (example implementation)
            total_violations_query = select(func.count(ComplianceViolation.id))
            result = await self.db_session.execute(total_violations_query)
            total_violations = result.scalar() or 0
            
            resolved_violations_query = select(func.count(ComplianceViolation.id)).where(
                ComplianceViolation.status == 'RESOLVED'
            )
            result = await self.db_session.execute(resolved_violations_query)
            resolved_violations = result.scalar() or 0
            
            compliance_score = (resolved_violations / total_violations * 100) if total_violations > 0 else 100
            
            return {
                'compliance_score': round(compliance_score, 2),
                'total_violations': total_violations,
                'resolved_violations': resolved_violations,
                'resolution_rate': round((resolved_violations / total_violations * 100), 2) if total_violations > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get compliance metrics: {e}")
            return {}
    
    async def _count_active_rules(self) -> int:
        """Count active compliance rules"""
        try:
            query = select(func.count(ComplianceRule.id)).where(ComplianceRule.is_active == True)
            result = await self.db_session.execute(query)
            return result.scalar() or 0
        except Exception:
            return 0
    
    async def _save_report_file(self, report: RegulatoryReport, report_data: Dict[str, Any]) -> Path:
        """Save report data to file"""
        try:
            # Create filename
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            filename = f"{report.report_type}_{report.jurisdiction}_{timestamp}.json"
            file_path = self.reports_path / filename
            
            # Save as JSON
            with open(file_path, 'w') as f:
                json.dump(report_data, f, indent=2, default=str)
            
            # Calculate file hash
            import hashlib
            with open(file_path, 'rb') as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()
            
            report.file_hash = file_hash
            
            return file_path
            
        except Exception as e:
            logger.error(f"Failed to save report file: {e}")
            raise

```python file="feature-3-audit-compliance/core/whistleblower_service.py"
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, desc
from prometheus_client import Counter

from database.models import WhistleblowerReport
from core.audit_service import AuditService
from config import config

logger = structlog.get_logger(__name__)

class WhistleblowerService:
    def __init__(self, db_session: AsyncSession, audit_service: AuditService):
        self.db_session = db_session
        self.audit_service = audit_service
        
        # Metrics
        self.reports_submitted = Counter(
            'whistleblower_reports_submitted_total',
            'Total whistleblower reports submitted',
            ['category', 'is_anonymous']
        )
        self.reports_resolved = Counter(
            'whistleblower_reports_resolved_total',
            'Total whistleblower reports resolved',
            ['category', 'resolution_type']
        )
    
    async def submit_report(
        self,
        title: str,
        description: str,
        category: str,
        severity: str = 'MEDIUM',
        reporter_id: Optional[str] = None,
        reporter_contact: Optional[str] = None,
        evidence_data: Optional[Dict[str, Any]] = None,
        attachments: Optional[List[Dict[str, Any]]] = None,
        is_anonymous: bool = True
    ) -> str:
        """Submit a whistleblower report"""
        try:
            if not config.whistleblower_enabled:
                raise ValueError("Whistleblower reporting is disabled")
            
            # Create report
            report = WhistleblowerReport(
                title=title,
                description=description,
                category=category,
                severity=severity,
                reporter_id=reporter_id if not is_anonymous else None,
                reporter_contact=reporter_contact if not is_anonymous else None,
                is_anonymous=is_anonymous,
                evidence_data=evidence_data,
                attachments=attachments or []
            )
            
            self.db_session.add(report)
            await self.db_session.commit()
            
            # Log the submission (with privacy protection)
            await self.audit_service.log_activity(
                action='SUBMIT_WHISTLEBLOWER_REPORT',
                resource_type='WHISTLEBLOWER_REPORT',
                resource_id=str(report.id),
                after_data={
                    'category': category,
                    'severity': severity,
                    'is_anonymous': is_anonymous,
                    'has_evidence': evidence_data is not None,
                    'attachment_count': len(attachments) if attachments else 0
                },
                compliance_relevant=True
            )
            
            # Update metrics
            self.reports_submitted.labels(
                category=category,
                is_anonymous=str(is_anonymous)
            ).inc()
            
            logger.info(
                "Whistleblower report submitted",
                report_id=str(report.id),
                category=category,
                severity=severity,
                is_anonymous=is_anonymous
            )
            
            return str(report.id)
            
        except Exception as e:
            logger.error(f"Failed to submit whistleblower report: {e}")
            await self.db_session.rollback()
            raise
    
    async def get_reports(
        self,
        status: Optional[str] = None,
        category: Optional[str] = None,
        severity: Optional[str] = None,
        assigned_to: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get whistleblower reports with filtering"""
        try:
            query = select(WhistleblowerReport)
            
            # Apply filters
            conditions = []
            if status:
                conditions.append(WhistleblowerReport.status == status)
            if category:
                conditions.append(WhistleblowerReport.category == category)
            if severity:
                conditions.append(WhistleblowerReport.severity == severity)
            if assigned_to:
                conditions.append(WhistleblowerReport.assigned_to == assigned_to)
            
            if conditions:
                query = query.where(and_(*conditions))
            
            query = query.order_by(desc(WhistleblowerReport.submitted_at))
            query = query.limit(limit).offset(offset)
            
            result = await self.db_session.execute(query)
            reports = result.scalars().all()
            
            reports_data = []
            for report in reports:
                report_data = {
                    'id': str(report.id),
                    'title': report.title,
                    'description': report.description,
                    'category': report.category,
                    'severity': report.severity,
                    'status': report.status,
                    'is_anonymous': report.is_anonymous,
                    'submitted_at': report.submitted_at.isoformat(),
                    'updated_at': report.updated_at.isoformat() if report.updated_at else None,
                    'assigned_to': report.assigned_to,
                    'has_evidence': report.evidence_data is not None,
                    'attachment_count': len(report.attachments) if report.attachments else 0
                }
                
                # Include contact info only for non-anonymous reports
                if not report.is_anonymous:
                    report_data['reporter_contact'] = report.reporter_contact
                
                reports_data.append(report_data)
            
            return reports_data
            
        except Exception as e:
            logger.error(f"Failed to get whistleblower reports: {e}")
            raise
    
    async def get_report_details(self, report_id: str, include_sensitive: bool = False) -> Dict[str, Any]:
        """Get detailed information about a specific report"""
        try:
            query = select(WhistleblowerReport).where(WhistleblowerReport.id == report_id)
            result = await self.db_session.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ValueError(f"Report {report_id} not found")
            
            report_data = {
                'id': str(report.id),
                'title': report.title,
                'description': report.description,
                'category': report.category,
                'severity': report.severity,
                'status': report.status,
                'is_anonymous': report.is_anonymous,
                'submitted_at': report.submitted_at.isoformat(),
                'updated_at': report.updated_at.isoformat() if report.updated_at else None,
                'resolved_at': report.resolved_at.isoformat() if report.resolved_at else None,
                'assigned_to': report.assigned_to,
                'investigation_notes': report.investigation_notes,
                'resolution': report.resolution
            }
            
            # Include sensitive data only if authorized
            if include_sensitive:
                report_data.update({
                    'reporter_id': report.reporter_id,
                    'reporter_contact': report.reporter_contact,
                    'evidence_data': report.evidence_data,
                    'attachments': report.attachments
                })
            else:
                report_data.update({
                    'has_evidence': report.evidence_data is not None,
                    'attachment_count': len(report.attachments) if report.attachments else 0
                })
            
            return report_data
            
        except Exception as e:
            logger.error(f"Failed to get report details: {e}")
            raise
    
    async def assign_report(self, report_id: str, assigned_to: str, assigned_by: str) -> bool:
        """Assign a report to an investigator"""
        try:
            query = select(WhistleblowerReport).where(WhistleblowerReport.id == report_id)
            result = await self.db_session.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ValueError(f"Report {report_id} not found")
            
            old_assignee = report.assigned_to
            report.assigned_to = assigned_to
            report.status = 'INVESTIGATING' if report.status == 'SUBMITTED' else report.status
            report.updated_at = datetime.now(timezone.utc)
            
            await self.db_session.commit()
            
            # Log the assignment
            await self.audit_service.log_activity(
                action='ASSIGN_WHISTLEBLOWER_REPORT',
                resource_type='WHISTLEBLOWER_REPORT',
                resource_id=report_id,
                before_data={'assigned_to': old_assignee},
                after_data={'assigned_to': assigned_to, 'assigned_by': assigned_by},
                compliance_relevant=True
            )
            
            logger.info(
                "Whistleblower report assigned",
                report_id=report_id,
                assigned_to=assigned_to,
                assigned_by=assigned_by
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to assign report: {e}")
            await self.db_session.rollback()
            raise
    
    async def update_investigation(
        self,
        report_id: str,
        investigation_notes: str,
        status: Optional[str] = None,
        updated_by: str = 'system'
    ) -> bool:
        """Update investigation notes and status"""
        try:
            query = select(WhistleblowerReport).where(WhistleblowerReport.id == report_id)
            result = await self.db_session.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ValueError(f"Report {report_id} not found")
            
            old_notes = report.investigation_notes
            old_status = report.status
            
            report.investigation_notes = investigation_notes
            if status:
                report.status = status
            report.updated_at = datetime.now(timezone.utc)
            
            await self.db_session.commit()
            
            # Log the update
            await self.audit_service.log_activity(
                action='UPDATE_WHISTLEBLOWER_INVESTIGATION',
                resource_type='WHISTLEBLOWER_REPORT',
                resource_id=report_id,
                before_data={
                    'investigation_notes': old_notes,
                    'status': old_status
                },
                after_data={
                    'investigation_notes': investigation_notes,
                    'status': status or old_status,
                    'updated_by': updated_by
                },
                compliance_relevant=True
            )
            
            logger.info(
                "Whistleblower investigation updated",
                report_id=report_id,
                status=status or old_status,
                updated_by=updated_by
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to update investigation: {e}")
            await self.db_session.rollback()
            raise
    
    async def resolve_report(
        self,
        report_id: str,
        resolution: str,
        resolved_by: str,
        resolution_type: str = 'RESOLVED'
    ) -> bool:
        """Resolve a whistleblower report"""
        try:
            query = select(WhistleblowerReport).where(WhistleblowerReport.id == report_id)
            result = await self.db_session.execute(query)
            report = result.scalar_one_or_none()
            
            if not report:
                raise ValueError(f"Report {report_id} not found")
            
            old_status = report.status
            report.status = 'RESOLVED'
            report.resolution = resolution
            report.resolved_at = datetime.now(timezone.utc)
            report.updated_at = datetime.now(timezone.utc)
            
            await self.db_session.commit()
            
            # Update metrics
            self.reports_resolved.labels(
                category=report.category,
                resolution_type=resolution_type
            ).inc()
            
            # Log the resolution
            await self.audit_service.log_activity(
                action='RESOLVE_WHISTLEBLOWER_REPORT',
                resource_type='WHISTLEBLOWER_REPORT',
                resource_id=report_id,
                before_data={'status': old_status},
                after_data={
                    'status': 'RESOLVED',
                    'resolution': resolution,
                    'resolved_by': resolved_by,
                    'resolution_type': resolution_type
                },
                compliance_relevant=True
            )
            
            logger.info(
                "Whistleblower report resolved",
                report_id=report_id,
                resolution_type=resolution_type,
                resolved_by=resolved_by
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to resolve report: {e}")
            await self.db_session.rollback()
            raise
    
    async def get_statistics(self) -> Dict[str, Any]:
        """Get whistleblower reporting statistics"""
        try:
            # Total reports
            total_query = select(func.count(WhistleblowerReport.id))
            result = await self.db_session.execute(total_query)
            total_reports = result.scalar() or 0
            
            # Reports by status
            status_query = select(
                WhistleblowerReport.status,
                func.count(WhistleblowerReport.id).label('count')
            ).group_by(WhistleblowerReport.status)
            
            result = await self.db_session.execute(status_query)
            status_counts = {row.status: row.count for row in result}
            
            # Reports by category
            category_query = select(
                WhistleblowerReport.category,
                func.count(WhistleblowerReport.id).label('count')
            ).group_by(WhistleblowerReport.category)
            
            result = await self.db_session.execute(category_query)
            category_counts = {row.category: row.count for row in result}
            
            # Anonymous vs identified
            anonymous_query = select(
                WhistleblowerReport.is_anonymous,
                func.count(WhistleblowerReport.id).label('count')
            ).group_by(WhistleblowerReport.is_anonymous)
            
            result = await self.db_session.execute(anonymous_query)
            anonymous_counts = {row.is_anonymous: row.count for row in result}
            
            return {
                'total_reports': total_reports,
                'by_status': status_counts,
                'by_category': category_counts,
                'anonymous_breakdown': {
                    'anonymous': anonymous_counts.get(True, 0),
                    'identified': anonymous_counts.get(False, 0)
                },
                'resolution_rate': (
                    status_counts.get('RESOLVED', 0) / total_reports * 100
                ) if total_reports > 0 else 0
            }
            
        except Exception as e:
            logger.error(f"Failed to get whistleblower statistics: {e}")
            return {}
