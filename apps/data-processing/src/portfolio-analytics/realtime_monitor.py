"""
Real-time Portfolio Monitoring System

This module provides real-time portfolio monitoring capabilities including:
- Asyncio-based real-time price monitoring
- Portfolio rebalancing suggestions
- Risk threshold monitoring and alerts
- Performance tracking and notifications
- Market condition analysis
"""

import asyncio
import aiohttp
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime, timedelta
import json
import logging
from dataclasses import dataclass
from enum import Enum

from .risk import RiskMetricsCalculator
from .analytics import PerformanceAnalytics
from .optimization import PortfolioOptimizer
from ..services.cache_service import CacheService
from ..services.alert_service import AlertService
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class AlertType(Enum):
    """Alert types for portfolio monitoring"""
    RISK_THRESHOLD = "risk_threshold"
    REBALANCE_NEEDED = "rebalance_needed"
    PERFORMANCE_ALERT = "performance_alert"
    MARKET_CONDITION = "market_condition"
    POSITION_LIMIT = "position_limit"


@dataclass
class MonitoringConfig:
    """Configuration for portfolio monitoring"""
    update_interval: int = 60  # seconds
    risk_threshold_var_95: float = -0.05  # 5% daily VaR threshold
    max_drawdown_threshold: float = -0.15  # 15% max drawdown threshold
    rebalance_threshold: float = 0.05  # 5% weight deviation threshold
    min_sharpe_ratio: float = 0.5  # Minimum acceptable Sharpe ratio
    max_position_weight: float = 0.3  # Maximum single position weight
    enable_auto_rebalance: bool = False
    enable_risk_alerts: bool = True
    enable_performance_alerts: bool = True


@dataclass
class PortfolioSnapshot:
    """Portfolio snapshot for monitoring"""
    timestamp: datetime
    portfolio_id: str
    total_value: float
    positions: Dict[str, float]  # symbol -> weight
    current_prices: Dict[str, float]  # symbol -> price
    returns: pd.Series
    risk_metrics: Dict
    performance_metrics: Dict


