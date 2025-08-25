import asyncio
from typing import Dict, List, Optional, Any
from starknet_py.net.full_node_client import FullNodeClient
from starknet_py.net.models import StarknetChainId
from starknet_py.contract import Contract
from starknet_py.net.client_models import Call
from starknet_py.cairo.felt import Felt
import logging
from config.settings import starknet_config

logger = logging.getLogger(__name__)

class StarkNetClient:
    """Core StarkNet blockchain client for DeFi protocol interactions"""
    
    def __init__(self, network: str = "mainnet"):
        self.network = network
        self.rpc_url = (
            starknet_config.STARKNET_RPC_URL 
            if network == "mainnet" 
            else starknet_config.STARKNET_TESTNET_RPC_URL
        )
        self.client = FullNodeClient(node_url=self.rpc_url)
        self.contracts: Dict[str, Contract] = {}
        self._semaphore = asyncio.Semaphore(starknet_config.MAX_CONCURRENT_REQUESTS)
        
    async def get_latest_block(self) -> Dict[str, Any]:
        """Get the latest block information"""
        try:
            async with self._semaphore:
                block = await self.client.get_block("latest")
                return {
                    "block_number": block.block_number,
                    "block_hash": hex(block.block_hash),
                    "timestamp": block.timestamp,
                    "transaction_count": len(block.transactions)
                }
        except Exception as e:
            logger.error(f"Error fetching latest block: {e}")
            raise
    
    async def get_contract(self, address: str, abi: List[Dict]) -> Contract:
        """Get or create a contract instance"""
        if address not in self.contracts:
            try:
                contract = await Contract.from_address(
                    address=address,
                    provider=self.client
                )
                self.contracts[address] = contract
                logger.info(f"Contract loaded: {address}")
            except Exception as e:
                logger.error(f"Error loading contract {address}: {e}")
                raise
        
        return self.contracts[address]
    
    async def call_contract(
        self, 
        contract_address: str, 
        function_name: str, 
        calldata: List[int] = None
    ) -> Any:
        """Make a contract call"""
        try:
            async with self._semaphore:
                call = Call(
                    to_addr=int(contract_address, 16),
                    selector=function_name,
                    calldata=calldata or []
                )
                result = await self.client.call_contract(call)
                return result
        except Exception as e:
            logger.error(f"Contract call failed for {contract_address}.{function_name}: {e}")
            raise
    
    async def get_transaction_receipt(self, tx_hash: str) -> Dict[str, Any]:
        """Get transaction receipt and details"""
        try:
            async with self._semaphore:
                receipt = await self.client.get_transaction_receipt(tx_hash)
                return {
                    "transaction_hash": hex(receipt.transaction_hash),
                    "status": receipt.execution_status.value,
                    "block_number": receipt.block_number,
                    "gas_consumed": receipt.actual_fee,
                    "events": [
                        {
                            "from_address": hex(event.from_address),
                            "keys": [hex(key) for key in event.keys],
                            "data": [hex(data) for data in event.data]
                        }
                        for event in receipt.events
                    ]
                }
        except Exception as e:
            logger.error(f"Error fetching transaction receipt {tx_hash}: {e}")
            raise
    
    async def get_block_transactions(self, block_number: int) -> List[Dict[str, Any]]:
        """Get all transactions in a specific block"""
        try:
            async with self._semaphore:
                block = await self.client.get_block(block_number)
                transactions = []
                
                for tx in block.transactions:
                    transactions.append({
                        "hash": hex(tx.transaction_hash),
                        "type": tx.type.name,
                        "sender_address": hex(tx.sender_address) if hasattr(tx, 'sender_address') else None,
                        "calldata": [hex(data) for data in tx.calldata] if hasattr(tx, 'calldata') else [],
                        "max_fee": tx.max_fee if hasattr(tx, 'max_fee') else 0
                    })
                
                return transactions
        except Exception as e:
            logger.error(f"Error fetching block transactions for block {block_number}: {e}")
            raise
    
    async def monitor_new_blocks(self, callback):
        """Monitor new blocks and execute callback for each new block"""
        last_block = 0
        
        while True:
            try:
                current_block_info = await self.get_latest_block()
                current_block = current_block_info["block_number"]
                
                if current_block > last_block:
                    logger.info(f"New block detected: {current_block}")
                    await callback(current_block_info)
                    last_block = current_block
                
                await asyncio.sleep(starknet_config.BLOCK_POLLING_INTERVAL)
                
            except Exception as e:
                logger.error(f"Error in block monitoring: {e}")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def close(self):
        """Close the client connection"""
        await self.client.close()
