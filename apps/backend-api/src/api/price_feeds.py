import asyncio
import aiohttp
import logging
from typing import Dict, List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
from config.settings import protocol_config

logger = logging.getLogger(__name__)

class PriceFeedManager:
    """Manages price feeds from multiple sources for accurate token pricing"""
    
    def __init__(self):
        self.price_cache: Dict[str, Dict] = {}
        self.cache_duration = timedelta(minutes=5)  # Cache prices for 5 minutes
        self.session = None
        
        # Price feed sources
        self.price_sources = {
            "coingecko": "https://api.coingecko.com/api/v3",
            "coinmarketcap": "https://pro-api.coinmarketcap.com/v1",
            "defillama": "https://coins.llama.fi/prices/current"
        }
        
        # Token ID mappings for different price feeds
        self.token_mappings = {
            "ETH": {
                "coingecko": "ethereum",
                "symbol": "ETH",
                "address": protocol_config.TOKENS["ETH"]
            },
            "USDC": {
                "coingecko": "usd-coin",
                "symbol": "USDC",
                "address": protocol_config.TOKENS["USDC"]
            },
            "USDT": {
                "coingecko": "tether",
                "symbol": "USDT",
                "address": protocol_config.TOKENS["USDT"]
            },
            "STRK": {
                "coingecko": "starknet",
                "symbol": "STRK",
                "address": protocol_config.TOKENS["STRK"]
            }
        }
    
    async def __aenter__(self):
        """Async context manager entry"""
        self.session = aiohttp.ClientSession()
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit"""
        if self.session:
            await self.session.close()
    
    async def get_token_price(self, token_symbol: str) -> Optional[Decimal]:
        """Get current price for a token"""
        try:
            # Check cache first
            if self._is_price_cached(token_symbol):
                cached_data = self.price_cache[token_symbol]
                return Decimal(str(cached_data["price"]))
            
            # Fetch from multiple sources
            price = await self._fetch_price_from_sources(token_symbol)
            
            if price:
                # Cache the price
                self.price_cache[token_symbol] = {
                    "price": float(price),
                    "timestamp": datetime.utcnow(),
                    "source": "aggregated"
                }
                
                return price
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting price for {token_symbol}: {e}")
            return None
    
    async def get_multiple_prices(self, token_symbols: List[str]) -> Dict[str, Decimal]:
        """Get prices for multiple tokens efficiently"""
        try:
            tasks = []
            for symbol in token_symbols:
                task = asyncio.create_task(self.get_token_price(symbol))
                tasks.append((symbol, task))
            
            results = {}
            for symbol, task in tasks:
                try:
                    price = await task
                    if price:
                        results[symbol] = price
                except Exception as e:
                    logger.warning(f"Error getting price for {symbol}: {e}")
            
            return results
            
        except Exception as e:
            logger.error(f"Error getting multiple prices: {e}")
            return {}
    
    async def _fetch_price_from_sources(self, token_symbol: str) -> Optional[Decimal]:
        """Fetch price from multiple sources and return average"""
        try:
            if token_symbol not in self.token_mappings:
                logger.warning(f"Token {token_symbol} not in mappings")
                return None
            
            prices = []
            
            # Try CoinGecko first
            cg_price = await self._fetch_from_coingecko(token_symbol)
            if cg_price:
                prices.append(cg_price)
            
            # Try other sources if needed
            # Add more price sources here
            
            if not prices:
                return None
            
            # Return average price
            avg_price = sum(prices) / len(prices)
            return Decimal(str(avg_price))
            
        except Exception as e:
            logger.error(f"Error fetching price from sources for {token_symbol}: {e}")
            return None
    
    async def _fetch_from_coingecko(self, token_symbol: str) -> Optional[float]:
        """Fetch price from CoinGecko API"""
        try:
            if not self.session:
                self.session = aiohttp.ClientSession()
            
            token_mapping = self.token_mappings.get(token_symbol)
            if not token_mapping:
                return None
            
            coingecko_id = token_mapping.get("coingecko")
            if not coingecko_id:
                return None
            
            url = f"{self.price_sources['coingecko']}/simple/price"
            params = {
                "ids": coingecko_id,
                "vs_currencies": "usd"
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    price = data.get(coingecko_id, {}).get("usd")
                    
                    if price:
                        logger.debug(f"CoinGecko price for {token_symbol}: ${price}")
                        return float(price)
                
                logger.warning(f"CoinGecko API error for {token_symbol}: {response.status}")
                return None
                
        except Exception as e:
            logger.error(f"Error fetching from CoinGecko for {token_symbol}: {e}")
            return None
    
    def _is_price_cached(self, token_symbol: str) -> bool:
        """Check if price is cached and still valid"""
        if token_symbol not in self.price_cache:
            return False
        
        cached_data = self.price_cache[token_symbol]
        cache_time = cached_data.get("timestamp")
        
        if not cache_time:
            return False
        
        # Check if cache is still valid
        time_diff = datetime.utcnow() - cache_time
        return time_diff < self.cache_duration
    
    async def update_all_token_prices(self):
        """Update prices for all supported tokens"""
        try:
            logger.info("Updating all token prices...")
            
            token_symbols = list(self.token_mappings.keys())
            prices = await self.get_multiple_prices(token_symbols)
            
            logger.info(f"Updated prices for {len(prices)} tokens:")
            for symbol, price in prices.items():
                logger.info(f"  {symbol}: ${price}")
            
            return prices
            
        except Exception as e:
            logger.error(f"Error updating all token prices: {e}")
            return {}
    
    def get_cached_prices(self) -> Dict[str, Dict]:
        """Get all cached prices"""
        return self.price_cache.copy()
    
    def clear_cache(self):
        """Clear price cache"""
        self.price_cache.clear()
        logger.info("Price cache cleared")
