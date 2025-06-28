#!/usr/bin/env python3
"""
Example usage of the unified API client

This script demonstrates how to use the unified API client with:
- Retry logic and exponential backoff
- Rate limiting
- Response caching
- Error handling
- Specialized API clients
"""

import asyncio
import sys
from pathlib import Path

# Add the src directory to Python path
sys.path.append(str(Path(__file__).parent.parent / 'src'))

from src.config.settings import Settings
from src.services.cache_service import CacheService
from src.services.api_client import (
    UnifiedAPIClient,
    CoinMarketCapClient,
    NewsAPIClient,
    CoingeckoClient,
    RequestConfig,
    APIError,
    RateLimitError
)


async def example_basic_usage():
    """Example of basic API client usage"""
    print("=== Basic API Client Usage ===")
    
    # Create a basic API client
    config = RequestConfig(
        timeout=30,
        max_retries=3,
        retry_delay=1.0,
        retry_backoff=2.0,
        cache_ttl=300,
        rate_limit_requests=10,
        rate_limit_window=60
    )
    
    client = UnifiedAPIClient(
        base_url='https://jsonplaceholder.typicode.com',
        config=config
    )
    
    try:
        # Make a GET request
        response = await client.get('posts/1')
        print(f"Response: {response}")
        
        # Make a POST request
        post_data = {'title': 'Test Post', 'body': 'Test Body', 'userId': 1}
        response = await client.post('posts', data=post_data)
        print(f"POST Response: {response}")
        
        # Get statistics
        stats = client.get_stats()
        print(f"Client Stats: {stats}")
        
    except APIError as e:
        print(f"API Error: {e}")
    finally:
        await client.close()


async def example_cached_requests():
    """Example of cached requests"""
    print("\n=== Cached Requests Example ===")
    
    # Initialize settings and cache service
    settings = Settings()
    cache_service = CacheService(settings)
    
    # Create API client with caching
    client = UnifiedAPIClient(
        base_url='https://jsonplaceholder.typicode.com',
        cache_service=cache_service
    )
    
    try:
        # First request - will be cached
        print("Making first request...")
        response1 = await client.get('posts/1')
        print(f"First response: {response1}")
        
        # Second request - should be served from cache
        print("Making second request (should be cached)...")
        response2 = await client.get('posts/1')
        print(f"Second response: {response2}")
        
        # Check stats
        stats = client.get_stats()
        print(f"Cache hits: {stats['cached_requests']}")
        
        # Clear cache
        client.clear_cache()
        print("Cache cleared")
        
    except APIError as e:
        print(f"API Error: {e}")
    finally:
        await client.close()


async def example_coinmarketcap_client():
    """Example of CoinMarketCap client usage"""
    print("\n=== CoinMarketCap Client Example ===")
    
    settings = Settings()
    cache_service = CacheService(settings)
    
    # Create CoinMarketCap client
    cmc_client = CoinMarketCapClient(settings, cache_service)
    
    try:
        # Get cryptocurrency listings
        print("Fetching cryptocurrency listings...")
        listings = await cmc_client.get_listings(start=1, limit=5, convert='USD')
        print(f"Found {len(listings.get('data', []))} cryptocurrencies")
        
        # Get price quotes for specific symbols
        print("Fetching price quotes...")
        quotes = await cmc_client.get_quotes(['BTC', 'ETH'], convert='USD')
        print(f"Price quotes: {quotes}")
        
        # Get client statistics
        stats = cmc_client.get_stats()
        print(f"CMC Client Stats: {stats}")
        
    except APIError as e:
        print(f"CoinMarketCap API Error: {e}")
    except RateLimitError as e:
        print(f"Rate limit exceeded: {e}")
    finally:
        await cmc_client.close()


async def example_news_api_client():
    """Example of News API client usage"""
    print("\n=== News API Client Example ===")
    
    settings = Settings()
    cache_service = CacheService(settings)
    
    # Create News API client
    news_client = NewsAPIClient(settings, cache_service)
    
    try:
        # Get news articles about cryptocurrency
        print("Fetching crypto news...")
        news = await news_client.get_everything(
            query='cryptocurrency',
            page_size=5,
            language='en',
            sort_by='publishedAt'
        )
        
        articles = news.get('articles', [])
        print(f"Found {len(articles)} articles")
        
        for i, article in enumerate(articles[:3], 1):
            print(f"{i}. {article.get('title', 'No title')}")
            print(f"   Source: {article.get('source', {}).get('name', 'Unknown')}")
            print(f"   Published: {article.get('publishedAt', 'Unknown')}")
            print()
        
        # Get client statistics
        stats = news_client.get_stats()
        print(f"News API Client Stats: {stats}")
        
    except APIError as e:
        print(f"News API Error: {e}")
    except RateLimitError as e:
        print(f"Rate limit exceeded: {e}")
    finally:
        await news_client.close()


async def example_coingecko_client():
    """Example of CoinGecko client usage"""
    print("\n=== CoinGecko Client Example ===")
    
    settings = Settings()
    cache_service = CacheService(settings)
    
    # Create CoinGecko client
    coingecko_client = CoingeckoClient(settings, cache_service)
    
    try:
        # Get simple price data
        print("Fetching simple price data...")
        prices = await coingecko_client.get_simple_price(
            ids=['bitcoin', 'ethereum'],
            vs_currencies=['usd', 'eur'],
            include_market_cap=True,
            include_24hr_vol=True,
            include_24hr_change=True
        )
        print(f"Price data: {prices}")
        
        # Get market data
        print("Fetching market data...")
        markets = await coingecko_client.get_coin_markets(
            vs_currency='usd',
            per_page=5,
            order='market_cap_desc'
        )
        print(f"Market data: {markets}")
        
        # Get client statistics
        stats = coingecko_client.get_stats()
        print(f"CoinGecko Client Stats: {stats}")
        
    except APIError as e:
        print(f"CoinGecko API Error: {e}")
    except RateLimitError as e:
        print(f"Rate limit exceeded: {e}")
    finally:
        await coingecko_client.close()


async def example_error_handling():
    """Example of error handling"""
    print("\n=== Error Handling Example ===")
    
    # Create client with invalid URL to trigger errors
    client = UnifiedAPIClient(base_url='https://invalid-url-that-does-not-exist.com')
    
    try:
        # This should fail
        await client.get('test')
    except APIError as e:
        print(f"Caught API Error: {e}")
        print(f"Status Code: {e.status_code}")
        print(f"Response Data: {e.response_data}")
    except RateLimitError as e:
        print(f"Caught Rate Limit Error: {e}")
    except Exception as e:
        print(f"Caught unexpected error: {e}")
    finally:
        await client.close()


async def main():
    """Main function to run all examples"""
    print("Unified API Client Examples")
    print("=" * 50)
    
    # Run examples
    await example_basic_usage()
    await example_cached_requests()
    await example_coinmarketcap_client()
    await example_news_api_client()
    await example_coingecko_client()
    await example_error_handling()
    
    print("\n" + "=" * 50)
    print("All examples completed!")


if __name__ == "__main__":
    # Run the examples
    asyncio.run(main()) 