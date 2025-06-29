"""
Portfolio and trading data models
"""

from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Numeric, Boolean, Text, ForeignKey, Enum as SQLEnum
from sqlalchemy.orm import relationship

from ..config.database import Base

class TransactionType(Enum):
    """Transaction type enumeration"""
    BUY = "buy"
    SELL = "sell"
    TRANSFER_IN = "transfer_in"
    TRANSFER_OUT = "transfer_out"
    STAKE = "stake"
    UNSTAKE = "unstake"
    REWARD = "reward"
    FEE = "fee"

class Portfolio(Base):
    """Portfolio model"""
    __tablename__ = 'portfolios'
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    
    # Portfolio metadata
    base_currency = Column(String(10), default='USD')
    is_public = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Performance tracking
    total_value_usd = Column(Numeric(20, 2), default=0)
    total_cost_basis = Column(Numeric(20, 2), default=0)
    total_pnl = Column(Numeric(20, 2), default=0)
    total_pnl_percentage = Column(Numeric(10, 4), default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    positions = relationship("Position", back_populates="portfolio")
    transactions = relationship("Transaction", back_populates="portfolio")

class Position(Base):
    """Position model"""
    __tablename__ = 'positions'
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.id'), nullable=False)
    cryptocurrency_id = Column(Integer, ForeignKey('cryptocurrencies.id'), nullable=False)
    
    # Position data
    quantity = Column(Numeric(20, 8), nullable=False)
    average_cost = Column(Numeric(20, 8), default=0)
    total_cost_basis = Column(Numeric(20, 2), default=0)
    
    # Current values
    current_price = Column(Numeric(20, 8), default=0)
    current_value = Column(Numeric(20, 2), default=0)
    unrealized_pnl = Column(Numeric(20, 2), default=0)
    unrealized_pnl_percentage = Column(Numeric(10, 4), default=0)
    
    # Realized P&L
    realized_pnl = Column(Numeric(20, 2), default=0)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="positions")
    cryptocurrency = relationship("CryptoCurrency")

class Transaction(Base):
    """
    Portfolio transaction model
    """
    __tablename__ = 'transactions'
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey('portfolios.id'), nullable=False)
    cryptocurrency_id = Column(Integer, ForeignKey('cryptocurrencies.id'), nullable=False)
    
    # Transaction details
    transaction_type = Column(SQLEnum(TransactionType), nullable=False)
    quantity = Column(Numeric(20, 8), nullable=False)
    price = Column(Numeric(20, 8), nullable=False)
    total_value = Column(Numeric(20, 2), nullable=False)
    fee = Column(Numeric(20, 8), default=0)
    
    # External references
    external_id = Column(String(100), unique=True)  # Exchange transaction ID
    exchange = Column(String(50))
    wallet_address = Column(String(100))
    transaction_hash = Column(String(100))
    
    # Metadata
    notes = Column(Text)
    tags = Column(Text)  # JSON array of tags
    
    # Timestamps
    executed_at = Column(DateTime, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="transactions")
    cryptocurrency = relationship("CryptoCurrency")
