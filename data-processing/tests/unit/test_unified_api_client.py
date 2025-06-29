"""
Unit tests for unified API client
"""

import pytest
import asyncio
import json
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from datetime import datetime

from src.services.api_client import (
    UnifiedAPIClient, 
    CoinMarketCapClient, 
    NewsAPIClient, 
    CoingeckoClient,
    RequestConfig,
    RateLimiter,
    CacheManager,
    APIError,
    RateLimitError,
    RetryableError,
    HTTPMethod
)
from src.config.settings import Settings


class TestRequestConfig:
    """Test RequestConfig dataclass"""
    
    def test_default_config(self):
        """Test default configuration values"""
        config = RequestConfig()
        assert config.timeout == 30
        assert config.max_retries == 3
        assert config.retry_delay == 1.0
        assert config.retry_backoff == 2.0
        assert config.cache_ttl == 300
        assert config.rate_limit_requests == 100
        assert config.rate_limit_window == 60
        assert config.headers is None
    
    def test_custom_config(self):
        """Test custom configuration values"""
        headers = {'Authorization': 'Bearer token'}
        config = RequestConfig(
            timeout=60,
            max_retries=5,
            retry_delay=2.0,
            retry_backoff=3.0,
            cache_ttl=600,
            rate_limit_requests=50,
            rate_limit_window=120,
            headers=headers
        )
        assert config.timeout == 60
        assert config.max_retries == 5
        assert config.retry_delay == 2.0
        assert config.retry_backoff == 3.0
        assert config.cache_ttl == 600
        assert config.rate_limit_requests == 50
        assert config.rate_limit_window == 120
        assert config.headers == headers


class TestRateLimiter:
    """Test RateLimiter class"""
    
    @pytest.fixture
    def rate_limiter(self):
        """Create rate limiter instance"""
        return RateLimiter(max_requests=5, time_window=60)
    
    @pytest.mark.asyncio
    async def test_acquire_within_limit(self, rate_limiter):
        """Test acquiring requests within rate limit"""
        # Should not block
        await rate_limiter.acquire()
        await rate_limiter.acquire()
        await rate_limiter.acquire()
        
        assert len(rate_limiter.requests) == 3
        assert rate_limiter.get_remaining_requests() == 2
    
    @pytest.mark.asyncio
    async def test_acquire_exceeds_limit(self, rate_limiter):
        """Test acquiring requests that exceed rate limit"""
        # Fill up the rate limit
        for _ in range(5):
            await rate_limiter.acquire()
        
        # Next request should be rate limited
        with patch('asyncio.sleep') as mock_sleep:
            await rate_limiter.acquire()
            mock_sleep.assert_called_once()
    
    def test_get_remaining_requests(self, rate_limiter):
        """Test getting remaining requests"""
        assert rate_limiter.get_remaining_requests() == 5
        
        # Add some requests
        rate_limiter.requests = [datetime.now().timestamp() for _ in range(3)]
        assert rate_limiter.get_remaining_requests() == 2


class TestCacheManager:
    """Test CacheManager class"""
    
    @pytest.fixture
    def cache_service(self):
        """Create mock cache service"""
        return Mock()
    
    @pytest.fixture
    def cache_manager(self, cache_service):
        """Create cache manager instance"""
        return CacheManager(cache_service)
    
    def test_generate_cache_key(self, cache_manager):
        """Test cache key generation"""
        key = cache_manager._generate_cache_key('GET', 'https://api.example.com/data')
        assert key.startswith('api_cache:')
        assert len(key) == 45  # api_cache: + 32 char md5 hash
        
        # Test with parameters
        key_with_params = cache_manager._generate_cache_key(
            'GET', 
            'https://api.example.com/data',
            params={'limit': 10, 'offset': 0}
        )
        assert key_with_params != key
    
    def test_get_cached_response(self, cache_manager, cache_service):
        """Test getting cached response"""
        cached_data = {'data': 'test'}
        cache_service.get.return_value = cached_data
        
        result = cache_manager.get('GET', 'https://api.example.com/data')
        assert result == cached_data
        cache_service.get.assert_called_once()
    
    def test_set_cached_response(self, cache_manager, cache_service):
        """Test setting cached response"""
        response_data = {'data': 'test'}
        cache_service.set.return_value = True
        
        result = cache_manager.set('GET', 'https://api.example.com/data', response_data, 300)
        assert result is True
        cache_service.set.assert_called_once()


