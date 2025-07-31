import asyncio
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, desc, func
from prometheus_client import Counter, Gauge, Histogram

from database.models import ComplianceRule, ComplianceViolation, SanctionsList
from core.audit_service import AuditService
from config import config

logger = structlog.get_logger(__name__)

@dataclass
class RiskAssessment:
    entity_id: str
    entity_type: str
    risk_score: float
    risk_factors: List[str]
    recommendations: List[str]

class ComplianceService:
    def __init__(self, db_session: AsyncSession, audit_service: AuditService):
        self.db_session = db_session
        self.audit_service = audit_service
        
        # Metrics
        self.compliance_checks_total = Counter(
            'compliance_checks_total',
            'Total compliance checks performed',
            ['check_type', 'result']
        )
        self.violations_detected = Counter(
            'compliance_violations_detected_total',
            'Total compliance violations detected',
            ['rule_type', 'severity']
        )
        self.risk_assessments_performed = Counter(
            'risk_assessments_performed_total',
            'Total risk assessments performed',
            ['entity_type']
        )
        self.sanctions_checks = Counter(
            'sanctions_checks_total',
            'Total sanctions checks performed',
            ['result']
        )
        self.active_violations = Gauge(
            'compliance_active_violations',
            'Number of active compliance violations',
            ['rule_type']
        )
    
    async def create_compliance_rule(
        self,
        name: str,
        description: str,
        rule_type: str,
        jurisdiction: str,
        conditions: Dict[str, Any],
        actions: Dict[str, Any],
        severity: str = 'MEDIUM',
        created_by: str = 'system'
    ) -> str:
        """Create a new compliance rule"""
        try:
            rule = ComplianceRule(
                name=name,
                description=description,
                rule_type=rule_type,
                jurisdiction=jurisdiction,
                conditions=conditions,
                actions=actions,
                severity=severity,
                created_by=created_by
            )
            
            self.db_session.add(rule)
            await self.db_session.commit()
            
            # Log the creation
            await self.audit_service.log_activity(
                action='CREATE_COMPLIANCE_RULE',
                resource_type='COMPLIANCE_RULE',
                resource_id=str(rule.id),
                after_data={
                    'name': name,
                    'rule_type': rule_type,
                    'jurisdiction': jurisdiction,
                    'severity': severity
                },
                compliance_relevant=True
            )
            
            logger.info(
                "Compliance rule created",
                rule_id=str(rule.id),
                name=name,
                rule_type=rule_type
            )
            
            return str(rule.id)
            
        except Exception as e:
            logger.error(f"Failed to create compliance rule: {e}")
            await self.db_session.rollback()
            raise
    
    async def check_aml_compliance(
        self,
        entity_type: str,
        entity_id: str,
        transaction_data: Dict[str, Any]
    ) -> RiskAssessment:
        """Perform AML compliance check"""
        try:
            risk_factors = []
            risk_score = 0.0
            recommendations = []
            
            # Check transaction amount
            amount = transaction_data.get('amount', 0)
            if amount > 10000:  # Large transaction threshold
                risk_factors.append('LARGE_TRANSACTION')
                risk_score += 0.3
                recommendations.append('Verify source of funds')
            
            # Check transaction frequency
            frequency = transaction_data.get('daily_transaction_count', 0)
            if frequency > 10:
                risk_factors.append('HIGH_FREQUENCY')
                risk_score += 0.2
                recommendations.append('Review transaction patterns')
            
            # Check geographic risk
            country = transaction_data.get('country', '').upper()
            high_risk_countries = ['AF', 'IR', 'KP', 'SY']  # Example high-risk countries
            if country in high_risk_countries:
                risk_factors.append('HIGH_RISK_GEOGRAPHY')
                risk_score += 0.4
                recommendations.append('Enhanced due diligence required')
            
            # Check for unusual patterns
            if transaction_data.get('is_round_amount', False):
                risk_factors.append('ROUND_AMOUNT_PATTERN')
                risk_score += 0.1
            
            if transaction_data.get('rapid_movement', False):
                risk_factors.append('RAPID_FUND_MOVEMENT')
                risk_score += 0.3
                recommendations.append('Investigate fund movement pattern')
            
            # Normalize risk score
            risk_score = min(risk_score, 1.0)
            
            assessment = RiskAssessment(
                entity_id=entity_id,
                entity_type=entity_type,
                risk_score=risk_score,
                risk_factors=risk_factors,
                recommendations=recommendations
            )
            
            # Check if violation threshold is exceeded
            if risk_score >= config.aml_risk_threshold:
                await self._create_violation(
                    rule_type='AML',
                    entity_type=entity_type,
                    entity_id=entity_id,
                    violation_data={
                        'risk_score': risk_score,
                        'risk_factors': risk_factors,
                        'transaction_data': transaction_data
                    },
                    risk_score=risk_score
                )
            
            # Update metrics
            self.compliance_checks_total.labels(
                check_type='AML',
                result='HIGH_RISK' if risk_score >= config.aml_risk_threshold else 'LOW_RISK'
            ).inc()
            
            self.risk_assessments_performed.labels(entity_type=entity_type).inc()
            
            # Log the assessment
            await self.audit_service.log_activity(
                action='AML_RISK_ASSESSMENT',
                resource_type=entity_type,
                resource_id=entity_id,
                after_data={
                    'risk_score': risk_score,
                    'risk_factors': risk_factors,
                    'threshold_exceeded': risk_score >= config.aml_risk_threshold
                },
                compliance_relevant=True
            )
            
            return assessment
            
        except Exception as e:
            logger.error(f"Failed to perform AML compliance check: {e}")
            raise
    
    async def check_sanctions_compliance(
        self,
        entity_type: str,
        entity_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Check entity against sanctions lists"""
        try:
            matches = []
            
            # Get entity identifiers
            name = entity_data.get('name', '').lower()
            aliases = [alias.lower() for alias in entity_data.get('aliases', [])]
            addresses = entity_data.get('addresses', [])
            identifiers = entity_data.get('identifiers', {})
            
            # Query sanctions lists
            query = select(SanctionsList).where(SanctionsList.is_active == True)
            result = await self.db_session.execute(query)
            sanctions_entries = result.scalars().all()
            
            for entry in sanctions_entries:
                match_score = 0.0
                match_reasons = []
                
                # Name matching
                entry_name = entry.name.lower()
                if self._fuzzy_match(name, entry_name):
                    match_score += 0.8
                    match_reasons.append('NAME_MATCH')
                
                # Alias matching
                entry_aliases = [alias.lower() for alias in (entry.aliases or [])]
                for alias in aliases:
                    for entry_alias in entry_aliases:
                        if self._fuzzy_match(alias, entry_alias):
                            match_score += 0.6
                            match_reasons.append('ALIAS_MATCH')
                            break
                
                # Address matching
                entry_addresses = entry.addresses or []
                for address in addresses:
                    for entry_address in entry_addresses:
                        if self._address_match(address, entry_address):
                            match_score += 0.4
                            match_reasons.append('ADDRESS_MATCH')
                
                # Identifier matching
                entry_identifiers = entry.identifiers or {}
                for id_type, id_value in identifiers.items():
                    if id_type in entry_identifiers:
                        if str(id_value).lower() == str(entry_identifiers[id_type]).lower():
                            match_score += 0.9
                            match_reasons.append(f'{id_type}_MATCH')
                
                # If significant match found
                if match_score >= 0.7:
                    matches.append({
                        'sanctions_entry_id': str(entry.id),
                        'list_name': entry.list_name,
                        'source': entry.source,
                        'match_score': min(match_score, 1.0),
                        'match_reasons': match_reasons,
                        'entry_name': entry.name
                    })
            
            # Determine result
            is_sanctioned = len(matches) > 0
            result_data = {
                'is_sanctioned': is_sanctioned,
                'matches': matches,
                'check_timestamp': datetime.now(timezone.utc).isoformat(),
                'total_lists_checked': len(sanctions_entries)
            }
            
            # Create violation if sanctioned
            if is_sanctioned:
                await self._create_violation(
                    rule_type='SANCTIONS',
                    entity_type=entity_type,
                    entity_id=entity_data.get('id', 'unknown'),
                    violation_data={
                        'sanctions_matches': matches,
                        'entity_data': entity_data
                    },
                    risk_score=1.0  # Maximum risk for sanctions match
                )
            
            # Update metrics
            self.sanctions_checks.labels(
                result='MATCH' if is_sanctioned else 'NO_MATCH'
            ).inc()
            
            # Log the check
            await self.audit_service.log_activity(
                action='SANCTIONS_CHECK',
                resource_type=entity_type,
                resource_id=entity_data.get('id', 'unknown'),
                after_data={
                    'is_sanctioned': is_sanctioned,
                    'matches_found': len(matches)
                },
                compliance_relevant=True
            )
            
            return result_data
            
        except Exception as e:
            logger.error(f"Failed to perform sanctions check: {e}")
            raise
    
    async def monitor_transaction_patterns(
        self,
        user_id: str,
        transactions: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Monitor transaction patterns for suspicious activity"""
        try:
            suspicious_patterns = []
            risk_score = 0.0
            
            if not transactions:
                return {
                    'suspicious_patterns': [],
                    'risk_score': 0.0,
                    'recommendations': []
                }
            
            # Pattern 1: Structuring (amounts just below reporting threshold)
            structuring_count = 0
            for tx in transactions:
                amount = tx.get('amount', 0)
                if 9000 <= amount < 10000:  # Just below $10k threshold
                    structuring_count += 1
            
            if structuring_count >= 3:
                suspicious_patterns.append('STRUCTURING')
                risk_score += 0.6
            
            # Pattern 2: Rapid succession transactions
            transaction_times = [tx.get('timestamp') for tx in transactions if tx.get('timestamp')]
            if len(transaction_times) >= 5:
                # Check if multiple transactions within short time frame
                time_diffs = []
                for i in range(1, len(transaction_times)):
                    diff = abs(transaction_times[i] - transaction_times[i-1])
                    time_diffs.append(diff)
                
                avg_time_diff = sum(time_diffs) / len(time_diffs) if time_diffs else 0
                if avg_time_diff < 300:  # Less than 5 minutes average
                    suspicious_patterns.append('RAPID_SUCCESSION')
                    risk_score += 0.4
            
            # Pattern 3: Round number bias
            round_amounts = sum(1 for tx in transactions if tx.get('amount', 0) % 1000 == 0)
            if round_amounts / len(transactions) > 0.7:
                suspicious_patterns.append('ROUND_AMOUNT_BIAS')
                risk_score += 0.3
            
            # Pattern 4: Geographic anomalies
            countries = [tx.get('country') for tx in transactions if tx.get('country')]
            unique_countries = set(countries)
            if len(unique_countries) > 5:  # Transactions from many countries
                suspicious_patterns.append('GEOGRAPHIC_DISPERSION')
                risk_score += 0.3
            
            # Pattern 5: Unusual timing
            hours = [datetime.fromisoformat(tx.get('timestamp')).hour 
                    for tx in transactions if tx.get('timestamp')]
            night_transactions = sum(1 for hour in hours if hour < 6 or hour > 22)
            if night_transactions / len(hours) > 0.5 if hours else False:
                suspicious_patterns.append('UNUSUAL_TIMING')
                risk_score += 0.2
            
            risk_score = min(risk_score, 1.0)
            
            # Generate recommendations
            recommendations = []
            if 'STRUCTURING' in suspicious_patterns:
                recommendations.append('File Suspicious Activity Report (SAR)')
            if 'RAPID_SUCCESSION' in suspicious_patterns:
                recommendations.append('Review transaction velocity limits')
            if 'GEOGRAPHIC_DISPERSION' in suspicious_patterns:
                recommendations.append('Verify travel patterns and business activities')
            
            result = {
                'user_id': user_id,
                'suspicious_patterns': suspicious_patterns,
                'risk_score': risk_score,
                'recommendations': recommendations,
                'transactions_analyzed': len(transactions),
                'analysis_timestamp': datetime.now(timezone.utc).isoformat()
            }
            
            # Create violation if high risk
            if risk_score >= 0.7:
                await self._create_violation(
                    rule_type='TRANSACTION_MONITORING',
                    entity_type='USER',
                    entity_id=user_id,
                    violation_data={
                        'suspicious_patterns': suspicious_patterns,
                        'risk_score': risk_score,
                        'transaction_count': len(transactions)
                    },
                    risk_score=risk_score
                )
            
            # Log the monitoring
            await self.audit_service.log_activity(
                action='TRANSACTION_PATTERN_ANALYSIS',
                resource_type='USER',
                resource_id=user_id,
                after_data=result,
                compliance_relevant=True
            )
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to monitor transaction patterns: {e}")
            raise
    
    async def get_compliance_violations(
        self,
        status: Optional[str] = None,
        rule_type: Optional[str] = None,
        entity_type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get compliance violations with filtering"""
        try:
            query = select(ComplianceViolation).join(ComplianceRule)
            
            # Apply filters
            conditions = []
            if status:
                conditions.append(ComplianceViolation.status == status)
            if rule_type:
                conditions.append(ComplianceRule.rule_type == rule_type)
            if entity_type:
                conditions.append(ComplianceViolation.entity_type == entity_type)
            
            if conditions:
                query = query.where(and_(*conditions))
            
            query = query.order_by(desc(ComplianceViolation.detected_at))
            query = query.limit(limit).offset(offset)
            
            result = await self.db_session.execute(query)
            violations = result.scalars().all()
            
            violations_data = []
            for violation in violations:
                violations_data.append({
                    'id': str(violation.id),
                    'rule_id': str(violation.rule_id),
                    'entity_type': violation.entity_type,
                    'entity_id': violation.entity_id,
                    'violation_data': violation.violation_data,
                    'risk_score': violation.risk_score,
                    'status': violation.status,
                    'detected_at': violation.detected_at.isoformat(),
                    'resolution_notes': violation.resolution_notes,
                    'resolved_by': violation.resolved_by,
                    'resolved_at': violation.resolved_at.isoformat() if violation.resolved_at else None
                })
            
            return violations_data
            
        except Exception as e:
            logger.error(f"Failed to get compliance violations: {e}")
            raise
    
    async def resolve_violation(
        self,
        violation_id: str,
        resolution_notes: str,
        resolved_by: str,
        status: str = 'RESOLVED'
    ) -> bool:
        """Resolve a compliance violation"""
        try:
            query = select(ComplianceViolation).where(ComplianceViolation.id == violation_id)
            result = await self.db_session.execute(query)
            violation = result.scalar_one_or_none()
            
            if not violation:
                raise ValueError(f"Violation {violation_id} not found")
            
            old_status = violation.status
            violation.status = status
            violation.resolution_notes = resolution_notes
            violation.resolved_by = resolved_by
            violation.resolved_at = datetime.now(timezone.utc)
            
            await self.db_session.commit()
            
            # Log the resolution
            await self.audit_service.log_activity(
                action='RESOLVE_COMPLIANCE_VIOLATION',
                resource_type='COMPLIANCE_VIOLATION',
                resource_id=violation_id,
                before_data={'status': old_status},
                after_data={
                    'status': status,
                    'resolved_by': resolved_by,
                    'resolution_notes': resolution_notes
                },
                compliance_relevant=True
            )
            
            logger.info(
                "Compliance violation resolved",
                violation_id=violation_id,
                status=status,
                resolved_by=resolved_by
            )
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to resolve violation: {e}")
            await self.db_session.rollback()
            raise
    
    async def _create_violation(
        self,
        rule_type: str,
        entity_type: str,
        entity_id: str,
        violation_data: Dict[str, Any],
        risk_score: Optional[float] = None
    ):
        """Create a compliance violation"""
        try:
            # Find applicable rule
            query = select(ComplianceRule).where(
                and_(
                    ComplianceRule.rule_type == rule_type,
                    ComplianceRule.is_active == True
                )
            )
            result = await self.db_session.execute(query)
            rule = result.scalar_one_or_none()
            
            if not rule:
                logger.warning(f"No active rule found for type: {rule_type}")
                return
            
            violation = ComplianceViolation(
                rule_id=rule.id,
                entity_type=entity_type,
                entity_id=entity_id,
                violation_data=violation_data,
                risk_score=risk_score
            )
            
            self.db_session.add(violation)
            await self.db_session.commit()
            
            # Update metrics
            self.violations_detected.labels(
                rule_type=rule_type,
                severity=rule.severity
            ).inc()
            
            logger.warning(
                "Compliance violation detected",
                violation_id=str(violation.id),
                rule_type=rule_type,
                entity_type=entity_type,
                entity_id=entity_id,
                risk_score=risk_score
            )
            
        except Exception as e:
            logger.error(f"Failed to create violation: {e}")
            await self.db_session.rollback()
    
    def _fuzzy_match(self, str1: str, str2: str, threshold: float = 0.8) -> bool:
        """Perform fuzzy string matching"""
        # Simple implementation - in production, use libraries like fuzzywuzzy
        if not str1 or not str2:
            return False
        
        # Exact match
        if str1 == str2:
            return True
        
        # Length difference check
        if abs(len(str1) - len(str2)) > max(len(str1), len(str2)) * 0.3:
            return False
        
        # Simple character overlap ratio
        set1, set2 = set(str1), set(str2)
        intersection = len(set1.intersection(set2))
        union = len(set1.union(set2))
        
        return (intersection / union) >= threshold if union > 0 else False
    
    def _address_match(self, addr1: Dict[str, Any], addr2: Dict[str, Any]) -> bool:
        """Match addresses with some tolerance"""
        # Simple address matching - in production, use address normalization
        street1 = addr1.get('street', '').lower()
        street2 = addr2.get('street', '').lower()
        city1 = addr1.get('city', '').lower()
        city2 = addr2.get('city', '').lower()
        
        return (self._fuzzy_match(street1, street2, 0.7) and 
                self._fuzzy_match(city1, city2, 0.8))
