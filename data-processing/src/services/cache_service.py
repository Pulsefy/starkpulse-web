"""
Cache service for Redis operations
"""

import json
import redis
from typing import Any, Optional, Dict, List
from datetime import timedelta

from ..config.settings import Settings
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class CacheService:
    """
    Redis cache service for caching frequently accessed data
    """
    
    def __init__(self, settings: Settings):
        self.settings = settings
        self.redis_client = redis.from_url(
            settings.redis_url,
            db=settings.redis_db,
            decode_responses=True
        )
        self.default_ttl = settings.cache_ttl
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found
        """
        logger.debug(f"Getting cache key: {key}")
        try:
            value = self.redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except (redis.RedisError, json.JSONDecodeError) as e:
            logger.error(f"Cache get error for key {key}: {str(e)}")
            return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> bool:
        """
        Set value in cache
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        logger.debug(f"Setting cache key: {key}")
        try:
            ttl = ttl or self.default_ttl
            serialized_value = json.dumps(value, default=str)
            return self.redis_client.setex(key, ttl, serialized_value)
        except (redis.RedisError, json.JSONEncodeError) as e:
            logger.error(f"Cache set error for key {key}: {str(e)}")
            return False
    
    def delete(self, key: str) -> bool:
        """
        Delete key from cache
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if successful, False otherwise
        """
        logger.debug(f"Deleting cache key: {key}")
        try:
            return bool(self.redis_client.delete(key))
        except redis.RedisError as e:
            logger.error(f"Cache delete error for key {key}: {str(e)}")
            return False
    
    def exists(self, key: str) -> bool:
        """
        Check if key exists in cache
        
        Args:
            key: Cache key
            
        Returns:
            True if key exists, False otherwise
        """
        try:
            return bool(self.redis_client.exists(key))
        except redis.RedisError as e:
            logger.error(f"Cache exists error for key {key}: {str(e)}")
            return False
    
    def get_many(self, keys: List[str]) -> Dict[str, Any]:
        """
        Get multiple values from cache
        
        Args:
            keys: List of cache keys
            
        Returns:
            Dictionary of key-value pairs
        """
        try:
            values = self.redis_client.mget(keys)
            result = {}
            for key, value in zip(keys, values):
                if value:
                    try:
                        result[key] = json.loads(value)
                    except json.JSONDecodeError:
                        logger.warning(f"Failed to decode cached value for key {key}")
            return result
        except redis.RedisError as e:
            logger.error(f"Cache get_many error: {str(e)}")
            return {}
    
    def set_many(self, data: Dict[str, Any], ttl: Optional[int] = None) -> bool:
        """
        Set multiple values in cache
        
        Args:
            data: Dictionary of key-value pairs
            ttl: Time to live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            ttl = ttl or self.default_ttl
            pipe = self.redis_client.pipeline()
            
            for key, value in data.items():
                serialized_value = json.dumps(value, default=str)
                pipe.setex(key, ttl, serialized_value)
            
            pipe.execute()
            return True
        except (redis.RedisError, json.JSONEncodeError) as e:
            logger.error(f"Cache set_many error: {str(e)}")
            return False
    
    def increment(self, key: str, amount: int = 1) -> Optional[int]:
        """
        Increment a counter in cache
        
        Args:
            key: Cache key
            amount: Amount to increment by
            
        Returns:
            New value or None if error
        """
        try:
            return self.redis_client.incrby(key, amount)
        except redis.RedisError as e:
            logger.error(f"Cache increment error for key {key}: {str(e)}")
            return None
    
    def expire(self, key: str, ttl: int) -> bool:
        """
        Set expiration time for a key
        
        Args:
            key: Cache key
            ttl: Time to live in seconds
            
        Returns:
            True if successful, False otherwise
        """
        try:
            return bool(self.redis_client.expire(key, ttl))
        except redis.RedisError as e:
            logger.error(f"Cache expire error for key {key}: {str(e)}")
            return False
    
    def flush_all(self) -> bool:
        """
        Clear all cache data
        
        Returns:
            True if successful, False otherwise
        """
        try:
            return self.redis_client.flushdb()
        except redis.RedisError as e:
            logger.error(f"Cache flush error: {str(e)}")
            return False
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics
        
        Returns:
            Dictionary with cache stats
        """
        try:
            info = self.redis_client.info()
            return {
                'connected_clients': info.get('connected_clients', 0),
                'used_memory': info.get('used_memory', 0),
                'used_memory_human': info.get('used_memory_human', '0B'),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0),
                'total_commands_processed': info.get('total_commands_processed', 0)
            }
        except redis.RedisError as e:
            logger.error(f"Cache stats error: {str(e)}")
            return {}
    
    def health_check(self) -> bool:
        """
        Check if Redis is healthy
        
        Returns:
            True if healthy, False otherwise
        """
        return self.redis_client.ping()

# Cache key generators
class CacheKeys:
    """Cache key generators for consistent naming"""
    
    @staticmethod
    def crypto_price(symbol: str) -> str:
        """Generate cache key for crypto price"""
        return f"crypto:price:{symbol.upper()}"
    
    @staticmethod
    def crypto_market_data(symbol: str) -> str:
        """Generate cache key for crypto market data"""
        return f"crypto:market:{symbol.upper()}"
    
    @staticmethod
    def news_feed(source: str) -> str:
        """Generate cache key for news feed"""
        return f"news:feed:{source}"
    
    @staticmethod
    def portfolio_value(portfolio_id: int) -> str:
        """Generate cache key for portfolio value"""
        return f"portfolio:value:{portfolio_id}"
    
    @staticmethod
    def user_portfolios(user_id: str) -> str:
        """Generate cache key for user portfolios"""
        return f"user:portfolios:{user_id}"
