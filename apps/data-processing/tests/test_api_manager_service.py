import pytest
from unittest.mock import MagicMock, AsyncMock, patch
from src.services.api_manager_service import ApiManagerService
from src.config import Config
import pybreaker
import aiohttp

# Fixture to provide a mock config for all tests
@pytest.fixture
def mock_config():
    config = Config()
    # Override providers for predictable testing
    config.api_providers = {
        "test_service": {
            "primary": {"name": "primary", "base_url": "http://primary.com/", "api_key": "123", "rate_limit": 10, "cost_per_call": 0.1},
            "failover": {"name": "failover", "base_url": "http://failover.com/", "api_key": "456", "rate_limit": 10, "cost_per_call": 0.2},
        }
    }
    return config

# Fixture to initialize the service with mocked dependencies
@pytest.fixture
def manager(mock_config):
    with patch('redis.Redis.from_url') as mock_redis:
        # We patch the class method from_url to return a mock instance
        mock_redis_instance = MagicMock()
        mock_redis.return_value = mock_redis_instance
        
        service = ApiManagerService(config=mock_config)
        # We also need to mock the session object inside the service
        service.session = AsyncMock()
        yield service

@pytest.mark.asyncio
async def test_make_request_success_and_cache(manager, mock_config):
    """
    Tests a successful API call and verifies that the response is cached
    and served on the second call without making a new network request.
    """
    # Arrange
    mock_response_data = {"data": "success"}
    # Mock the aiohttp response
    manager.session.get.return_value.__aenter__.return_value.json = AsyncMock(return_value=mock_response_data)
    manager.session.get.return_value.__aenter__.return_value.status = 200
    
    # Mock Redis 'get' to return None on the first call (cache miss)
    manager.redis_client.get.return_value = None

    # Act (First Call - Cache Miss)
    response = await manager.make_request("test_service", "test_endpoint")

    # Assert (First Call)
    assert response == mock_response_data
    manager.session.get.assert_called_once() # Network call was made
    manager.redis_client.set.assert_called_once() # Response was cached

    # Arrange for second call (Cache Hit)
    # Mock Redis 'get' to return the cached data
    manager.redis_client.get.return_value = json.dumps(mock_response_data)
    manager.session.get.reset_mock() # Reset the call counter for the network mock

    # Act (Second Call - Cache Hit)
    response_cached = await manager.make_request("test_service", "test_endpoint")

    # Assert (Second Call)
    assert response_cached == mock_response_data
    manager.session.get.assert_not_called() # Network call was NOT made

@pytest.mark.asyncio
async def test_failover_mechanism(manager):
    """
    Tests that the manager correctly fails over to the secondary provider
    when the primary provider fails.
    """
    # Arrange
    # Simulate primary provider failure and secondary provider success
    primary_failure = aiohttp.ClientError("Primary failed")
    secondary_success_data = {"data": "from_failover"}
    
    mock_primary_response = AsyncMock()
    mock_primary_response.__aenter__.side_effect = primary_failure

    mock_secondary_response = AsyncMock()
    mock_secondary_response.__aenter__.return_value.json = AsyncMock(return_value=secondary_success_data)
    mock_secondary_response.__aenter__.return_value.status = 200
    
    manager.session.get.side_effect = [mock_primary_response, mock_secondary_response]
    manager.redis_client.get.return_value = None # Ensure no cache hit

    # Act
    response = await manager.make_request("test_service", "test_endpoint")

    # Assert
    assert response == secondary_success_data
    assert manager.session.get.call_count == 2 # Called primary, then secondary
    assert "failover.com" in manager.session.get.call_args_list[1].args[0]

@pytest.mark.asyncio
async def test_circuit_breaker_opens(manager):
    """
    Tests that the circuit breaker opens after repeated failures.
    """
    # Arrange
    # We patch the specific breaker instance to control its state
    with patch('src.services.circuit_breaker_service.CircuitBreaker.get_breaker') as mock_get_breaker:
        mock_breaker = MagicMock()
        mock_breaker.side_effect = pybreaker.CircuitBreakerError("Circuit is open")
        mock_get_breaker.return_value = mock_breaker
        
        manager.redis_client.get.return_value = None # No cache

        # Act & Assert
        # The ApiManagerService should catch the breaker error and return None
        response = await manager.make_request("test_service", "test_endpoint")
        assert response is None
        assert manager.health_status["test_service"] == "unhealthy" # Should be marked unhealthy

@pytest.mark.asyncio
async def test_rate_limiting_prevents_call(manager):
    """
    Tests that the manager does not make a network call if the
    rate limiter blocks the request.
    """
    # Arrange
    # Patch the RateLimiter's method to simulate being rate limited
    with patch('src.services.rate_limiter_service.RateLimiter.is_rate_limited', new_callable=AsyncMock) as mock_is_limited:
        mock_is_limited.return_value = True # Simulate rate limit exceeded
        manager.redis_client.get.return_value = None # No cache

        # Act
        response = await manager.make_request("test_service", "test_endpoint")

        # Assert
        assert response is None
        manager.session.get.assert_not_called() # Network call should not be madeimport pytest
