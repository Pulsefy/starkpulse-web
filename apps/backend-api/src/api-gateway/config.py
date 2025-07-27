import os
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class APIGatewayConfig:
    # Gateway Core Configuration
    api_host: str = os.getenv('GATEWAY_API_HOST', '0.0.0.0')
    api_port: int = int(os.getenv('GATEWAY_API_PORT', '8000'))
    
    # Upstream Services Configuration (Example: mapping path prefixes to service URLs)
    # In a real scenario, this might come from a service discovery system
    upstream_services: Dict[str, List[str]] = {
        "/products": [
            os.getenv('UPSTREAM_PRODUCTS_V1', 'http://localhost:8005/api/v1/products'),
            # Add more instances for load balancing
        ],
        "/audit": [
            os.getenv('UPSTREAM_AUDIT_V1', 'http://localhost:8003/api/v1/audit'),
        ],
        "/news": [
            os.getenv('UPSTREAM_NEWS_V1', 'http://localhost:8007/api/v1/news'), # Placeholder for a new service
        ]
    }
    
    # Rate Limiting Configuration (per API Key)
    # Format: {api_key_id: {limit: int, window_seconds: int}}
    # Example tiers:
    #   'basic_tier': {'limit': 100, 'window_seconds': 60} (100 requests per minute)
    #   'premium_tier': {'limit': 1000, 'window_seconds': 60} (1000 requests per minute)
    #   'unlimited_tier': {'limit': 0, 'window_seconds': 0} (no limit)
    rate_limits: Dict[str, Dict[str, int]] = {
        'default': {'limit': 50, 'window_seconds': 60}, # Default for unknown keys
        'api_key_basic': {'limit': 100, 'window_seconds': 60},
        'api_key_premium': {'limit': 1000, 'window_seconds': 60},
        'api_key_unlimited': {'limit': 0, 'window_seconds': 0}, # 0 means no limit
    }
    
    # API Key Management (for demonstration, in-memory)
    # In production, this would be a secure database or vault
    api_keys: Dict[str, str] = { # {api_key: tier_name}
        'YOUR_BASIC_API_KEY': 'api_key_basic',
        'YOUR_PREMIUM_API_KEY': 'api_key_premium',
        'YOUR_UNLIMITED_API_KEY': 'api_key_unlimited',
    }
    
    # Redis Configuration for Rate Limiting and API Key storage
    redis_host: str = os.getenv('GATEWAY_REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('GATEWAY_REDIS_PORT', '6379'))
    redis_password: str = os.getenv('GATEWAY_REDIS_PASSWORD', '')
    redis_db: int = int(os.getenv('GATEWAY_REDIS_DB', '3')) # Use a dedicated DB for gateway
    
    # Monitoring
    prometheus_port: int = int(os.getenv('GATEWAY_PROMETHEUS_PORT', '8008'))
    enable_metrics: bool = os.getenv('GATEWAY_ENABLE_METRICS', 'true').lower() == 'true'
    
    # Logging
    log_level: str = os.getenv('GATEWAY_LOG_LEVEL', 'INFO')
    log_file: str = os.getenv('GATEWAY_LOG_FILE', 'logs/api_gateway.log')
    
    # SLA Monitoring (conceptual thresholds)
    sla_max_response_time_ms: int = int(os.getenv('SLA_MAX_RESPONSE_TIME_MS', '500'))
    sla_max_error_rate_percent: float = float(os.getenv('SLA_MAX_ERROR_RATE_PERCENT', '1.0')) # 1%

# Global config instance
config = APIGatewayConfig()
