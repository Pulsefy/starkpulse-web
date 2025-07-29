#!/usr/bin/env python3
"""
Database setup script for Audit & Compliance System
Creates tables and initial data
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from database.models import Base, ComplianceRule, SanctionsList
from config import config
import structlog

logger = structlog.get_logger(__name__)

async def create_tables():
    """Create all database tables"""
    try:
        engine = create_async_engine(
            config.database_url,
            echo=True,
            pool_size=config.database_pool_size,
            max_overflow=config.database_max_overflow
        )
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        logger.info("Database tables created successfully")
        await engine.dispose()
        
    except Exception as e:
        logger.error(f"Failed to create database tables: {e}")
        raise

async def create_default_compliance_rules():
    """Create default compliance rules"""
    try:
        engine = create_async_engine(config.database_url)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            # AML Rule for large transactions
            aml_rule = ComplianceRule(
                name="Large Transaction Monitoring",
                description="Monitor transactions above $10,000 for AML compliance",
                rule_type="AML",
                jurisdiction="US",
                conditions={
                    "amount_threshold": 10000,
                    "currency": "USD",
                    "time_window_hours": 24
                },
                actions={
                    "alert": True,
                    "require_documentation": True,
                    "escalate_to_compliance": True
                },
                severity="HIGH",
                created_by="system"
            )
            
            # KYC Rule for identity verification
            kyc_rule = ComplianceRule(
                name="Identity Verification Requirement",
                description="Require KYC verification for new accounts",
                rule_type="KYC",
                jurisdiction="US",
                conditions={
                    "account_age_days": 0,
                    "verification_required": True
                },
                actions={
                    "block_transactions": True,
                    "require_documents": ["passport", "utility_bill"],
                    "manual_review": True
                },
                severity="CRITICAL",
                created_by="system"
            )
            
            # Sanctions screening rule
            sanctions_rule = ComplianceRule(
                name="OFAC Sanctions Screening",
                description="Screen all entities against OFAC sanctions lists",
                rule_type="SANCTIONS",
                jurisdiction="US",
                conditions={
                    "screening_required": True,
                    "lists": ["OFAC_SDN", "OFAC_CONS"]
                },
                actions={
                    "block_immediately": True,
                    "alert_compliance": True,
                    "freeze_assets": True
                },
                severity="CRITICAL",
                created_by="system"
            )
            
            # Transaction monitoring rule
            transaction_rule = ComplianceRule(
                name="Suspicious Transaction Patterns",
                description="Monitor for suspicious transaction patterns",
                rule_type="TRANSACTION_MONITORING",
                jurisdiction="US",
                conditions={
                    "structuring_threshold": 3,
                    "velocity_threshold": 10,
                    "round_amount_ratio": 0.7
                },
                actions={
                    "flag_for_review": True,
                    "generate_sar": True,
                    "enhanced_monitoring": True
                },
                severity="HIGH",
                created_by="system"
            )
            
            # Add rules to session
            session.add_all([aml_rule, kyc_rule, sanctions_rule, transaction_rule])
            await session.commit()
            
            logger.info("Default compliance rules created successfully")
        
        await engine.dispose()
        
    except Exception as e:
        logger.error(f"Failed to create default compliance rules: {e}")
        raise

async def create_sample_sanctions_data():
    """Create sample sanctions list data"""
    try:
        engine = create_async_engine(config.database_url)
        async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        
        async with async_session() as session:
            # Sample sanctioned individuals
            sanctions_entries = [
                SanctionsList(
                    list_name="OFAC SDN",
                    source="OFAC",
                    entity_type="INDIVIDUAL",
                    name="John Sanctioned",
                    aliases=["Johnny S", "J. Sanctioned"],
                    addresses=[
                        {"street": "123 Blocked St", "city": "Restricted City", "country": "XX"}
                    ],
                    identifiers={"passport": "XX123456", "ssn": "XXX-XX-XXXX"}
                ),
                SanctionsList(
                    list_name="OFAC SDN",
                    source="OFAC",
                    entity_type="ENTITY",
                    name="Blocked Corporation Ltd",
                    aliases=["BC Ltd", "Blocked Corp"],
                    addresses=[
                        {"street": "456 Embargo Ave", "city": "Sanctions Town", "country": "XX"}
                    ],
                    identifiers={"tax_id": "XX-1234567", "registration": "BC123456"}
                ),
                SanctionsList(
                    list_name="EU Sanctions",
                    source="EU",
                    entity_type="INDIVIDUAL",
                    name="Maria Restricted",
                    aliases=["M. Restricted"],
                    addresses=[
                        {"street": "789 Forbidden Rd", "city": "Prohibited Place", "country": "YY"}
                    ],
                    identifiers={"passport": "YY789012"}
                )
            ]
            
            session.add_all(sanctions_entries)
            await session.commit()
            
            logger.info("Sample sanctions data created successfully")
        
        await engine.dispose()
        
    except Exception as e:
        logger.error(f"Failed to create sample sanctions data: {e}")
        raise

async def main():
    """Main setup function"""
    try:
        logger.info("Starting database setup...")
        
        # Create tables
        await create_tables()
        
        # Create default compliance rules
        await create_default_compliance_rules()
        
        # Create sample sanctions data
        await create_sample_sanctions_data()
        
        logger.info("Database setup completed successfully!")
        
    except Exception as e:
        logger.error(f"Database setup failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())
