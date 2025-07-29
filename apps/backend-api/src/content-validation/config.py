import os
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class ContentValidationConfig:
    # Database Configuration
    database_url: str = os.getenv('VALIDATION_DATABASE_URL', 'postgresql+asyncpg://user:password@localhost/validation_db')
    
    # Redis Configuration
    redis_host: str = os.getenv('VALIDATION_REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('VALIDATION_REDIS_PORT', '6379'))
    redis_password: str = os.getenv('VALIDATION_REDIS_PASSWORD', '')
    redis_db: int = int(os.getenv('VALIDATION_REDIS_DB', '4')) # Use a dedicated DB for validation
    
    # API Configuration
    api_host: str = os.getenv('VALIDATION_API_HOST', '0.0.0.0')
    api_port: int = int(os.getenv('VALIDATION_API_PORT', '8007'))
    
    # Monitoring
    prometheus_port: int = int(os.getenv('VALIDATION_PROMETHEUS_PORT', '8009'))
    enable_metrics: bool = os.getenv('VALIDATION_ENABLE_METRICS', 'true').lower() == 'true'
    
    # Logging
    log_level: str = os.getenv('VALIDATION_LOG_LEVEL', 'INFO')
    log_file: str = os.getenv('VALIDATION_LOG_FILE', 'logs/content_validation.log')
    
    # Validation Network Parameters
    min_validators_per_content: int = int(os.getenv('MIN_VALIDATORS_PER_CONTENT', '3'))
    consensus_threshold_percent: float = float(os.getenv('CONSENSUS_THRESHOLD_PERCENT', '0.75')) # 75% agreement
    validation_timeout_seconds: int = int(os.getenv('VALIDATION_TIMEOUT_SECONDS', '3600')) # 1 hour
    
    # Reputation Scoring
    initial_reputation: float = float(os.getenv('INITIAL_REPUTATION', '100.0'))
    reputation_gain_on_correct_vote: float = float(os.getenv('REPUTATION_GAIN_ON_CORRECT_VOTE', '1.0'))
    reputation_loss_on_incorrect_vote: float = float(os.getenv('REPUTATION_LOSS_ON_INCORRECT_VOTE', '5.0'))
    reputation_loss_on_malicious_activity: float = float(os.getenv('REPUTATION_LOSS_ON_MALICIOUS_ACTIVITY', '20.0'))
    min_reputation_for_selection: float = float(os.getenv('MIN_REPUTATION_FOR_SELECTION', '50.0'))
    
    # Content Verification (Simplified thresholds)
    plagiarism_threshold: float = float(os.getenv('PLAGIARISM_THRESHOLD', '0.8')) # 80% similarity
    bias_detection_threshold: float = float(os.getenv('BIAS_DETECTION_THRESHOLD', '0.6')) # 60% bias score
    
    # Validator Node Configuration (for a single node running this app)
    # In a real distributed system, each node would have its own ID and API endpoint
    validator_node_id: str = os.getenv('VALIDATOR_NODE_ID', 'validator_node_1')
    validator_node_api_url: str = os.getenv('VALIDATOR_NODE_API_URL', 'http://localhost:8007')

# Global config instance
config = ContentValidationConfig()
