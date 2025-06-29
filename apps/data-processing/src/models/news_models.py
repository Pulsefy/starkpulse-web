"""
News and media data models
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey, Float
from sqlalchemy.orm import relationship

from ..config.database import Base

class NewsSource(Base):
    """
    News source information model
    """
    __tablename__ = 'news_sources'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    domain = Column(String(100), unique=True, nullable=False)
    description = Column(Text)
    
    # Source metadata
    language = Column(String(10), default='en')
    country = Column(String(10))
    category = Column(String(50))
    
    # Quality metrics
    reliability_score = Column(Float, default=0.5)  # 0-1 scale
    is_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    articles = relationship("NewsArticle", back_populates="source")

class NewsArticle(Base):
    """
    News article model
    """
    __tablename__ = 'news_articles'
    
    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(Integer, ForeignKey('news_sources.id'), nullable=False)
    
    # Article content
    title = Column(String(500), nullable=False)
    description = Column(Text)
    content = Column(Text)
    url = Column(String(1000), unique=True, nullable=False)
    url_to_image = Column(String(1000))
    
    # Article metadata
    author = Column(String(200))
    published_at = Column(DateTime, nullable=False, index=True)
    language = Column(String(10), default='en')
    
    # Analysis data
    sentiment_score = Column(Float)  # -1 to 1 scale
    relevance_score = Column(Float)  # 0 to 1 scale
    keywords = Column(Text)  # JSON array of keywords
    
    # Processing status
    is_processed = Column(Boolean, default=False)
    is_relevant = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    source = relationship("NewsSource", back_populates="articles")

class NewsFeed(Base):
    """
    News feed configuration model
    """
    __tablename__ = 'news_feeds'
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    url = Column(String(1000), nullable=False)
    feed_type = Column(String(20), default='rss')  # rss, atom, json
    
    # Feed configuration
    update_interval = Column(Integer, default=1800)  # seconds
    max_articles = Column(Integer, default=100)
    keywords_filter = Column(Text)  # JSON array of keywords
    
    # Status
    is_active = Column(Boolean, default=True)
    last_updated = Column(DateTime)
    last_error = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