class TestUnifiedAPIClient:
    """Test UnifiedAPIClient class"""
    
    @pytest.fixture
    def settings(self):
        """Create settings instance"""
        return Settings()
    
    @pytest.fixture
    def cache_service(self):
        """Create mock cache service"""
        return Mock()
    
    @pytest.fixture
    def api_client(self, settings, cache_service):
        """Create API client instance"""
        config = RequestConfig(
            timeout=10,
            max_retries=2,
            retry_delay=0.1,
            retry_backoff=2.0,
            cache_ttl=300,
            rate_limit_requests=10,
            rate_limit_window=60
        )
        return UnifiedAPIClient(
            base_url='https://api.example.com',
            config=config,
            cache_service=cache_service,
            settings=settings
        )
    
    @pytest.mark.asyncio
    async def test_context_manager(self, api_client):
        """Test async context manager"""
        async with api_client as client:
            assert client.session is not None
            assert not client.session.closed
        
        assert api_client.session is None
    
    @pytest.mark.asyncio
    async def test_successful_get_request(self, api_client):
        """Test successful GET request"""
        mock_response = {'status': 'success', 'data': 'test'}
        
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 200
            mock_response_obj.json = AsyncMock(return_value=mock_response)
            mock_response_obj.__aenter__.return_value = mock_response_obj
            mock_response_obj.__aexit__.return_value = None
            mock_request.return_value = mock_response_obj
            
            result = await api_client.get('test-endpoint')
            
            assert result == mock_response
            assert api_client.stats['successful_requests'] == 1
            assert api_client.stats['total_requests'] == 1
    
    @pytest.mark.asyncio
    async def test_cached_get_request(self, api_client, cache_service):
        """Test GET request with cache hit"""
        cached_data = {'status': 'success', 'data': 'cached'}
        cache_service.get.return_value = cached_data
        
        result = await api_client.get('test-endpoint')
        
        assert result == cached_data
        assert api_client.stats['cached_requests'] == 1
        assert api_client.stats['total_requests'] == 0  # No actual request made
    
    @pytest.mark.asyncio
    async def test_retry_on_retryable_error(self, api_client):
        """Test retry logic on retryable errors"""
        mock_response = {'status': 'success', 'data': 'test'}
        
        with patch('aiohttp.ClientSession.request') as mock_request:
            # First call fails with 500, second succeeds
            mock_response_obj_1 = AsyncMock()
            mock_response_obj_1.status = 500
            mock_response_obj_1.json = AsyncMock(return_value={'error': 'server error'})
            mock_response_obj_1.__aenter__.return_value = mock_response_obj_1
            mock_response_obj_1.__aexit__.return_value = None
            
            mock_response_obj_2 = AsyncMock()
            mock_response_obj_2.status = 200
            mock_response_obj_2.json = AsyncMock(return_value=mock_response)
            mock_response_obj_2.__aenter__.return_value = mock_response_obj_2
            mock_response_obj_2.__aexit__.return_value = None
            
            mock_request.side_effect = [mock_response_obj_1, mock_response_obj_2]
            
            result = await api_client.get('test-endpoint')
            
            assert result == mock_response
            assert mock_request.call_count == 2
            assert api_client.stats['successful_requests'] == 1
            assert api_client.stats['failed_requests'] == 1
    
    @pytest.mark.asyncio
    async def test_rate_limit_error(self, api_client):
        """Test rate limit error handling"""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 429
            mock_response_obj.headers = {'Retry-After': '60'}
            mock_response_obj.json = AsyncMock(return_value={'error': 'rate limited'})
            mock_response_obj.__aenter__.return_value = mock_response_obj
            mock_response_obj.__aexit__.return_value = None
            mock_request.return_value = mock_response_obj
            
            with pytest.raises(RetryableError) as exc_info:
                await api_client.get('test-endpoint')
            
            assert "Rate limited" in str(exc_info.value)
            assert api_client.stats['rate_limited_requests'] == 1
    
    @pytest.mark.asyncio
    async def test_non_retryable_error(self, api_client):
        """Test non-retryable error handling"""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_response_obj = AsyncMock()
            mock_response_obj.status = 400
            mock_response_obj.json = AsyncMock(return_value={'error': 'bad request'})
            mock_response_obj.__aenter__.return_value = mock_response_obj
            mock_response_obj.__aexit__.return_value = None
            mock_request.return_value = mock_response_obj
            
            with pytest.raises(APIError) as exc_info:
                await api_client.get('test-endpoint')
            
            assert "HTTP 400" in str(exc_info.value)
            assert api_client.stats['failed_requests'] == 1
    
    @pytest.mark.asyncio
    async def test_network_error(self, api_client):
        """Test network error handling"""
        with patch('aiohttp.ClientSession.request') as mock_request:
            mock_request.side_effect = aiohttp.ClientError("Connection failed")
            
            with pytest.raises(RetryableError) as exc_info:
                await api_client.get('test-endpoint')
            
            assert "Network error" in str(exc_info.value)
            assert api_client.stats['failed_requests'] == 1
    
    def test_get_stats(self, api_client):
        """Test getting request statistics"""
        stats = api_client.get_stats()
        
        expected_keys = [
            'total_requests', 'successful_requests', 'failed_requests',
            'cached_requests', 'rate_limited_requests', 'rate_limiter_remaining',
            'cache_enabled'
        ]
        
        for key in expected_keys:
            assert key in stats
    
    def test_clear_cache(self, api_client, cache_service):
        """Test clearing cache"""
        cache_service.flush_all.return_value = True
        
        result = api_client.clear_cache()
        assert result is True
        cache_service.flush_all.assert_called_once()


