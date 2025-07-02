# class CoinGeckoClient(APIClient):
#     """CoinGecko API client"""
#     def __init__(self):
#         super().__init__('https://api.coingecko.com/api/v3/')
#         self.rate_limiter = RateLimiter(max_requests=50, time_window=60)  # CoinGecko free tier

#     async def get_price(self, ids: List[str], vs_currencies: List[str] = ["usd"]) -> Dict[str, Any]:
#         await self.rate_limiter.acquire()
#         params = {
#             'ids': ','.join(ids),
#             'vs_currencies': ','.join(vs_currencies)
#         }
#         return await self.get('simple/price', params=params)

#     async def get_market_chart(self, coin_id: str, vs_currency: str = "usd", days: int = 30) -> Dict[str, Any]:
#         await self.rate_limiter.acquire()
#         params = {
#             'vs_currency': vs_currency,
#             'days': days
#         }
#         return await self.get(f'coins/{coin_id}/market_chart', params=params)

"""
Unified API client service for external data sources with retry logic and error handling.

This module provides a robust HTTP client with:
- Automatic retry with exponential backoff
- Rate limiting implementation
- Response caching mechanism
- Comprehensive error handling and logging
"""

import asyncio
import aiohttp
import time
import hashlib
import json
from typing import Dict, Any, Optional, List, Union, Callable
from urllib.parse import urljoin, urlencode
from dataclasses import dataclass
from enum import Enum

from ..utils.logger import setup_logger
from ..config.settings import Settings

logger = setup_logger(__name__)

class HTTPMethod(Enum):
    """HTTP methods enumeration"""
    GET = "GET"
    POST = "POST"
    PUT = "PUT"
    DELETE = "DELETE"
    PATCH = "PATCH"

class APIError(Exception):
    """Base exception for API errors"""
    def __init__(self, message: str, status_code: Optional[int] = None, 
                 response_data: Optional[Dict[str, Any]] = None):
        self.message = message
        self.status_code = status_code
        self.response_data = response_data
        super().__init__(self.message)

class RateLimitError(APIError):
    """Exception raised when rate limit is exceeded"""
    pass

class RetryableError(APIError):
    """Exception for errors that can be retried"""
    pass

@dataclass
class RequestConfig:
    """Configuration for API requests"""
    timeout: int = 30
    max_retries: int = 3
    retry_delay: float = 1.0
    retry_backoff: float = 2.0
    cache_ttl: int = 300  # 5 minutes
    rate_limit_requests: int = 100
    rate_limit_window: int = 60  # seconds
    headers: Optional[Dict[str, str]] = None