class RealTimePortfolioMonitor:
    """
    Real-time portfolio monitoring system with asyncio support
    """
    
    def __init__(self, 
                 config: MonitoringConfig,
                 cache_service: CacheService,
                 alert_service: AlertService):
        """
        Initialize real-time portfolio monitor
        
        Args:
            config: Monitoring configuration
            cache_service: Cache service for storing data
            alert_service: Alert service for notifications
        """
        self.config = config
        self.cache_service = cache_service
        self.alert_service = alert_service
        
        # Analytics engines
        self.risk_calculator = RiskMetricsCalculator()
        self.performance_analytics = PerformanceAnalytics()
        self.optimizer = PortfolioOptimizer()
        
        # Monitoring state
        self.monitored_portfolios: Dict[str, Dict] = {}
        self.price_feeds: Dict[str, float] = {}
        self.monitoring_tasks: Dict[str, asyncio.Task] = {}
        self.is_running = False
        
        # Session for HTTP requests
        self.session: Optional[aiohttp.ClientSession] = None
    
    async def start_monitoring(self, portfolio_ids: List[str]):
        """
        Start monitoring specified portfolios
        
        Args:
            portfolio_ids: List of portfolio IDs to monitor
        """
        logger.info(f"Starting real-time monitoring for {len(portfolio_ids)} portfolios")
        
        self.is_running = True
        self.session = aiohttp.ClientSession()
        
        # Start monitoring tasks for each portfolio
        for portfolio_id in portfolio_ids:
            task = asyncio.create_task(self._monitor_portfolio(portfolio_id))
            self.monitoring_tasks[portfolio_id] = task
        
        # Start price feed task
        price_task = asyncio.create_task(self._update_price_feeds())
        self.monitoring_tasks['price_feeds'] = price_task
        
        logger.info("Real-time monitoring started successfully")
    
    async def stop_monitoring(self):
        """Stop all monitoring tasks"""
        logger.info("Stopping real-time monitoring")
        
        self.is_running = False
        
        # Cancel all tasks
        for task in self.monitoring_tasks.values():
            task.cancel()
        
        # Wait for tasks to complete
        await asyncio.gather(*self.monitoring_tasks.values(), return_exceptions=True)
        
        # Close HTTP session
        if self.session:
            await self.session.close()
        
        self.monitoring_tasks.clear()
        logger.info("Real-time monitoring stopped")
    
    async def _monitor_portfolio(self, portfolio_id: str):
        """
        Monitor a single portfolio in real-time
        
        Args:
            portfolio_id: Portfolio ID to monitor
        """
        logger.info(f"Starting monitoring for portfolio {portfolio_id}")
        
        while self.is_running:
            try:
                # Get current portfolio snapshot
                snapshot = await self._get_portfolio_snapshot(portfolio_id)
                
                if snapshot:
                    # Store snapshot in cache
                    await self._store_snapshot(snapshot)
                    
                    # Check risk thresholds
                    if self.config.enable_risk_alerts:
                        await self._check_risk_thresholds(snapshot)
                    
                    # Check performance alerts
                    if self.config.enable_performance_alerts:
                        await self._check_performance_alerts(snapshot)
                    
                    # Check rebalancing needs
                    await self._check_rebalancing_needs(snapshot)
                    
                    # Check position limits
                    await self._check_position_limits(snapshot)
                
                # Wait for next update
                await asyncio.sleep(self.config.update_interval)
                
            except asyncio.CancelledError:
                logger.info(f"Monitoring cancelled for portfolio {portfolio_id}")
                break
            except Exception as e:
                logger.error(f"Error monitoring portfolio {portfolio_id}: {str(e)}")
                await asyncio.sleep(self.config.update_interval)
    
    async def _update_price_feeds(self):
        """Update real-time price feeds for all monitored assets"""
        while self.is_running:
            try:
                # Get all unique symbols from monitored portfolios
                symbols = set()
                for portfolio_data in self.monitored_portfolios.values():
                    symbols.update(portfolio_data.get('symbols', []))
                
                if symbols:
                    # Fetch current prices
                    prices = await self._fetch_current_prices(list(symbols))
                    self.price_feeds.update(prices)
                    
                    # Cache prices
                    await self._cache_prices(prices)
                
                # Update every 30 seconds for price feeds
                await asyncio.sleep(30)
                
            except asyncio.CancelledError:
                logger.info("Price feed monitoring cancelled")
                break
            except Exception as e:
                logger.error(f"Error updating price feeds: {str(e)}")
                await asyncio.sleep(30)
    
    async def _get_portfolio_snapshot(self, portfolio_id: str) -> Optional[PortfolioSnapshot]:
        """
        Get current portfolio snapshot with real-time data
        
        Args:
            portfolio_id: Portfolio ID
            
        Returns:
            Portfolio snapshot or None if error
        """
        try:
            # Get portfolio data from cache/database
            portfolio_data = await self._fetch_portfolio_data(portfolio_id)
            
            if not portfolio_data:
                return None
            
            # Get current prices
            symbols = list(portfolio_data['positions'].keys())
            current_prices = {symbol: self.price_feeds.get(symbol, 0) for symbol in symbols}
            
            # Calculate current portfolio value and weights
            total_value = sum(
                portfolio_data['positions'][symbol] * current_prices[symbol] 
                for symbol in symbols
            )
            
            current_weights = {
                symbol: (portfolio_data['positions'][symbol] * current_prices[symbol]) / total_value
                for symbol in symbols
            } if total_value > 0 else {}
            
            # Get historical returns for risk/performance calculations
            returns = await self._get_portfolio_returns(portfolio_id)
            
            # Calculate risk metrics
            risk_metrics = {}
            if len(returns) > 30:
                risk_metrics = self.risk_calculator.calculate_comprehensive_risk_metrics(returns)
            
            # Calculate performance metrics
            performance_metrics = {}
            if len(returns) > 30:
                performance_metrics = self.performance_analytics.calculate_comprehensive_performance_metrics(returns)
            
            return PortfolioSnapshot(
                timestamp=datetime.utcnow(),
                portfolio_id=portfolio_id,
                total_value=total_value,
                positions=current_weights,
                current_prices=current_prices,
                returns=returns,
                risk_metrics=risk_metrics,
                performance_metrics=performance_metrics
            )
            
        except Exception as e:
            logger.error(f"Error getting portfolio snapshot for {portfolio_id}: {str(e)}")
            return None

    async def _check_risk_thresholds(self, snapshot: PortfolioSnapshot):
        """Check if portfolio exceeds risk thresholds"""
        risk_metrics = snapshot.risk_metrics

        # Check VaR threshold
        var_95 = risk_metrics.get('var_historical_95', 0)
        if var_95 < self.config.risk_threshold_var_95:
            await self._send_alert(
                AlertType.RISK_THRESHOLD,
                snapshot.portfolio_id,
                f"Portfolio VaR (95%) exceeded threshold: {var_95:.2%} < {self.config.risk_threshold_var_95:.2%}",
                {'var_95': var_95, 'threshold': self.config.risk_threshold_var_95}
            )

        # Check max drawdown threshold
        max_drawdown = risk_metrics.get('max_drawdown', 0)
        if max_drawdown < self.config.max_drawdown_threshold:
            await self._send_alert(
                AlertType.RISK_THRESHOLD,
                snapshot.portfolio_id,
                f"Portfolio max drawdown exceeded threshold: {max_drawdown:.2%} < {self.config.max_drawdown_threshold:.2%}",
                {'max_drawdown': max_drawdown, 'threshold': self.config.max_drawdown_threshold}
            )

    async def _check_performance_alerts(self, snapshot: PortfolioSnapshot):
        """Check performance-related alerts"""
        performance_metrics = snapshot.performance_metrics

        # Check Sharpe ratio
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)
        if sharpe_ratio < self.config.min_sharpe_ratio:
            await self._send_alert(
                AlertType.PERFORMANCE_ALERT,
                snapshot.portfolio_id,
                f"Portfolio Sharpe ratio below threshold: {sharpe_ratio:.2f} < {self.config.min_sharpe_ratio:.2f}",
                {'sharpe_ratio': sharpe_ratio, 'threshold': self.config.min_sharpe_ratio}
            )

    async def _check_rebalancing_needs(self, snapshot: PortfolioSnapshot):
        """Check if portfolio needs rebalancing"""
        # Get target weights from cache or database
        target_weights = await self._get_target_weights(snapshot.portfolio_id)

        if not target_weights:
            return

        current_weights = snapshot.positions
        rebalance_needed = False
        weight_deviations = {}

        # Check weight deviations
        for symbol in target_weights:
            target_weight = target_weights[symbol]
            current_weight = current_weights.get(symbol, 0)
            deviation = abs(current_weight - target_weight)

            weight_deviations[symbol] = {
                'target': target_weight,
                'current': current_weight,
                'deviation': deviation
            }

            if deviation > self.config.rebalance_threshold:
                rebalance_needed = True

        if rebalance_needed:
            # Generate rebalancing suggestions
            suggestions = await self._generate_rebalancing_suggestions(snapshot, target_weights)

            await self._send_alert(
                AlertType.REBALANCE_NEEDED,
                snapshot.portfolio_id,
                f"Portfolio rebalancing needed - weight deviations exceed {self.config.rebalance_threshold:.1%}",
                {
                    'weight_deviations': weight_deviations,
                    'rebalancing_suggestions': suggestions
                }
            )

    async def _check_position_limits(self, snapshot: PortfolioSnapshot):
        """Check if any position exceeds maximum weight limit"""
        for symbol, weight in snapshot.positions.items():
            if weight > self.config.max_position_weight:
                await self._send_alert(
                    AlertType.POSITION_LIMIT,
                    snapshot.portfolio_id,
                    f"Position {symbol} exceeds maximum weight: {weight:.2%} > {self.config.max_position_weight:.2%}",
                    {'symbol': symbol, 'weight': weight, 'limit': self.config.max_position_weight}
                )

    async def _generate_rebalancing_suggestions(self, snapshot: PortfolioSnapshot, target_weights: Dict[str, float]) -> Dict:
        """Generate specific rebalancing suggestions"""
        current_weights = snapshot.positions
        total_value = snapshot.total_value

        suggestions = {
            'trades': [],
            'total_trade_value': 0
        }

        for symbol in target_weights:
            target_weight = target_weights[symbol]
            current_weight = current_weights.get(symbol, 0)

            target_value = total_value * target_weight
            current_value = total_value * current_weight
            trade_value = target_value - current_value

            if abs(trade_value) > total_value * 0.01:  # Only suggest trades > 1% of portfolio
                suggestions['trades'].append({
                    'symbol': symbol,
                    'action': 'buy' if trade_value > 0 else 'sell',
                    'value': abs(trade_value),
                    'current_weight': current_weight,
                    'target_weight': target_weight
                })

                suggestions['total_trade_value'] += abs(trade_value)

        return suggestions

    async def _send_alert(self, alert_type: AlertType, portfolio_id: str, message: str, data: Dict):
        """Send alert through alert service"""
        try:
            alert_data = {
                'type': alert_type.value,
                'portfolio_id': portfolio_id,
                'message': message,
                'timestamp': datetime.utcnow().isoformat(),
                'data': data
            }

            # Send through alert service
            self.alert_service.send_alert(
                message,
                tags=[alert_type.value, 'portfolio', portfolio_id]
            )

            # Cache alert for dashboard
            cache_key = f"portfolio_alert:{portfolio_id}:{alert_type.value}"
            await self._cache_data(cache_key, alert_data, ttl=3600)  # 1 hour TTL

            logger.info(f"Alert sent for portfolio {portfolio_id}: {message}")

        except Exception as e:
            logger.error(f"Error sending alert: {str(e)}")

    # Helper methods for data access
    async def _fetch_portfolio_data(self, portfolio_id: str) -> Optional[Dict]:
        """Fetch portfolio data from cache or database"""
        # Implementation would fetch from database service
        # For now, return cached data
        cache_key = f"portfolio_data:{portfolio_id}"
        return await self._get_cached_data(cache_key)

    async def _fetch_current_prices(self, symbols: List[str]) -> Dict[str, float]:
        """Fetch current prices for symbols"""
        prices = {}

        # This would integrate with real price feeds (WebSocket, REST API, etc.)
        # For now, simulate with cached prices
        for symbol in symbols:
            cache_key = f"price:{symbol}"
            cached_price = await self._get_cached_data(cache_key)
            if cached_price:
                prices[symbol] = cached_price

        return prices

    async def _get_portfolio_returns(self, portfolio_id: str) -> pd.Series:
        """Get historical portfolio returns"""
        cache_key = f"portfolio_returns:{portfolio_id}"
        cached_returns = await self._get_cached_data(cache_key)

        if cached_returns:
            return pd.Series(cached_returns)
        else:
            # Return empty series if no data
            return pd.Series(dtype=float)

    async def _get_target_weights(self, portfolio_id: str) -> Optional[Dict[str, float]]:
        """Get target weights for portfolio"""
        cache_key = f"target_weights:{portfolio_id}"
        return await self._get_cached_data(cache_key)

    async def _store_snapshot(self, snapshot: PortfolioSnapshot):
        """Store portfolio snapshot in cache"""
        cache_key = f"portfolio_snapshot:{snapshot.portfolio_id}"
        snapshot_data = {
            'timestamp': snapshot.timestamp.isoformat(),
            'portfolio_id': snapshot.portfolio_id,
            'total_value': snapshot.total_value,
            'positions': snapshot.positions,
            'current_prices': snapshot.current_prices,
            'risk_metrics': snapshot.risk_metrics,
            'performance_metrics': snapshot.performance_metrics
        }

        await self._cache_data(cache_key, snapshot_data, ttl=300)  # 5 minutes TTL

    async def _cache_prices(self, prices: Dict[str, float]):
        """Cache current prices"""
        for symbol, price in prices.items():
            cache_key = f"price:{symbol}"
            await self._cache_data(cache_key, price, ttl=60)  # 1 minute TTL

    async def _cache_data(self, key: str, data: Any, ttl: int = 300):
        """Cache data with TTL"""
        try:
            self.cache_service.set(key, data, ttl)
        except Exception as e:
            logger.error(f"Error caching data for key {key}: {str(e)}")

    async def _get_cached_data(self, key: str) -> Any:
        """Get cached data"""
        try:
            return self.cache_service.get(key)
        except Exception as e:
            logger.error(f"Error getting cached data for key {key}: {str(e)}")
            return None

    # Public methods for external access
    async def get_portfolio_status(self, portfolio_id: str) -> Optional[Dict]:
        """Get current portfolio status"""
        cache_key = f"portfolio_snapshot:{portfolio_id}"
        return await self._get_cached_data(cache_key)

    async def get_recent_alerts(self, portfolio_id: str, alert_type: Optional[AlertType] = None) -> List[Dict]:
        """Get recent alerts for portfolio"""
        alerts = []

        if alert_type:
            cache_key = f"portfolio_alert:{portfolio_id}:{alert_type.value}"
            alert = await self._get_cached_data(cache_key)
            if alert:
                alerts.append(alert)
        else:
            # Get all alert types
            for alert_type_enum in AlertType:
                cache_key = f"portfolio_alert:{portfolio_id}:{alert_type_enum.value}"
                alert = await self._get_cached_data(cache_key)
                if alert:
                    alerts.append(alert)

        return alerts

    def add_portfolio_to_monitoring(self, portfolio_id: str, portfolio_data: Dict):
        """Add portfolio to monitoring list"""
        self.monitored_portfolios[portfolio_id] = portfolio_data

        if self.is_running:
            # Start monitoring task for new portfolio
            task = asyncio.create_task(self._monitor_portfolio(portfolio_id))
            self.monitoring_tasks[portfolio_id] = task

    def remove_portfolio_from_monitoring(self, portfolio_id: str):
        """Remove portfolio from monitoring"""
        if portfolio_id in self.monitored_portfolios:
            del self.monitored_portfolios[portfolio_id]

        if portfolio_id in self.monitoring_tasks:
            self.monitoring_tasks[portfolio_id].cancel()
            del self.monitoring_tasks[portfolio_id]


