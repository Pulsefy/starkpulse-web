#!/usr/bin/env python3
"""
Generate sample data for testing the Audit & Compliance System
"""

import asyncio
import sys
import random
from datetime import datetime, timezone, timedelta
from pathlib import Path
from faker import Faker

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from core.audit_service import AuditService
from core.compliance_service import ComplianceService
from core.whistleblower_service import WhistleblowerService
from config import config
import structlog

logger = structlog.get_logger(__name__)
fake = Faker()

async def generate_audit_logs(audit_service: AuditService, count: int = 1000):
    """Generate sample audit logs"""
    try:
        logger.info(f"Generating {count} sample audit logs...")
        
        actions = [
            "CREATE_USER", "UPDATE_USER", "DELETE_USER", "LOGIN", "LOGOUT",
            "CREATE_TRANSACTION", "UPDATE_TRANSACTION", "CANCEL_TRANSACTION",
            "CREATE_ACCOUNT", "UPDATE_ACCOUNT", "CLOSE_ACCOUNT",
            "UPLOAD_DOCUMENT", "VERIFY_IDENTITY", "CHANGE_PASSWORD"
        ]
        
        resource_types = ["USER", "TRANSACTION", "ACCOUNT", "DOCUMENT", "SESSION"]
        
        for i in range(count):
            action = random.choice(actions)
            resource_type = random.choice(resource_types)
            
            # Generate realistic before/after data based on action
            before_data = None
            after_data = None
            
            if action == "CREATE_USER":
                after_data = {
                    "email": fake.email(),
                    "status": "active",
                    "created_at": fake.date_time().isoformat()
                }
            elif action == "UPDATE_USER":
                before_data = {"status": "pending"}
                after_data = {"status": "verified"}
            elif action == "CREATE_TRANSACTION":
                after_data = {
                    "amount": round(random.uniform(100, 50000), 2),
                    "currency": random.choice(["USD", "EUR", "GBP"]),
                    "type": random.choice(["deposit", "withdrawal", "transfer"]),
                    "status": "pending"
                }
            elif action == "LOGIN":
                after_data = {
                    "session_id": fake.uuid4(),
                    "ip_address": fake.ipv4(),
                    "user_agent": fake.user_agent()
                }
            
            await audit_service.log_activity(
                action=action,
                resource_type=resource_type,
                user_id=fake.uuid4(),
                resource_id=fake.uuid4(),
                before_data=before_data,
                after_data=after_data,
                metadata={
                    "source": random.choice(["web", "mobile", "api"]),
                    "version": "1.0.0"
                },
                ip_address=fake.ipv4(),
                user_agent=fake.user_agent(),
                session_id=fake.uuid4(),
                compliance_relevant=random.choice([True, False])
            )
            
            if i % 100 == 0:
                logger.info(f"Generated {i} audit logs...")
        
        logger.info(f"Successfully generated {count} audit logs")
        
    except Exception as e:
        logger.error(f"Failed to generate audit logs: {e}")
        raise

async def generate_compliance_violations(compliance_service: ComplianceService, count: int = 50):
    """Generate sample compliance violations"""
    try:
        logger.info(f"Generating {count} sample compliance violations...")
        
        # Generate AML violations
        for i in range(count // 2):
            transaction_data = {
                "amount": random.uniform(10000, 100000),
                "daily_transaction_count": random.randint(5, 20),
                "country": random.choice(["US", "AF", "IR", "KP", "SY"]),
                "is_round_amount": random.choice([True, False]),
                "rapid_movement": random.choice([True, False])
            }
            
            await compliance_service.check_aml_compliance(
                entity_type="USER",
                entity_id=fake.uuid4(),
                transaction_data=transaction_data
            )
        
        # Generate transaction monitoring violations
        for i in range(count // 2):
            transactions = []
            for j in range(random.randint(5, 15)):
                transactions.append({
                    "amount": random.uniform(9000, 9999),  # Structuring amounts
                    "timestamp": (datetime.now(timezone.utc) - timedelta(hours=j)).timestamp(),
                    "country": "US"
                })
            
            await compliance_service.monitor_transaction_patterns(
                user_id=fake.uuid4(),
                transactions=transactions
            )
        
        logger.info(f"Successfully generated compliance violations")
        
    except Exception as e:
        logger.error(f"Failed to generate compliance violations: {e}")
        raise

async def generate_whistleblower_reports(whistleblower_service: WhistleblowerService, count: int = 20):
    """Generate sample whistleblower reports"""
    try:
        logger.info(f"Generating {count} sample whistleblower reports...")
        
        categories = ["FRAUD", "CORRUPTION", "SAFETY", "DISCRIMINATION", "HARASSMENT", "FINANCIAL_MISCONDUCT"]
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        
        for i in range(count):
            category = random.choice(categories)
            severity = random.choice(severities)
            is_anonymous = random.choice([True, False])
            
            title = f"{category.title()} Report #{i+1}"
            description = fake.text(max_nb_chars=500)
            
            evidence_data = None
            if random.choice([True, False]):
                evidence_data = {
                    "documents": [f"evidence_{j}.pdf" for j in range(random.randint(1, 3))],
                    "witnesses": [fake.name() for _ in range(random.randint(0, 2))],
                    "incident_date": fake.date_time().isoformat(),
                    "location": fake.address()
                }
            
            await whistleblower_service.submit_report(
                title=title,
                description=description,
                category=category,
                severity=severity,
                reporter_contact=None if is_anonymous else fake.email(),
                evidence_data=evidence_data,
                is_anonymous=is_anonymous
            )
        
        logger.info(f"Successfully generated {count} whistleblower reports")
        
    except Exception as e:
        logger.error(f"Failed to generate whistleblower reports: {e}")
        raise

async def main():
    """Main data generation function"""
    try:
        logger.info("Starting sample data generation...")
        
        # Create database connection
        engine = create_async_engine(config.database_url)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            # Initialize services
            audit_service = AuditService(session)
            compliance_service = ComplianceService(session, audit_service)
            whistleblower_service = WhistleblowerService(session, audit_service)
            
            # Generate sample data
            await generate_audit_logs(audit_service, count=1000)
            await generate_compliance_violations(compliance_service, count=50)
            await generate_whistleblower_reports(whistleblower_service, count=20)
        
        await engine.dispose()
        logger.info("Sample data generation completed successfully!")
        
    except Exception as e:
        logger.error(f"Sample data generation failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
