import asyncio
import logging
from typing import Dict, List, Optional, Any
from decimal import Decimal
from datetime import datetime, timedelta
from core.starknet_client import StarkNetClient
from core.protocol_base import ProtocolBase, ArbitrageOpportunity, LiquidityPool
from protocols.jediswap import JediSwapProtocol
from protocols.myswap import MySwapProtocol
from database.models import Base, Protocol, LiquidityPoolModel, SwapTransactionModel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from config.settings import starknet_config

logger = logging.getLogger(__name__)

class ProtocolManager:
    """Manages all DeFi protocol integrations and cross-protocol analysis"""
    
    def __init__(self, network: str = "mainnet"):
        self.network = network
        self.starknet_client = StarkNetClient(network)
        self.protocols: Dict[str, ProtocolBase] = {}
        self.is_monitoring = False
        
        # Database setup
        self.engine = create_engine(starknet_config.DATABASE_URL)
        Base.metadata.create_all(bind=self.engine)
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        self.db_session = SessionLocal()
        
        # Initialize protocols
        self._initialize_protocols()
    
    def _initialize_protocols(self):
        """Initialize all supported protocols"""
        try:
            # Add JediSwap
            self.protocols["jediswap"] = JediSwapProtocol(self.starknet_client)
            
            # Add mySwap
            self.protocols["myswap"] = MySwapProtocol(self.starknet_client)
            
            # Add more protocols as needed
            # self.protocols["10kswap"] = TenKSwapProtocol(self.starknet_client)
            
            logger.info(f"Initialized {len(self.protocols)} protocols")
            
        except Exception as e:
            logger.error(f"Error initializing protocols: {e}")
            raise
    
    async def start_all_protocols(self):
        """Initialize all protocols"""
        try:
            logger.info("Starting all protocols...")
            
            for name, protocol in self.protocols.items():
                try:
                    await protocol.initialize()
                    logger.info(f"✓ {name} protocol started successfully")
                except Exception as e:
                    logger.error(f"✗ Failed to start {name}: {e}")
            
            logger.info("All protocols initialization completed")
            
        except Exception as e:
            logger.error(f"Error starting protocols: {e}")
            raise
    
    async def get_all_pools(self) -> Dict[str, List[LiquidityPool]]:
        """Get all pools from all protocols"""
        try:
            all_pools = {}
            
            for name, protocol in self.protocols.items():
                try:
                    pools = await protocol.get_all_pools()
                    all_pools[name] = pools
                    logger.info(f"Retrieved {len(pools)} pools from {name}")
                except Exception as e:
                    logger.error(f"Error getting pools from {name}: {e}")
                    all_pools[name] = []
            
            return all_pools
            
        except Exception as e:
            logger.error(f"Error getting all pools: {e}")
            return {}
    
    async def get_best_swap_quote(
        self, 
        token_in: str, 
        token_out: str, 
        amount_in: Decimal
    ) -> Dict[str, Any]:
        """Get best swap quote across all protocols"""
        try:
            quotes = {}
            
            for name, protocol in self.protocols.items():
                try:
                    quote = await protocol.get_swap_quote(token_in, token_out, amount_in)
                    quotes[name] = quote
                except Exception as e:
                    logger.warning(f"Error getting quote from {name}: {e}")
                    continue
            
            if not quotes:
                raise ValueError("No quotes available")
            
            # Find best quote (highest output amount)
            best_protocol = max(quotes.keys(), key=lambda k: quotes[k]["amount_out"])
            best_quote = quotes[best_protocol]
            best_quote["all_quotes"] = quotes
            best_quote["best_protocol"] = best_protocol
            
            return best_quote
            
        except Exception as e:
            logger.error(f"Error getting best swap quote: {e}")
            raise
    
    async def detect_arbitrage_opportunities(self) -> List[ArbitrageOpportunity]:
        """Detect arbitrage opportunities across all protocols"""
        try:
            opportunities = []
            protocol_list = list(self.protocols.values())
            
            # Compare each protocol with every other protocol
            for i, protocol_a in enumerate(protocol_list):
                for protocol_b in protocol_list[i+1:]:
                    try:
                        arb_ops = await protocol_a.detect_arbitrage_opportunities([protocol_b])
                        opportunities.extend(arb_ops)
                    except Exception as e:
                        logger.warning(f"Error detecting arbitrage between {protocol_a.name} and {protocol_b.name}: {e}")
            
            # Sort by profit potential
            opportunities.sort(key=lambda x: x.net_profit, reverse=True)
            
            logger.info(f"Found {len(opportunities)} arbitrage opportunities")
            return opportunities
            
        except Exception as e:
            logger.error(f"Error detecting arbitrage opportunities: {e}")
            return []
    
    async def get_protocol_tvl_summary(self) -> Dict[str, Any]:
        """Get TVL summary across all protocols"""
        try:
            summary = {
                "total_tvl": Decimal('0'),
                "protocols": {},
                "top_pools": [],
                "timestamp": datetime.utcnow()
            }
            
            all_pools_data = await self.get_all_pools()
            all_pools_list = []
            
            for protocol_name, pools in all_pools_data.items():
                protocol_tvl = Decimal('0')
                pool_count = len(pools)
                
                for pool in pools:
                    if pool.tvl_usd:
                        protocol_tvl += pool.tvl_usd
                        all_pools_list.append({
                            "protocol": protocol_name,
                            "pool": pool,
                            "tvl": pool.tvl_usd
                        })
                
                summary["protocols"][protocol_name] = {
                    "tvl": protocol_tvl,
                    "pool_count": pool_count,
                    "avg_pool_size": protocol_tvl / pool_count if pool_count > 0 else Decimal('0')
                }
                
                summary["total_tvl"] += protocol_tvl
            
            # Get top 10 pools by TVL
            all_pools_list.sort(key=lambda x: x["tvl"], reverse=True)
            summary["top_pools"] = all_pools_list[:10]
            
            return summary
            
        except Exception as e:
            logger.error(f"Error getting TVL summary: {e}")
            return {}
    
    async def start_monitoring(self):
        """Start monitoring all protocols for real-time data"""
        try:
            if self.is_monitoring:
                logger.warning("Monitoring already started")
                return
            
            self.is_monitoring = True
            logger.info("Starting real-time monitoring...")
            
            # Start monitoring tasks for each protocol
            monitoring_tasks = []
            
            for name, protocol in self.protocols.items():
                task = asyncio.create_task(
                    self._monitor_protocol_swaps(name, protocol)
                )
                monitoring_tasks.append(task)
            
            # Start arbitrage detection task
            arb_task = asyncio.create_task(self._monitor_arbitrage_opportunities())
            monitoring_tasks.append(arb_task)
            
            # Start TVL update task
            tvl_task = asyncio.create_task(self._update_tvl_periodically())
            monitoring_tasks.append(tvl_task)
            
            # Wait for all tasks
            await asyncio.gather(*monitoring_tasks)
            
        except Exception as e:
            logger.error(f"Error in monitoring: {e}")
            self.is_monitoring = False
            raise
    
    async def _monitor_protocol_swaps(self, protocol_name: str, protocol: ProtocolBase):
        """Monitor swaps for a specific protocol"""
        try:
            async def swap_callback(swap_transaction):
                try:
                    logger.info(f"New {protocol_name} swap: {swap_transaction.tx_hash}")
                    
                    # Store in database
                    await self._store_swap_transaction(protocol_name, swap_transaction)
                    
                    # Trigger any additional analysis
                    await self._analyze_swap_transaction(swap_transaction)
                    
                except Exception as e:
                    logger.error(f"Error processing swap callback: {e}")
            
            await protocol.monitor_swaps(swap_callback)
            
        except Exception as e:
            logger.error(f"Error monitoring {protocol_name} swaps: {e}")
    
    async def _monitor_arbitrage_opportunities(self):
        """Continuously monitor for arbitrage opportunities"""
        try:
            while self.is_monitoring:
                try:
                    opportunities = await self.detect_arbitrage_opportunities()
                    
                    for opp in opportunities:
                        if opp.net_profit > Decimal('10'):  # $10+ profit threshold
                            logger.info(f"High-value arbitrage opportunity: {opp.net_profit} USD profit")
                            # Here you could trigger alerts, execute trades, etc.
                    
                    await asyncio.sleep(30)  # Check every 30 seconds
                    
                except Exception as e:
                    logger.error(f"Error in arbitrage monitoring: {e}")
                    await asyncio.sleep(60)  # Wait longer on error
                    
        except Exception as e:
            logger.error(f"Error in arbitrage monitoring loop: {e}")
    
    async def _update_tvl_periodically(self):
        """Update TVL data periodically"""
        try:
            while self.is_monitoring:
                try:
                    logger.info("Updating TVL data...")
                    summary = await self.get_protocol_tvl_summary()
                    
                    # Store TVL data in database or cache
                    logger.info(f"Total ecosystem TVL: ${summary.get('total_tvl', 0):,.2f}")
                    
                    await asyncio.sleep(300)  # Update every 5 minutes
                    
                except Exception as e:
                    logger.error(f"Error updating TVL: {e}")
                    await asyncio.sleep(600)  # Wait longer on error
                    
        except Exception as e:
            logger.error(f"Error in TVL update loop: {e}")
    
    async def _store_swap_transaction(self, protocol_name: str, swap_tx):
        """Store swap transaction in database"""
        try:
            # Implementation would store in database
            logger.debug(f"Storing {protocol_name} swap transaction: {swap_tx.tx_hash}")
        except Exception as e:
            logger.error(f"Error storing swap transaction: {e}")
    
    async def _analyze_swap_transaction(self, swap_tx):
        """Analyze swap transaction for patterns, MEV, etc."""
        try:
            # Implementation would analyze for MEV, large trades, etc.
            if swap_tx.amount_in > Decimal('10000'):  # Large trade threshold
                logger.info(f"Large swap detected: {swap_tx.amount_in} tokens")
        except Exception as e:
            logger.error(f"Error analyzing swap transaction: {e}")
    
    async def stop_monitoring(self):
        """Stop all monitoring activities"""
        self.is_monitoring = False
        logger.info("Monitoring stopped")
    
    async def close(self):
        """Close all connections"""
        try:
            await self.stop_monitoring()
            await self.starknet_client.close()
            self.db_session.close()
            logger.info("Protocol manager closed")
        except Exception as e:
            logger.error(f"Error closing protocol manager: {e}")
