"""
Configuration management for StarkPulse Data Processing
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """
    Configuration class for data processing module
    """
    
    def __init__(self):
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.debug = os.getenv('DEBUG', 'False').lower() == 'true'
        
        # Database configuration
        self.database_url = os.getenv('DATABASE_URL')
        self.redis_url = os.getenv('REDIS_URL', 'redis://localhost:6379')
        
        # API Keys
        self.coinmarketcap_api_key = os.getenv('COINMARKETCAP_API_KEY')
        self.coingecko_api_key = os.getenv('COINGECKO_API_KEY')
        self.news_api_key = os.getenv('NEWS_API_KEY')
        
        # StarkNet configuration
        self.starknet_rpc_url = os.getenv('STARKNET_RPC_URL', 'https://starknet-mainnet.public.blastapi.io')
        self.starknet_private_key = os.getenv('STARKNET_PRIVATE_KEY')
        
        # Processing intervals (in seconds)
        self.price_update_interval = int(os.getenv('PRICE_UPDATE_INTERVAL', '300'))  # 5 minutes
        self.news_update_interval = int(os.getenv('NEWS_UPDATE_INTERVAL', '1800'))   # 30 minutes
        
        # Logging
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        self.log_file = os.getenv('LOG_FILE', 'logs/data_processing.log')
        
        ## API Providers dictionary here
        self.api_providers = {
            "crypto_prices": {
                "primary": {
                    "name": "coingecko",
                    "base_url": "https://api.coingecko.com/api/v3/",
                    "api_key": self.coingecko_api_key,
                    "rate_limit": 50,  # requests per minute
                    "cost_per_call": 0.001,
                },
                "failover": {
                    "name": "coinmarketcap",
                    "base_url": "https://pro-api.coinmarketcap.com/v1/",
                    "api_key": self.coinmarketcap_api_key,
                    "rate_limit": 30,
                    "cost_per_call": 0.005,
                },
            },
            "news": {
                "primary": {
                    "name": "newsapi",
                    "base_url": "https://newsapi.org/v2/",
                    "api_key": self.news_api_key,
                    "rate_limit": 100,
                    "cost_per_call": 0.0,
                }
            }
        
        }
    
    def validate(self) -> bool:
        """
        Validate required configuration
        """
        required_vars = [
            'DATABASE_URL',
            'COINMARKETCAP_API_KEY',
            'NEWS_API_KEY',
            'COINGECKO_API_KEY' 
        ]
        
        missing_vars = [var for var in required_vars if not getattr(self, var.lower())]
        
        if missing_vars:
            raise ValueError(f"Missing required environment variables: {', '.join(missing_vars)}")
        
        return True