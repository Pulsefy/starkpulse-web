"""
Application settings and configuration management
"""

import os
from dotenv import load_dotenv

load_dotenv()

class Settings:
    """Centralized configuration management"""
    
    def __init__(self):
        # Environment
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.debug = os.getenv('DEBUG', 'False').lower() == 'true'
        
        # Database
        self.database_url = os.getenv('DATABASE_URL')
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        
        # API Keys
        self.coinmarketcap_api_key = os.getenv('COINMARKETCAP_API_KEY')
        self.coingecko_api_key = os.getenv('COINGECKO_API_KEY')
        self.news_api_key = os.getenv('NEWS_API_KEY')
        
        # StarkNet
        self.starknet_rpc_url = os.getenv('STARKNET_RPC_URL', 'https://starknet-mainnet.public.blastapi.io')
        
        # Processing intervals (seconds)
        self.price_update_interval = int(os.getenv('PRICE_UPDATE_INTERVAL', '300'))
        self.news_update_interval = int(os.getenv('NEWS_UPDATE_INTERVAL', '1800'))
        
        # Logging
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        self.log_file = os.getenv('LOG_FILE', 'logs/data_processing.log')
    
    def validate(self) -> bool:
        """Validate required configuration"""
        required_vars = ['DATABASE_URL', 'COINMARKETCAP_API_KEY', 'NEWS_API_KEY']
        missing_vars = [var for var in required_vars if not getattr(self, var.lower())]
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        return True
