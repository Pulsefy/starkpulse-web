import os
from typing import Dict, List
from pydantic import BaseSettings, Field
from dotenv import load_dotenv

load_dotenv()

class StarkNetConfig(BaseSettings):
    """StarkNet network configuration"""
    
    # RPC Configuration
    STARKNET_RPC_URL: str = Field(
        default="https://starknet-mainnet.public.blastapi.io",
        env="STARKNET_RPC_URL"
    )
    STARKNET_TESTNET_RPC_URL: str = Field(
        default="https://starknet-goerli.public.blastapi.io",
        env="STARKNET_TESTNET_RPC_URL"
    )
    
    # Network Settings
    NETWORK: str = Field(default="mainnet", env="STARKNET_NETWORK")
    CHAIN_ID: int = Field(default=1, env="STARKNET_CHAIN_ID")
    
    # Database Configuration
    DATABASE_URL: str = Field(
        default="postgresql://user:password@localhost/starknet_defi",
        env="DATABASE_URL"
    )
    
    # Redis Configuration
    REDIS_URL: str = Field(default="redis://localhost:6379", env="REDIS_URL")
    
    # API Configuration
    API_HOST: str = Field(default="0.0.0.0", env="API_HOST")
    API_PORT: int = Field(default=8000, env="API_PORT")
    
    # Monitoring Configuration
    BLOCK_POLLING_INTERVAL: int = Field(default=10, env="BLOCK_POLLING_INTERVAL")
    MAX_CONCURRENT_REQUESTS: int = Field(default=50, env="MAX_CONCURRENT_REQUESTS")
    
    class Config:
        env_file = ".env"

class ProtocolConfig:
    """DeFi Protocol addresses and configurations"""
    
    PROTOCOLS = {
        "jediswap": {
            "name": "JediSwap",
            "router_address": "0x041fd22b238fa21cfcf5dd45a8548974d8263b3a531a60388411c5e230f97023",
            "factory_address": "0x00dad44c139a476c7a17fc8141e6db680e9abc9f56fe249a105094c44382c2fd",
            "supported_tokens": ["ETH", "USDC", "USDT", "DAI", "WBTC"],
            "fee_tiers": [0.003, 0.005, 0.01]  # 0.3%, 0.5%, 1%
        },
        "myswap": {
            "name": "mySwap",
            "router_address": "0x010884171baf1914edc28d7afb619b40a4051cfae78a094a55d230f19e944a28",
            "factory_address": "0x00bef22de5282d1c2c7d0a4e4c6c5b8e5c5e5c5e5c5e5c5e5c5e5c5e5c5e5c5e",
            "supported_tokens": ["ETH", "USDC", "USDT", "STRK"],
            "fee_tiers": [0.003, 0.01]  # 0.3%, 1%
        },
        "10kswap": {
            "name": "10KSwap",
            "router_address": "0x07a6f98c03379b9513ca84cca1373ff452a7462a3b61598f0af5bb27ad7f76d1",
            "factory_address": "0x01c0a36e26a8f822e0d81f20a5a562b16a8f8a3b9e4b5c6d7e8f9a0b1c2d3e4f",
            "supported_tokens": ["ETH", "USDC", "USDT"],
            "fee_tiers": [0.003]  # 0.3%
        }
    }
    
    # Common token addresses on StarkNet
    TOKENS = {
        "ETH": "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
        "USDC": "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
        "USDT": "0x068f5c6a61780768455de69077e07e89787839bf8166decfbf92b645209c0fb8",
        "DAI": "0x00da114221cb83fa859dbdb4c44beeaa0bb37c7537ad5ae66fe5e0efd20e6eb3",
        "WBTC": "0x03fe2b97c1fd336e750087d68b9b867997fd64a2661ff3ca5a7c771641e8e7ac",
        "STRK": "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
    }

# Global configuration instances
starknet_config = StarkNetConfig()
protocol_config = ProtocolConfig()
