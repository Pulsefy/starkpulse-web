import pytest
from unittest.mock import MagicMock
from src.services.rate_limiter_service import RateLimiter

@pytest.mark.asyncio
async def test_rate_limiter():
   
    mock_redis_client = MagicMock()

    mock_pipeline = MagicMock()
    
    # Simulate the count increasing with each call
    call_count = 0
    def incr_side_effect(*args, **kwargs):
        nonlocal call_count
        call_count += 1
        # Return the new count and a TTL
        return (call_count, 60)

    mock_pipeline.execute.side_effect = incr_side_effect
    mock_redis_client.pipeline.return_value = mock_pipeline
    
    # Set a limit of 3 requests
    limiter = RateLimiter(client=mock_redis_client, requests=3, per_seconds=60)
    api_key = "test_api"

    # Act & Assert
    # First 3 calls should be allowed
    assert await limiter.is_rate_limited(api_key) is False
    assert await limiter.is_rate_limited(api_key) is False
    assert await limiter.is_rate_limited(api_key) is False
    
    # 4th call should be blocked
    assert await limiter.is_rate_limited(api_key) is True