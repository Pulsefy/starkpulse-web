"""
Cryptocurrency data processing module
"""

import asyncio
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from decimal import Decimal

from ..services.api_client import CoinMarketCapClient, CoinGeckoClient, APIClient
from ..services.database_service import DatabaseService
from ..services.cache_service import CacheService, CacheKeys
from ..models.crypto_models import CryptoCurrency, PriceData, MarketData
from ..utils.logger import setup_logger
from ..utils.validators import validate_price_data
from ..utils.quality_metrics import DataQualityMetrics
from ..utils.anomaly_detection import AnomalyDetector
from ..services.alert_service import AlertService
from ..utils.helpers import calculate_percentage_change

logger = setup_logger(__name__)

    """
    Processor for cryptocurrency data collection and processing with validation, anomaly detection, and quality monitoring
    """
    def __init__(self, db_service: DatabaseService, cache_service: CacheService, 
                 cmc_client: CoinMarketCapClient, cg_client: CoinGeckoClient = None):
        self.db_service = db_service
        self.cache_service = cache_service
        self.cmc_client = cmc_client
        self.cg_client = cg_client or CoinGeckoClient()
        self.quality_metrics = DataQualityMetrics()
        self.alert_service = AlertService()

    async def update_prices_realtime(self, symbols: List[str] = None, use_coingecko: bool = False) -> int:
        """Update cryptocurrency prices in real-time from CoinGecko or CoinMarketCap"""
        logger.info(f"Updating real-time prices (CoinGecko: {use_coingecko})")
        try:
            if symbols:
                cryptos = [self.db_service.get_cryptocurrency_by_symbol(symbol) for symbol in symbols]
                cryptos = [c for c in cryptos if c is not None]
            else:
                cryptos = self.db_service.get_all_cryptocurrencies(active_only=True)
            if not cryptos:
                logger.warning("No cryptocurrencies found to update")
                return 0
            batch_size = 50 if use_coingecko else 100
            total_processed = 0
            for i in range(0, len(cryptos), batch_size):
                batch = cryptos[i:i + batch_size]
                batch_symbols = [crypto.symbol.lower() for crypto in batch]
                try:
                    if use_coingecko:
                        async with self.cg_client:
                            response = await self.cg_client.get_price(batch_symbols)
                        # Normalize CoinGecko response
                        for crypto in batch:
                            price = response.get(crypto.symbol.lower(), {}).get('usd')
                            if price is not None:
                                price_data = {
                                    'cryptocurrency_id': crypto.id,
                                    'price_usd': Decimal(str(price)),
                                    'timestamp': datetime.utcnow()
                                }
                                validation_errors = validate_price_data(price_data)
                                self.quality_metrics.record_total()
                                if validation_errors:
                                    self.quality_metrics.record_missing_field()
                                    self.alert_service.send_alert(
                                        f"Invalid CoinGecko price data for {crypto.symbol}: {validation_errors}",
                                        tags=["validation", "price_data"]
                                    )
                                    continue
                                self.db_service.save_price_data([price_data])
                                total_processed += 1
                    else:
                        async with self.cmc_client:
                            response = await self.cmc_client.get_quotes(batch_symbols)
                        if 'data' not in response:
                            logger.error("Invalid response format from CoinMarketCap")
                            continue
                        for crypto in batch:
                            if crypto.symbol in response['data']:
                                usd_quote = response['data'][crypto.symbol].get('quote', {}).get('USD', {})
                                if usd_quote:
                                    price_data = {
                                        'cryptocurrency_id': crypto.id,
                                        'price_usd': Decimal(str(usd_quote.get('price', 0))),
                                        'timestamp': datetime.utcnow()
                                    }
                                    validation_errors = validate_price_data(price_data)
                                    self.quality_metrics.record_total()
                                    if validation_errors:
                                        self.quality_metrics.record_missing_field()
                                        self.alert_service.send_alert(
                                            f"Invalid CMC price data for {crypto.symbol}: {validation_errors}",
                                            tags=["validation", "price_data"]
                                        )
                                        continue
                                    self.db_service.save_price_data([price_data])
                                    total_processed += 1
                except Exception as e:
                    logger.error(f"Error processing real-time price batch: {str(e)}")
                    continue
            logger.info(f"Successfully updated {total_processed} real-time price records")
            logger.info(f"Data quality metrics: {self.quality_metrics.get_metrics()}")
            return total_processed
        except Exception as e:
            logger.error(f"Error updating real-time prices: {str(e)}")
            return 0

    async def backfill_historical_prices(self, symbol: str, days: int = 30, use_coingecko: bool = True) -> int:
        """Backfill historical price data from CoinGecko or CoinMarketCap"""
        logger.info(f"Backfilling historical prices for {symbol} (days: {days}, CoinGecko: {use_coingecko})")
        try:
            crypto = self.db_service.get_cryptocurrency_by_symbol(symbol)
            if not crypto:
                logger.warning(f"Cryptocurrency {symbol} not found")
                return 0
            if use_coingecko:
                async with self.cg_client:
                    response = await self.cg_client.get_market_chart(symbol.lower(), days=days)
                prices = response.get('prices', [])
                count = 0
                for price_point in prices:
                    ts, price = price_point
                    price_data = {
                        'cryptocurrency_id': crypto.id,
                        'price_usd': Decimal(str(price)),
                        'timestamp': datetime.utcfromtimestamp(ts / 1000)
                    }
                    validation_errors = validate_price_data(price_data)
                    self.quality_metrics.record_total()
                    if validation_errors:
                        self.quality_metrics.record_missing_field()
                        self.alert_service.send_alert(
                            f"Invalid historical price data for {symbol}: {validation_errors}",
                            tags=["validation", "price_data"]
                        )
                        continue
                    self.db_service.save_price_data([price_data])
                    count += 1
                logger.info(f"Backfilled {count} historical price records for {symbol}")
                logger.info(f"Data quality metrics: {self.quality_metrics.get_metrics()}")
                return count
            else:
                # CoinMarketCap historical backfill implementation
                from datetime import timezone
                import math
                async with self.cmc_client:
                    # CMC API may have a max range per call, so we loop by day
                    now = datetime.now(timezone.utc)
                    start_time = now - timedelta(days=days)
                    count = 0
                    for day in range(days):
                        day_start = (start_time + timedelta(days=day)).replace(hour=0, minute=0, second=0, microsecond=0)
                        day_end = day_start + timedelta(days=1)
                        time_start_iso = day_start.isoformat().replace('+00:00', 'Z')
                        time_end_iso = day_end.isoformat().replace('+00:00', 'Z')
                        response = await self.cmc_client.get_historical_quotes(symbol, time_start_iso, time_end_iso, interval="hourly")
                        quotes = response.get('data', {}).get('quotes', [])
                        for quote in quotes:
                            price = quote.get('quote', {}).get('USD', {}).get('price')
                            timestamp = quote.get('timestamp')
                            if price is not None and timestamp:
                                try:
                                    ts = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                                except Exception:
                                    continue
                                price_data = {
                                    'cryptocurrency_id': crypto.id,
                                    'price_usd': Decimal(str(price)),
                                    'timestamp': ts
                                }
                                validation_errors = validate_price_data(price_data)
                                self.quality_metrics.record_total()
                                if validation_errors:
                                    self.quality_metrics.record_missing_field()
                                    self.alert_service.send_alert(
                                        f"Invalid CMC historical price data for {symbol}: {validation_errors}",
                                        tags=["validation", "price_data"]
                                    )
                                    continue
                                self.db_service.save_price_data([price_data])
                                count += 1
                    logger.info(f"Backfilled {count} historical price records for {symbol} from CoinMarketCap")
                    logger.info(f"Data quality metrics: {self.quality_metrics.get_metrics()}")
                    return count
        except Exception as e:
            logger.error(f"Error backfilling historical prices for {symbol}: {str(e)}")
            return 0
    
    async def update_cryptocurrency_listings(self, limit: int = 200) -> int:
        """
        Update cryptocurrency listings from CoinMarketCap
        
        Args:
            limit: Number of cryptocurrencies to fetch
            
        Returns:
            Number of cryptocurrencies processed
        """
        logger.info(f"Updating cryptocurrency listings (limit: {limit})")
        
        try:
            async with self.cmc_client:
                response = await self.cmc_client.get_listings(limit=limit)
                
            if 'data' not in response:
                logger.error("Invalid response format from CoinMarketCap")
                return 0
            
            processed_count = 0
            
            for crypto_data in response['data']:
                try:
                    # Check if cryptocurrency already exists
                    existing_crypto = self.db_service.get_cryptocurrency_by_symbol(
                        crypto_data['symbol']
                    )
                    
                    if not existing_crypto:
                        # Create new cryptocurrency record
                        crypto_info = {
                            'symbol': crypto_data['symbol'],
                            'name': crypto_data['name'],
                            'slug': crypto_data['slug'],
                            'cmc_id': crypto_data['id'],
                            'is_active': True
                        }
                        
                        self.db_service.create_cryptocurrency(crypto_info)
                        logger.debug(f"Created new cryptocurrency: {crypto_data['symbol']}")
                    
                    processed_count += 1
                    
                except Exception as e:
                    logger.error(f"Error processing cryptocurrency {crypto_data.get('symbol', 'unknown')}: {str(e)}")
                    continue
            
            logger.info(f"Successfully processed {processed_count} cryptocurrencies")
            return processed_count
            
        except Exception as e:
            logger.error(f"Error updating cryptocurrency listings: {str(e)}")
            return 0
    
    async def update_prices(self, symbols: List[str] = None) -> int:
        """Update cryptocurrency prices"""
        logger.info("Updating cryptocurrency prices")
        
        try:
            # Get cryptocurrencies to update
            if symbols:
                cryptos = [self.db_service.get_cryptocurrency_by_symbol(symbol) 
                          for symbol in symbols]
                cryptos = [c for c in cryptos if c is not None]
            else:
                cryptos = self.db_service.get_all_cryptocurrencies(active_only=True)
            
            if not cryptos:
                logger.warning("No cryptocurrencies found to update")
                return 0
            
            # Process in batches to respect API limits
            batch_size = 100
            total_processed = 0
            
            for i in range(0, len(cryptos), batch_size):
                batch = cryptos[i:i + batch_size]
                batch_symbols = [crypto.symbol for crypto in batch]
                try:
                    async with self.cmc_client:
                        response = await self.cmc_client.get_quotes(batch_symbols)
                    if 'data' not in response:
                        logger.error("Invalid response format from CoinMarketCap")
                        continue
                    price_data_batch = []
                    batch_prices = []
                    for crypto in batch:
                        if crypto.symbol in response['data']:
                            quote_data = response['data'][crypto.symbol]
                            usd_quote = quote_data.get('quote', {}).get('USD', {})
                            if usd_quote:
                                price = Decimal(str(usd_quote.get('price', 0)))
                                price_data = {
                                    'cryptocurrency_id': crypto.id,
                                    'price_usd': price,
                                    'percent_change_1h': usd_quote.get('percent_change_1h'),
                                    'percent_change_24h': usd_quote.get('percent_change_24h'),
                                    'percent_change_7d': usd_quote.get('percent_change_7d'),
                                    'percent_change_30d': usd_quote.get('percent_change_30d'),
                                    'volume_24h': usd_quote.get('volume_24h'),
                                    'market_cap': usd_quote.get('market_cap'),
                                    'timestamp': datetime.utcnow()
                                }
                                self.quality_metrics.record_total()
                                # Validate price data
                                validation_errors = validate_price_data(price_data)
                                if validation_errors:
                                    self.quality_metrics.record_missing_field()
                                    self.alert_service.send_alert(
                                        f"Invalid price data for {crypto.symbol}: {validation_errors}",
                                        tags=["validation", "price_data"]
                                    )
                                    logger.warning(f"Invalid price data for {crypto.symbol}: {validation_errors}")
                                    continue
                                price_data_batch.append(price_data)
                                batch_prices.append(float(price))
                                # Cache the price data
                                cache_key = CacheKeys.crypto_price(crypto.symbol)
                                self.cache_service.set(cache_key, {
                                    'price': float(price_data['price_usd']),
                                    'change_24h': price_data['percent_change_24h'],
                                    'timestamp': price_data['timestamp'].isoformat()
                                }, ttl=300)  # 5 minutes
                    # Anomaly detection on batch prices
                    if batch_prices:
                        anomaly_indices = AnomalyDetector.detect_price_anomalies(batch_prices)
                        if anomaly_indices:
                            self.quality_metrics.metrics['anomalies_detected'] += len(anomaly_indices)
                            for idx in anomaly_indices:
                                symbol = batch[idx].symbol
                                self.alert_service.send_alert(
                                    f"Anomaly detected in price for {symbol}",
                                    tags=["anomaly", "price_data"]
                                )
                    # Bulk save price data
                    if price_data_batch:
                        saved_count = self.db_service.save_price_data(price_data_batch)
                        total_processed += saved_count
                        logger.debug(f"Saved {saved_count} price records for batch")
                    # Rate limiting delay
                    await asyncio.sleep(1)
                except Exception as e:
                    logger.error(f"Error processing price data batch: {str(e)}")
                    continue
            
            logger.info(f"Successfully updated {total_processed} price records")
            logger.info(f"Data quality metrics: {self.quality_metrics.get_metrics()}")
            return total_processed
        except Exception as e:
            logger.error(f"Error updating price data: {str(e)}")
            return 0
    
    async def calculate_market_metrics(self, symbol: str) -> Optional[Dict[str, Any]]:
        """
        Calculate advanced market metrics for a cryptocurrency
        
        Args:
            symbol: Cryptocurrency symbol
            
        Returns:
            Dictionary with calculated metrics or None if error
        """
        try:
            crypto = self.db_service.get_cryptocurrency_by_symbol(symbol)
            if not crypto:
                return None
            
            # Get recent price data for calculations
            with self.db_service.get_session() as session:
                recent_prices = session.query(PriceData)\
                                     .filter(PriceData.cryptocurrency_id == crypto.id)\
                                     .filter(PriceData.timestamp >= datetime.utcnow() - timedelta(days=30))\
                                     .order_by(PriceData.timestamp.desc())\
                                     .limit(30)\
                                     .all()
            
            if len(recent_prices) < 2:
                return None
            
            # Calculate metrics
            current_price = float(recent_prices[0].price_usd)
            prices = [float(p.price_usd) for p in reversed(recent_prices)]
            
            # Volatility (standard deviation of returns)
            returns = []
            for i in range(1, len(prices)):
                return_pct = (prices[i] - prices[i-1]) / prices[i-1]
                returns.append(return_pct)
            
            if returns:
                import statistics
                volatility = statistics.stdev(returns) * 100  # Convert to percentage
            else:
                volatility = 0
            
            # Support and resistance levels (simplified)
            high_30d = max(prices)
            low_30d = min(prices)
            
            # RSI calculation (simplified 14-period)
            if len(prices) >= 14:
                rsi = self._calculate_rsi(prices[-14:])
            else:
                rsi = 50  # Neutral
            
            metrics = {
                'symbol': symbol,
                'current_price': current_price,
                'volatility_30d': round(volatility, 4),
                'high_30d': high_30d,
                'low_30d': low_30d,
                'rsi': round(rsi, 2),
                'price_change_30d': calculate_percentage_change(prices[0], current_price),
                'calculated_at': datetime.utcnow().isoformat()
            }
            
            # Cache the metrics
            cache_key = CacheKeys.crypto_market_data(symbol)
            self.cache_service.set(cache_key, metrics, ttl=1800)  # 30 minutes
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating market metrics for {symbol}: {str(e)}")
            return None
    
    def _calculate_rsi(self, prices: List[float], period: int = 14) -> float:
        """
        Calculate Relative Strength Index (RSI)
        
        Args:
            prices: List of prices
            period: RSI period
            
        Returns:
            RSI value (0-100)
        """
        if len(prices) < period + 1:
            return 50.0
        
        gains = []
        losses = []
        
        for i in range(1, len(prices)):
            change = prices[i] - prices[i-1]
            if change > 0:
                gains.append(change)
                losses.append(0)
            else:
                gains.append(0)
                losses.append(abs(change))
        
        if len(gains) < period:
            return 50.0
        
        avg_gain = sum(gains[-period:]) / period
        avg_loss = sum(losses[-period:]) / period
        
        if avg_loss == 0:
            return 100.0
        
        rs = avg_gain / avg_loss
        rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    async def get_trending_cryptocurrencies(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get trending cryptocurrencies based on price changes and volume
        
        Args:
            limit: Number of trending cryptos to return
            
        Returns:
            List of trending cryptocurrency data
        """
        try:
            with self.db_service.get_session() as session:
                # Get latest price data with significant changes
                from sqlalchemy import and_, desc
                
                trending_query = session.query(PriceData, CryptoCurrency)\
                    .join(CryptoCurrency)\
                    .filter(and_(
                        CryptoCurrency.is_active == True,
                        PriceData.percent_change_24h != None,
                        PriceData.volume_24h != None,
                        PriceData.volume_24h > 1000000  # Minimum volume filter
                    ))\
                    .order_by(desc(PriceData.percent_change_24h))\
                    .limit(limit * 2)  # Get more to filter
                
                results = trending_query.all()
                
                trending_cryptos = []
                for price_data, crypto in results:
                    if len(trending_cryptos) >= limit:
                        break
                    
                    trending_cryptos.append({
                        'symbol': crypto.symbol,
                        'name': crypto.name,
                        'price_usd': float(price_data.price_usd),
                        'change_24h': float(price_data.percent_change_24h or 0),
                        'volume_24h': float(price_data.volume_24h or 0),
                        'market_cap': float(price_data.market_cap or 0),
                        'timestamp': price_data.timestamp.isoformat()
                    })
                
                return trending_cryptos
                
        except Exception as e:
            logger.error(f"Error getting trending cryptocurrencies: {str(e)}")
            return []
    
    async def cleanup_old_price_data(self, days_to_keep: int = 90):
        """
        Clean up old price data beyond retention period
        
        Args:
            days_to_keep: Number of days of data to keep
        """
        try:
            logger.info(f"Cleaning up price data older than {days_to_keep} days")
            
            cutoff_date = datetime.utcnow() - timedelta(days=days_to_keep)
            
            with self.db_service.get_session() as session:
                deleted_count = session.query(PriceData)\
                                     .filter(PriceData.timestamp < cutoff_date)\
                                     .delete()
                
                logger.info(f"Cleaned up {deleted_count} old price records")
                
        except Exception as e:
            logger.error(f"Error cleaning up old price data: {str(e)}")
    
    async def calculate_metrics(self, symbol: str) -> Dict[str, Any]:
        """Calculate market metrics"""
        logger.info(f"Calculating metrics for {symbol}")
        
        try:
            crypto = self.db_service.get_cryptocurrency_by_symbol(symbol)
            if not crypto:
                return None
            
            # Get recent price data for calculations
            with self.db_service.get_session() as session:
                recent_prices = session.query(PriceData)\
                                     .filter(PriceData.cryptocurrency_id == crypto.id)\
                                     .filter(PriceData.timestamp >= datetime.utcnow() - timedelta(days=30))\
                                     .order_by(PriceData.timestamp.desc())\
                                     .limit(30)\
                                     .all()
            
            if len(recent_prices) < 2:
                return None
            
            # Calculate metrics
            current_price = float(recent_prices[0].price_usd)
            prices = [float(p.price_usd) for p in reversed(recent_prices)]
            
            # Volatility (standard deviation of returns)
            returns = []
            for i in range(1, len(prices)):
                return_pct = (prices[i] - prices[i-1]) / prices[i-1]
                returns.append(return_pct)
            
            if returns:
                import statistics
                volatility = statistics.stdev(returns) * 100  # Convert to percentage
            else:
                volatility = 0
            
            # Support and resistance levels (simplified)
            high_30d = max(prices)
            low_30d = min(prices)
            
            # RSI calculation (simplified 14-period)
            if len(prices) >= 14:
                rsi = self._calculate_rsi(prices[-14:])
            else:
                rsi = 50  # Neutral
            
            metrics = {
                'symbol': symbol,
                'current_price': current_price,
                'volatility_30d': round(volatility, 4),
                'high_30d': high_30d,
                'low_30d': low_30d,
                'rsi': round(rsi, 2),
                'price_change_30d': calculate_percentage_change(prices[0], current_price),
                'calculated_at': datetime.utcnow().isoformat()
            }
            
            # Cache the metrics
            cache_key = CacheKeys.crypto_market_data(symbol)
            self.cache_service.set(cache_key, metrics, ttl=1800)  # 30 minutes
            
            return metrics
            
        except Exception as e:
            logger.error(f"Error calculating market metrics for {symbol}: {str(e)}")
            return None
