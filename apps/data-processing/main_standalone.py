#!/usr/bin/env python3
"""
StarkPulse Data Processing Module - Standalone Version

Runs without database dependencies for testing and development
"""

import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional
import json

# Add the current directory to Python path
sys.path.append(str(Path(__file__).parent / 'src'))

from src.utils.logger import setup_logger

# Initialize logger
logger = setup_logger(__name__)

class StandaloneSettings:
    """Simplified settings that don't require database validation"""
    
    def __init__(self):
        # Environment
        self.environment = os.getenv('ENVIRONMENT', 'development')
        self.debug = os.getenv('DEBUG', 'False').lower() == 'true'
        
        # API Keys
        self.coinmarketcap_api_key = os.getenv('COINMARKETCAP_API_KEY')
        self.coingecko_api_key = os.getenv('COINGECKO_API_KEY')
        self.news_api_key = os.getenv('NEWS_API_KEY')
        
        # API Client Configuration
        self.api_timeout = int(os.getenv('API_TIMEOUT', '30'))
        self.api_max_retries = int(os.getenv('API_MAX_RETRIES', '3'))
        self.api_retry_delay = float(os.getenv('API_RETRY_DELAY', '1.0'))
        self.api_retry_backoff = float(os.getenv('API_RETRY_BACKOFF', '2.0'))
        
        # Rate Limiting
        self.api_rate_limit_requests = int(os.getenv('API_RATE_LIMIT_REQUESTS', '100'))
        self.api_rate_limit_window = int(os.getenv('API_RATE_LIMIT_WINDOW', '60'))
        
        # StarkNet
        self.starknet_rpc_url = os.getenv('STARKNET_RPC_URL', 'https://starknet-mainnet.public.blastapi.io')
        
        # Processing intervals (seconds)
        self.price_update_interval = int(os.getenv('PRICE_UPDATE_INTERVAL', '300'))
        self.news_update_interval = int(os.getenv('NEWS_UPDATE_INTERVAL', '1800'))
        
        # Logging
        self.log_level = os.getenv('LOG_LEVEL', 'INFO')
        self.log_file = os.getenv('LOG_FILE', 'logs/data_processing.log')
    
    def validate(self) -> bool:
        """Validate only API-related configuration"""
        # Only validate API keys that are actually needed
        api_keys = {
            'COINMARKETCAP_API_KEY': self.coinmarketcap_api_key,
            'NEWS_API_KEY': self.news_api_key
        }
        
        missing_keys = [key for key, value in api_keys.items() if not value]
        
        if missing_keys:
            logger.warning(f"Missing API keys: {', '.join(missing_keys)}")
            logger.info("Some features will be disabled without API keys")
        
        return True

class MockDataStorage:
    """Simple in-memory data storage for testing"""
    
    def __init__(self):
        self.price_data = []
        self.news_data = []
        self.portfolio_data = []
    
    def save_price_data(self, data):
        self.price_data.extend(data)
        logger.info(f"Saved {len(data)} price records to memory")
    
    def save_news_data(self, data):
        self.news_data.extend(data)
        logger.info(f"Saved {len(data)} news records to memory")
    
    def get_latest_prices(self, limit=10):
        return self.price_data[-limit:] if self.price_data else []
    
    def export_to_json(self, filename="data_export.json"):
        """Export collected data to JSON file"""
        data = {
            'timestamp': datetime.now().isoformat(),
            'price_data': [{
                'price': str(item.get('price_usd', 0)),
                'timestamp': item.get('timestamp', datetime.now()).isoformat() if hasattr(item.get('timestamp', datetime.now()), 'isoformat') else str(item.get('timestamp', datetime.now())),
                'symbol': item.get('symbol', 'UNKNOWN'),
                'market_cap': str(item.get('market_cap', 0)),
                'volume_24h': str(item.get('volume_24h', 0))
            } for item in self.price_data],
            'news_data': [{
                'title': item.get('title', ''),
                'summary': item.get('summary', ''),
                'timestamp': item.get('timestamp', datetime.now()).isoformat() if hasattr(item.get('timestamp', datetime.now()), 'isoformat') else str(item.get('timestamp', datetime.now())),
                'source': item.get('source', '')
            } for item in self.news_data],
            'portfolio_data': self.portfolio_data
        }
        
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        
        logger.info(f"Data exported to {filename}")

