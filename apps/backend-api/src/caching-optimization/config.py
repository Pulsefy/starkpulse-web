import os
from dataclasses import dataclass

@dataclass
class CachingOptimizationConfig:
    # Redis Configuration
    redis_host: str = os.getenv('CACHING_REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('CACHING_REDIS_PORT', '6379'))
    redis_password: str = os.getenv('CACHING_REDIS_PASSWORD', '')
    redis_db: int = int(os.getenv('CACHING_REDIS_DB', '2')) # Use a different DB for caching
    
    # Cache TTLs (Time To Live in seconds)
    default_cache_ttl: int = int(os.getenv('CACHING_DEFAULT_TTL', '300')) # 5 minutes
    long_cache_ttl: int = int(os.getenv('CACHING_LONG_TTL', '3600')) # 1 hour
    short_cache_ttl: int = int(os.getenv('CACHING_SHORT_TTL', '60')) # 1 minute
    
    # Cache Warming/Preloading
    cache_warming_interval_seconds: int = int(os.getenv('CACHING_WARMING_INTERVAL', '300')) # Every 5 minutes
    
    # API Configuration
    api_host: str = os.getenv('CACHING_API_HOST', '0.0.0.0')
    api_port: int = int(os.getenv('CACHING_API_PORT', '8005'))
    
    # Monitoring
    prometheus_port: int = int(os.getenv('CACHING_PROMETHEUS_PORT', '8006'))
    enable_metrics: bool = os.getenv('CACHING_ENABLE_METRICS', 'true').lower() == 'true'
    
    # Logging
    log_level: str = os.getenv('CACHING_LOG_LEVEL', 'INFO')
    log_file: str = os.getenv('CACHING_LOG_FILE', 'logs/caching_optimization.log')

# Global config instance
config = CachingOptimizationConfig()
