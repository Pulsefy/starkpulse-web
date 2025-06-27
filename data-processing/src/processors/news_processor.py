"""
News data processing module
"""

import asyncio
import feedparser
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from urllib.parse import urlparse

from ..services.api_client import NewsAPIClient
from ..services.database_service import DatabaseService
from ..services.cache_service import CacheService, CacheKeys
from ..models.news_models import NewsArticle, NewsSource, NewsFeed
from ..utils.logger import setup_logger
from ..utils.validators import validate_news_article, sanitize_string
from ..utils.helpers import parse_datetime, extract_domain, clean_text

logger = setup_logger(__name__)

class NewsProcessor:
    """
    Processor for news data collection and processing
    """
    
    def __init__(self, db_service: DatabaseService, cache_service: CacheService, 
                 news_client: NewsAPIClient):
        self.db_service = db_service
        self.cache_service = cache_service
        self.news_client = news_client
        
        # Crypto-related keywords for filtering
        self.crypto_keywords = [
            'bitcoin', 'btc', 'ethereum', 'eth', 'cryptocurrency', 'crypto',
            'blockchain', 'defi', 'nft', 'altcoin', 'stablecoin', 'mining',
            'starknet', 'stark', 'layer2', 'l2', 'scaling', 'zk-stark'
        ]
    
    async def update_news_sources(self) -> int:
        """
        Update and validate news sources
        
        Returns:
            Number of sources processed
        """
        logger.info("Updating news sources")
        
        # Predefined reliable crypto news sources
        sources_data = [
            {
                'name': 'CoinDesk',
                'domain': 'coindesk.com',
                'description': 'Leading cryptocurrency news platform',
                'category': 'cryptocurrency',
                'reliability_score': 0.9,
                'is_verified': True
            },
            {
                'name': 'Cointelegraph',
                'domain': 'cointelegraph.com',
                'description': 'Cryptocurrency and blockchain news',
                'category': 'cryptocurrency',
                'reliability_score': 0.85,
                'is_verified': True
            },
            {
                'name': 'The Block',
                'domain': 'theblock.co',
                'description': 'Crypto research and news',
                'category': 'cryptocurrency',
                'reliability_score': 0.9,
                'is_verified': True
            },
            {
                'name': 'Decrypt',
                'domain': 'decrypt.co',
                'description': 'Cryptocurrency and Web3 news',
                'category': 'cryptocurrency',
                'reliability_score': 0.8,
                'is_verified': True
            }
        ]
        
        processed_count = 0
        
        for source_data in sources_data:
            try:
                # Check if source already exists
                with self.db_service.get_session() as session:
                    existing_source = session.query(NewsSource)\
                                           .filter(NewsSource.domain == source_data['domain'])\
                                           .first()
                
                if not existing_source:
                    self.db_service.create_news_source(source_data)
                    logger.debug(f"Created news source: {source_data['name']}")
                
                processed_count += 1
                
            except Exception as e:
                logger.error(f"Error processing news source {source_data['name']}: {str(e)}")
                continue
        
        logger.info(f"Successfully processed {processed_count} news sources")
        return processed_count
    
    async def fetch_crypto_news(self, hours_back: int = 24) -> int:
        """
        Fetch cryptocurrency-related news articles
        
        Args:
            hours_back: How many hours back to fetch news
            
        Returns:
            Number of articles processed
        """
        logger.info(f"Fetching crypto news from last {hours_back} hours")
        
        # Dummy implementation
        dummy_articles = [
            {
                "title": "Bitcoin reaches new highs",
                "url": "https://example.com/news1",
                "source": "CryptoNews",
                "relevance_score": 0.85
            },
            {
                "title": "Ethereum upgrade successful",
                "url": "https://example.com/news2", 
                "source": "BlockchainDaily",
                "relevance_score": 0.92
            }
        ]
        
        saved_count = self.db_service.save_news_articles(dummy_articles)
        
        # Cache recent news
        self.cache_service.set("news:recent", dummy_articles[:10], ttl=1800)
        
        return saved_count
    
    def _get_or_create_source(self, domain: str, source_info: Dict[str, Any]) -> Optional[NewsSource]:
        """
        Get existing news source or create new one
        
        Args:
            domain: Source domain
            source_info: Source information from API
            
        Returns:
            NewsSource object or None if error
        """
        try:
            with self.db_service.get_session() as session:
                # Try to find existing source
                source = session.query(NewsSource)\
                              .filter(NewsSource.domain == domain)\
                              .first()
                
                if source:
                    return source
                
                # Create new source
                source_data = {
                    'name': source_info.get('name', domain),
                    'domain': domain,
                    'description': f"News source: {domain}",
                    'reliability_score': 0.5,  # Default score
                    'is_verified': False,
                    'is_active': True
                }
                
                return self.db_service.create_news_source(source_data)
                
        except Exception as e:
            logger.error(f"Error getting/creating news source {domain}: {str(e)}")
            return None
    
    def _calculate_relevance_score(self, title: str, description: str, content: str) -> float:
        """
        Calculate relevance score for crypto news
        
        Args:
            title: Article title
            description: Article description
            content: Article content
            
        Returns:
            Relevance score (0.0 to 1.0)
        """
        try:
            # Combine all text
            full_text = f"{title} {description} {content}".lower()
            
            # Count keyword matches
            keyword_matches = 0
            total_keywords = len(self.crypto_keywords)
            
            for keyword in self.crypto_keywords:
                if keyword.lower() in full_text:
                    keyword_matches += 1
            
            # Base score from keyword density
            base_score = keyword_matches / total_keywords
            
            # Boost score for title matches (more important)
            title_lower = title.lower()
            title_boost = 0
            for keyword in self.crypto_keywords[:5]:  # Top keywords
                if keyword.lower() in title_lower:
                    title_boost += 0.1
            
            # Final score (capped at 1.0)
            final_score = min(base_score + title_boost, 1.0)
            
            return round(final_score, 3)
            
        except Exception as e:
            logger.error(f"Error calculating relevance score: {str(e)}")
            return 0.5  # Default neutral score
    
    async def analyze_sentiment(self, article_id: int) -> float:
        """
        Analyze sentiment of news article (placeholder for ML integration)
        
        Args:
            article_id: Article ID to analyze
            
        Returns:
            Sentiment score (-1.0 to 1.0) or None if error
        """
        logger.info(f"Analyzing sentiment for article {article_id}")
        
        # Dummy implementation
        return 0.75  # Positive sentiment
    
    async def get_trending_news(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get trending news articles based on relevance and recency
        
        Args:
            limit: Number of trending articles to return
            
        Returns:
            List of trending news articles
        """
        try:
            with self.db_service.get_session() as session:
                from sqlalchemy import and_, desc
                
                # Get recent high-relevance articles
                trending_query = session.query(NewsArticle, NewsSource)\
                    .join(NewsSource)\
                    .filter(and_(
                        NewsArticle.is_relevant == True,
                        NewsArticle.published_at >= datetime.utcnow() - timedelta(days=7),
                        NewsArticle.relevance_score >= 0.5
                    ))\
                    .order_by(desc(NewsArticle.relevance_score), desc(NewsArticle.published_at))\
                    .limit(limit)
                
                results = trending_query.all()
                
                trending_articles = []
                for article, source in results:
                    trending_articles.append({
                        'id': article.id,
                        'title': article.title,
                        'description': article.description,
                        'url': article.url,
                        'url_to_image': article.url_to_image,
                        'author': article.author,
                        'source_name': source.name,
                        'published_at': article.published_at.isoformat(),
                        'relevance_score': float(article.relevance_score or 0),
                        'sentiment_score': float(article.sentiment_score or 0)
                    })
                
                return trending_articles
                
        except Exception as e:
            logger.error(f"Error getting trending news: {str(e)}")
            return []
    
    async def cleanup_old_articles(self, days_to_keep: int = 30):
        """
        Clean up old news articles beyond retention period
        
        Args:
            days_to_keep: Number of days of articles to keep
        """
        try:
            logger.info(f"Cleaning up news articles older than {days_to_keep} days")
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            with self.db_service.get_session() as session:
                deleted_count = session.query(NewsArticle)\
                                     .filter(NewsArticle.published_at < cutoff_date)\
                                     .delete()
                
                logger.info(f"Cleaned up {deleted_count} old news articles")
                
        except Exception as e:
            logger.error(f"Error cleaning up old news articles: {str(e)}")
