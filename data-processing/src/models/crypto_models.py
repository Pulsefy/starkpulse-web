"""
Cryptocurrency data models
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Numeric, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship

from ..config.database import Base

class CryptoCurrency(Base):
    """
    Cryptocurrency information model
    """
    __tablename__ = 'cryptocurrencies'
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(20), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), unique=True, index=True)
    cmc_id = Column(Integer, unique=True, index=True)  # CoinMarketCap ID
    coingecko_id = Column(String(100), unique=True, index=True)
    
    # Metadata
    description = Column(Text)
    website_url = Column(String(255))
    explorer_url = Column(String(255))
    source_code_url = Column(String(255))
    whitepaper_url = Column(String(255))
    
    # Status
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    price_data = relationship("PriceData", back_populates="cryptocurrency")
    market_data = relationship("MarketData", back_populates="cryptocurrency")

class PriceData(Base):
    """
    Cryptocurrency price data model
    """
    __tablename__ = 'price_data'
    
    id = Column(Integer, primary_key=True, index=True)
    cryptocurrency_id = Column(Integer, ForeignKey('cryptocurrencies.id'), nullable=False)
    
    # Price information
    price_usd = Column(Numeric(20, 8), nullable=False)
    price_btc = Column(Numeric(20, 8))
    price_eth = Column(Numeric(20, 8))
    
    # Change data
    percent_change_1h = Column(Numeric(10, 4))
    percent_change_24h = Column(Numeric(10, 4))
    percent_change_7d = Column(Numeric(10, 4))
    percent_change_30d = Column(Numeric(10, 4))
    
    # Volume and market cap
    volume_24h = Column(Numeric(20, 2))
    market_cap = Column(Numeric(20, 2))
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    cryptocurrency = relationship("CryptoCurrency", back_populates="price_data")

class MarketData(Base):
    """
    Extended market data for cryptocurrencies
    """
    __tablename__ = 'market_data'
    
    id = Column(Integer, primary_key=True, index=True)
    cryptocurrency_id = Column(Integer, ForeignKey('cryptocurrencies.id'), nullable=False)
    
    # Supply information
    circulating_supply = Column(Numeric(20, 2))
    total_supply = Column(Numeric(20, 2))
    max_supply = Column(Numeric(20, 2))
    
    # Market metrics
    market_cap_rank = Column(Integer)
    fully_diluted_market_cap = Column(Numeric(20, 2))
    
    # Trading data
    high_24h = Column(Numeric(20, 8))
    low_24h = Column(Numeric(20, 8))
    ath = Column(Numeric(20, 8))  # All-time high
    ath_date = Column(DateTime)
    atl = Column(Numeric(20, 8))  # All-time low
    atl_date = Column(DateTime)
    
    # Timestamp
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    cryptocurrency = relationship("CryptoCurrency", back_populates="market_data")
