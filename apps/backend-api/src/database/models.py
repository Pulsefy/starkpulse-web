from sqlalchemy import Column, Integer, String, Decimal, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime

Base = declarative_base()

class Protocol(Base):
    """DeFi Protocol model"""
    __tablename__ = "protocols"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    router_address = Column(String(66), nullable=False)
    factory_address = Column(String(66), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    pools = relationship("LiquidityPoolModel", back_populates="protocol")
    transactions = relationship("SwapTransactionModel", back_populates="protocol")

class Token(Base):
    """Token model"""
    __tablename__ = "tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    address = Column(String(66), unique=True, nullable=False, index=True)
    symbol = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    decimals = Column(Integer, nullable=False)
    price_usd = Column(Decimal(20, 8), nullable=True)
    market_cap = Column(Decimal(20, 2), nullable=True)
    volume_24h = Column(Decimal(20, 2), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class LiquidityPoolModel(Base):
    """Liquidity Pool model"""
    __tablename__ = "liquidity_pools"
    
    id = Column(Integer, primary_key=True, index=True)
    address = Column(String(66), unique=True, nullable=False, index=True)
    protocol_id = Column(Integer, ForeignKey("protocols.id"), nullable=False)
    token0_address = Column(String(66), ForeignKey("tokens.address"), nullable=False)
    token1_address = Column(String(66), ForeignKey("tokens.address"), nullable=False)
    reserve0 = Column(Decimal(30, 18), nullable=False, default=0)
    reserve1 = Column(Decimal(30, 18), nullable=False, default=0)
    total_supply = Column(Decimal(30, 18), nullable=False, default=0)
    fee_tier = Column(Decimal(5, 4), nullable=False)  # e.g., 0.003 for 0.3%
    tvl_usd = Column(Decimal(20, 2), nullable=True)
    volume_24h = Column(Decimal(20, 2), nullable=True)
    volume_7d = Column(Decimal(20, 2), nullable=True)
    apr = Column(Decimal(8, 4), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    protocol = relationship("Protocol", back_populates="pools")
    token0 = relationship("Token", foreign_keys=[token0_address])
    token1 = relationship("Token", foreign_keys=[token1_address])
    transactions = relationship("SwapTransactionModel", back_populates="pool")

class SwapTransactionModel(Base):
    """Swap Transaction model"""
    __tablename__ = "swap_transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    tx_hash = Column(String(66), unique=True, nullable=False, index=True)
    block_number = Column(Integer, nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    protocol_id = Column(Integer, ForeignKey("protocols.id"), nullable=False)
    pool_id = Column(Integer, ForeignKey("liquidity_pools.id"), nullable=False)
    sender = Column(String(66), nullable=False)
    token_in = Column(String(66), nullable=False)
    token_out = Column(String(66), nullable=False)
    amount_in = Column(Decimal(30, 18), nullable=False)
    amount_out = Column(Decimal(30, 18), nullable=False)
    price_impact = Column(Decimal(8, 4), nullable=True)
    gas_used = Column(Integer, nullable=True)
    gas_price = Column(Decimal(20, 8), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    protocol = relationship("Protocol", back_populates="transactions")
    pool = relationship("LiquidityPoolModel", back_populates="transactions")

class ArbitrageOpportunityModel(Base):
    """Arbitrage Opportunity model"""
    __tablename__ = "arbitrage_opportunities"
    
    id = Column(Integer, primary_key=True, index=True)
    token0_symbol = Column(String(20), nullable=False)
    token1_symbol = Column(String(20), nullable=False)
    protocol_a = Column(String(100), nullable=False)
    protocol_b = Column(String(100), nullable=False)
    price_a = Column(Decimal(30, 18), nullable=False)
    price_b = Column(Decimal(30, 18), nullable=False)
    profit_percentage = Column(Decimal(8, 4), nullable=False)
    required_capital = Column(Decimal(20, 8), nullable=False)
    estimated_profit = Column(Decimal(20, 8), nullable=False)
    gas_cost = Column(Decimal(20, 8), nullable=False)
    net_profit = Column(Decimal(20, 8), nullable=False)
    is_executed = Column(Boolean, default=False)
    detected_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

class YieldOpportunity(Base):
    """Yield Farming Opportunity model"""
    __tablename__ = "yield_opportunities"
    
    id = Column(Integer, primary_key=True, index=True)
    protocol_name = Column(String(100), nullable=False)
    pool_address = Column(String(66), nullable=False)
    token_pair = Column(String(50), nullable=False)  # e.g., "ETH/USDC"
    apr = Column(Decimal(8, 4), nullable=False)
    tvl_usd = Column(Decimal(20, 2), nullable=False)
    risk_score = Column(Decimal(3, 2), nullable=True)  # 0-10 scale
    impermanent_loss_risk = Column(String(20), nullable=True)  # LOW, MEDIUM, HIGH
    additional_rewards = Column(Text, nullable=True)  # JSON string of additional reward tokens
    min_deposit = Column(Decimal(20, 8), nullable=True)
    lock_period = Column(Integer, nullable=True)  # in days
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class PortfolioPosition(Base):
    """User Portfolio Position model"""
    __tablename__ = "portfolio_positions"
    
    id = Column(Integer, primary_key=True, index=True)
    wallet_address = Column(String(66), nullable=False, index=True)
    protocol_name = Column(String(100), nullable=False)
    pool_address = Column(String(66), nullable=False)
    token_pair = Column(String(50), nullable=False)
    position_type = Column(String(20), nullable=False)  # LP, STAKE, FARM
    amount_token0 = Column(Decimal(30, 18), nullable=True)
    amount_token1 = Column(Decimal(30, 18), nullable=True)
    lp_tokens = Column(Decimal(30, 18), nullable=True)
    entry_price_usd = Column(Decimal(20, 8), nullable=False)
    current_value_usd = Column(Decimal(20, 8), nullable=True)
    unrealized_pnl = Column(Decimal(20, 8), nullable=True)
    rewards_earned = Column(Decimal(20, 8), nullable=True, default=0)
    entry_timestamp = Column(DateTime(timezone=True), nullable=False)
    last_updated = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True)
