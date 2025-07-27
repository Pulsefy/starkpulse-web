import os
from typing import List, Optional
from dataclasses import dataclass

@dataclass
class AuditComplianceConfig:
    # Database Configuration
    database_url: str = os.getenv('AUDIT_DATABASE_URL', 'postgresql+asyncpg://user:pass@localhost/audit_db')
    database_pool_size: int = int(os.getenv('AUDIT_DB_POOL_SIZE', '20'))
    database_max_overflow: int = int(os.getenv('AUDIT_DB_MAX_OVERFLOW', '30'))
    
    # Redis Configuration
    redis_url: str = os.getenv('AUDIT_REDIS_URL', 'redis://localhost:6379/2')
    redis_password: str = os.getenv('AUDIT_REDIS_PASSWORD', '')
    
    # Security Configuration
    secret_key: str = os.getenv('AUDIT_SECRET_KEY', 'your-super-secret-key-change-in-production')
    encryption_key: str = os.getenv('AUDIT_ENCRYPTION_KEY', 'your-32-byte-encryption-key-here!')
    hash_algorithm: str = 'HS256'
    access_token_expire_minutes: int = int(os.getenv('AUDIT_TOKEN_EXPIRE', '30'))
    
    # Audit Configuration
    audit_retention_days: int = int(os.getenv('AUDIT_RETENTION_DAYS', '2555'))  # 7 years
    max_audit_batch_size: int = int(os.getenv('AUDIT_MAX_BATCH_SIZE', '1000'))
    audit_hash_algorithm: str = 'sha256'
    enable_audit_encryption: bool = os.getenv('AUDIT_ENABLE_ENCRYPTION', 'true').lower() == 'true'
    
    # Compliance Configuration
    aml_risk_threshold: float = float(os.getenv('AML_RISK_THRESHOLD', '0.7'))
    kyc_verification_required: bool = os.getenv('KYC_REQUIRED', 'true').lower() == 'true'
    sanctions_check_enabled: bool = os.getenv('SANCTIONS_CHECK_ENABLED', 'true').lower() == 'true'
    transaction_monitoring_enabled: bool = os.getenv('TRANSACTION_MONITORING', 'true').lower() == 'true'
    
    # Reporting Configuration
    report_generation_enabled: bool = os.getenv('REPORT_GENERATION', 'true').lower() == 'true'
    report_storage_path: str = os.getenv('REPORT_STORAGE_PATH', '/app/reports')
    report_retention_days: int = int(os.getenv('REPORT_RETENTION_DAYS', '2555'))
    
    # API Configuration
    api_host: str = os.getenv('AUDIT_API_HOST', '0.0.0.0')
    api_port: int = int(os.getenv('AUDIT_API_PORT', '8003'))
    api_workers: int = int(os.getenv('AUDIT_API_WORKERS', '4'))
    
    # Monitoring Configuration
    prometheus_port: int = int(os.getenv('AUDIT_PROMETHEUS_PORT', '9003'))
    enable_metrics: bool = os.getenv('AUDIT_ENABLE_METRICS', 'true').lower() == 'true'
    
    # Logging Configuration
    log_level: str = os.getenv('AUDIT_LOG_LEVEL', 'INFO')
    log_file: str = os.getenv('AUDIT_LOG_FILE', 'logs/audit.log')
    structured_logging: bool = os.getenv('AUDIT_STRUCTURED_LOGGING', 'true').lower() == 'true'
    
    # Whistleblower Configuration
    whistleblower_enabled: bool = os.getenv('WHISTLEBLOWER_ENABLED', 'true').lower() == 'true'
    anonymous_reporting: bool = os.getenv('ANONYMOUS_REPORTING', 'true').lower() == 'true'
    
    # Regulatory Configuration
    regulatory_jurisdictions: List[str] = os.getenv('REGULATORY_JURISDICTIONS', 'US,EU,UK').split(',')
    ofac_sanctions_list_url: str = os.getenv('OFAC_SANCTIONS_URL', 'https://www.treasury.gov/ofac/downloads/sdn.xml')
    
    # Performance Configuration
    cache_ttl_seconds: int = int(os.getenv('AUDIT_CACHE_TTL', '3600'))
    background_task_workers: int = int(os.getenv('AUDIT_BG_WORKERS', '4'))

# Global config instance
config = AuditComplianceConfig()
