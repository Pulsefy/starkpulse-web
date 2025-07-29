import redis.asyncio as redis
import structlog

from config import config

logger = structlog.get_logger(__name__)

redis_client: redis.Redis = None

async def init_redis():
    """Initializes the Redis client for the API Gateway."""
    global redis_client
    redis_client = redis.Redis(
        host=config.redis_host,
        port=config.redis_port,
        password=config.redis_password,
        db=config.redis_db,
        decode_responses=True
    )
    try:
        await redis_client.ping()
        logger.info("API Gateway Redis connection established.")
    except Exception as e:
        logger.error(f"Failed to connect to API Gateway Redis: {e}")
        redis_client = None # Ensure client is None if connection fails

async def get_redis_client() -> redis.Redis:
    """Dependency to get the Redis client for the API Gateway."""
    if not redis_client:
        await init_redis() # Re-initialize if not already
    if not redis_client:
        raise ConnectionError("API Gateway Redis client not initialized or connected.")
    return redis_client

async def close_redis():
    """Closes the Redis client connection for the API Gateway."""
    if redis_client:
        await redis_client.close()
        logger.info("API Gateway Redis connection closed.")
