from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass
from decimal import Decimal
import asyncio
import logging

logger = logging.getLogger(__name__)

@dataclass
class TokenInfo:
    """Token information structure"""
    address: str
    symbol: str
    name: str
    decimals: int
    price_usd: Optional[Decimal] = None

@dataclass
class LiquidityPool:
    """Liquidity pool information"""
    address: str
    token0: TokenInfo
    token1: TokenInfo
    reserve0: Decimal
    reserve1: Decimal
    total_supply: Decimal
    fee_tier: Decimal
    tvl_usd: Optional[Decimal] = None
    volume_24h: Optional[Decimal] = None
    apr: Optional[Decimal] = None

@dataclass
class SwapTransaction:
    """Swap transaction data"""
    tx_hash: str
    block_number: int
    timestamp: int
    pool_address: str
    token_in: str
    token_out: str
    amount_in: Decimal
    amount_out: Decimal
    price_impact: Decimal
    gas_used: int
    sender: str

@dataclass
class ArbitrageOpportunity:
    """Arbitrage opportunity data"""
    token_pair: Tuple[str, str]
    protocol_a: str
    protocol_b: str
    price_a: Decimal
    price_b: Decimal
    profit_percentage: Decimal
    required_capital: Decimal
    estimated_profit: Decimal
    gas_cost: Decimal
    net_profit: Decimal

class ProtocolBase(ABC):
    """Base class for DeFi protocol integrations"""
    
    def __init__(self, name: str, starknet_client, config: Dict[str, Any]):
        self.name = name
        self.client = starknet_client
        self.config = config
        self.pools: Dict[str, LiquidityPool] = {}
        self.tokens: Dict[str, TokenInfo] = {}
        
    @abstractmethod
    async def initialize(self):
        """Initialize the protocol connection and load basic data"""
        pass
    
    @abstractmethod
    async def get_all_pools(self) -> List[LiquidityPool]:
        """Get all liquidity pools for this protocol"""
        pass
    
    @abstractmethod
    async def get_pool_info(self, pool_address: str) -> LiquidityPool:
        """Get detailed information about a specific pool"""
        pass
    
    @abstractmethod
    async def get_swap_quote(
        self, 
        token_in: str, 
        token_out: str, 
        amount_in: Decimal
    ) -> Dict[str, Any]:
        """Get a swap quote for given tokens and amount"""
        pass
    
    @abstractmethod
    async def monitor_swaps(self, callback) -> None:
        """Monitor swap transactions and execute callback for each swap"""
        pass
    
    async def calculate_tvl(self, pool: LiquidityPool) -> Decimal:
        """Calculate Total Value Locked for a pool"""
        try:
            if not pool.token0.price_usd or not pool.token1.price_usd:
                return Decimal('0')
            
            tvl = (
                pool.reserve0 * pool.token0.price_usd +
                pool.reserve1 * pool.token1.price_usd
            )
            return tvl
        except Exception as e:
            logger.error(f"Error calculating TVL for pool {pool.address}: {e}")
            return Decimal('0')
    
    async def calculate_apr(self, pool: LiquidityPool) -> Decimal:
        """Calculate Annual Percentage Rate for a pool"""
        try:
            if not pool.volume_24h or not pool.tvl_usd or pool.tvl_usd == 0:
                return Decimal('0')
            
            # Simple APR calculation: (daily_fees * 365) / TVL
            daily_fees = pool.volume_24h * pool.fee_tier
            apr = (daily_fees * 365) / pool.tvl_usd * 100
            return apr
        except Exception as e:
            logger.error(f"Error calculating APR for pool {pool.address}: {e}")
            return Decimal('0')
    
    async def detect_arbitrage_opportunities(
        self, 
        other_protocols: List['ProtocolBase']
    ) -> List[ArbitrageOpportunity]:
        """Detect arbitrage opportunities between this protocol and others"""
        opportunities = []
        
        try:
            for other_protocol in other_protocols:
                # Compare prices across protocols
                for pool_addr, pool in self.pools.items():
                    token_pair = (pool.token0.symbol, pool.token1.symbol)
                    
                    # Find corresponding pool in other protocol
                    other_pool = None
                    for other_addr, other_p in other_protocol.pools.items():
                        if ((other_p.token0.symbol, other_p.token1.symbol) == token_pair or
                            (other_p.token1.symbol, other_p.token0.symbol) == token_pair):
                            other_pool = other_p
                            break
                    
                    if other_pool:
                        # Calculate price difference and potential profit
                        opportunity = await self._calculate_arbitrage_profit(
                            pool, other_pool, self.name, other_protocol.name
                        )
                        if opportunity and opportunity.profit_percentage > Decimal('0.5'):  # >0.5% profit
                            opportunities.append(opportunity)
                            
        except Exception as e:
            logger.error(f"Error detecting arbitrage opportunities: {e}")
        
        return opportunities
    
    async def _calculate_arbitrage_profit(
        self, 
        pool_a: LiquidityPool, 
        pool_b: LiquidityPool,
        protocol_a: str,
        protocol_b: str
    ) -> Optional[ArbitrageOpportunity]:
        """Calculate potential arbitrage profit between two pools"""
        try:
            # Simple price calculation (reserve1/reserve0)
            price_a = pool_a.reserve1 / pool_a.reserve0
            price_b = pool_b.reserve1 / pool_b.reserve0
            
            if price_a == price_b:
                return None
            
            # Determine which direction is profitable
            if price_a > price_b:
                profit_percentage = ((price_a - price_b) / price_b) * 100
                required_capital = min(pool_a.reserve0, pool_b.reserve0) * Decimal('0.1')  # 10% of smaller reserve
            else:
                profit_percentage = ((price_b - price_a) / price_a) * 100
                required_capital = min(pool_a.reserve1, pool_b.reserve1) * Decimal('0.1')
            
            estimated_profit = required_capital * (profit_percentage / 100)
            gas_cost = Decimal('0.01')  # Estimated gas cost in USD
            net_profit = estimated_profit - gas_cost
            
            return ArbitrageOpportunity(
                token_pair=(pool_a.token0.symbol, pool_a.token1.symbol),
                protocol_a=protocol_a,
                protocol_b=protocol_b,
                price_a=price_a,
                price_b=price_b,
                profit_percentage=profit_percentage,
                required_capital=required_capital,
                estimated_profit=estimated_profit,
                gas_cost=gas_cost,
                net_profit=net_profit
            )
            
        except Exception as e:
            logger.error(f"Error calculating arbitrage profit: {e}")
            return None
