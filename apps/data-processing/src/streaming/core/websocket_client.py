import asyncio
import json
import time
from typing import Optional, Callable, Dict, Any
import websockets
import structlog
from prometheus_client import Counter, Gauge

from config import config

logger = structlog.get_logger(__name__)

class WebSocketClient:
    def __init__(self, url: str, on_message: Callable[[Dict[str, Any]], None]):
        self.url = url
        self.on_message = on_message
        self.websocket: Optional[websockets.WebSocketServerProtocol] = None
        self.is_connected = False
        self.reconnect_attempts = 0
        self.last_ping = time.time()
        
        # Metrics
        self.connections_active = Gauge(
            'websocket_connections_active',
            'Active WebSocket connections',
            ['url']
        )
        self.messages_received = Counter(
            'websocket_messages_received_total',
            'Total WebSocket messages received',
            ['url']
        )
        self.connection_errors = Counter(
            'websocket_connection_errors_total',
            'WebSocket connection errors',
            ['url', 'error_type']
        )
    
    async def connect(self):
        """Establish WebSocket connection with retry logic"""
        while self.reconnect_attempts < config.max_reconnect_attempts:
            try:
                logger.info(f"Connecting to WebSocket: {self.url}")
                
                self.websocket = await websockets.connect(
                    self.url,
                    ping_interval=20,
                    ping_timeout=10,
                    close_timeout=10
                )
                
                self.is_connected = True
                self.reconnect_attempts = 0
                self.connections_active.labels(url=self.url).set(1)
                
                logger.info(f"WebSocket connected: {self.url}")
                return True
                
            except Exception as e:
                self.reconnect_attempts += 1
                self.connection_errors.labels(
                    url=self.url,
                    error_type=type(e).__name__
                ).inc()
                
                logger.error(
                    f"WebSocket connection failed (attempt {self.reconnect_attempts}): {e}"
                )
                
                if self.reconnect_attempts < config.max_reconnect_attempts:
                    await asyncio.sleep(config.reconnect_delay)
                else:
                    logger.error("Max reconnection attempts reached")
                    return False
        
        return False
    
    async def disconnect(self):
        """Close WebSocket connection"""
        self.is_connected = False
        if self.websocket:
            await self.websocket.close()
            self.websocket = None
        
        self.connections_active.labels(url=self.url).set(0)
        logger.info(f"WebSocket disconnected: {self.url}")
    
    async def send_message(self, message: Dict[str, Any]):
        """Send message through WebSocket"""
        if not self.is_connected or not self.websocket:
            raise RuntimeError("WebSocket not connected")
        
        try:
            await self.websocket.send(json.dumps(message))
            logger.debug(f"Sent WebSocket message: {message}")
        except Exception as e:
            logger.error(f"Failed to send WebSocket message: {e}")
            raise
    
    async def listen(self):
        """Listen for incoming WebSocket messages"""
        if not self.websocket:
            raise RuntimeError("WebSocket not connected")
        
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    self.messages_received.labels(url=self.url).inc()
                    self.last_ping = time.time()
                    
                    # Call message handler
                    await self.on_message(data)
                    
                except json.JSONDecodeError as e:
                    logger.error(f"Invalid JSON received: {e}")
                except Exception as e:
                    logger.error(f"Error processing message: {e}")
                    
        except websockets.exceptions.ConnectionClosed:
            logger.warning("WebSocket connection closed")
            self.is_connected = False
        except Exception as e:
            logger.error(f"WebSocket listen error: {e}")
            self.is_connected = False
            raise
    
    async def start_with_reconnect(self):
        """Start WebSocket with automatic reconnection"""
        while True:
            try:
                if await self.connect():
                    await self.listen()
                
                # Connection lost, attempt reconnection
                if self.is_connected:
                    self.is_connected = False
                    self.connections_active.labels(url=self.url).set(0)
                
                logger.info("Attempting to reconnect...")
                await asyncio.sleep(config.reconnect_delay)
                
            except asyncio.CancelledError:
                await self.disconnect()
                break
            except Exception as e:
                logger.error(f"Unexpected error in WebSocket client: {e}")
                await asyncio.sleep(config.reconnect_delay)
    
    def is_healthy(self) -> bool:
        """Check if WebSocket connection is healthy"""
        if not self.is_connected:
            return False
        
        # Check if we've received messages recently
        time_since_last_ping = time.time() - self.last_ping
        return time_since_last_ping < config.websocket_timeout
