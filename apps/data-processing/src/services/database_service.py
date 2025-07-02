"""
Database service for data operations
"""

from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from contextlib import contextmanager

from ..config.database import DatabaseConfig
from ..models.crypto_models import CryptoCurrency, PriceData, MarketData
from ..models.news_models import NewsArticle, NewsSource
from ..models.portfolio_models import Portfolio, Position, Transaction
from ..utils.logger import setup_logger

logger = setup_logger(__name__)

class DatabaseService:
    """Database service for data persistence"""
    
    def __init__(self, db_config: DatabaseConfig):
        self.db_config = db_config
    
    @contextmanager
    def get_session(self):
        """Database session context manager"""
        session = self.db_config.get_session()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database error: {str(e)}")
            raise
        finally:
            session.close()
    
    # Cryptocurrency operations
    def create_cryptocurrency(self, crypto_data: Dict[str, Any]) -> CryptoCurrency:
        """Create a new cryptocurrency record"""
        with self.get_session() as session:
            crypto = CryptoCurrency(**crypto_data)
            session.add(crypto)
            session.flush()
            session.refresh(crypto)
            return crypto
    
    def get_cryptocurrency_by_symbol(self, symbol: str) -> Optional[CryptoCurrency]:
        """Get cryptocurrency by symbol"""
        with self.get_session() as session:
            return session.query(CryptoCurrency).filter(CryptoCurrency.symbol == symbol).first()
    
    def get_all_cryptocurrencies(self, active_only: bool = True) -> List[CryptoCurrency]:
        """Get all cryptocurrencies"""
        with self.get_session() as session:
            query = session.query(CryptoCurrency)
            if active_only:
                query = query.filter(CryptoCurrency.is_active == True)
            return query.all()
    
    def save_price_data(self, price_data_list: List[Dict[str, Any]]) -> int:
        """
        Bulk save price data
        
        Args:
            price_data_list: List of price data dictionaries
            
        Returns:
            int: Number of records saved
        """
        with self.get_session() as session:
            price_objects = [PriceData(**data) for data in price_data_list]
            session.bulk_save_objects(price_objects)
            return len(price_objects)
    
    def get_latest_price_data(self, cryptocurrency_id: int) -> Optional[PriceData]:
        """Get latest price data for a cryptocurrency"""
        with self.get_session() as session:
            return session.query(PriceData)\
                         .filter(PriceData.cryptocurrency_id == cryptocurrency_id)\
                         .order_by(PriceData.timestamp.desc())\
                         .first()
    
    def save_crypto_data(self, data: List[Dict[str, Any]]) -> int:
        """Save cryptocurrency data"""
        logger.info(f"Saving {len(data)} crypto records")
        # Dummy implementation
        return len(data)
    
    # News operations
    def create_news_source(self, source_data: Dict[str, Any]) -> NewsSource:
        """Create a new news source"""
        with self.get_session() as session:
            source = NewsSource(**source_data)
            session.add(source)
            session.flush()
            session.refresh(source)
            return source
    
    def save_news_articles(self, articles: List[Dict[str, Any]]) -> int:
        """Save news articles"""
        logger.info(f"Saving {len(articles)} news articles")
        # Dummy implementation
        return len(articles)
    
    def get_recent_news(self, limit: int = 100) -> List[NewsArticle]:
        """Get recent news articles"""
        with self.get_session() as session:
            return session.query(NewsArticle)\
                         .filter(NewsArticle.is_relevant == True)\
                         .order_by(NewsArticle.published_at.desc())\
                         .limit(limit)\
                         .all()
    
    # Portfolio operations
    def create_portfolio(self, portfolio_data: Dict[str, Any]) -> Portfolio:
        """Create a new portfolio"""
        with self.get_session() as session:
            portfolio = Portfolio(**portfolio_data)
            session.add(portfolio)
            session.flush()
            session.refresh(portfolio)
            return portfolio
    
    def get_user_portfolios(self, user_id: str) -> List[Portfolio]:
        """Get all portfolios for a user"""
        with self.get_session() as session:
            return session.query(Portfolio)\
                         .filter(Portfolio.user_id == user_id)\
                         .filter(Portfolio.is_active == True)\
                         .all()
    
    def update_portfolio_value(self, portfolio_id: int, total_value: float, total_pnl: float):
        """Update portfolio total value and P&L"""
        with self.get_session() as session:
            portfolio = session.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
            if portfolio:
                portfolio.total_value_usd = total_value
                portfolio.total_pnl = total_pnl
                if portfolio.total_cost_basis > 0:
                    portfolio.total_pnl_percentage = (total_pnl / portfolio.total_cost_basis) * 100
    
    def get_portfolio_data(self, user_id: str) -> List[Dict[str, Any]]:
        """Get portfolio data for user"""
        logger.info(f"Getting portfolio data for user {user_id}")
        # Dummy implementation
        return []
    
    # Utility operations
    def cleanup_old_data(self, days: int = 90):
        """Clean up old data beyond retention period"""
        with self.get_session() as session:
            from datetime import datetime, timedelta
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            
            # Clean up old price data (keep daily snapshots)
            deleted_prices = session.query(PriceData)\
                                  .filter(PriceData.timestamp < cutoff_date)\
                                  .delete()
            
            logger.info(f"Cleaned up {deleted_prices} old price records")
    
    def get_health_status(self) -> Dict[str, Any]:
        """Get database health status"""
        try:
            with self.get_session() as session:
                # Test basic connectivity
                session.execute("SELECT 1")
                
                # Get table counts
                crypto_count = session.query(CryptoCurrency).count()
                price_count = session.query(PriceData).count()
                news_count = session.query(NewsArticle).count()
                
                return {
                    'status': 'healthy',
                    'cryptocurrencies': crypto_count,
                    'price_records': price_count,
                    'news_articles': news_count
                }
        except Exception as e:
            logger.error(f"Database health check failed: {str(e)}")
            return {
                'status': 'unhealthy',
                'error': str(e)
            }