class RebalancingEngine:
    """
    Automated portfolio rebalancing engine
    """

    def __init__(self, optimizer: PortfolioOptimizer):
        self.optimizer = optimizer

    async def execute_rebalancing(self,
                                portfolio_id: str,
                                current_weights: Dict[str, float],
                                target_weights: Dict[str, float],
                                total_value: float,
                                execution_method: str = 'gradual') -> Dict:
        """
        Execute portfolio rebalancing

        Args:
            portfolio_id: Portfolio ID
            current_weights: Current portfolio weights
            target_weights: Target portfolio weights
            total_value: Total portfolio value
            execution_method: Execution method ('immediate', 'gradual', 'threshold')

        Returns:
            Rebalancing execution plan
        """
        trades = []

        for symbol in target_weights:
            current_weight = current_weights.get(symbol, 0)
            target_weight = target_weights[symbol]

            weight_diff = target_weight - current_weight
            trade_value = total_value * weight_diff

            if abs(trade_value) > total_value * 0.005:  # Minimum 0.5% trade
                trades.append({
                    'symbol': symbol,
                    'action': 'buy' if trade_value > 0 else 'sell',
                    'value': abs(trade_value),
                    'weight_change': weight_diff
                })

        execution_plan = {
            'portfolio_id': portfolio_id,
            'trades': trades,
            'execution_method': execution_method,
            'total_trade_value': sum(trade['value'] for trade in trades),
            'estimated_cost': self._estimate_transaction_costs(trades),
            'timestamp': datetime.utcnow().isoformat()
        }

        return execution_plan

    def _estimate_transaction_costs(self, trades: List[Dict]) -> float:
        """Estimate transaction costs for trades"""
        # Simple cost estimation - 0.1% per trade
        total_cost = 0
        for trade in trades:
            total_cost += trade['value'] * 0.001  # 0.1% transaction cost

        return total_cost
