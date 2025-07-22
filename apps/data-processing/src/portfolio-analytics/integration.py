"""
Portfolio Analytics Integration Module

This module integrates the portfolio analytics engine with the existing
portfolio processing system, providing seamless data flow and enhanced
analytics capabilities.
"""

import asyncio
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import logging

from .engine import PortfolioAnalyticsEngine
from .realtime_monitor import MonitoringConfig
from .backtesting import BacktestConfig
from .reporting import ReportConfig
from ..processors.portfolio_processor import PortfolioProcessor
from ..services.database_service import DatabaseService
from ..services.cache_service import CacheService
from ..services.alert_service import AlertService
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class EnhancedPortfolioProcessor(PortfolioProcessor):
    """
    Enhanced portfolio processor with integrated analytics capabilities
    """
    
    def __init__(self, database_service: DatabaseService, cache_service: CacheService, alert_service: AlertService):
        """
        Initialize enhanced portfolio processor
        
        Args:
            database_service: Database service instance
            cache_service: Cache service instance
            alert_service: Alert service instance
        """
        super().__init__(database_service, cache_service, alert_service)
        
        # Initialize analytics engine
        self.analytics_engine = PortfolioAnalyticsEngine(
            cache_service, alert_service
        )
        
        # Analytics configuration
        self.enable_real_time_analytics = True
        self.enable_automated_reports = True
        self.analytics_update_interval = 3600  # 1 hour
        
        logger.info("Enhanced portfolio processor initialized with analytics engine")
    
    async def process_portfolios_with_analytics(self, user_id: str = None) -> Dict[str, Any]:
        """
        Process portfolios with comprehensive analytics
        
        Args:
            user_id: Optional user ID to filter portfolios
            
        Returns:
            Processing results with analytics
        """
        logger.info(f"Starting enhanced portfolio processing for user: {user_id or 'all users'}")
        
        try:
            # Run standard portfolio processing
            processing_results = await self.process_portfolios(user_id)
            
            # Get processed portfolios
            portfolios = await self._get_portfolios_for_analytics(user_id)
            
            analytics_results = {}
            
            # Run analytics for each portfolio
            for portfolio in portfolios:
                try:
                    portfolio_id = str(portfolio.id)
                    logger.info(f"Running analytics for portfolio {portfolio_id}")
                    
                    # Get portfolio data
                    portfolio_data = await self._prepare_portfolio_data_for_analytics(portfolio)
                    
                    if portfolio_data:
                        # Run comprehensive analysis
                        analysis_result = await self.analytics_engine.analyze_portfolio_comprehensive(
                            portfolio_id=portfolio_id,
                            returns=portfolio_data['returns'],
                            weights=portfolio_data['weights'],
                            asset_returns=portfolio_data.get('asset_returns'),
                            benchmark_returns=portfolio_data.get('benchmark_returns'),
                            asset_metadata=portfolio_data.get('asset_metadata')
                        )
                        
                        analytics_results[portfolio_id] = analysis_result
                        
                        # Generate automated report if enabled
                        if self.enable_automated_reports:
                            await self._generate_automated_report(portfolio_id, analysis_result)
                        
                        # Check for alerts
                        await self._process_analytics_alerts(portfolio_id, analysis_result)
                    
                except Exception as e:
                    logger.error(f"Error processing analytics for portfolio {portfolio.id}: {str(e)}")
                    continue
            
            # Combine results
            combined_results = {
                'processing_results': processing_results,
                'analytics_results': analytics_results,
                'portfolios_analyzed': len(analytics_results),
                'timestamp': datetime.utcnow().isoformat()
            }
            
            logger.info(f"Enhanced portfolio processing completed. Analyzed {len(analytics_results)} portfolios")
            return combined_results
            
        except Exception as e:
            logger.error(f"Error in enhanced portfolio processing: {str(e)}")
            return {
                'error': str(e),
                'processing_results': {},
                'analytics_results': {},
                'timestamp': datetime.utcnow().isoformat()
            }
    
    async def start_real_time_monitoring(self, portfolio_ids: List[str] = None):
        """
        Start real-time monitoring for portfolios
        
        Args:
            portfolio_ids: List of portfolio IDs to monitor (None for all)
        """
        if portfolio_ids is None:
            # Get all active portfolio IDs
            portfolio_ids = await self._get_all_active_portfolio_ids()
        
        if not portfolio_ids:
            logger.warning("No portfolios found for real-time monitoring")
            return
        
        # Configure monitoring
        monitoring_config = MonitoringConfig(
            update_interval=60,  # 1 minute
            risk_threshold_var_95=-0.05,  # 5% daily VaR threshold
            max_drawdown_threshold=-0.15,  # 15% max drawdown threshold
            rebalance_threshold=0.05,  # 5% weight deviation threshold
            enable_auto_rebalance=False,
            enable_risk_alerts=True,
            enable_performance_alerts=True
        )
        
        # Start monitoring
        await self.analytics_engine.start_real_time_monitoring(portfolio_ids, monitoring_config)
        logger.info(f"Started real-time monitoring for {len(portfolio_ids)} portfolios")
    
    async def stop_real_time_monitoring(self):
        """Stop real-time monitoring"""
        await self.analytics_engine.stop_real_time_monitoring()
        logger.info("Stopped real-time monitoring")
    
    async def run_portfolio_optimization(self, portfolio_id: str, optimization_method: str = 'max_sharpe') -> Dict:
        """
        Run portfolio optimization for a specific portfolio
        
        Args:
            portfolio_id: Portfolio ID
            optimization_method: Optimization method
            
        Returns:
            Optimization results
        """
        try:
            # Get portfolio data
            portfolio_data = await self._get_portfolio_for_optimization(portfolio_id)
            
            if not portfolio_data:
                return {'error': 'Portfolio data not found'}
            
            # Run optimization
            result = await self.analytics_engine.optimize_portfolio(
                expected_returns=portfolio_data['expected_returns'],
                covariance_matrix=portfolio_data['covariance_matrix'],
                optimization_method=optimization_method
            )
            
            # Store optimization results
            await self._store_optimization_results(portfolio_id, result)
            
            return result
            
        except Exception as e:
            logger.error(f"Error in portfolio optimization for {portfolio_id}: {str(e)}")
            return {'error': str(e)}
    
    async def run_portfolio_backtest(self, 
                                   portfolio_id: str,
                                   strategy_name: str,
                                   start_date: str,
                                   end_date: str) -> Dict:
        """
        Run portfolio strategy backtest
        
        Args:
            portfolio_id: Portfolio ID
            strategy_name: Strategy name
            start_date: Backtest start date
            end_date: Backtest end date
            
        Returns:
            Backtest results
        """
        try:
            # Get historical data for backtesting
            historical_data = await self._get_historical_data_for_backtest(
                portfolio_id, start_date, end_date
            )
            
            if not historical_data:
                return {'error': 'Historical data not available'}
            
            # Define strategy function based on strategy name
            strategy_func = self._get_strategy_function(strategy_name)
            
            # Configure backtest
            config = BacktestConfig(
                start_date=start_date,
                end_date=end_date,
                initial_capital=100000,
                rebalance_frequency='monthly',
                transaction_cost=0.001
            )
            
            # Run backtest
            result = await self.analytics_engine.run_backtest(
                strategy_func=strategy_func,
                asset_returns=historical_data['asset_returns'],
                config=config,
                strategy_name=strategy_name,
                benchmark_returns=historical_data.get('benchmark_returns')
            )
            
            # Store backtest results
            await self._store_backtest_results(portfolio_id, strategy_name, result)
            
            return {
                'success': True,
                'strategy_name': result.strategy_name,
                'final_value': result.portfolio_values.iloc[-1] if len(result.portfolio_values) > 0 else 0,
                'total_return': result.performance_metrics.get('total_return', 0),
                'sharpe_ratio': result.performance_metrics.get('sharpe_ratio', 0),
                'max_drawdown': result.risk_metrics.get('max_drawdown', 0)
            }
            
        except Exception as e:
            logger.error(f"Error in portfolio backtest for {portfolio_id}: {str(e)}")
            return {'error': str(e)}
    
    async def generate_portfolio_report(self, 
                                      portfolio_id: str,
                                      report_type: str = 'comprehensive') -> Dict:
        """
        Generate comprehensive portfolio report
        
        Args:
            portfolio_id: Portfolio ID
            report_type: Type of report
            
        Returns:
            Generated report
        """
        try:
            report = await self.analytics_engine.generate_portfolio_report(
                portfolio_id, report_type
            )
            
            # Store report
            await self._store_portfolio_report(portfolio_id, report)
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating portfolio report for {portfolio_id}: {str(e)}")
            return {'error': str(e)}
    
    # Private helper methods
    async def _get_portfolios_for_analytics(self, user_id: str = None) -> List:
        """Get portfolios for analytics processing"""
        try:
            async with self.database_service.get_session() as session:
                from ..models.portfolio_models import Portfolio
                
                query = session.query(Portfolio).filter(Portfolio.is_active == True)
                if user_id:
                    query = query.filter(Portfolio.user_id == user_id)
                
                portfolios = query.all()
                return portfolios
                
        except Exception as e:
            logger.error(f"Error getting portfolios for analytics: {str(e)}")
            return []
    
    async def _prepare_portfolio_data_for_analytics(self, portfolio) -> Optional[Dict]:
        """Prepare portfolio data for analytics"""
        try:
            # Get portfolio returns
            returns = await self._get_portfolio_returns(portfolio.id)
            
            # Get current weights
            weights = await self._get_portfolio_weights(portfolio.id)
            
            # Get asset returns if available
            asset_returns = await self._get_asset_returns(portfolio.id)
            
            # Get benchmark returns if available
            benchmark_returns = await self._get_benchmark_returns()
            
            if returns.empty or weights.empty:
                return None
            
            return {
                'returns': returns,
                'weights': weights,
                'asset_returns': asset_returns,
                'benchmark_returns': benchmark_returns,
                'asset_metadata': None  # Could be enhanced with sector/geography data
            }
            
        except Exception as e:
            logger.error(f"Error preparing portfolio data: {str(e)}")
            return None
    
    async def _get_portfolio_returns(self, portfolio_id: int) -> pd.Series:
        """Get portfolio returns from database"""
        # Implementation would query historical portfolio values and calculate returns
        # For now, return empty series
        return pd.Series(dtype=float)
    
    async def _get_portfolio_weights(self, portfolio_id: int) -> pd.Series:
        """Get current portfolio weights"""
        # Implementation would query current positions and calculate weights
        # For now, return empty series
        return pd.Series(dtype=float)
    
    async def _get_asset_returns(self, portfolio_id: int) -> Optional[pd.DataFrame]:
        """Get individual asset returns"""
        # Implementation would query historical asset prices and calculate returns
        return None
    
    async def _get_benchmark_returns(self) -> Optional[pd.Series]:
        """Get benchmark returns (e.g., S&P 500)"""
        # Implementation would query benchmark data
        return None
    
    async def _generate_automated_report(self, portfolio_id: str, analysis_result: Dict):
        """Generate automated report"""
        try:
            report = await self.analytics_engine.generate_portfolio_report(portfolio_id)
            
            # Store report in cache for dashboard access
            cache_key = f"portfolio_report:{portfolio_id}"
            self.cache_service.set(cache_key, report, ttl=86400)  # 24 hours
            
            logger.info(f"Generated automated report for portfolio {portfolio_id}")
            
        except Exception as e:
            logger.error(f"Error generating automated report: {str(e)}")
    
    async def _process_analytics_alerts(self, portfolio_id: str, analysis_result: Dict):
        """Process analytics alerts"""
        alerts = analysis_result.get('risk_alerts', [])
        
        for alert in alerts:
            # Send alert through existing alert service
            self.alert_service.send_alert(
                alert.get('message', 'Portfolio alert'),
                tags=['analytics', 'portfolio', portfolio_id, alert.get('type', 'unknown')]
            )
    
    async def _get_all_active_portfolio_ids(self) -> List[str]:
        """Get all active portfolio IDs"""
        try:
            portfolios = await self._get_portfolios_for_analytics()
            return [str(p.id) for p in portfolios]
        except Exception as e:
            logger.error(f"Error getting active portfolio IDs: {str(e)}")
            return []
    
    def _get_strategy_function(self, strategy_name: str):
        """Get strategy function by name"""
        from .backtesting import equal_weight_strategy, momentum_strategy, mean_reversion_strategy
        
        strategies = {
            'equal_weight': equal_weight_strategy,
            'momentum': momentum_strategy,
            'mean_reversion': mean_reversion_strategy
        }
        
        return strategies.get(strategy_name, equal_weight_strategy)
    
    async def _store_optimization_results(self, portfolio_id: str, results: Dict):
        """Store optimization results"""
        cache_key = f"optimization_results:{portfolio_id}"
        self.cache_service.set(cache_key, results, ttl=86400)
    
    async def _store_backtest_results(self, portfolio_id: str, strategy_name: str, results):
        """Store backtest results"""
        cache_key = f"backtest_results:{portfolio_id}:{strategy_name}"
        result_summary = {
            'strategy_name': results.strategy_name,
            'performance_metrics': results.performance_metrics,
            'risk_metrics': results.risk_metrics,
            'timestamp': datetime.utcnow().isoformat()
        }
        self.cache_service.set(cache_key, result_summary, ttl=86400)
    
    async def _store_portfolio_report(self, portfolio_id: str, report: Dict):
        """Store portfolio report"""
        cache_key = f"portfolio_report:{portfolio_id}"
        self.cache_service.set(cache_key, report, ttl=86400)
