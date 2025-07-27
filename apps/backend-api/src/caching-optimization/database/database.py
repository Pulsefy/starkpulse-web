from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import redis.asyncio as redis
import structlog

from config import config
from database.models import Base

logger = structlog.get_logger(__name__)

# Database setup (using a simple SQLite for this example, but can be PostgreSQL)
# For a real project, use config.database_url from a shared config or env var
engine = create_async_engine("sqlite+aiosqlite:///./test.db", echo=False)
AsyncSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    class_=AsyncSession
)

# Redis client
redis_client: redis.Redis = None

async def init_db():
    """Initializes the database by creating all tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created/verified.")

async def get_db():
    """Dependency to get an async database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_redis():
    """Initializes the Redis client."""
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
        logger.info("Redis connection established.")
    except Exception as e:
        logger.error(f"Failed to connect to Redis: {e}")
        redis_client = None # Ensure client is None if connection fails

async def get_redis_client() -> redis.Redis:
    """Dependency to get the Redis client."""
    if not redis_client:
        await init_redis() # Re-initialize if not already
    if not redis_client:
        raise ConnectionError("Redis client not initialized or connected.")
    return redis_client

async def close_redis():
    """Closes the Redis client connection."""
    if redis_client:
        await redis_client.close()
        logger.info("Redis connection closed.")
