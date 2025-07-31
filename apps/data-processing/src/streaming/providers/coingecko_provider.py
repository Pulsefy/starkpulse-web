import asyncio
import time
from typing import Dict, Any, List, Optional
import aiohttp
import structlog

from core.stream_manager import StreamManager, StreamMessage, StreamType
from config import config

logger = structlog.get_logger(__name__)

class CoinGeckoProvider:
    def __init__(self, stream_manager: StreamManager):
        self.stream_manager = stream_manager
        self.session: Optional[aiohttp.ClientSession] = None
        self.is_running = False
        self.fetch_task: Optional[asyncio.Task] = None
        self.symbols_map = {
            'BTCUSDT': 'bitcoin',
            'ETHUSDT': 'ethereum',
            'ADAUSDT': 'cardano',
            'DOTUSDT': 'polkadot',
            'LINKUSDT': 'chainlink',
            'BNBUSDT': 'binancecoin',
            'XRPUSDT': 'ripple',
            'LTCUSDT': 'litecoin',
            'BCHUSDT': 'bitcoin-cash',
            'EOSUSDT': 'eos'
        }
    
    async def initialize(self, symbols: List[str]):
        """Initialize CoinGecko HTTP client"""
        self.session = aiohttp.ClientSession(
            timeout=aiohttp.ClientTimeout(total=30),
            headers={
                'User-Agent': 'StarkPulse-DataProcessor/1.0',
                'X-CG-Demo-API-Key': config.coingecko_api_key
            } if config.coingecko_api_key else {'User-Agent': 'StarkPulse-DataProcessor/1.0'}
        )
        
        logger.info(f"CoinGecko provider initialized for {len(symbols)} symbols")
    
    async def start(self):
        """Start the CoinGecko data fetching"""
        if self.is_running:
            logger.warning("CoinGecko provider already running")
            return
        
        self.is_running = True
        self.fetch_task = asyncio.create_task(self._fetch_loop())
        
        logger.info("CoinGecko provider started")
        return self.fetch_task
    
    async def _fetch_loop(self):
        """Main fetch loop for CoinGecko data"""
        while self.is_running:
            try:
                # Fetch price data
                await self._fetch_prices()
                
                # Fetch news data
                await self._fetch_news()
                
                # Wait before next fetch (respect rate limits)
                await asyncio.sleep(60)  # 1 minute interval
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in CoinGecko fetch loop: {e}")
                await asyncio.sleep(30)  # Wait before retry
    
    async def _fetch_prices(self):
        """Fetch price data from CoinGecko"""
        if not self.session:
            return
        
        try:
            # Get coin IDs for our symbols
            coin_ids = [self.symbols_map.get(symbol) for symbol in config.crypto_symbols]
            coin_ids = [cid for cid in coin_ids if cid]  # Remove None values
            
            if not coin_ids:
                return
            
            # Fetch price data
            url = f"{config.coingecko_api_url}/simple/price"
            params = {
                'ids': ','.join(coin_ids),
                'vs_currencies': 'usd',
                'include_market_cap': 'true',
                'include_24hr_vol': 'true',
                'include_24hr_change': 'true',
                'include_last_updated_at': 'true'
            }
            
            async with self.session.get(url, params=params) as response:
                if response.status == 200:
                    data = await response.json()
                    await self._process_price_data(data)
                else:
                    logger.error(f"CoinGecko API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error fetching CoinGecko prices: {e}")
    
    async def _process_price_data(self, data: Dict[str, Any]):
        """Process price data from CoinGecko"""
        current_time = time.time()
        
        for coin_id, price_data in data.items():
            # Find corresponding symbol
            symbol = None
            for sym, cid in self.symbols_map.items():
                if cid == coin_id:
                    symbol = sym
                    break
            
            if not symbol:
                continue
            
            message = StreamMessage(
                stream_type=StreamType.PRICE,
                symbol=symbol,
                data={
                    'type': 'coingecko_price',
                    'price': price_data.get('usd', 0),
                    'market_cap': price_data.get('usd_market_cap', 0),
                    'volume_24h': price_data.get('usd_24h_vol', 0),
                    'price_change_24h': price_data.get('usd_24h_change', 0),
                    'last_updated': price_data.get('last_updated_at', current_time)
                },
                timestamp=current_time,
                source='coingecko'
            )
            
            await self.stream_manager.produce_message(message)
    
    async def _fetch_news(self):
        """Fetch cryptocurrency news from CoinGecko"""
        if not self.session:
            return
        
        try:
            url = f"{config.coingecko_api_url}/news"
            
            async with self.session.get(url) as response:
                if response.status == 200:
                    data = await response.json()
                    await self._process_news_data(data)
                else:
                    logger.error(f"CoinGecko news API error: {response.status}")
                    
        except Exception as e:
            logger.error(f"Error fetching CoinGecko news: {e}")
    
    async def _process_news_data(self, data: Dict[str, Any]):
        """Process news data from CoinGecko"""
        current_time = time.time()
        
        news_items = data.get('data', [])
        
        for item in news_items[:10]:  # Limit to 10 most recent
            message = StreamMessage(
                stream_type=StreamType.NEWS,
                symbol=None,  # News is not symbol-specific
                data={
                    'type': 'coingecko_news',
                    'title': item.get('title', ''),
                    'description': item.get('description', ''),
                    'url': item.get('url', ''),
                    'author': item.get('author', ''),
                    'published_at': item.get('published_at', ''),
                    'thumb_2x': item.get('thumb_2x', ''),
                    'tags': item.get('tags', [])
                },
                timestamp=current_time,
                source='coingecko'
            )
            
            await self.stream_manager.produce_message(message)
    
    async def stop(self):
        """Stop the CoinGecko provider"""
        self.is_running = False
        
        if self.fetch_task:
            self.fetch_task.cancel()
            try:
                await self.fetch_task
            except asyncio.CancelledError:
                pass
        
        if self.session:
            await self.session.close()
        
        logger.info("CoinGecko provider stopped")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check provider health"""
        if not self.session or self.session.closed:
            return {'status': 'unhealthy', 'reason': 'Session not initialized or closed'}
        
        try:
            # Test API connectivity
            url = f"{config.coingecko_api_url}/ping"
            async with self.session.get(url) as response:
                if response.status == 200:
                    return {
                        'status': 'healthy',
                        'running': self.is_running,
                        'symbols_mapped': len(self.symbols_map)
                    }
                else:
                    return {'status': 'unhealthy', 'reason': f'API returned {response.status}'}
                    
        except Exception as e:
            return {'status': 'unhealthy', 'reason': str(e)}
