import asyncio
import logging
from typing import Dict, List, Optional, Any
from decimal import Decimal
from datetime import datetime
from core.protocol_base import ProtocolBase, LiquidityPool, TokenInfo, SwapTransaction
from core.starknet_client import StarkNetClient
from utils.contract_utils import ContractUtils
from config.settings import protocol_config

logger = logging.getLogger(__name__)

class JediSwapProtocol(ProtocolBase):
    """JediSwap protocol data collector and analyzer"""
    
    def __init__(self, starknet_client: StarkNetClient):
        config = protocol_config.PROTOCOLS["jediswap"]
        super().__init__("JediSwap", starknet_client, config)
        self.router_address = config["router_address"]
        self.factory_address = config["factory_address"]
        self.supported_tokens = config["supported_tokens"]
        self.fee_tiers = config["fee_tiers"]
        
        # Event signatures for monitoring
        self.swap_event_signature = "0x99cd8bde557814842a3121e8ddfd433a539b8c9f14bf31ebf108d12e6196e9"
        self.mint_event_signature = "0x4c209b5fc8ad50758f13e2e1088ba56a560dff690a1c6fef26394f4c03821c4"
        self.burn_event_signature = "0x0c396cd989a39f4459b5a75fd0c67fc94e3e7a3c0b34ccb0e77e3c0e8f3c8c8"
    
    async def initialize(self):
        """Initialize JediSwap protocol connection"""
        try:
            logger.info("Initializing JediSwap protocol...")
            
            # Load supported tokens
            for symbol in self.supported_tokens:
                if symbol in protocol_config.TOKENS:
                    token_address = protocol_config.TOKENS[symbol]
                    token_info = await self._get_token_info(token_address, symbol)
                    self.tokens[token_address] = token_info
            
            # Discover and load all pools
            await self._discover_pools()
            
            logger.info(f"JediSwap initialized with {len(self.pools)} pools and {len(self.tokens)} tokens")
            
        except Exception as e:
            logger.error(f"Error initializing JediSwap: {e}")
            raise
    
    async def get_all_pools(self) -> List[LiquidityPool]:
        """Get all JediSwap liquidity pools"""
        try:
            if not self.pools:
                await self._discover_pools()
            
            # Update pool data
            updated_pools = []
            for pool_address in self.pools.keys():
                pool = await self.get_pool_info(pool_address)
                updated_pools.append(pool)
            
            return updated_pools
            
        except Exception as e:
            logger.error(f"Error fetching JediSwap pools: {e}")
            return []
    
    async def get_pool_info(self, pool_address: str) -> LiquidityPool:
        """Get detailed information about a JediSwap pool"""
        try:
            # Get pool reserves and token info
            reserves_call = await self.client.call_contract(
                pool_address, 
                "get_reserves", 
                []
            )
            
            # Get token addresses
            token0_call = await self.client.call_contract(pool_address, "token0", [])
            token1_call = await self.client.call_contract(pool_address, "token1", [])
            
            # Get total supply
            total_supply_call = await self.client.call_contract(
                pool_address, 
                "totalSupply", 
                []
            )
            
            token0_address = hex(token0_call[0])
            token1_address = hex(token1_call[0])
            
            # Get or create token info
            token0 = await self._get_or_create_token_info(token0_address)
            token1 = await self._get_or_create_token_info(token1_address)
            
            # Parse reserves (assuming Uint256 format)
            reserve0 = Decimal(reserves_call[0]) / (10 ** token0.decimals)
            reserve1 = Decimal(reserves_call[1]) / (10 ** token1.decimals)
            total_supply = Decimal(total_supply_call[0]) / (10 ** 18)  # LP tokens typically 18 decimals
            
            # Create pool object
            pool = LiquidityPool(
                address=pool_address,
                token0=token0,
                token1=token1,
                reserve0=reserve0,
                reserve1=reserve1,
                total_supply=total_supply,
                fee_tier=Decimal('0.003')  # JediSwap default 0.3%
            )
            
            # Calculate TVL and APR
            pool.tvl_usd = await self.calculate_tvl(pool)
            pool.volume_24h = await self._get_24h_volume(pool_address)
            pool.apr = await self.calculate_apr(pool)
            
            self.pools[pool_address] = pool
            return pool
            
        except Exception as e:
            logger.error(f"Error fetching pool info for {pool_address}: {e}")
            raise
    
    async def get_swap_quote(
        self, 
        token_in: str, 
        token_out: str, 
        amount_in: Decimal
    ) -> Dict[str, Any]:
        """Get swap quote from JediSwap router"""
        try:
            # Convert amount to wei
            token_in_info = self.tokens.get(token_in)
            if not token_in_info:
                raise ValueError(f"Token {token_in} not found")
            
            amount_in_wei = int(amount_in * (10 ** token_in_info.decimals))
            
            # Call getAmountsOut on router
            amounts_out = await self.client.call_contract(
                self.router_address,
                "getAmountsOut",
                [amount_in_wei, [token_in, token_out]]
            )
            
            token_out_info = self.tokens.get(token_out)
            amount_out = Decimal(amounts_out[-1]) / (10 ** token_out_info.decimals)
            
            # Calculate price impact
            price_impact = await self._calculate_price_impact(
                token_in, token_out, amount_in, amount_out
            )
            
            return {
                "amount_in": amount_in,
                "amount_out": amount_out,
                "price_impact": price_impact,
                "fee": amount_in * Decimal('0.003'),
                "route": [token_in, token_out],
                "protocol": self.name
            }
            
        except Exception as e:
            logger.error(f"Error getting swap quote: {e}")
            raise
    
    async def monitor_swaps(self, callback):
        """Monitor JediSwap transactions and parse swap events"""
        try:
            logger.info("Starting JediSwap swap monitoring...")
            
            async def process_block(block_info):
                try:
                    transactions = await self.client.get_block_transactions(
                        block_info["block_number"]
                    )
                    
                    for tx in transactions:
                        # Get transaction receipt to check for swap events
                        receipt = await self.client.get_transaction_receipt(tx["hash"])
                        
                        for event in receipt.get("events", []):
                            if event["from_address"] in self.pools:
                                # Check if it's a swap event
                                if len(event["keys"]) > 0 and event["keys"][0] == self.swap_event_signature:
                                    swap_tx = await self._parse_swap_event(
                                        tx, event, block_info["timestamp"]
                                    )
                                    if swap_tx:
                                        await callback(swap_tx)
                                        
                except Exception as e:
                    logger.error(f"Error processing block {block_info['block_number']}: {e}")
            
            # Start monitoring new blocks
            await self.client.monitor_new_blocks(process_block)
            
        except Exception as e:
            logger.error(f"Error in swap monitoring: {e}")
            raise
    
    async def _discover_pools(self):
        """Discover all JediSwap pools from factory contract"""
        try:
            # Get total number of pairs
            all_pairs_length = await self.client.call_contract(
                self.factory_address,
                "allPairsLength",
                []
            )
            
            total_pairs = all_pairs_length[0]
            logger.info(f"Discovering {total_pairs} JediSwap pools...")
            
            # Fetch all pool addresses
            for i in range(min(total_pairs, 100)):  # Limit to first 100 pools for demo
                try:
                    pair_address = await self.client.call_contract(
                        self.factory_address,
                        "allPairs",
                        [i]
                    )
                    
                    pool_address = hex(pair_address[0])
                    
                    # Initialize empty pool (will be populated when needed)
                    self.pools[pool_address] = None
                    
                except Exception as e:
                    logger.warning(f"Error fetching pool {i}: {e}")
                    continue
                    
        except Exception as e:
            logger.error(f"Error discovering pools: {e}")
            raise
    
    async def _get_token_info(self, address: str, symbol: str = None) -> TokenInfo:
        """Get token information from contract"""
        try:
            # Get token details
            name_result = await self.client.call_contract(address, "name", [])
            symbol_result = await self.client.call_contract(address, "symbol", [])
            decimals_result = await self.client.call_contract(address, "decimals", [])
            
            # Convert felt to string (simplified)
            name = symbol or "Unknown"  # Simplified for demo
            symbol = symbol or "UNK"
            decimals = decimals_result[0]
            
            return TokenInfo(
                address=address,
                symbol=symbol,
                name=name,
                decimals=decimals
            )
            
        except Exception as e:
            logger.error(f"Error getting token info for {address}: {e}")
            # Return default token info
            return TokenInfo(
                address=address,
                symbol=symbol or "UNK",
                name=symbol or "Unknown",
                decimals=18
            )
    
    async def _get_or_create_token_info(self, address: str) -> TokenInfo:
        """Get existing token info or create new one"""
        if address in self.tokens:
            return self.tokens[address]
        
        # Find symbol from known tokens
        symbol = None
        for sym, addr in protocol_config.TOKENS.items():
            if addr.lower() == address.lower():
                symbol = sym
                break
        
        token_info = await self._get_token_info(address, symbol)
        self.tokens[address] = token_info
        return token_info
    
    async def _get_24h_volume(self, pool_address: str) -> Decimal:
        """Get 24h trading volume for a pool (simplified implementation)"""
        try:
            # In a real implementation, you'd query historical swap events
            # For demo, return a mock value
            return Decimal('100000')  # $100k daily volume
        except Exception as e:
            logger.error(f"Error getting 24h volume for {pool_address}: {e}")
            return Decimal('0')
    
    async def _calculate_price_impact(
        self, 
        token_in: str, 
        token_out: str, 
        amount_in: Decimal, 
        amount_out: Decimal
    ) -> Decimal:
        """Calculate price impact for a swap"""
        try:
            # Find the pool for this token pair
            pool = None
            for p in self.pools.values():
                if p and ((p.token0.address == token_in and p.token1.address == token_out) or
                         (p.token1.address == token_in and p.token0.address == token_out)):
                    pool = p
                    break
            
            if not pool:
                return Decimal('0')
            
            # Calculate spot price
            if pool.token0.address == token_in:
                spot_price = pool.reserve1 / pool.reserve0
            else:
                spot_price = pool.reserve0 / pool.reserve1
            
            # Calculate execution price
            execution_price = amount_out / amount_in
            
            # Price impact percentage
            price_impact = abs((execution_price - spot_price) / spot_price) * 100
            return Decimal(str(price_impact))
            
        except Exception as e:
            logger.error(f"Error calculating price impact: {e}")
            return Decimal('0')
    
    async def _parse_swap_event(
        self, 
        transaction: Dict, 
        event: Dict, 
        timestamp: int
    ) -> Optional[SwapTransaction]:
        """Parse swap event from transaction receipt"""
        try:
            # Simplified event parsing - in practice you'd need proper ABI decoding
            event_data = event.get("data", [])
            
            if len(event_data) < 4:
                return None
            
            # Extract swap data (simplified)
            amount_in = Decimal(int(event_data[0], 16))
            amount_out = Decimal(int(event_data[1], 16))
            token_in = event_data[2] if len(event_data) > 2 else "0x0"
            token_out = event_data[3] if len(event_data) > 3 else "0x0"
            
            return SwapTransaction(
                tx_hash=transaction["hash"],
                block_number=transaction.get("block_number", 0),
                timestamp=timestamp,
                pool_address=event["from_address"],
                token_in=token_in,
                token_out=token_out,
                amount_in=amount_in,
                amount_out=amount_out,
                price_impact=Decimal('0'),  # Would calculate from reserves
                gas_used=transaction.get("gas_used", 0),
                sender=transaction.get("sender_address", "0x0")
            )
            
        except Exception as e:
            logger.error(f"Error parsing swap event: {e}")
            return None
