import asyncio
import json
import time
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, asdict
from enum import Enum
import redis.asyncio as redis
import structlog
from prometheus_client import Counter, Histogram, Gauge

from config import config

logger = structlog.get_logger(__name__)

class StreamType(Enum):
    PRICE = "crypto:prices"
    NEWS = "crypto:news"
    BLOCKCHAIN = "crypto:blockchain"

@dataclass
class StreamMessage:
    stream_type: StreamType
    symbol: Optional[str]
    data: Dict[str, Any]
    timestamp: float
    source: str
    message_id: Optional[str] = None

class StreamManager:
    def __init__(self):
        self.redis_client: Optional[redis.Redis] = None
        self.processors: Dict[StreamType, List[Callable]] = {
            StreamType.PRICE: [],
            StreamType.NEWS: [],
            StreamType.BLOCKCHAIN: []
        }
        self.consumer_tasks: List[asyncio.Task] = []
        self.is_running = False
        
        # Metrics
        self.messages_produced = Counter(
            'streaming_messages_produced_total',
            'Total messages produced',
            ['stream_type', 'source']
        )
        self.messages_consumed = Counter(
            'streaming_messages_consumed_total',
            'Total messages consumed',
            ['stream_type', 'processor']
        )
        self.processing_duration = Histogram(
            'streaming_processing_duration_seconds',
            'Message processing duration',
            ['stream_type', 'processor']
        )
        self.stream_length = Gauge(
            'streaming_stream_length',
            'Current stream length',
            ['stream_type']
        )
        
    async def initialize(self):
        """Initialize Redis connection and create consumer groups"""
        try:
            self.redis_client = redis.Redis(
                host=config.redis_host,
                port=config.redis_port,
                password=config.redis_password,
                db=config.redis_db,
                decode_responses=True
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info("Redis connection established")
            
            # Create consumer groups for each stream type
            for stream_type in StreamType:
                try:
                    await self.redis_client.xgroup_create(
                        stream_type.value,
                        config.consumer_group,
                        id='0',
                        mkstream=True
                    )
                    logger.info(f"Created consumer group for {stream_type.value}")
                except redis.ResponseError as e:
                    if "BUSYGROUP" not in str(e):
                        raise
                    logger.debug(f"Consumer group already exists for {stream_type.value}")
                        
        except Exception as e:
            logger.error(f"Failed to initialize StreamManager: {e}")
            raise
    
    async def produce_message(self, message: StreamMessage) -> str:
        """Produce a message to the appropriate stream"""
        if not self.redis_client:
            raise RuntimeError("StreamManager not initialized")
        
        try:
            # Convert message to dict for Redis
            message_data = {
                'symbol': message.symbol or '',
                'data': json.dumps(message.data),
                'timestamp': message.timestamp,
                'source': message.source
            }
            
            # Add to Redis stream
            message_id = await self.redis_client.xadd(
                message.stream_type.value,
                message_data,
                maxlen=config.max_stream_length
            )
            
            # Update metrics
            self.messages_produced.labels(
                stream_type=message.stream_type.value,
                source=message.source
            ).inc()
            
            # Update stream length gauge
            stream_info = await self.redis_client.xinfo_stream(message.stream_type.value)
            self.stream_length.labels(stream_type=message.stream_type.value).set(
                stream_info['length']
            )
            
            logger.debug(f"Produced message {message_id} to {message.stream_type.value}")
            return message_id
            
        except Exception as e:
            logger.error(f"Failed to produce message: {e}")
            raise
    
    def register_processor(self, stream_type: StreamType, processor: Callable):
        """Register a message processor for a stream type"""
        self.processors[stream_type].append(processor)
        logger.info(f"Registered processor for {stream_type.value}")
    
    async def start_consumers(self):
        """Start consumer tasks for all stream types"""
        if self.is_running:
            logger.warning("Consumers already running")
            return
        
        self.is_running = True
        
        for stream_type in StreamType:
            if self.processors[stream_type]:
                task = asyncio.create_task(
                    self._consume_stream(stream_type)
                )
                self.consumer_tasks.append(task)
                logger.info(f"Started consumer for {stream_type.value}")
        
        logger.info("All consumers started")
    
    async def stop_consumers(self):
        """Stop all consumer tasks"""
        self.is_running = False
        
        for task in self.consumer_tasks:
            task.cancel()
        
        if self.consumer_tasks:
            await asyncio.gather(*self.consumer_tasks, return_exceptions=True)
        
        self.consumer_tasks.clear()
        logger.info("All consumers stopped")
    
    async def _consume_stream(self, stream_type: StreamType):
        """Consume messages from a specific stream"""
        while self.is_running:
            try:
                # Read messages from stream
                messages = await self.redis_client.xreadgroup(
                    config.consumer_group,
                    config.consumer_name,
                    {stream_type.value: '>'},
                    count=10,
                    block=1000
                )
                
                for stream_name, stream_messages in messages:
                    for message_id, fields in stream_messages:
                        await self._process_message(
                            stream_type, message_id, fields
                        )
                        
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error consuming {stream_type.value}: {e}")
                await asyncio.sleep(1)
    
    async def _process_message(self, stream_type: StreamType, message_id: str, fields: Dict):
        """Process a single message"""
        try:
            # Reconstruct message
            message = StreamMessage(
                stream_type=stream_type,
                symbol=fields.get('symbol') or None,
                data=json.loads(fields['data']),
                timestamp=float(fields['timestamp']),
                source=fields['source'],
                message_id=message_id
            )
            
            # Process with all registered processors
            for processor in self.processors[stream_type]:
                start_time = time.time()
                try:
                    await processor(message)
                    
                    # Update metrics
                    self.messages_consumed.labels(
                        stream_type=stream_type.value,
                        processor=processor.__name__
                    ).inc()
                    
                    self.processing_duration.labels(
                        stream_type=stream_type.value,
                        processor=processor.__name__
                    ).observe(time.time() - start_time)
                    
                except Exception as e:
                    logger.error(f"Processor {processor.__name__} failed: {e}")
            
            # Acknowledge message
            await self.redis_client.xack(
                stream_type.value,
                config.consumer_group,
                message_id
            )
            
        except Exception as e:
            logger.error(f"Failed to process message {message_id}: {e}")
    
    async def get_stream_info(self) -> Dict[str, Any]:
        """Get information about all streams"""
        if not self.redis_client:
            return {}
        
        info = {}
        for stream_type in StreamType:
            try:
                stream_info = await self.redis_client.xinfo_stream(stream_type.value)
                info[stream_type.value] = {
                    'length': stream_info['length'],
                    'first_entry': stream_info.get('first-entry'),
                    'last_entry': stream_info.get('last-entry')
                }
            except redis.ResponseError:
                info[stream_type.value] = {'length': 0}
        
        return info
    
    async def health_check(self) -> Dict[str, Any]:
        """Perform health check"""
        try:
            if not self.redis_client:
                return {'status': 'unhealthy', 'reason': 'Redis not connected'}
            
            # Test Redis connection
            await self.redis_client.ping()
            
            # Get stream info
            stream_info = await self.get_stream_info()
            
            return {
                'status': 'healthy',
                'consumers_running': len(self.consumer_tasks),
                'streams': stream_info,
                'processors_registered': {
                    stream_type.value: len(processors)
                    for stream_type, processors in self.processors.items()
                }
            }
            
        except Exception as e:
            return {'status': 'unhealthy', 'reason': str(e)}
    
    async def close(self):
        """Clean up resources"""
        await self.stop_consumers()
        if self.redis_client:
            await self.redis_client.close()
        logger.info("StreamManager closed")
