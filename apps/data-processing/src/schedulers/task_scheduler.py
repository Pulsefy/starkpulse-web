import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from typing import Callable, Coroutine, Dict

from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class TaskScheduler:
    """A fully asynchronous task scheduler using APScheduler."""

    def __init__(self):
        self._scheduler = AsyncIOScheduler(timezone="UTC")

    def setup_schedules(self,
                        price_update_job: Callable[[], Coroutine],
                        news_fetch_job: Callable[[], Coroutine],
                        portfolio_update_job: Callable[[], Coroutine],
                        reporting_job: Callable[[], Coroutine],
                        reporting_schedule: Dict[str, str]):
        """
        Adds all required jobs to the scheduler.
        """
        logger.info("Setting up scheduled tasks using APScheduler")

        self._scheduler.add_job(price_update_job, trigger='interval', minutes=5, name='Price Updater')
        self._scheduler.add_job(news_fetch_job, trigger='interval', minutes=30, name='News Fetcher')
        self._scheduler.add_job(portfolio_update_job, trigger='interval', minutes=10, name='Portfolio Updater')

        self._scheduler.add_job(
            reporting_job,
            trigger='cron',
            hour=reporting_schedule.get('hour', '7'),
            minute=reporting_schedule.get('minute', '0'),
            name='Daily Report Generator'
        )

        logger.info("All jobs have been scheduled.")

    def start(self):
        """Starts the scheduler's loop."""
        logger.info("Starting the async scheduler...")
        self._scheduler.start()
        # Log all scheduled jobs and their next run times
        for job in self._scheduler.get_jobs():
            logger.info(f"Scheduled Job: '{job.name}' | Next Run: {job.next_run_time}")

    def stop(self):
        """Stops the scheduler gracefully."""
        logger.info("Stopping the async scheduler...")
        self._scheduler.shutdown()