async def fetch_sample_crypto_data(storage: MockDataStorage):
    """Fetch sample cryptocurrency data without database"""
    logger.info("Fetching sample cryptocurrency data...")
    
    try:
        # Create settings
        settings = StandaloneSettings()
        
        if settings.coinmarketcap_api_key:
            try:
                from src.services.api_client import CoinMarketCapClient
                
                cmc_client = CoinMarketCapClient(settings.coinmarketcap_api_key)
                
                # Fetch data for popular cryptocurrencies
                symbols = ['BTC', 'ETH', 'STRK']
                
                async with cmc_client:
                    response = await cmc_client.get_quotes(symbols)
                    
                    if 'data' in response:
                        price_data = []
                        for symbol, data in response['data'].items():
                            usd_quote = data.get('quote', {}).get('USD', {})
                            if usd_quote:
                                price_data.append({
                                    'symbol': symbol,
                                    'price_usd': usd_quote.get('price', 0),
                                    'timestamp': datetime.now(),
                                    'market_cap': usd_quote.get('market_cap', 0),
                                    'volume_24h': usd_quote.get('volume_24h', 0)
                                })
                        
                        storage.save_price_data(price_data)
                        
                        # Display results
                        logger.info("Current Cryptocurrency Prices:")
                        for item in price_data:
                            logger.info(f"{item['symbol']}: ${item['price_usd']:.2f}")
                        return
            except ImportError:
                logger.warning("API client not available. Using mock data.")
        
        # Fallback to mock data
        logger.warning("No CoinMarketCap API key found or API client unavailable. Using mock data.")
        mock_data = [
            {'symbol': 'BTC', 'price_usd': 45000.00, 'timestamp': datetime.now()},
            {'symbol': 'ETH', 'price_usd': 3000.00, 'timestamp': datetime.now()},
            {'symbol': 'STRK', 'price_usd': 1.50, 'timestamp': datetime.now()}
        ]
        storage.save_price_data(mock_data)
        
        logger.info("Mock Cryptocurrency Prices:")
        for item in mock_data:
            logger.info(f"{item['symbol']}: ${item['price_usd']:.2f}")
    
    except Exception as e:
        logger.error(f"Error fetching crypto data: {str(e)}")
        # Still provide mock data on error
        mock_data = [
            {'symbol': 'BTC', 'price_usd': 45000.00, 'timestamp': datetime.now()},
            {'symbol': 'ETH', 'price_usd': 3000.00, 'timestamp': datetime.now()},
            {'symbol': 'STRK', 'price_usd': 1.50, 'timestamp': datetime.now()}
        ]
        storage.save_price_data(mock_data)
        logger.info("Fallback to mock data due to error")

async def fetch_sample_news_data(storage: MockDataStorage):
    """Fetch sample news data without database"""
    logger.info("Fetching sample news data...")
    
    try:
        settings = StandaloneSettings()
        
        if settings.news_api_key:
            logger.info("News API key found but integration not implemented in this example")
        else:
            logger.info("No News API key found. Using mock data.")
        
        # Generate mock news data
        mock_news = [
            {
                'title': 'Bitcoin Reaches New Heights',
                'summary': 'Bitcoin continues its upward trend amid institutional adoption...',
                'timestamp': datetime.now(),
                'source': 'Mock Crypto News'
            },
            {
                'title': 'StarkNet Ecosystem Growth',
                'summary': 'StarkNet sees increased adoption with new DeFi protocols launching...',
                'timestamp': datetime.now(),
                'source': 'Mock Blockchain News'
            }
        ]
        
        storage.save_news_data(mock_news)
        
        logger.info("Latest News:")
        for news in mock_news:
            logger.info(f"- {news['title']}")
    
    except Exception as e:
        logger.error(f"Error fetching news data: {str(e)}")

async def main():
    """
    Main function for standalone data processing
    """
    logger.info("Starting StarkPulse Data Processing (Standalone Mode)...")
    
    try:
        # Initialize configuration
        settings = StandaloneSettings()
        settings.validate()
        
        # Initialize mock storage
        storage = MockDataStorage()
        
        # Run data collection
        logger.info("Running data collection...")
        
        await fetch_sample_crypto_data(storage)
        await fetch_sample_news_data(storage)
        
        # Export data
        storage.export_to_json("starkpulse_data.json")
        
        logger.info("Standalone data processing completed successfully!")
        logger.info(f"Collected {len(storage.price_data)} price records")
        logger.info(f"Collected {len(storage.news_data)} news records")
        logger.info("Data exported to starkpulse_data.json")
        
    except Exception as e:
        logger.error(f"Error in standalone data processing: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())