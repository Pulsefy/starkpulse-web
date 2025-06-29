# Unified API Client Service

## Overview

The Unified API Client Service provides a robust, feature-rich HTTP client for external data sources with comprehensive error handling, retry logic, rate limiting, and response caching. This service is designed to handle the complexities of making HTTP requests to various APIs while providing a consistent interface and reliable error recovery.

## Features

### ✅ **HTTP Client with Retry Mechanisms**

-   **Automatic retry with exponential backoff** for transient failures
-   **Configurable retry attempts** and delay intervals
-   **Smart retry logic** that distinguishes between retryable and non-retryable errors
-   **Network error recovery** for connection issues

### ✅ **Rate Limiting Implementation**

-   **Sliding window rate limiting** with configurable limits
-   **Automatic request queuing** when rate limits are exceeded
-   **Per-client rate limit configuration** for different API providers
-   **Rate limit header parsing** (Retry-After support)

### ✅ **Response Caching**

-   **Intelligent caching** for GET requests with configurable TTL
-   **Cache key generation** based on method, URL, and parameters
-   **Cache invalidation** patterns and bulk operations
-   **Redis integration** for distributed caching

### ✅ **Comprehensive Error Handling**

-   **Custom exception hierarchy** for different error types
-   **Detailed error information** including status codes and response data
-   **Graceful degradation** when services are unavailable
-   **Extensive logging** for debugging and monitoring

## Architecture

### Core Components

```
UnifiedAPIClient
├── RateLimiter (Sliding window rate limiting)
├── CacheManager (Response caching)
├── RequestConfig (Configuration management)
└── Specialized Clients
    ├── CoinMarketCapClient
    ├── NewsAPIClient
    └── CoingeckoClient
```

### Class Hierarchy

```python
APIError (Base exception)
├── RateLimitError (Rate limit exceeded)
└── RetryableError (Retryable failures)

UnifiedAPIClient (Base client)
├── CoinMarketCapClient (Crypto price data)
├── NewsAPIClient (News articles)
└── CoingeckoClient (Alternative crypto data)
```

## Usage

### Basic Usage

```python
from src.services.api_client import UnifiedAPIClient, RequestConfig

# Create a basic API client
config = RequestConfig(
    timeout=30,
    max_retries=3,
    retry_delay=1.0,
    retry_backoff=2.0,
    cache_ttl=300,
    rate_limit_requests=100,
    rate_limit_window=60
)

client = UnifiedAPIClient(
    base_url='https://api.example.com',
    config=config
)

# Make requests
async with client:
    response = await client.get('endpoint')
    post_response = await client.post('endpoint', data={'key': 'value'})
```

### With Caching

```python
from src.services.cache_service import CacheService
from src.config.settings import Settings

settings = Settings()
cache_service = CacheService(settings)

client = UnifiedAPIClient(
    base_url='https://api.example.com',
    cache_service=cache_service
)

# First request - cached
response1 = await client.get('data')

# Second request - served from cache
response2 = await client.get('data')  # Cache hit!
```

### Specialized Clients

#### CoinMarketCap Client

```python
from src.services.api_client import CoinMarketCapClient

cmc_client = CoinMarketCapClient(settings, cache_service)

# Get cryptocurrency listings
listings = await cmc_client.get_listings(start=1, limit=100, convert='USD')

# Get price quotes
quotes = await cmc_client.get_quotes(['BTC', 'ETH'], convert='USD')

# Get metadata
metadata = await cmc_client.get_metadata(['BTC', 'ETH'])
```

#### News API Client

```python
from src.services.api_client import NewsAPIClient

news_client = NewsAPIClient(settings, cache_service)

# Get news articles
articles = await news_client.get_everything(
    query='cryptocurrency',
    page_size=50,
    language='en',
    sort_by='publishedAt'
)

# Get top headlines
headlines = await news_client.get_top_headlines(
    country='us',
    category='technology',
    page_size=20
)
```

#### CoinGecko Client

```python
from src.services.api_client import CoingeckoClient

coingecko_client = CoingeckoClient(settings, cache_service)

# Get simple price data
prices = await coingecko_client.get_simple_price(
    ids=['bitcoin', 'ethereum'],
    vs_currencies=['usd', 'eur'],
    include_market_cap=True
)

# Get market data
markets = await coingecko_client.get_coin_markets(
    vs_currency='usd',
    per_page=100,
    order='market_cap_desc'
)
```

## Configuration

### Environment Variables

```bash
# API Client Configuration
API_TIMEOUT=30
API_MAX_RETRIES=3
API_RETRY_DELAY=1.0
API_RETRY_BACKOFF=2.0

# Rate Limiting
API_RATE_LIMIT_REQUESTS=100
API_RATE_LIMIT_WINDOW=60

# Cache Settings
CACHE_TTL=300
REDIS_URL=redis://localhost:6379
REDIS_DB=0

# API Keys
COINMARKETCAP_API_KEY=your_cmc_api_key
NEWS_API_KEY=your_news_api_key
COINGECKO_API_KEY=your_coingecko_api_key
```

### RequestConfig Options

| Option                | Type  | Default | Description                    |
| --------------------- | ----- | ------- | ------------------------------ |
| `timeout`             | int   | 30      | Request timeout in seconds     |
| `max_retries`         | int   | 3       | Maximum retry attempts         |
| `retry_delay`         | float | 1.0     | Initial retry delay in seconds |
| `retry_backoff`       | float | 2.0     | Exponential backoff multiplier |
| `cache_ttl`           | int   | 300     | Cache TTL in seconds           |
| `rate_limit_requests` | int   | 100     | Requests per time window       |
| `rate_limit_window`   | int   | 60      | Time window in seconds         |
| `headers`             | dict  | None    | Default request headers        |

