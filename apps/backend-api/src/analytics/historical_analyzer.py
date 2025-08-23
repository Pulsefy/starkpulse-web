import asyncio
import logging
from typing import Dict, List, Optional, Any, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from dataclasses import dataclass
import statistics
from analytics.pool_analyzer import PoolMetrics

logger = logging.getLogger(__name__)

@dataclass
class HistoricalDataPoint:
    """Single historical data point for a pool"""
    timestamp: datetime
    tvl_usd: Decimal
    volume_24h: Decimal
    price_token0: Decimal
    price_token1: Decimal
    apr: Decimal
    fees_earned: Decimal
    liquidity_providers: int

@dataclass
class TrendAnalysis:
    """Trend analysis results"""
    metric_name: str
    time_period: str
    trend_direction: str  # UP, DOWN, STABLE
    trend_strength: Decimal  # 0-10
    percentage_change: Decimal
    volatility: Decimal
    prediction_confidence: Decimal

class HistoricalAnalyzer:
    """Analyzes historical pool data and identifies trends"""
    
    def __init__(self):
        self.historical_data: Dict[str, List[HistoricalDataPoint]] = {}
        self.trend_cache: Dict[str, List[TrendAnalysis]] = {}
    
    async def analyze_pool_trends(
        self, 
        pool_address: str, 
        days: int = 30
    ) -> List[TrendAnalysis]:
        """Analyze trends for a specific pool over time period"""
        try:
            logger.info(f"Analyzing trends for pool {pool_address} over {days} days")
            
            # Get historical data
            historical_data = await self._get_historical_data(pool_address, days)
            
            if len(historical_data) < 7:  # Need at least a week of data
                logger.warning(f"Insufficient historical data for pool {pool_address}")
                return []
            
            trends = []
            
            # Analyze different metrics
            metrics_to_analyze = [
                ("tvl_usd", "TVL"),
                ("volume_24h", "Volume"),
                ("apr", "APR"),
                ("price_token0", "Token0 Price"),
                ("price_token1", "Token1 Price")
            ]
            
            for metric_attr, metric_name in metrics_to_analyze:
                trend = await self._analyze_metric_trend(
                    historical_data, metric_attr, metric_name, days
                )
                if trend:
                    trends.append(trend)
            
            # Cache results
            self.trend_cache[pool_address] = trends
            
            return trends
            
        except Exception as e:
            logger.error(f"Error analyzing pool trends: {e}")
            return []
    
    async def compare_pool_performance(
        self, 
        pool_addresses: List[str], 
        days: int = 30
    ) -> Dict[str, Any]:
        """Compare historical performance of multiple pools"""
        try:
            logger.info(f"Comparing performance of {len(pool_addresses)} pools")
            
            pool_performances = {}
            
            for pool_address in pool_addresses:
                try:
                    trends = await self.analyze_pool_trends(pool_address, days)
                    historical_data = await self._get_historical_data(pool_address, days)
                    
                    if historical_data:
                        performance = await self._calculate_performance_metrics(
                            historical_data, trends
                        )
                        pool_performances[pool_address] = performance
                        
                except Exception as e:
                    logger.warning(f"Error analyzing pool {pool_address}: {e}")
                    continue
            
            # Generate comparison insights
            comparison = await self._generate_comparison_insights(pool_performances)
            
            return {
                "pool_performances": pool_performances,
                "comparison_insights": comparison,
                "analysis_period": f"{days} days",
                "analyzed_at": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error comparing pool performance: {e}")
            return {}
    
    async def predict_pool_metrics(
        self, 
        pool_address: str, 
        days_ahead: int = 7
    ) -> Dict[str, Any]:
        """Predict future pool metrics based on historical trends"""
        try:
            logger.info(f"Predicting metrics for pool {pool_address} - {days_ahead} days ahead")
            
            # Get recent trends
            trends = await self.analyze_pool_trends(pool_address, 30)
            historical_data = await self._get_historical_data(pool_address, 30)
            
            if not trends or not historical_data:
                return {"error": "Insufficient data for prediction"}
            
            predictions = {}
            
            for trend in trends:
                prediction = await self._predict_metric(
                    trend, historical_data, days_ahead
                )
                predictions[trend.metric_name.lower().replace(" ", "_")] = prediction
            
            # Calculate prediction confidence
            overall_confidence = statistics.mean([
                pred["confidence"] for pred in predictions.values()
            ])
            
            return {
                "pool_address": pool_address,
                "predictions": predictions,
                "prediction_horizon": f"{days_ahead} days",
                "overall_confidence": overall_confidence,
                "predicted_at": datetime.utcnow(),
                "disclaimer": "Predictions are based on historical trends and should not be considered financial advice"
            }
            
        except Exception as e:
            logger.error(f"Error predicting pool metrics: {e}")
            return {"error": str(e)}
    
    async def identify_seasonal_patterns(
        self, 
        pool_address: str, 
        days: int = 90
    ) -> Dict[str, Any]:
        """Identify seasonal or cyclical patterns in pool data"""
        try:
            logger.info(f"Identifying seasonal patterns for pool {pool_address}")
            
            historical_data = await self._get_historical_data(pool_address, days)
            
            if len(historical_data) < 30:
                return {"error": "Insufficient data for seasonal analysis"}
            
            patterns = {}
            
            # Analyze weekly patterns
            weekly_patterns = await self._analyze_weekly_patterns(historical_data)
            patterns["weekly"] = weekly_patterns
            
            # Analyze monthly patterns (if enough data)
            if days >= 60:
                monthly_patterns = await self._analyze_monthly_patterns(historical_data)
                patterns["monthly"] = monthly_patterns
            
            # Identify anomalies
            anomalies = await self._identify_anomalies(historical_data)
            patterns["anomalies"] = anomalies
            
            return {
                "pool_address": pool_address,
                "patterns": patterns,
                "analysis_period": f"{days} days",
                "data_points": len(historical_data),
                "analyzed_at": datetime.utcnow()
            }
            
        except Exception as e:
            logger.error(f"Error identifying seasonal patterns: {e}")
            return {"error": str(e)}
    
    async def _get_historical_data(
        self, 
        pool_address: str, 
        days: int
    ) -> List[HistoricalDataPoint]:
        """Get historical data for a pool (mock implementation)"""
        try:
            # In a real implementation, this would query the database
            # For demo, generate mock historical data
            
            if pool_address in self.historical_data:
                return self.historical_data[pool_address][-days:]
            
            # Generate mock data
            historical_data = []
            base_date = datetime.utcnow() - timedelta(days=days)
            
            # Base values
            base_tvl = Decimal('500000')
            base_volume = Decimal('50000')
            base_price0 = Decimal('2000')  # ETH price
            base_price1 = Decimal('1')     # USDC price
            base_apr = Decimal('15')
            
            for i in range(days):
                # Add some realistic variation
                date = base_date + timedelta(days=i)
                
                # Simulate price movements
                price_variation = Decimal(str(0.95 + (i % 10) * 0.01))  # ±5% variation
                volume_variation = Decimal(str(0.8 + (i % 15) * 0.02))   # ±20% variation
                tvl_variation = Decimal(str(0.9 + (i % 20) * 0.01))      # ±10% variation
                
                data_point = HistoricalDataPoint(
                    timestamp=date,
                    tvl_usd=base_tvl * tvl_variation,
                    volume_24h=base_volume * volume_variation,
                    price_token0=base_price0 * price_variation,
                    price_token1=base_price1,
                    apr=base_apr + Decimal(str((i % 10) - 5)),  # ±5% APR variation
                    fees_earned=base_volume * volume_variation * Decimal('0.003'),
                    liquidity_providers=100 + (i % 20)
                )
                
                historical_data.append(data_point)
            
            # Cache the data
            self.historical_data[pool_address] = historical_data
            
            return historical_data
            
        except Exception as e:
            logger.error(f"Error getting historical data: {e}")
            return []
    
    async def _analyze_metric_trend(
        self, 
        historical_data: List[HistoricalDataPoint], 
        metric_attr: str, 
        metric_name: str, 
        days: int
    ) -> Optional[TrendAnalysis]:
        """Analyze trend for a specific metric"""
        try:
            # Extract metric values
            values = [getattr(point, metric_attr) for point in historical_data]
            
            if len(values) < 2:
                return None
            
            # Calculate trend direction and strength
            first_half = values[:len(values)//2]
            second_half = values[len(values)//2:]
            
            first_avg = statistics.mean(first_half)
            second_avg = statistics.mean(second_half)
            
            # Determine trend direction
            change_percentage = ((second_avg - first_avg) / first_avg) * 100
            
            if change_percentage > 5:
                trend_direction = "UP"
            elif change_percentage < -5:
                trend_direction = "DOWN"
            else:
                trend_direction = "STABLE"
            
            # Calculate trend strength (0-10)
            trend_strength = min(abs(change_percentage) / 2, Decimal('10'))
            
            # Calculate volatility
            volatility = Decimal(str(statistics.stdev([float(v) for v in values])))
            
            # Prediction confidence based on trend consistency
            prediction_confidence = self._calculate_prediction_confidence(
                values, trend_direction
            )
            
            return TrendAnalysis(
                metric_name=metric_name,
                time_period=f"{days} days",
                trend_direction=trend_direction,
                trend_strength=trend_strength,
                percentage_change=Decimal(str(change_percentage)),
                volatility=volatility,
                prediction_confidence=prediction_confidence
            )
            
        except Exception as e:
            logger.error(f"Error analyzing metric trend: {e}")
            return None
    
    async def _calculate_performance_metrics(
        self, 
        historical_data: List[HistoricalDataPoint], 
        trends: List[TrendAnalysis]
    ) -> Dict[str, Any]:
        """Calculate comprehensive performance metrics"""
        try:
            if not historical_data:
                return {}
            
            # Basic statistics
            tvl_values = [point.tvl_usd for point in historical_data]
            volume_values = [point.volume_24h for point in historical_data]
            apr_values = [point.apr for point in historical_data]
            
            performance = {
                "tvl_stats": {
                    "min": min(tvl_values),
                    "max": max(tvl_values),
                    "avg": statistics.mean(tvl_values),
                    "current": tvl_values[-1],
                    "change": ((tvl_values[-1] - tvl_values[0]) / tvl_values[0]) * 100
                },
                "volume_stats": {
                    "min": min(volume_values),
                    "max": max(volume_values),
                    "avg": statistics.mean(volume_values),
                    "total": sum(volume_values),
                    "current": volume_values[-1]
                },
                "apr_stats": {
                    "min": min(apr_values),
                    "max": max(apr_values),
                    "avg": statistics.mean(apr_values),
                    "current": apr_values[-1]
                },
                "trends_summary": {
                    "positive_trends": len([t for t in trends if t.trend_direction == "UP"]),
                    "negative_trends": len([t for t in trends if t.trend_direction == "DOWN"]),
                    "stable_trends": len([t for t in trends if t.trend_direction == "STABLE"])
                }
            }
            
            return performance
            
        except Exception as e:
            logger.error(f"Error calculating performance metrics: {e}")
            return {}
    
    async def _generate_comparison_insights(
        self, 
        pool_performances: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Generate insights from pool performance comparison"""
        try:
            if not pool_performances:
                return {}
            
            insights = {
                "best_tvl_growth": None,
                "highest_volume": None,
                "most_stable_apr": None,
                "overall_winner": None
            }
            
            # Find best performers
            best_tvl_change = -float('inf')
            highest_avg_volume = 0
            most_stable_apr = float('inf')
            
            for pool_addr, performance in pool_performances.items():
                # TVL growth
                tvl_change = performance.get("tvl_stats", {}).get("change", 0)
                if tvl_change > best_tvl_change:
                    best_tvl_change = tvl_change
                    insights["best_tvl_growth"] = {
                        "pool": pool_addr,
                        "change": tvl_change
                    }
                
                # Volume
                avg_volume = performance.get("volume_stats", {}).get("avg", 0)
                if avg_volume > highest_avg_volume:
                    highest_avg_volume = avg_volume
                    insights["highest_volume"] = {
                        "pool": pool_addr,
                        "avg_volume": avg_volume
                    }
                
                # APR stability (lower volatility = more stable)
                apr_stats = performance.get("apr_stats", {})
                apr_volatility = abs(apr_stats.get("max", 0) - apr_stats.get("min", 0))
                if apr_volatility < most_stable_apr:
                    most_stable_apr = apr_volatility
                    insights["most_stable_apr"] = {
                        "pool": pool_addr,
                        "volatility": apr_volatility,
                        "avg_apr": apr_stats.get("avg", 0)
                    }
            
            return insights
            
        except Exception as e:
            logger.error(f"Error generating comparison insights: {e}")
            return {}
    
    async def _predict_metric(
        self, 
        trend: TrendAnalysis, 
        historical_data: List[HistoricalDataPoint], 
        days_ahead: int
    ) -> Dict[str, Any]:
        """Predict future value of a metric based on trend"""
        try:
            # Simple linear prediction based on trend
            current_value = getattr(historical_data[-1], trend.metric_name.lower().replace(" ", "_"))
            
            # Calculate daily change rate
            daily_change_rate = trend.percentage_change / len(historical_data)
            
            # Project forward
            predicted_change = daily_change_rate * days_ahead
            predicted_value = current_value * (1 + predicted_change / 100)
            
            # Adjust confidence based on trend strength and volatility
            confidence = trend.prediction_confidence
            if trend.volatility > current_value * Decimal('0.2'):  # High volatility
                confidence *= Decimal('0.7')
            
            return {
                "current_value": current_value,
                "predicted_value": predicted_value,
                "predicted_change": predicted_change,
                "confidence": confidence,
                "trend_direction": trend.trend_direction
            }
            
        except Exception as e:
            logger.error(f"Error predicting metric: {e}")
            return {
                "error": str(e),
                "confidence": Decimal('0')
            }
    
    def _calculate_prediction_confidence(
        self, 
        values: List[Decimal], 
        trend_direction: str
    ) -> Decimal:
        """Calculate confidence in trend prediction"""
        try:
            if len(values) < 5:
                return Decimal('30')  # Low confidence with little data
            
            # Check trend consistency
            increases = 0
            decreases = 0
            
            for i in range(1, len(values)):
                if values[i] > values[i-1]:
                    increases += 1
                elif values[i] < values[i-1]:
                    decreases += 1
            
            total_changes = increases + decreases
            if total_changes == 0:
                return Decimal('50')  # Neutral confidence for no changes
            
            # Calculate consistency
            if trend_direction == "UP":
                consistency = increases / total_changes
            elif trend_direction == "DOWN":
                consistency = decreases / total_changes
            else:  # STABLE
                consistency = 1 - abs(increases - decreases) / total_changes
            
            # Convert to confidence percentage
            confidence = Decimal(str(consistency * 100))
            
            return min(confidence, Decimal('95'))  # Cap at 95%
            
        except Exception as e:
            logger.error(f"Error calculating prediction confidence: {e}")
            return Decimal('50')
    
    async def _analyze_weekly_patterns(
        self, 
        historical_data: List[HistoricalDataPoint]
    ) -> Dict[str, Any]:
        """Analyze weekly patterns in the data"""
        try:
            # Group data by day of week
            weekday_data = {i: [] for i in range(7)}  # 0=Monday, 6=Sunday
            
            for point in historical_data:
                weekday = point.timestamp.weekday()
                weekday_data[weekday].append(point)
            
            # Calculate averages for each day
            weekday_averages = {}
            days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
            
            for day_num, day_name in enumerate(days):
                if weekday_data[day_num]:
                    avg_volume = statistics.mean([p.volume_24h for p in weekday_data[day_num]])
                    avg_tvl = statistics.mean([p.tvl_usd for p in weekday_data[day_num]])
                    
                    weekday_averages[day_name] = {
                        "avg_volume": avg_volume,
                        "avg_tvl": avg_tvl,
                        "data_points": len(weekday_data[day_num])
                    }
            
            # Find best and worst days
            if weekday_averages:
                best_volume_day = max(weekday_averages.keys(), 
                                    key=lambda k: weekday_averages[k]["avg_volume"])
                worst_volume_day = min(weekday_averages.keys(), 
                                     key=lambda k: weekday_averages[k]["avg_volume"])
                
                return {
                    "weekday_averages": weekday_averages,
                    "best_volume_day": best_volume_day,
                    "worst_volume_day": worst_volume_day,
                    "pattern_strength": "MODERATE"  # Simplified
                }
            
            return {"error": "Insufficient data for weekly analysis"}
            
        except Exception as e:
            logger.error(f"Error analyzing weekly patterns: {e}")
            return {"error": str(e)}
    
    async def _analyze_monthly_patterns(
        self, 
        historical_data: List[HistoricalDataPoint]
    ) -> Dict[str, Any]:
        """Analyze monthly patterns in the data"""
        try:
            # Group by month
            monthly_data = {}
            
            for point in historical_data:
                month_key = point.timestamp.strftime("%Y-%m")
                if month_key not in monthly_data:
                    monthly_data[month_key] = []
                monthly_data[month_key].append(point)
            
            # Calculate monthly averages
            monthly_averages = {}
            for month, points in monthly_data.items():
                if points:
                    monthly_averages[month] = {
                        "avg_volume": statistics.mean([p.volume_24h for p in points]),
                        "avg_tvl": statistics.mean([p.tvl_usd for p in points]),
                        "avg_apr": statistics.mean([p.apr for p in points]),
                        "data_points": len(points)
                    }
            
            return {
                "monthly_averages": monthly_averages,
                "months_analyzed": len(monthly_averages)
            }
            
        except Exception as e:
            logger.error(f"Error analyzing monthly patterns: {e}")
            return {"error": str(e)}
    
    async def _identify_anomalies(
        self, 
        historical_data: List[HistoricalDataPoint]
    ) -> List[Dict[str, Any]]:
        """Identify anomalous data points"""
        try:
            anomalies = []
            
            # Calculate thresholds for volume and TVL
            volumes = [p.volume_24h for p in historical_data]
            tvls = [p.tvl_usd for p in historical_data]
            
            if len(volumes) < 10:  # Need sufficient data
                return anomalies
            
            volume_mean = statistics.mean(volumes)
            volume_stdev = statistics.stdev(volumes)
            tvl_mean = statistics.mean(tvls)
            tvl_stdev = statistics.stdev(tvls)
            
            # Find outliers (>2 standard deviations)
            for point in historical_data:
                volume_z_score = abs((point.volume_24h - volume_mean) / volume_stdev)
                tvl_z_score = abs((point.tvl_usd - tvl_mean) / tvl_stdev)
                
                if volume_z_score > 2:
                    anomalies.append({
                        "timestamp": point.timestamp,
                        "type": "volume_anomaly",
                        "value": point.volume_24h,
                        "z_score": volume_z_score,
                        "severity": "HIGH" if volume_z_score > 3 else "MEDIUM"
                    })
                
                if tvl_z_score > 2:
                    anomalies.append({
                        "timestamp": point.timestamp,
                        "type": "tvl_anomaly",
                        "value": point.tvl_usd,
                        "z_score": tvl_z_score,
                        "severity": "HIGH" if tvl_z_score > 3 else "MEDIUM"
                    })
            
            return anomalies
            
        except Exception as e:
            logger.error(f"Error identifying anomalies: {e}")
            return []