from unittest.mock import MagicMock, AsyncMock, patch
from src.services.api_manager_service import ApiManagerService
from src.config import Config
import pybreaker
import aiohttp

# Fixture to provide a mock config for all tests
@pytest.fixture
def mock_config():
    config = Config()
    # Override providers for predictable testing
    config.api_providers = {
        "test_service": {
            "primary": {"name": "primary", "base_url": "http://primary.com/", "api_key": "123", "rate_limit": 10, "cost_per_call": 0.1},
            "failover": {"name": "failover", "base_url": "http://failover.com/", "api_key": "456", "rate_limit": 10, "cost_per_call": 0.2},
        }
    }
    return config

# Fixture to initialize the service with mocked dependencies
@pytest.fixture
def manager(mock_config):
    with patch('redis.Redis.from_url') as mock_redis:
        # We patch the class method from_url to return a mock instance
        mock_redis_instance = MagicMock()
        mock_redis.return_value = mock_redis_instance
        
        service = ApiManagerService(config=mock_config)
        # We also need to mock the session object inside the service
        service.session = AsyncMock()
        yield service

@pytest.mark.asyncio
async def test_make_request_success_and_cache(manager, mock_config):
    """
    Tests a successful API call and verifies that the response is cached
    and served on the second call without making a new network request.
    """
    # Arrange
    mock_response_data = {"data": "success"}
    # Mock the aiohttp response
    manager.session.get.return_value.__aenter__.return_value.json = AsyncMock(return_value=mock_response_data)
    manager.session.get.return_value.__aenter__.return_value.status = 200
    
    # Mock Redis 'get' to return None on the first call (cache miss)
    manager.redis_client.get.return_value = None

    # Act (First Call - Cache Miss)
    response = await manager.make_request("test_service", "test_endpoint")

    # Assert (First Call)
    assert response == mock_response_data
    manager.session.get.assert_called_once() # Network call was made
    manager.redis_client.set.assert_called_once() # Response was cached

    # Arrange for second call (Cache Hit)
    # Mock Redis 'get' to return the cached data
    manager.redis_client.get.return_value = json.dumps(mock_response_data)
    manager.session.get.reset_mock() # Reset the call counter for the network mock

    # Act (Second Call - Cache Hit)
    response_cached = await manager.make_request("test_service", "test_endpoint")

    # Assert (Second Call)
    assert response_cached == mock_response_data
    manager.session.get.assert_not_called() # Network call was NOT made

@pytest.mark.asyncio
async def test_failover_mechanism(manager):
    """
    Tests that the manager correctly fails over to the secondary provider
    when the primary provider fails.
    """
    # Arrange
    # Simulate primary provider failure and secondary provider success
    primary_failure = aiohttp.ClientError("Primary failed")
    secondary_success_data = {"data": "from_failover"}
    
    mock_primary_response = AsyncMock()
    mock_primary_response.__aenter__.side_effect = primary_failure

    mock_secondary_response = AsyncMock()
    mock_secondary_response.__aenter__.return_value.json = AsyncMock(return_value=secondary_success_data)
    mock_secondary_response.__aenter__.return_value.status = 200
    
    manager.session.get.side_effect = [mock_primary_response, mock_secondary_response]
    manager.redis_client.get.return_value = None # Ensure no cache hit

    # Act
    response = await manager.make_request("test_service", "test_endpoint")

    # Assert
    assert response == secondary_success_data
    assert manager.session.get.call_count == 2 # Called primary, then secondary
    assert "failover.com" in manager.session.get.call_args_list[1].args[0]

@pytest.mark.asyncio
async def test_circuit_breaker_opens(manager):
    """
    Tests that the circuit breaker opens after repeated failures.
    """
    # Arrange
    # We patch the specific breaker instance to control its state
    with patch('src.services.circuit_breaker_service.CircuitBreaker.get_breaker') as mock_get_breaker:
        mock_breaker = MagicMock()
        mock_breaker.side_effect = pybreaker.CircuitBreakerError("Circuit is open")
        mock_get_breaker.return_value = mock_breaker
        
        manager.redis_client.get.return_value = None # No cache

        # Act & Assert
        # The ApiManagerService should catch the breaker error and return None
        response = await manager.make_request("test_service", "test_endpoint")
        assert response is None
        assert manager.health_status["test_service"] == "unhealthy" # Should be marked unhealthy

@pytest.mark.asyncio
async def test_rate_limiting_prevents_call(manager):
    """
    Tests that the manager does not make a network call if the
    rate limiter blocks the request.
    """
    # Arrange
    # Patch the RateLimiter's method to simulate being rate limited
    with patch('src.services.rate_limiter_service.RateLimiter.is_rate_limited', new_callable=AsyncMock) as mock_is_limited:
        mock_is_limited.return_value = True # Simulate rate limit exceeded
        manager.redis_client.get.return_value = None # No cache

        # Act
        response = await manager.make_request("test_service", "test_endpoint")

        # Assert
        assert response is None
        manager.session.get.assert_not_called() # Network call should not be made