## Error Handling

### Exception Types

```python
from src.services.api_client import APIError, RateLimitError, RetryableError

try:
    response = await client.get('endpoint')
except RateLimitError as e:
    # Rate limit exceeded
    print(f"Rate limited: {e}")
except RetryableError as e:
    # Retryable error (5xx, network issues)
    print(f"Retryable error: {e}")
except APIError as e:
    # Non-retryable error (4xx)
    print(f"API error: {e}")
    print(f"Status code: {e.status_code}")
    print(f"Response data: {e.response_data}")
```

### Retryable Errors

The client automatically retries on:

-   **5xx Server Errors** (500, 502, 503, 504)
-   **Specific 4xx Errors** (408, 429)
-   **Network Errors** (Connection failures, timeouts)

### Non-Retryable Errors

The client does NOT retry on:

-   **4xx Client Errors** (400, 401, 403, 404)
-   **Rate Limit Errors** (429) - handled separately
-   **Validation Errors** (400)

## Monitoring and Statistics

### Request Statistics

```python
stats = client.get_stats()

# Available metrics:
# - total_requests: Total requests made
# - successful_requests: Successful responses
# - failed_requests: Failed requests
# - cached_requests: Cache hits
# - rate_limited_requests: Rate limit hits
# - rate_limiter_remaining: Remaining requests in window
# - cache_enabled: Whether caching is enabled
```

### Logging

The client provides comprehensive logging:

```python
import logging

# Set log level
logging.getLogger('src.services.api_client').setLevel(logging.DEBUG)

# Log messages include:
# - Request details (method, URL, parameters)
# - Response times
# - Cache hits/misses
# - Rate limiting events
# - Retry attempts
# - Error details
```

## Best Practices

### 1. **Use Context Managers**

```python
# Good
async with client as api_client:
    response = await api_client.get('endpoint')

# Avoid
client = UnifiedAPIClient(...)
response = await client.get('endpoint')
await client.close()  # Easy to forget
```

### 2. **Configure Rate Limits Appropriately**

```python
# For CoinMarketCap (30 requests/minute)
config = RequestConfig(rate_limit_requests=30, rate_limit_window=60)

# For News API (100 requests/minute)
config = RequestConfig(rate_limit_requests=100, rate_limit_window=60)
```

### 3. **Use Caching for Expensive Operations**

```python
# Cache price data for 5 minutes
config = RequestConfig(cache_ttl=300)

# Cache news data for 30 minutes
config = RequestConfig(cache_ttl=1800)
```

### 4. **Handle Errors Gracefully**

```python
try:
    response = await client.get('endpoint')
except RateLimitError:
    # Implement fallback logic
    response = await fallback_client.get('endpoint')
except APIError as e:
    # Log and handle gracefully
    logger.error(f"API error: {e}")
    response = default_response
```

### 5. **Monitor Performance**

```python
# Regular monitoring
stats = client.get_stats()
if stats['failed_requests'] > stats['total_requests'] * 0.1:
    logger.warning("High failure rate detected")

# Cache efficiency
cache_hit_rate = stats['cached_requests'] / stats['total_requests']
if cache_hit_rate < 0.5:
    logger.info("Consider increasing cache TTL")
```

## Testing

### Unit Tests

```bash
# Run unit tests
pytest tests/unit/test_unified_api_client.py -v

# Run with coverage
pytest tests/unit/test_unified_api_client.py --cov=src.services.api_client
```

### Integration Tests

```bash
# Run integration tests
pytest tests/integration/ -v
```

### Example Usage

```bash
# Run example script
python examples/api_client_usage.py
```

## Performance Considerations

### 1. **Connection Pooling**

The client uses aiohttp's connection pooling for efficient HTTP connections:

```python
connector = aiohttp.TCPConnector(
    limit=100,              # Total connection pool size
    limit_per_host=30,      # Connections per host
    keepalive_timeout=30,   # Keep-alive timeout
    enable_cleanup_closed=True
)
```

### 2. **Caching Strategy**

-   **GET requests only** are cached
-   **Cache keys** include method, URL, and parameters
-   **TTL-based expiration** with configurable timeouts
-   **Redis backend** for distributed caching

### 3. **Rate Limiting**

-   **Sliding window** implementation for accurate rate limiting
-   **Thread-safe** operations with asyncio locks
-   **Automatic queuing** when limits are exceeded

### 4. **Retry Strategy**

-   **Exponential backoff** to avoid overwhelming servers
-   **Maximum retry attempts** to prevent infinite loops
-   **Selective retry** based on error type

## Troubleshooting

### Common Issues

1. **Rate Limit Errors**

    - Check API provider limits
    - Adjust `rate_limit_requests` and `rate_limit_window`
    - Implement request batching

2. **Cache Misses**

    - Verify Redis connection
    - Check cache TTL settings
    - Monitor cache hit rates

3. **Timeout Errors**

    - Increase `timeout` configuration
    - Check network connectivity
    - Monitor API response times

4. **Retry Loops**
    - Review retry configuration
    - Check for non-retryable errors
    - Monitor error patterns

### Debug Mode

```python
import logging

# Enable debug logging
logging.basicConfig(level=logging.DEBUG)

# Create client with debug config
config = RequestConfig(timeout=60, max_retries=1)
client = UnifiedAPIClient(config=config)
```

## Contributing

When contributing to the unified API client:

1. **Add tests** for new functionality
2. **Update documentation** for new features
3. **Follow error handling patterns** established in the codebase
4. **Use type hints** for all new methods
5. **Add logging** for debugging and monitoring

## License

This unified API client is part of the StarkPulse Web project and is licensed under the MIT License.
