import json
import logging
from typing import Dict, List, Any, Optional
from starknet_py.cairo.felt import Felt
from starknet_py.net.client_models import Call

logger = logging.getLogger(__name__)

class ContractUtils:
    """Utility functions for contract interactions and ABI parsing"""
    
    @staticmethod
    def load_abi(abi_path: str) -> List[Dict[str, Any]]:
        """Load contract ABI from JSON file"""
        try:
            with open(abi_path, 'r') as f:
                abi = json.load(f)
            return abi
        except Exception as e:
            logger.error(f"Error loading ABI from {abi_path}: {e}")
            raise
    
    @staticmethod
    def encode_function_call(function_name: str, args: List[Any]) -> Call:
        """Encode a function call with arguments"""
        try:
            # Convert arguments to Felt values
            calldata = []
            for arg in args:
                if isinstance(arg, str) and arg.startswith('0x'):
                    calldata.append(int(arg, 16))
                elif isinstance(arg, int):
                    calldata.append(arg)
                else:
                    calldata.append(int(str(arg)))
            
            return Call(
                to_addr=0,  # Will be set by the caller
                selector=function_name,
                calldata=calldata
            )
        except Exception as e:
            logger.error(f"Error encoding function call {function_name}: {e}")
            raise
    
    @staticmethod
    def decode_event_data(event_data: List[str], event_abi: Dict[str, Any]) -> Dict[str, Any]:
        """Decode event data based on ABI"""
        try:
            decoded = {}
            
            # Simple decoding - in practice, you'd need more sophisticated ABI parsing
            if 'inputs' in event_abi:
                for i, input_def in enumerate(event_abi['inputs']):
                    if i < len(event_data):
                        name = input_def['name']
                        type_name = input_def['type']
                        
                        if type_name == 'felt':
                            decoded[name] = int(event_data[i], 16)
                        elif type_name == 'Uint256':
                            # Handle Uint256 (two felts)
                            if i + 1 < len(event_data):
                                low = int(event_data[i], 16)
                                high = int(event_data[i + 1], 16)
                                decoded[name] = low + (high << 128)
                        else:
                            decoded[name] = event_data[i]
            
            return decoded
        except Exception as e:
            logger.error(f"Error decoding event data: {e}")
            return {}
    
    @staticmethod
    def calculate_price_impact(
        amount_in: int,
        reserve_in: int,
        reserve_out: int,
        fee_rate: float = 0.003
    ) -> float:
        """Calculate price impact for a swap"""
        try:
            if reserve_in == 0 or reserve_out == 0:
                return 0.0
            
            # Apply fee
            amount_in_with_fee = amount_in * (1 - fee_rate)
            
            # Calculate output amount using constant product formula
            amount_out = (amount_in_with_fee * reserve_out) / (reserve_in + amount_in_with_fee)
            
            # Calculate price before and after
            price_before = reserve_out / reserve_in
            price_after = (reserve_out - amount_out) / (reserve_in + amount_in)
            
            # Price impact percentage
            price_impact = abs((price_after - price_before) / price_before) * 100
            
            return price_impact
        except Exception as e:
            logger.error(f"Error calculating price impact: {e}")
            return 0.0
    
    @staticmethod
    def format_token_amount(amount: int, decimals: int) -> float:
        """Format token amount from wei to human readable"""
        return amount / (10 ** decimals)
    
    @staticmethod
    def parse_token_amount(amount: float, decimals: int) -> int:
        """Parse human readable amount to wei"""
        return int(amount * (10 ** decimals))
    
    @staticmethod
    def is_valid_address(address: str) -> bool:
        """Validate StarkNet address format"""
        try:
            if not address.startswith('0x'):
                return False
            
            # Remove 0x prefix and check if it's a valid hex
            hex_part = address[2:]
            int(hex_part, 16)
            
            # StarkNet addresses should be 64 characters (including 0x)
            return len(address) <= 66
        except ValueError:
            return False
    
    @staticmethod
    def normalize_address(address: str) -> str:
        """Normalize address to standard format"""
        if not address.startswith('0x'):
            address = '0x' + address
        
        # Pad with zeros if needed
        hex_part = address[2:]
        if len(hex_part) < 64:
            hex_part = hex_part.zfill(64)
        
        return '0x' + hex_part
