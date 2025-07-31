import pytest
import asyncio
import time
from unittest.mock import AsyncMock, MagicMock

from core.rate_limiter import RateLimiter, RATE_LIMIT_EXCEEDED_TOTAL, CURRENT_RATE_LIMIT_USAGE
from config import config

@pytest.fixture
def mock_redis_client():
    mock = AsyncMock()
    mock.pipeline.return_value = MagicMock()
    mock.pipeline.return_value.incr.return_value = mock.pipeline.return_value
    mock.pipeline.return_value.expire.return_value = mock.pipeline.return_value
    mock.pipeline.return_value.execute.return_value = [1, None] # Default: count 1, expire set
    mock.get.return_value = None
    mock.ttl.return_value = -2 # Default: key does not exist
    return mock

@pytest.fixture
def rate_limiter(mock_redis_client):
    # Reset Prometheus counters before each test
    RATE_LIMIT_EXCEEDED_TOTAL._value = 0
    CURRENT_RATE_LIMIT_USAGE._metrics.clear() # Clear gauge metrics
    return RateLimiter(mock_redis_client)

@pytest.mark.asyncio
async def test_check_rate_limit_pass(rate_limiter: RateLimiter, mock_redis_client):
    api_key = "YOUR_BASIC_API_KEY"
    endpoint = "/products"
    
    # Configure mock to allow 5 requests within limit (limit is 100)
    mock_redis_client.pipeline.return_value.execute.side_effect = [[i, None] for i in range(1, 6)]

    for i in range(5):
        result = await rate_limiter.check_rate_limit(api_key, endpoint)
        assert result is True
        assert mock_redis_client.pipeline.return_value.incr.call_count == i + 1
        assert mock_redis_client.pipeline.return_value.expire.call_count == i + 1
        assert CURRENT_RATE_LIMIT_USAGE._metrics[(api_key, endpoint)]._value == i + 1

    assert RATE_LIMIT_EXCEEDED_TOTAL._value == 0

@pytest.mark.asyncio
async def test_check_rate_limit_exceed(rate_limiter: RateLimiter, mock_redis_client):
    api_key = "YOUR_BASIC_API_KEY" # Limit: 100/min
    endpoint = "/products"
    
    # Simulate hitting the limit + 1
    mock_redis_client.pipeline.return_value.execute.side_effect = [[i, None] for i in range(1, 102)]

    for i in range(100):
        result = await rate_limiter.check_rate_limit(api_key, endpoint)
        assert result is True
    
    # 101st request should fail
    result = await rate_limiter.check_rate_limit(api_key, endpoint)
    assert result is False
    assert RATE_LIMIT_EXCEEDED_TOTAL._value == 1
    assert CURRENT_RATE_LIMIT_USAGE._metrics[(api_key, endpoint)]._value == 101

@pytest.mark.asyncio
async def test_check_rate_limit_unlimited_tier(rate_limiter: RateLimiter, mock_redis_client):
    api_key = "YOUR_UNLIMITED_API_KEY" # Limit: 0/min
    endpoint = "/data"

    result = await rate_limiter.check_rate_limit(api_key, endpoint)
    assert result is True
    mock_redis_client.pipeline.assert_not_called() # No Redis operations for unlimited
    assert RATE_LIMIT_EXCEEDED_TOTAL._value == 0

@pytest.mark.asyncio
async def test_get_rate_limit_status_unlimited(rate_limiter: RateLimiter, mock_redis_client):
    api_key = "YOUR_UNLIMITED_API_KEY"
    endpoint = "/data"

    status = await rate_limiter.get_rate_limit_status(api_key, endpoint)
    assert status == {"limit": "unlimited", "remaining": "unlimited", "reset_in_seconds": 0}
    mock_redis_client.get.assert_not_called()
    mock_redis_client.ttl.assert_not_called()

@pytest.mark.asyncio
async def test_get_rate_limit_status_limited(rate_limiter: RateLimiter, mock_redis_client):
    api_key = "YOUR_BASIC_API_KEY"
    endpoint = "/products"
    
    # Simulate 50 requests made and 30 seconds left in window
    mock_redis_client.get.return_value = b"50"
    mock_redis_client.ttl.return_value = 30

    status = await rate_limiter.get_rate_limit_status(api_key, endpoint)
    assert status["limit"] == 100
    assert status["remaining"] == 50
    assert status["reset_in_seconds"] == 30
    mock_redis_client.get.assert_called_once()
    mock_redis_client.ttl.assert_called_once()

@pytest.mark.asyncio
async def test_get_rate_limit_status_no_requests_yet(rate_limiter: RateLimiter, mock_redis_client):
    api_key = "YOUR_BASIC_API_KEY"
    endpoint = "/products"
    
    # Simulate no requests made yet
    mock_redis_client.get.return_value = None
    mock_redis_client.ttl.return_value = -2 # Key does not exist

    status = await rate_limiter.get_rate_limit_status(api_key, endpoint)
    assert status["limit"] == 100
    assert status["remaining"] == 100
    assert status["reset_in_seconds"] == config.rate_limits['api_key_basic']['window_seconds'] # Should default to full window
