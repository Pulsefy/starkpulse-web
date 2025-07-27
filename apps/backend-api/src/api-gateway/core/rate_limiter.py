import asyncio
import time
from typing import Optional
import redis.asyncio as redis
import structlog
from prometheus_client import Counter, Gauge

from config import config

logger = structlog.get_logger(__name__)

# Prometheus Metrics for Rate Limiting
RATE_LIMIT_EXCEEDED_TOTAL = Counter(
    'gateway_rate_limit_exceeded_total',
    'Total requests rejected due to rate limiting',
    ['api_key_id', 'endpoint']
)
CURRENT_RATE_LIMIT_USAGE = Gauge(
    'gateway_current_rate_limit_usage',
    'Current rate limit usage for a given key and window',
    ['api_key_id', 'endpoint']
)

class RateLimiter:
    def __init__(self, redis_client: redis.Redis):
        self.redis_client = redis_client
        self.rate_limits = config.rate_limits
        logger.info("RateLimiter initialized.")

    async def _get_api_key_tier(self, api_key: str) -> str:
        """Retrieves the rate limit tier for a given API key."""
        # In a real system, this would involve a secure lookup, possibly cached.
        # For this example, we use the in-memory config.api_keys.
        return config.api_keys.get(api_key, 'default')

    async def check_rate_limit(self, api_key: str, endpoint: str) -> bool:
        """
        Checks if the request is within the rate limit for the given API key and endpoint.
        Implements a fixed-window counter approach.
        """
        tier = await self._get_api_key_tier(api_key)
        limit_config = self.rate_limits.get(tier, self.rate_limits['default'])
        
        limit = limit_config.get('limit')
        window_seconds = limit_config.get('window_seconds')

        if limit == 0: # Unlimited tier
            return True

        # Use a unique key for each API key and endpoint within the current window
        current_window = int(time.time() // window_seconds)
        key = f"rate_limit:{api_key}:{endpoint}:{current_window}"

        # Increment the counter and set/update expiry
        # Use a Redis pipeline for atomicity
        pipe = self.redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds + 1) # Add a small buffer for expiry
        
        current_count, _ = await pipe.execute()

        CURRENT_RATE_LIMIT_USAGE.labels(api_key_id=api_key, endpoint=endpoint).set(current_count)

        if current_count > limit:
            RATE_LIMIT_EXCEEDED_TOTAL.labels(api_key_id=api_key, endpoint=endpoint).inc()
            logger.warning(
                "Rate limit exceeded",
                api_key=api_key,
                endpoint=endpoint,
                current_count=current_count,
                limit=limit,
                window_seconds=window_seconds
            )
            return False
        
        logger.debug(
            "Rate limit check passed",
            api_key=api_key,
            endpoint=endpoint,
            current_count=current_count,
            limit=limit
        )
        return True

    async def get_rate_limit_status(self, api_key: str, endpoint: str) -> Dict[str, Any]:
        """Returns the current rate limit status for an API key and endpoint."""
        tier = await self._get_api_key_tier(api_key)
        limit_config = self.rate_limits.get(tier, self.rate_limits['default'])
        
        limit = limit_config.get('limit')
        window_seconds = limit_config.get('window_seconds')

        if limit == 0:
            return {"limit": "unlimited", "remaining": "unlimited", "reset_in_seconds": 0}

        current_window = int(time.time() // window_seconds)
        key = f"rate_limit:{api_key}:{endpoint}:{current_window}"
        
        current_count = await self.redis_client.get(key)
        current_count = int(current_count) if current_count else 0
        
        ttl = await self.redis_client.ttl(key)
        reset_in_seconds = max(0, ttl) if ttl != -1 else window_seconds # -1 means no expiry, treat as full window

        remaining = max(0, limit - current_count)

        return {
            "limit": limit,
            "remaining": remaining,
            "reset_in_seconds": reset_in_seconds
        }