class RateLimiter:
    """
    Advanced rate limiter with sliding window implementation
    """
    
    def __init__(self, max_requests: int, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = []
        self._lock = asyncio.Lock()
    
    async def acquire(self) -> None:
        """Acquire permission to make a request with proper locking"""
        async with self._lock:
            now = time.time()
            
            # Remove old requests outside the time window
            self.requests = [req_time for req_time in self.requests 
                           if now - req_time < self.time_window]
            
            # Check if we can make a request
            if len(self.requests) >= self.max_requests:
                sleep_time = self.time_window - (now - self.requests[0])
                if sleep_time > 0:
                    logger.warning(f"Rate limit reached, waiting {sleep_time:.2f} seconds")
                    await asyncio.sleep(sleep_time)
                    return await self.acquire()
            
            self.requests.append(now)
    
    def get_remaining_requests(self) -> int:
        """Get remaining requests in current window"""
        now = time.time()
        self.requests = [req_time for req_time in self.requests 
                        if now - req_time < self.time_window]
        return max(0, self.max_requests - len(self.requests))

class CacheManager:
    """
    Cache manager for API responses
    """
    
    def __init__(self, cache_service):
        self.cache_service = cache_service
    
    def _generate_cache_key(self, method: str, url: str, params: Optional[Dict] = None, 
                           data: Optional[Dict] = None) -> str:
        """Generate a unique cache key for the request"""
        key_parts = [method, url]
        
        if params:
            sorted_params = sorted(params.items())
            key_parts.append(urlencode(sorted_params))
        
        if data:
            sorted_data = sorted(data.items())
            key_parts.append(json.dumps(sorted_data, sort_keys=True))
        
        key_string = "|".join(key_parts)
        return f"api_cache:{hashlib.md5(key_string.encode()).hexdigest()}"
    
    def get(self, method: str, url: str, params: Optional[Dict] = None, 
            data: Optional[Dict] = None) -> Optional[Dict[str, Any]]:
        """Get cached response"""
        cache_key = self._generate_cache_key(method, url, params, data)
        return self.cache_service.get(cache_key)
    
    def set(self, method: str, url: str, response_data: Dict[str, Any], 
            ttl: int, params: Optional[Dict] = None, data: Optional[Dict] = None) -> bool:
        """Cache response data"""
        cache_key = self._generate_cache_key(method, url, params, data)
        return self.cache_service.set(cache_key, response_data, ttl)
    
    def invalidate_pattern(self, pattern: str) -> bool:
        """Invalidate cache entries matching pattern"""
        logger.info(f"Invalidating cache pattern: {pattern}")
        return True

class UnifiedAPIClient:
    """
    Unified API client with comprehensive error handling, retry logic, rate limiting, and caching
    """
    
    def __init__(self, base_url: str = None, config: RequestConfig = None, 
                 cache_service = None, settings: Settings = None):
        self.base_url = base_url.rstrip('/') if base_url else None
        self.config = config or RequestConfig()
        self.cache_service = cache_service
        self.cache_manager = CacheManager(cache_service) if cache_service else None
        self.settings = settings
        
        # Initialize rate limiter
        self.rate_limiter = RateLimiter(
            self.config.rate_limit_requests,
            self.config.rate_limit_window
        )
        
        # Session management
        self.session = None
        self._session_lock = asyncio.Lock()
        
        # Request statistics
        self.stats = {
            'total_requests': 0,
            'successful_requests': 0,
            'failed_requests': 0,
            'cached_requests': 0,
            'rate_limited_requests': 0
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        await self._ensure_session()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        await self.close()
    
    async def _ensure_session(self) -> None:
        """Ensure HTTP session is available"""
        if self.session is None or self.session.closed:
            async with self._session_lock:
                if self.session is None or self.session.closed:
                    timeout = aiohttp.ClientTimeout(total=self.config.timeout)
                    connector = aiohttp.TCPConnector(
                        limit=100,
                        limit_per_host=30,
                        keepalive_timeout=30,
                        enable_cleanup_closed=True
                    )
                    self.session = aiohttp.ClientSession(
                        timeout=timeout,
                        connector=connector,
                        headers=self.config.headers or {}
                    )
    
    async def close(self) -> None:
        """Close the HTTP session"""
        if self.session and not self.session.closed:
            await self.session.close()
            self.session = None
    
    def _is_retryable_error(self, status_code: int, error: Exception) -> bool:
        """Determine if an error is retryable"""
        # Retry on 5xx server errors
        if 500 <= status_code < 600:
            return True
        
        # Retry on specific 4xx errors that might be temporary
        if status_code in [408, 429, 502, 503, 504]:
            return True
        
        # Retry on network errors
        if isinstance(error, (aiohttp.ClientError, asyncio.TimeoutError)):
            return True
        
        return False
    
    def _should_cache_response(self, method: str, status_code: int) -> bool:
        """Determine if response should be cached"""
        # Only cache successful GET requests
        return (method.upper() == HTTPMethod.GET.value and 
                200 <= status_code < 300 and 
                self.cache_manager is not None)
    
    async def _make_request_with_retry(self, method: HTTPMethod, endpoint: str, 
                                      params: Optional[Dict[str, Any]] = None,
                                      data: Optional[Dict[str, Any]] = None,
                                      headers: Optional[Dict[str, str]] = None,
                                      skip_cache: bool = False) -> Dict[str, Any]:
        """
        Make HTTP request with retry logic and error handling
        """
        last_exception = None
        
        for attempt in range(self.config.max_retries + 1):
            try:
                return await self._make_request(method, endpoint, params, data, headers, skip_cache)
            except RetryableError as e:
                last_exception = e
                if attempt < self.config.max_retries:
                    delay = self.config.retry_delay * (self.config.retry_backoff ** attempt)
                    logger.warning(f"Retryable error on attempt {attempt + 1}, retrying in {delay:.2f}s: {str(e)}")
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"Max retries ({self.config.max_retries}) exceeded")
                    raise
            except (APIError, RateLimitError) as e:
                # Don't retry non-retryable errors
                raise
        
        # This should never be reached, but just in case
        raise last_exception or APIError("Unknown error occurred")
    
    async def _make_request(self, method: HTTPMethod, endpoint: str, 
                           params: Optional[Dict[str, Any]] = None,
                           data: Optional[Dict[str, Any]] = None,
                           headers: Optional[Dict[str, str]] = None,
                           skip_cache: bool = False) -> Dict[str, Any]:
        """
        Make HTTP request with error handling
        """
        await self._ensure_session()
        
        # Build full URL
        url = urljoin(self.base_url + '/', endpoint) if self.base_url else endpoint
        
        # Check cache for GET requests
        if (method == HTTPMethod.GET and not skip_cache and 
            self.cache_manager is not None):
            cached_response = self.cache_manager.get(method.value, url, params)
            if cached_response:
                self.stats['cached_requests'] += 1
                logger.debug(f"Cache hit for {method.value} {url}")
                return cached_response
        
        # Apply rate limiting
        try:
            await self.rate_limiter.acquire()
        except Exception as e:
            self.stats['rate_limited_requests'] += 1
            logger.error(f"Rate limiting error: {str(e)}")
            raise RateLimitError("Rate limit exceeded")
        
        # Prepare request
        request_headers = headers or {}
        request_kwargs = {
            'params': params,
            'headers': request_headers,
            'timeout': aiohttp.ClientTimeout(total=self.config.timeout)
        }
        
        if data and method in [HTTPMethod.POST, HTTPMethod.PUT, HTTPMethod.PATCH]:
            request_kwargs['json'] = data
        
        # Make request
        start_time = time.time()
        self.stats['total_requests'] += 1
        
        try:
            logger.debug(f"Making {method.value} request to {url}")
            
            async with self.session.request(method.value, url, **request_kwargs) as response:
                response_time = time.time() - start_time
                
                # Read response content
                try:
                    response_data = await response.json()
                except json.JSONDecodeError:
                    response_text = await response.text()
                    response_data = {'raw_response': response_text}
                
                # Handle different status codes
                if 200 <= response.status_code < 300:
                    self.stats['successful_requests'] += 1
                    logger.debug(f"Successful {method.value} request to {url} ({response_time:.2f}s)")
                    
                    # Cache successful GET responses
                    if self._should_cache_response(method.value, response.status_code):
                        self.cache_manager.set(method.value, url, response_data, 
                                             self.config.cache_ttl, params)
                    
                    return response_data
                
                elif response.status_code == 429:
                    self.stats['rate_limited_requests'] += 1
                    retry_after = int(response.headers.get('Retry-After', 60))
                    logger.warning(f"Rate limited, retrying after {retry_after} seconds")
                    await asyncio.sleep(retry_after)
                    raise RetryableError("Rate limited", response.status_code, response_data)
                
                elif self._is_retryable_error(response.status_code, None):
                    self.stats['failed_requests'] += 1
                    logger.warning(f"Retryable error {response.status_code} for {url}")
                    raise RetryableError(f"HTTP {response.status_code}", 
                                       response.status_code, response_data)
                
                else:
                    self.stats['failed_requests'] += 1
                    logger.error(f"HTTP {response.status_code} error for {url}: {response_data}")
                    raise APIError(f"HTTP {response.status_code}", 
                                 response.status_code, response_data)
        
        except (aiohttp.ClientError, asyncio.TimeoutError) as e:
            self.stats['failed_requests'] += 1
            logger.error(f"Network error for {url}: {str(e)}")
            raise RetryableError(f"Network error: {str(e)}")
        
        except Exception as e:
            self.stats['failed_requests'] += 1
            logger.error(f"Unexpected error for {url}: {str(e)}")
            raise APIError(f"Unexpected error: {str(e)}")
    
    async def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None,
                  headers: Optional[Dict[str, str]] = None, 
                  skip_cache: bool = False) -> Dict[str, Any]:
        """Make GET request"""
        return await self._make_request_with_retry(HTTPMethod.GET, endpoint, params=params, 
                                                  headers=headers, skip_cache=skip_cache)
    
    async def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None,
                   params: Optional[Dict[str, Any]] = None,
                   headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make POST request"""
        return await self._make_request_with_retry(HTTPMethod.POST, endpoint, params=params, 
                                                  data=data, headers=headers)
    
    async def put(self, endpoint: str, data: Optional[Dict[str, Any]] = None,
                  params: Optional[Dict[str, Any]] = None,
                  headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make PUT request"""
        return await self._make_request_with_retry(HTTPMethod.PUT, endpoint, params=params, 
                                                  data=data, headers=headers)
    
    async def delete(self, endpoint: str, params: Optional[Dict[str, Any]] = None,
                     headers: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
        """Make DELETE request"""
        return await self._make_request_with_retry(HTTPMethod.DELETE, endpoint, params=params, 
                                                  headers=headers)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get request statistics"""
        return {
            **self.stats,
            'rate_limiter_remaining': self.rate_limiter.get_remaining_requests(),
            'cache_enabled': self.cache_manager is not None
        }
    
    def clear_cache(self, pattern: str = None) -> bool:
        """Clear cache entries"""
        if self.cache_manager:
            if pattern:
                return self.cache_manager.invalidate_pattern(pattern)
            else:
                return self.cache_service.flush_all() if self.cache_service else False
        return False


# class CoinMarketCapClient(APIClient):
#     """CoinMarketCap API client"""
#     def __init__(self, settings: Settings):
#         super().__init__('https://pro-api.coinmarketcap.com/v1/')
#         self.api_key = settings.coinmarketcap_api_key

#     async def get_listings(self, start: int = 1, limit: int = 100) -> Dict[str, Any]:
#         headers = {'X-CMC_PRO_API_KEY': self.api_key}
#         params = {'start': start, 'limit': limit}
#         return await self.get('cryptocurrency/listings/latest', params=params, headers=headers)

#     async def get_quotes(self, symbols: List[str]) -> Dict[str, Any]:
#         headers = {'X-CMC_PRO_API_KEY': self.api_key}

# Specialized API clients
class CoinMarketCapClient(UnifiedAPIClient):
    """CoinMarketCap API client with specialized methods"""
    
    def __init__(self, settings: Settings, cache_service = None):
        config = RequestConfig(
            timeout=30,
            max_retries=3,
            retry_delay=1.0,
            retry_backoff=2.0,
            cache_ttl=300,  # 5 minutes for price data
            rate_limit_requests=30,  # CoinMarketCap free tier limit
            rate_limit_window=60,
            headers={'X-CMC_PRO_API_KEY': settings.coinmarketcap_api_key}
        )
        
        super().__init__(
            base_url='https://pro-api.coinmarketcap.com/v1/',
            config=config,
            cache_service=cache_service,
            settings=settings
        )
        self.api_key = settings.coinmarketcap_api_key
    
    async def get_listings(self, start: int = 1, limit: int = 100, 
                          convert: str = 'USD') -> Dict[str, Any]:
        """Get cryptocurrency listings"""
        params = {
            'start': start,
            'limit': limit,
            'convert': convert
        }
        return await self.get('cryptocurrency/listings/latest', params=params)
    
    async def get_quotes(self, symbols: List[str], convert: str = 'USD') -> Dict[str, Any]:
        """Get price quotes for symbols"""
        params = {
            'symbol': ','.join(symbols),
            'convert': convert
        }
        return await self.get('cryptocurrency/quotes/latest', params=params)
    
    async def get_metadata(self, symbols: List[str]) -> Dict[str, Any]:
        """Get cryptocurrency metadata"""
        params = {'symbol': ','.join(symbols)}
        return await self.get('cryptocurrency/info', params=params)
    
    async def get_market_pairs(self, symbol: str) -> Dict[str, Any]:
        """Get market pairs for a cryptocurrency"""
        params = {'symbol': symbol}
        return await self.get('cryptocurrency/market-pairs/latest', params=params)


    async def get_historical_quotes(self, symbol: str, time_start: str, time_end: str, interval: str = "daily") -> Dict[str, Any]:
        """
        Get historical price quotes for a symbol from CoinMarketCap
        Args:
            symbol: Cryptocurrency symbol (e.g., 'BTC')
            time_start: Start time in ISO 8601 (e.g., '2023-01-01T00:00:00Z')
            time_end: End time in ISO 8601 (e.g., '2023-01-31T00:00:00Z')
            interval: 'daily', 'hourly', etc.
        Returns:
            API response dict
        """
        headers = {'X-CMC_PRO_API_KEY': self.api_key}
        params = {
            'symbol': symbol,
            'time_start': time_start,
            'time_end': time_end,
            'interval': interval
        }
        return await self.get('cryptocurrency/quotes/historical', params=params, headers=headers)

class NewsAPIClient(APIClient):
    """News API client"""

class NewsAPIClient(UnifiedAPIClient):
    """News API client with specialized methods"""
    
    def __init__(self, settings: Settings, cache_service = None):
        config = RequestConfig(
            timeout=30,
            max_retries=3,
            retry_delay=1.0,
            retry_backoff=2.0,
            cache_ttl=1800,  # 30 minutes for news data
            rate_limit_requests=100,  # News API free tier limit
            rate_limit_window=60
        )
        
        super().__init__(
            base_url='https://newsapi.org/v2/',
            config=config,
            cache_service=cache_service,
            settings=settings
        )
        self.api_key = settings.news_api_key
    
    async def get_everything(self, query: str, from_date: str = None, 
                           to_date: str = None, page_size: int = 100,
                           language: str = 'en', sort_by: str = 'publishedAt') -> Dict[str, Any]:
        """Get news articles"""
        params = {
            'q': query,
            'apiKey': self.api_key,
            'pageSize': page_size,
            'language': language,
            'sortBy': sort_by
        }
        
        if from_date:
            params['from'] = from_date
        if to_date:
            params['to'] = to_date
            
        return await self.get('everything', params=params)
    
    async def get_top_headlines(self, country: str = 'us', category: str = None,
                               page_size: int = 100) -> Dict[str, Any]:
        """Get top headlines"""
        params = {
            'country': country,
            'apiKey': self.api_key,
            'pageSize': page_size
        }
        
        if category:
            params['category'] = category
            
        return await self.get('top-headlines', params=params)
    
    async def get_sources(self, category: str = None, language: str = 'en',
                         country: str = None) -> Dict[str, Any]:
        """Get news sources"""
        params = {
            'apiKey': self.api_key,
            'language': language
        }
        
        if category:
            params['category'] = category
        if country:
            params['country'] = country
            
        return await self.get('sources', params=params)

class CoingeckoClient(UnifiedAPIClient):
    """CoinGecko API client with specialized methods"""
    
    def __init__(self, settings: Settings, cache_service = None):
        config = RequestConfig(
            timeout=30,
            max_retries=3,
            retry_delay=1.0,
            retry_backoff=2.0,
            cache_ttl=300,  # 5 minutes for price data
            rate_limit_requests=50,  # CoinGecko free tier limit
            rate_limit_window=60
        )
        
        super().__init__(
            base_url='https://api.coingecko.com/api/v3/',
            config=config,
            cache_service=cache_service,
            settings=settings
        )
    
    async def get_simple_price(self, ids: List[str], vs_currencies: List[str] = ['usd'],
                              include_market_cap: bool = True, include_24hr_vol: bool = True,
                              include_24hr_change: bool = True) -> Dict[str, Any]:
        """Get simple price data"""
        params = {
            'ids': ','.join(ids),
            'vs_currencies': ','.join(vs_currencies),
            'include_market_cap': str(include_market_cap).lower(),
            'include_24hr_vol': str(include_24hr_vol).lower(),
            'include_24hr_change': str(include_24hr_change).lower()
        }
        return await self.get('simple/price', params=params)
    
    async def get_coin_markets(self, vs_currency: str = 'usd', order: str = 'market_cap_desc',
                              per_page: int = 100, page: int = 1, sparkline: bool = False) -> Dict[str, Any]:
        """Get coin market data"""
        params = {
            'vs_currency': vs_currency,
            'order': order,
            'per_page': per_page,
            'page': page,
            'sparkline': str(sparkline).lower()
        }
        return await self.get('coins/markets', params=params)
    
    async def get_coin_info(self, coin_id: str, localization: bool = True,
                           tickers: bool = True, market_data: bool = True,
                           community_data: bool = True, developer_data: bool = True) -> Dict[str, Any]:
        """Get detailed coin information"""
        params = {
            'localization': str(localization).lower(),
            'tickers': str(tickers).lower(),
            'market_data': str(market_data).lower(),
            'community_data': str(community_data).lower(),
            'developer_data': str(developer_data).lower()
        }
        return await self.get(f'coins/{coin_id}', params=params) 