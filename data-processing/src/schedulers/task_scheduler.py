"""
Task scheduler for automated data processing
"""

import asyncio
import schedule
import time
from datetime import datetime

from ..processors import CryptoDataProcessor, NewsProcessor, PortfolioProcessor, StarkNetProcessor
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class TaskScheduler:
    """Task scheduler for automated processing"""
    
    def __init__(self, crypto_processor: CryptoDataProcessor,
                 news_processor: NewsProcessor,
                 portfolio_processor: PortfolioProcessor,
                 starknet_processor: StarkNetProcessor):
        self.crypto_processor = crypto_processor
        self.news_processor = news_processor
        self.portfolio_processor = portfolio_processor
        self.starknet_processor = starknet_processor
        self.running = False
    
    def setup_schedules(self):
        """Setup scheduled tasks"""
        logger.info("Setting up scheduled tasks")
        
        # Price updates every 5 minutes
        schedule.every(5).minutes.do(self._run_async, self.crypto_processor.update_prices)
        
        # News updates every 30 minutes
        schedule.every(30).minutes.do(self._run_async, self.news_processor.fetch_crypto_news)
        
        # Portfolio updates every 10 minutes
        schedule.every(10).minutes.do(self._run_async, self.portfolio_processor.update_portfolio_values)
        
        # StarkNet metrics every 5 minutes
        schedule.every(5).minutes.do(self._run_async, self.starknet_processor.monitor_network_metrics)
    
    def _run_async(self, coro):
        """Run async function in scheduler"""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            loop.run_until_complete(coro())
            loop.close()
        except Exception as e:
            logger.error(f"Error in scheduled task: {str(e)}")
    
    def start(self):
        """Start the scheduler"""
        logger.info("Starting task scheduler")
        self.running = True
        
        while self.running:
            schedule.run_pending()
            time.sleep(1)
    
    def stop(self):
        """Stop the scheduler"""
        logger.info("Stopping task scheduler")
        self.running = False
