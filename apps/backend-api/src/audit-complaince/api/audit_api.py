from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, HTTPException, Depends, Query, Path
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
import structlog
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit_service import AuditService
from core.compliance_service import ComplianceService
from core.reporting_service import ReportingService
from core.whistleblower_service import WhistleblowerService
from database.models import Base
from config import config

logger = structlog.get_logger(__name__)

app = FastAPI(
    title="Audit & Compliance API",
    description="Comprehensive audit and compliance system API",
    version="1.0.0"
)

# Pydantic models
class AuditLogRequest(BaseModel):
    action: str = Field(..., description="Action performed")
    resource_type: str = Field(..., description="Type of resource")
    user_id: Optional[str] = Field(None, description="User ID")
    resource_id: Optional[str] = Field(None, description="Resource ID")
    before_data: Optional[Dict[str, Any]] = Field(None, description="Data before change")
    after_data: Optional[Dict[str, Any]] = Field(None, description="Data after change")
    metadata: Optional[Dict[str, Any]] = Field(None, description="Additional metadata")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    session_id: Optional[str] = Field(None, description="Session ID")
    compliance_relevant: bool = Field(False, description="Is compliance relevant")

class ComplianceRuleRequest(BaseModel):
    name: str = Field(..., description="Rule name")
    description: str = Field(..., description="Rule description")
    rule_type: str = Field(..., description="Rule type (AML, KYC, SANCTIONS, etc.)")
    jurisdiction: str = Field(..., description="Jurisdiction code")
    conditions: Dict[str, Any] = Field(..., description="Rule conditions")
    actions: Dict[str, Any] = Field(..., description="Rule actions")
    severity: str = Field("MEDIUM", description="Rule severity")

class WhistleblowerReportRequest(BaseModel):
    title: str = Field(..., description="Report title")
    description: str = Field(..., description="Report description")
    category: str = Field(..., description="Report category")
    severity: str = Field("MEDIUM", description="Report severity")
    reporter_contact: Optional[str] = Field(None, description="Reporter contact")
    evidence_data: Optional[Dict[str, Any]] = Field(None, description="Evidence data")
    is_anonymous: bool = Field(True, description="Is anonymous report")

class ViolationResolutionRequest(BaseModel):
    resolution_notes: str = Field(..., description="Resolution notes")
    resolved_by: str = Field(..., description="Resolved by user")
    status: str = Field("RESOLVED", description="New status")

# Dependency to get database session
async def get_db_session():
    # This would be implemented with your database connection logic
    pass

# Dependency to get audit service
async def get_audit_service(db: AsyncSession = Depends(get_db_session)):
    return AuditService(db)

# Dependency to get compliance service
async def get_compliance_service(
    db: AsyncSession = Depends(get_db_session),
    audit_service: AuditService = Depends(get_audit_service)
):
    return ComplianceService(db, audit_service)

# Dependency to get reporting service
async def get_reporting_service(
    db: AsyncSession = Depends(get_db_session),
    audit_service: AuditService = Depends(get_audit_service)
):
    return ReportingService(db, audit_service)

# Dependency to get whistleblower service
async def get_whistleblower_service(
    db: AsyncSession = Depends(get_db_session),
    audit_service: AuditService = Depends(get_audit_service)
):
    return WhistleblowerService(db, audit_service)

# Audit endpoints
@app.post("/api/v1/audit/log", response_model=Dict[str, str])
async def create_audit_log(
    request: AuditLogRequest,
    audit_service: AuditService = Depends(get_audit_service)
):
    """Create a new audit log entry"""
    try:
        audit_id = await audit_service.log_activity(
            action=request.action,
            resource_type=request.resource_type,
            user_id=request.user_id,
            resource_id=request.resource_id,
            before_data=request.before_data,
            after_data=request.after_data,
            metadata=request.metadata,
            ip_address=request.ip_address,
            user_agent=request.user_agent,
            session_id=request.session_id,
            compliance_relevant=request.compliance_relevant
        )
        
        return {"audit_id": audit_id}
        
    except Exception as e:
        logger.error(f"Failed to create audit log: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/audit/trail", response_model=List[Dict[str, Any]])
