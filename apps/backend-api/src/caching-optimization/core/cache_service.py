import asyncio
import json
from typing import Any, Callable, Dict, List, Optional, TypeVar, Union
import redis.asyncio as redis
import structlog
from functools import wraps
from prometheus_client import Counter, Gauge, Histogram

from config import config

logger = structlog.get_logger(__name__)

# Prometheus Metrics
CACHE_HITS = Counter('cache_hits_total', 'Total cache hits', ['cache_name', 'key_prefix'])
CACHE_MISSES = Counter('cache_misses_total', 'Total cache misses', ['cache_name', 'key_prefix'])
CACHE_SET_OPERATIONS = Counter('cache_set_operations_total', 'Total cache set operations', ['cache_name', 'key_prefix'])
CACHE_DELETE_OPERATIONS = Counter('cache_delete_operations_total', 'Total cache delete operations', ['cache_name', 'key_prefix'])
CACHE_ITEM_COUNT = Gauge('cache_item_count', 'Number of items in cache', ['cache_name', 'key_prefix'])
CACHE_OPERATION_DURATION = Histogram('cache_operation_duration_seconds', 'Duration of cache operations', ['operation', 'cache_name'])

T = TypeVar('T')

class CacheService:
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.default_ttl = config.default_cache_ttl
        logger.info("CacheService initialized.")

    async def get(self, key: str, cache_name: str = "default") -> Optional[Any]:
        """Retrieves data from cache."""
        start_time = asyncio.get_event_loop().time()
        try:
            data = await self.redis_client.get(key)
            if data:
                CACHE_HITS.labels(cache_name=cache_name, key_prefix=key.split(':')[0]).inc()
                logger.debug(f"Cache hit for key: {key}", cache_name=cache_name)
                return json.loads(data)
            CACHE_MISSES.labels(cache_name=cache_name, key_prefix=key.split(':')[0]).inc()
            logger.debug(f"Cache miss for key: {key}", cache_name=cache_name)
            return None
        except Exception as e:
            logger.error(f"Error getting from cache: {e}", key=key, cache_name=cache_name)
            return None
        finally:
            CACHE_OPERATION_DURATION.labels(operation='get', cache_name=cache_name).observe(asyncio.get_event_loop().time() - start_time)

    async def set(self, key: str, value: Any, ttl: Optional[int] = None, cache_name: str = "default"):
        """Stores data in cache."""
        start_time = asyncio.get_event_loop().time()
        try:
            serialized_value = json.dumps(value, default=str) # Ensure datetime objects are serialized
            await self.redis_client.set(key, serialized_value, ex=ttl or self.default_ttl)
            CACHE_SET_OPERATIONS.labels(cache_name=cache_name, key_prefix=key.split(':')[0]).inc()
            logger.debug(f"Cache set for key: {key}", cache_name=cache_name, ttl=ttl or self.default_ttl)
        except Exception as e:
            logger.error(f"Error setting cache: {e}", key=key, cache_name=cache_name)
        finally:
            CACHE_OPERATION_DURATION.labels(operation='set', cache_name=cache_name).observe(asyncio.get_event_loop().time() - start_time)

    async def delete(self, key: str, cache_name: str = "default"):
        """Deletes data from cache."""
        start_time = asyncio.get_event_loop().time()
        try:
            await self.redis_client.delete(key)
            CACHE_DELETE_OPERATIONS.labels(cache_name=cache_name, key_prefix=key.split(':')[0]).inc()
            logger.debug(f"Cache deleted for key: {key}", cache_name=cache_name)
        except Exception as e:
            logger.error(f"Error deleting from cache: {e}", key=key, cache_name=cache_name)
        finally:
            CACHE_OPERATION_DURATION.labels(operation='delete', cache_name=cache_name).observe(asyncio.get_event_loop().time() - start_time)

    async def invalidate_pattern(self, pattern: str, cache_name: str = "default"):
        """Invalidates all keys matching a pattern."""
        start_time = asyncio.get_event_loop().time()
        try:
            keys = []
            async for key in self.redis_client.scan_iter(match=pattern):
                keys.append(key)
            if keys:
                deleted_count = await self.redis_client.delete(*keys)
                logger.info(f"Invalidated {deleted_count} keys matching pattern: {pattern}", cache_name=cache_name)
                CACHE_DELETE_OPERATIONS.labels(cache_name=cache_name, key_prefix=pattern.split(':')[0]).inc(deleted_count)
        except Exception as e:
            logger.error(f"Error invalidating cache pattern: {e}", pattern=pattern, cache_name=cache_name)
        finally:
            CACHE_OPERATION_DURATION.labels(operation='invalidate_pattern', cache_name=cache_name).observe(asyncio.get_event_loop().time() - start_time)

    def cached(self, key_prefix: str, ttl: Optional[int] = None, cache_name: str = "default"):
        """
        Decorator to cache the result of an async function.
        The cache key is generated from key_prefix and function arguments.
        """
        def decorator(func: Callable[..., Any]):
            @wraps(func)
            async def wrapper(*args, **kwargs) -> Any:
                # Generate a unique cache key based on function name, prefix, and arguments
                # For simplicity, we'll use a basic hash of args/kwargs.
                # In production, consider more robust key generation.
                args_str = json.dumps(args, default=str) + json.dumps(kwargs, default=str)
                key_suffix = hashlib.sha256(args_str.encode()).hexdigest()
                cache_key = f"{key_prefix}:{func.__name__}:{key_suffix}"

                cached_result = await self.get(cache_key, cache_name=cache_name)
                if cached_result is not None:
                    return cached_result
                
                result = await func(*args, **kwargs)
                await self.set(cache_key, result, ttl=ttl, cache_name=cache_name)
                return result
            return wrapper
        return decorator

    async def get_cache_stats(self) -> Dict[str, Any]:
        """Retrieves overall cache statistics."""
        info = await self.redis_client.info('memory')
        db_size = await self.redis_client.dbsize()
        
        return {
            "connected": self.redis_client.connection_pool.connected,
            "used_memory_human": info.get('used_memory_human'),
            "total_keys": db_size,
            "default_ttl": self.default_ttl,
            "cache_hits_total": CACHE_HITS._value,
            "cache_misses_total": CACHE_MISSES._value,
            "cache_hit_ratio": CACHE_HITS._value / (CACHE_HITS._value + CACHE_MISSES._value) if (CACHE_HITS._value + CACHE_MISSES._value) > 0 else 0
        }

import hashlib # Import hashlib for the decorator
