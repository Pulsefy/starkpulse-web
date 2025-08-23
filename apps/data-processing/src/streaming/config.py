import os
from typing import Dict, List
from dataclasses import dataclass

@dataclass
class StreamingConfig:
    # Redis Configuration
    redis_host: str = os.getenv('STREAMING_REDIS_HOST', 'localhost')
    redis_port: int = int(os.getenv('STREAMING_REDIS_PORT', '6379'))
    redis_password: str = os.getenv('STREAMING_REDIS_PASSWORD', '')
    redis_db: int = int(os.getenv('STREAMING_REDIS_DB', '0'))
    
    # Stream Configuration
    max_stream_length: int = int(os.getenv('STREAMING_MAX_STREAM_LENGTH', '10000'))
    consumer_group: str = os.getenv('STREAMING_CONSUMER_GROUP', 'processors')
    consumer_name: str = os.getenv('STREAMING_CONSUMER_NAME', 'processor_1')
    
    # WebSocket Configuration
    websocket_timeout: int = int(os.getenv('STREAMING_WS_TIMEOUT', '30'))
    reconnect_delay: int = int(os.getenv('STREAMING_RECONNECT_DELAY', '5'))
    max_reconnect_attempts: int = int(os.getenv('STREAMING_MAX_RECONNECT_ATTEMPTS', '10'))
    
    # Rate Limiting
    rate_limit_requests: int = int(os.getenv('STREAMING_RATE_LIMIT_REQUESTS', '100'))
    rate_limit_window: int = int(os.getenv('STREAMING_RATE_LIMIT_WINDOW', '60'))
    backpressure_threshold: int = int(os.getenv('STREAMING_BACKPRESSURE_THRESHOLD', '1000'))
    
    # Monitoring
    prometheus_port: int = int(os.getenv('STREAMING_PROMETHEUS_PORT', '8001'))
    api_port: int = int(os.getenv('STREAMING_API_PORT', '8002'))
    enable_metrics: bool = os.getenv('STREAMING_ENABLE_METRICS', 'true').lower() == 'true'
    
    # Logging
    log_level: str = os.getenv('STREAMING_LOG_LEVEL', 'INFO')
    log_file: str = os.getenv('STREAMING_LOG_FILE', 'logs/streaming.log')
    
    # Provider Configuration
    binance_ws_url: str = 'wss://stream.binance.com:9443/ws'
    coingecko_api_url: str = 'https://api.coingecko.com/api/v3'
    coingecko_api_key: str = os.getenv('COINGECKO_API_KEY', '')
    
    # Symbols to track
    crypto_symbols: List[str] = [
        'BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOTUSDT', 'LINKUSDT',
        'BNBUSDT', 'XRPUSDT', 'LTCUSDT', 'BCHUSDT', 'EOSUSDT'
    ]

# Global config instance
config = StreamingConfig()
