import pytest
import asyncio
import json
from unittest.mock import AsyncMock, MagicMock

from core.cache_service import CacheService, CACHE_HITS, CACHE_MISSES, CACHE_SET_OPERATIONS, CACHE_DELETE_OPERATIONS
from config import config

@pytest.fixture
def mock_redis_client():
    mock = AsyncMock()
    mock.get.return_value = None # Default to cache miss
    mock.set.return_value = None
    mock.delete.return_value = None
    mock.scan_iter.return_value = AsyncMock(return_value=[]) # Default empty scan
    return mock

@pytest.fixture
def cache_service(mock_redis_client):
    # Reset Prometheus counters before each test
    for counter in [CACHE_HITS, CACHE_MISSES, CACHE_SET_OPERATIONS, CACHE_DELETE_OPERATIONS]:
        counter._value = 0
    return CacheService(mock_redis_client)

@pytest.mark.asyncio
async def test_get_cache_hit(cache_service: CacheService, mock_redis_client):
    test_key = "test:key"
    test_value = {"data": "value"}
    mock_redis_client.get.return_value = json.dumps(test_value).encode('utf-8')

    result = await cache_service.get(test_key)
    assert result == test_value
    mock_redis_client.get.assert_called_once_with(test_key)
    assert CACHE_HITS._value == 1
    assert CACHE_MISSES._value == 0

@pytest.mark.asyncio
async def test_get_cache_miss(cache_service: CacheService, mock_redis_client):
    test_key = "test:key"
    mock_redis_client.get.return_value = None

    result = await cache_service.get(test_key)
    assert result is None
    mock_redis_client.get.assert_called_once_with(test_key)
    assert CACHE_HITS._value == 0
    assert CACHE_MISSES._value == 1

@pytest.mark.asyncio
async def test_set_cache(cache_service: CacheService, mock_redis_client):
    test_key = "test:key"
    test_value = {"data": "value"}
    test_ttl = 60

    await cache_service.set(test_key, test_value, ttl=test_ttl)
    mock_redis_client.set.assert_called_once_with(test_key, json.dumps(test_value), ex=test_ttl)
    assert CACHE_SET_OPERATIONS._value == 1

@pytest.mark.asyncio
async def test_set_cache_default_ttl(cache_service: CacheService, mock_redis_client):
    test_key = "test:key"
    test_value = {"data": "value"}

    await cache_service.set(test_key, test_value)
    mock_redis_client.set.assert_called_once_with(test_key, json.dumps(test_value), ex=config.default_cache_ttl)
    assert CACHE_SET_OPERATIONS._value == 1

@pytest.mark.asyncio
async def test_delete_cache(cache_service: CacheService, mock_redis_client):
    test_key = "test:key"

    await cache_service.delete(test_key)
    mock_redis_client.delete.assert_called_once_with(test_key)
    assert CACHE_DELETE_OPERATIONS._value == 1

@pytest.mark.asyncio
async def test_invalidate_pattern(cache_service: CacheService, mock_redis_client):
    pattern = "prefix:*"
    keys_to_delete = ["prefix:key1", "prefix:key2"]
    mock_redis_client.scan_iter.return_value = AsyncMock(return_value=keys_to_delete).__aiter__()
    mock_redis_client.delete.return_value = len(keys_to_delete)

    await cache_service.invalidate_pattern(pattern)
    mock_redis_client.scan_iter.assert_called_once_with(match=pattern)
    mock_redis_client.delete.assert_called_once_with(*keys_to_delete)
    assert CACHE_DELETE_OPERATIONS._value == len(keys_to_delete)

@pytest.mark.asyncio
async def test_cached_decorator_hit(cache_service: CacheService, mock_redis_client):
    @cache_service.cached(key_prefix="test_func", ttl=10)
    async def test_func(arg1, arg2):
        return arg1 + arg2

    # Simulate cache hit
    mock_redis_client.get.return_value = json.dumps("cached_result").encode('utf-8')

    result = await test_func(1, 2)
    assert result == "cached_result"
    mock_redis_client.get.assert_called_once()
    mock_redis_client.set.assert_not_called()
    assert CACHE_HITS._value == 1

@pytest.mark.asyncio
async def test_cached_decorator_miss(cache_service: CacheService, mock_redis_client):
    @cache_service.cached(key_prefix="test_func", ttl=10)
    async def test_func(arg1, arg2):
        return arg1 + arg2

    # Simulate cache miss
    mock_redis_client.get.return_value = None

    result = await test_func(1, 2)
    assert result == 3
    mock_redis_client.get.assert_called_once()
    mock_redis_client.set.assert_called_once() # Should set the result
    assert CACHE_MISSES._value == 1
    assert CACHE_SET_OPERATIONS._value == 1
