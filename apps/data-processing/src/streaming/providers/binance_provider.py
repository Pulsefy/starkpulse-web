import asyncio
import json
from typing import Dict, Any, List
import structlog

from core.websocket_client import WebSocketClient
from core.stream_manager import StreamManager, StreamMessage, StreamType
from config import config

logger = structlog.get_logger(__name__)

class BinanceProvider:
    def __init__(self, stream_manager: StreamManager):
        self.stream_manager = stream_manager
        self.websocket_client: Optional[WebSocketClient] = None
        self.subscribed_symbols: List[str] = []
    
    async def initialize(self, symbols: List[str]):
        """Initialize Binance WebSocket connection"""
        self.subscribed_symbols = symbols
        
        # Create WebSocket client
        self.websocket_client = WebSocketClient(
            url=config.binance_ws_url,
            on_message=self._handle_message
        )
        
        logger.info(f"Binance provider initialized for symbols: {symbols}")
    
    async def start(self):
        """Start the Binance data stream"""
        if not self.websocket_client:
            raise RuntimeError("Provider not initialized")
        
        # Start WebSocket connection
        connection_task = asyncio.create_task(
            self.websocket_client.start_with_reconnect()
        )
        
        # Wait a bit for connection to establish
        await asyncio.sleep(2)
        
        # Subscribe to streams
        await self._subscribe_to_streams()
        
        logger.info("Binance provider started")
        return connection_task
    
    async def _subscribe_to_streams(self):
        """Subscribe to Binance streams for configured symbols"""
        if not self.websocket_client or not self.websocket_client.is_connected:
            logger.error("Cannot subscribe: WebSocket not connected")
            return
        
        # Create stream names for ticker and trade data
        streams = []
        for symbol in self.subscribed_symbols:
            symbol_lower = symbol.lower()
            streams.extend([
                f"{symbol_lower}@ticker",
                f"{symbol_lower}@trade",
                f"{symbol_lower}@depth5"
            ])
        
        # Subscribe message
        subscribe_message = {
            "method": "SUBSCRIBE",
            "params": streams,
            "id": 1
        }
        
        try:
            await self.websocket_client.send_message(subscribe_message)
            logger.info(f"Subscribed to {len(streams)} Binance streams")
        except Exception as e:
            logger.error(f"Failed to subscribe to streams: {e}")
    
    async def _handle_message(self, data: Dict[str, Any]):
        """Handle incoming Binance WebSocket messages"""
        try:
            # Skip subscription confirmation messages
            if 'result' in data or 'id' in data:
                return
            
            # Extract stream data
            if 'stream' not in data or 'data' not in data:
                return
            
            stream_name = data['stream']
            stream_data = data['data']
            
            # Determine message type and process
            if '@ticker' in stream_name:
                await self._process_ticker_data(stream_name, stream_data)
            elif '@trade' in stream_name:
                await self._process_trade_data(stream_name, stream_data)
            elif '@depth' in stream_name:
                await self._process_depth_data(stream_name, stream_data)
                
        except Exception as e:
            logger.error(f"Error handling Binance message: {e}")
    
    async def _process_ticker_data(self, stream_name: str, data: Dict[str, Any]):
        """Process ticker (24hr statistics) data"""
        symbol = data.get('s')
        if not symbol:
            return
        
        message = StreamMessage(
            stream_type=StreamType.PRICE,
            symbol=symbol,
            data={
                'type': 'ticker',
                'price': float(data.get('c', 0)),  # Current price
                'price_change': float(data.get('P', 0)),  # Price change %
                'volume': float(data.get('v', 0)),  # Volume
                'high': float(data.get('h', 0)),  # High price
                'low': float(data.get('l', 0)),  # Low price
                'open': float(data.get('o', 0)),  # Open price
                'count': int(data.get('x', 0))  # Trade count
            },
            timestamp=float(data.get('E', 0)) / 1000,  # Event time
            source='binance'
        )
        
        await self.stream_manager.produce_message(message)
    
    async def _process_trade_data(self, stream_name: str, data: Dict[str, Any]):
        """Process individual trade data"""
        symbol = data.get('s')
        if not symbol:
            return
        
        message = StreamMessage(
            stream_type=StreamType.PRICE,
            symbol=symbol,
            data={
                'type': 'trade',
                'price': float(data.get('p', 0)),
                'quantity': float(data.get('q', 0)),
                'trade_id': data.get('t'),
                'is_buyer_maker': data.get('m', False)
            },
            timestamp=float(data.get('T', 0)) / 1000,  # Trade time
            source='binance'
        )
        
        await self.stream_manager.produce_message(message)
    
    async def _process_depth_data(self, stream_name: str, data: Dict[str, Any]):
        """Process order book depth data"""
        symbol = data.get('s')
        if not symbol:
            return
        
        message = StreamMessage(
            stream_type=StreamType.PRICE,
            symbol=symbol,
            data={
                'type': 'depth',
                'bids': [[float(bid[0]), float(bid[1])] for bid in data.get('b', [])],
                'asks': [[float(ask[0]), float(ask[1])] for ask in data.get('a', [])],
                'last_update_id': data.get('lastUpdateId')
            },
            timestamp=float(data.get('E', 0)) / 1000,  # Event time
            source='binance'
        )
        
        await self.stream_manager.produce_message(message)
    
    async def stop(self):
        """Stop the Binance provider"""
        if self.websocket_client:
            await self.websocket_client.disconnect()
        logger.info("Binance provider stopped")
    
    async def health_check(self) -> Dict[str, Any]:
        """Check provider health"""
        if not self.websocket_client:
            return {'status': 'unhealthy', 'reason': 'Not initialized'}
        
        return {
            'status': 'healthy' if self.websocket_client.is_healthy() else 'unhealthy',
            'connected': self.websocket_client.is_connected,
            'subscribed_symbols': len(self.subscribed_symbols),
            'reconnect_attempts': self.websocket_client.reconnect_attempts
        }
