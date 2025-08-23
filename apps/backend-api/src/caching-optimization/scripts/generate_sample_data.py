import asyncio
import sys
import os
import datetime
import random
import uuid
import structlog

# Add the parent directory to the sys.path to allow imports from config and database
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database.database import get_db, init_db, init_redis, close_redis, get_redis_client
from services.product_service import ProductService
from core.cache_service import CacheService
from config import config

logger = structlog.get_logger(__name__)

async def generate_products(product_service: ProductService, db_session, num_products: int = 100):
    logger.info(f"Generating {num_products} sample products...")
    categories = ["Electronics", "Books", "Home & Kitchen", "Apparel", "Sports", "Toys"]
    
    for i in range(num_products):
        name = f"Product {i+1} - {uuid.uuid4().hex[:8]}"
        description = f"Description for product {i+1}."
        price = round(random.uniform(10.0, 1000.0), 2)
        category = random.choice(categories)
        stock = random.randint(0, 200)

        await product_service.create_product(
            db_session, name, description, price, category, stock
        )
        if i % 50 == 0:
            logger.debug(f"Generated {i} products...")
    await db_session.commit()
    logger.info(f"Finished generating {num_products} sample products.")

async def main():
    structlog.configure(
        processors=[
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.JSONRenderer()
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    logger.info("Starting sample data generation for Caching & Optimization feature...")
    
    # Initialize DB and Redis
    await init_db()
    await init_redis()

    async for db_session in get_db():
        redis_client = await get_redis_client()
        cache_service = CacheService(redis_client)
        product_service = ProductService(cache_service)

        await generate_products(product_service, db_session, num_products=200)
        
        # Optionally warm cache after generating data
        await product_service.warm_product_cache(db_session)

    await close_redis()
    logger.info("Sample data generation complete.")

if __name__ == "__main__":
    asyncio.run(main())