class TestCoinMarketCapClient:
    """Test CoinMarketCapClient class"""
    
    @pytest.fixture
    def settings(self):
        """Create settings instance"""
        settings = Settings()
        settings.coinmarketcap_api_key = 'test-api-key'
        return settings
    
    @pytest.fixture
    def cmc_client(self, settings):
        """Create CoinMarketCap client instance"""
        return CoinMarketCapClient(settings)
    
    @pytest.mark.asyncio
    async def test_get_listings(self, cmc_client):
        """Test getting cryptocurrency listings"""
        mock_response = {'data': [{'id': 1, 'name': 'Bitcoin', 'symbol': 'BTC'}]}
        
        with patch.object(cmc_client, 'get', return_value=mock_response):
            result = await cmc_client.get_listings(start=1, limit=10, convert='USD')
            
            assert result == mock_response
            cmc_client.get.assert_called_once_with(
                'cryptocurrency/listings/latest',
                params={'start': 1, 'limit': 10, 'convert': 'USD'}
            )
    
    @pytest.mark.asyncio
    async def test_get_quotes(self, cmc_client):
        """Test getting price quotes"""
        mock_response = {'data': {'BTC': {'quote': {'USD': {'price': 50000}}}}}
        
        with patch.object(cmc_client, 'get', return_value=mock_response):
            result = await cmc_client.get_quotes(['BTC', 'ETH'], convert='USD')
            
            assert result == mock_response
            cmc_client.get.assert_called_once_with(
                'cryptocurrency/quotes/latest',
                params={'symbol': 'BTC,ETH', 'convert': 'USD'}
            )


class TestNewsAPIClient:
    """Test NewsAPIClient class"""
    
    @pytest.fixture
    def settings(self):
        """Create settings instance"""
        settings = Settings()
        settings.news_api_key = 'test-api-key'
        return settings
    
    @pytest.fixture
    def news_client(self, settings):
        """Create News API client instance"""
        return NewsAPIClient(settings)
    
    @pytest.mark.asyncio
    async def test_get_everything(self, news_client):
        """Test getting news articles"""
        mock_response = {'articles': [{'title': 'Test Article'}]}
        
        with patch.object(news_client, 'get', return_value=mock_response):
            result = await news_client.get_everything(
                query='bitcoin',
                from_date='2024-01-01',
                to_date='2024-01-31',
                page_size=50
            )
            
            assert result == mock_response
            news_client.get.assert_called_once_with(
                'everything',
                params={
                    'q': 'bitcoin',
                    'apiKey': 'test-api-key',
                    'pageSize': 50,
                    'language': 'en',
                    'sortBy': 'publishedAt',
                    'from': '2024-01-01',
                    'to': '2024-01-31'
                }
            )


class TestCoingeckoClient:
    """Test CoingeckoClient class"""
    
    @pytest.fixture
    def settings(self):
        """Create settings instance"""
        return Settings()
    
    @pytest.fixture
    def coingecko_client(self, settings):
        """Create CoinGecko client instance"""
        return CoingeckoClient(settings)
    
    @pytest.mark.asyncio
    async def test_get_simple_price(self, coingecko_client):
        """Test getting simple price data"""
        mock_response = {'bitcoin': {'usd': 50000}}
        
        with patch.object(coingecko_client, 'get', return_value=mock_response):
            result = await coingecko_client.get_simple_price(
                ids=['bitcoin', 'ethereum'],
                vs_currencies=['usd', 'eur'],
                include_market_cap=True
            )
            
            assert result == mock_response
            coingecko_client.get.assert_called_once_with(
                'simple/price',
                params={
                    'ids': 'bitcoin,ethereum',
                    'vs_currencies': 'usd,eur',
                    'include_market_cap': 'true',
                    'include_24hr_vol': 'true',
                    'include_24hr_change': 'true'
                }
            ) 