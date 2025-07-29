import asyncio
import structlog
from database.database import get_db
from services.product_service import ProductService
from core.cache_service import CacheService
from config import config

logger = structlog.get_logger(__name__)

async def start_cache_warming_task(product_service: ProductService):
    """Starts a periodic task to warm up the cache."""
    while True:
        try:
            async for db_session in get_db():
                await product_service.warm_product_cache(db_session)
            logger.info(f"Cache warming completed. Next run in {config.cache_warming_interval_seconds} seconds.")
        except Exception as e:
            logger.error(f"Error during cache warming task: {e}")
        await asyncio.sleep(config.cache_warming_interval_seconds)