async def get_audit_trail(
    resource_type: Optional[str] = Query(None),
    resource_id: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Get audit trail with filtering"""
    try:
        trail = await audit_service.get_audit_trail(
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id,
            action=action,
            start_date=start_date,
            end_date=end_date,
            limit=limit,
            offset=offset
        )
        
        return trail
        
    except Exception as e:
        logger.error(f"Failed to get audit trail: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/audit/integrity", response_model=Dict[str, Any])
async def verify_audit_integrity(
    start_date: Optional[datetime] = Query(None),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Verify audit chain integrity"""
    try:
        integrity_status = await audit_service.verify_integrity(start_date=start_date)
        return integrity_status
        
    except Exception as e:
        logger.error(f"Failed to verify audit integrity: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/audit/export", response_model=Dict[str, Any])
async def export_audit_data(
    format_type: str = Query("json", regex="^(json|csv)$"),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    audit_service: AuditService = Depends(get_audit_service)
):
    """Export audit data"""
    try:
        export_data = await audit_service.export_audit_data(
            format_type=format_type,
            start_date=start_date,
            end_date=end_date
        )
        
        return export_data
        
    except Exception as e:
        logger.error(f"Failed to export audit data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Compliance endpoints
@app.post("/api/v1/compliance/rules", response_model=Dict[str, str])
async def create_compliance_rule(
    request: ComplianceRuleRequest,
    compliance_service: ComplianceService = Depends(get_compliance_service)
):
    """Create a new compliance rule"""
    try:
        rule_id = await compliance_service.create_compliance_rule(
            name=request.name,
            description=request.description,
            rule_type=request.rule_type,
            jurisdiction=request.jurisdiction,
            conditions=request.conditions,
            actions=request.actions,
            severity=request.severity
        )
        
        return {"rule_id": rule_id}
        
    except Exception as e:
        logger.error(f"Failed to create compliance rule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/compliance/aml-check", response_model=Dict[str, Any])
async def perform_aml_check(
    entity_type: str,
    entity_id: str,
    transaction_data: Dict[str, Any],
    compliance_service: ComplianceService = Depends(get_compliance_service)
):
    """Perform AML compliance check"""
    try:
        assessment = await compliance_service.check_aml_compliance(
            entity_type=entity_type,
            entity_id=entity_id,
            transaction_data=transaction_data
        )
        
        return {
            "entity_id": assessment.entity_id,
            "entity_type": assessment.entity_type,
            "risk_score": assessment.risk_score,
            "risk_factors": assessment.risk_factors,
            "recommendations": assessment.recommendations
        }
        
    except Exception as e:
        logger.error(f"Failed to perform AML check: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/compliance/sanctions-check", response_model=Dict[str, Any])
async def perform_sanctions_check(
    entity_type: str,
    entity_data: Dict[str, Any],
    compliance_service: ComplianceService = Depends(get_compliance_service)
):
    """Perform sanctions compliance check"""
    try:
        result = await compliance_service.check_sanctions_compliance(
            entity_type=entity_type,
            entity_data=entity_data
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to perform sanctions check: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/compliance/violations", response_model=List[Dict[str, Any]])
async def get_compliance_violations(
    status: Optional[str] = Query(None),
    rule_type: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    compliance_service: ComplianceService = Depends(get_compliance_service)
):
    """Get compliance violations"""
    try:
        violations = await compliance_service.get_compliance_violations(
            status=status,
            rule_type=rule_type,
            entity_type=entity_type,
            limit=limit,
            offset=offset
        )
        
        return violations
        
    except Exception as e:
        logger.error(f"Failed to get compliance violations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/api/v1/compliance/violations/{violation_id}/resolve")
async def resolve_compliance_violation(
    violation_id: str = Path(...),
    request: ViolationResolutionRequest = ...,
    compliance_service: ComplianceService = Depends(get_compliance_service)
):
    """Resolve a compliance violation"""
    try:
        success = await compliance_service.resolve_violation(
            violation_id=violation_id,
            resolution_notes=request.resolution_notes,
            resolved_by=request.resolved_by,
            status=request.status
        )
        
        return {"success": success}
        
    except Exception as e:
        logger.error(f"Failed to resolve violation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Reporting endpoints
@app.post("/api/v1/reports/sar", response_model=Dict[str, str])
async def generate_sar_report(
    period_start: datetime,
    period_end: datetime,
    jurisdiction: str = "US",
    reporting_service: ReportingService = Depends(get_reporting_service)
):
    """Generate Suspicious Activity Report"""
    try:
        report_id = await reporting_service.generate_sar_report(
            period_start=period_start,
            period_end=period_end,
            jurisdiction=jurisdiction
        )
        
        return {"report_id": report_id}
        
    except Exception as e:
        logger.error(f"Failed to generate SAR report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/reports/ctr", response_model=Dict[str, str])
async def generate_ctr_report(
    period_start: datetime,
    period_end: datetime,
    jurisdiction: str = "US",
    reporting_service: ReportingService = Depends(get_reporting_service)
):
    """Generate Currency Transaction Report"""
    try:
        report_id = await reporting_service.generate_ctr_report(
            period_start=period_start,
            period_end=period_end,
            jurisdiction=jurisdiction
        )
        
        return {"report_id": report_id}
        
    except Exception as e:
        logger.error(f"Failed to generate CTR report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/reports/dashboard", response_model=Dict[str, Any])
async def get_compliance_dashboard(
    reporting_service: ReportingService = Depends(get_reporting_service)
):
    """Get compliance dashboard data"""
    try:
        dashboard_data = await reporting_service.generate_compliance_dashboard_data()
        return dashboard_data
        
    except Exception as e:
        logger.error(f"Failed to get dashboard data: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Whistleblower endpoints
@app.post("/api/v1/whistleblower/reports", response_model=Dict[str, str])
async def submit_whistleblower_report(
    request: WhistleblowerReportRequest,
    whistleblower_service: WhistleblowerService = Depends(get_whistleblower_service)
):
    """Submit a whistleblower report"""
    try:
        report_id = await whistleblower_service.submit_report(
            title=request.title,
            description=request.description,
            category=request.category,
            severity=request.severity,
            reporter_contact=request.reporter_contact,
            evidence_data=request.evidence_data,
            is_anonymous=request.is_anonymous
        )
        
        return {"report_id": report_id}
        
    except Exception as e:
        logger.error(f"Failed to submit whistleblower report: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/whistleblower/reports", response_model=List[Dict[str, Any]])
async def get_whistleblower_reports(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    whistleblower_service: WhistleblowerService = Depends(get_whistleblower_service)
):
    """Get whistleblower reports"""
    try:
        reports = await whistleblower_service.get_reports(
            status=status,
            category=category,
            severity=severity,
            limit=limit,
            offset=offset
        )
        
        return reports
        
    except Exception as e:
        logger.error(f"Failed to get whistleblower reports: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/whistleblower/reports/{report_id}", response_model=Dict[str, Any])
async def get_whistleblower_report_details(
    report_id: str = Path(...),
    include_sensitive: bool = Query(False),
    whistleblower_service: WhistleblowerService = Depends(get_whistleblower_service)
):
    """Get whistleblower report details"""
    try:
        report = await whistleblower_service.get_report_details(
            report_id=report_id,
            include_sensitive=include_sensitive
        )
        
        return report
        
    except Exception as e:
        logger.error(f"Failed to get report details: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Health check endpoint
@app.get("/api/v1/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host=config.api_host,
        port=config.api_port,
        workers=config.api_workers
    )
