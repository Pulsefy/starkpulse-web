"""
Comprehensive Portfolio Analytics Engine

This module integrates all portfolio analytics capabilities into a unified engine:
- Risk metrics and VaR calculations
- Performance analytics and benchmarking
- Portfolio optimization
- Real-time monitoring
- Stress testing and scenario analysis
- Diversification analysis
- Backtesting framework
- Automated reporting and alerts
"""

import asyncio
import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Union, Any
from datetime import datetime, timedelta
import json
import logging

from .risk import RiskMetricsCalculator
from .analytics import PerformanceAnalytics
from .optimization import PortfolioOptimizer, RobustOptimizer
from .realtime_monitor import RealTimePortfolioMonitor, MonitoringConfig
from .stress_testing import StressTester
from .diversification import DiversificationAnalyzer
from .backtesting import PortfolioBacktester, BacktestConfig
from ..services.cache_service import CacheService
from ..services.alert_service import AlertService
from ..utils.logger import setup_logger

logger = setup_logger(__name__)


class PortfolioAnalyticsEngine:
    """
    Comprehensive portfolio analytics engine integrating all analysis capabilities
    """
    
    def __init__(self, 
                 cache_service: CacheService,
                 alert_service: AlertService,
                 risk_free_rate: float = 0.02):
        """
        Initialize portfolio analytics engine
        
        Args:
            cache_service: Cache service for data storage
            alert_service: Alert service for notifications
            risk_free_rate: Risk-free rate for calculations
        """
        self.cache_service = cache_service
        self.alert_service = alert_service
        self.risk_free_rate = risk_free_rate
        
        # Initialize analytics modules
        self.risk_calculator = RiskMetricsCalculator()
        self.performance_analytics = PerformanceAnalytics(risk_free_rate)
        self.optimizer = PortfolioOptimizer(risk_free_rate)
        self.robust_optimizer = RobustOptimizer(risk_free_rate)
        self.stress_tester = StressTester()
        self.diversification_analyzer = DiversificationAnalyzer()
        self.backtester = PortfolioBacktester()
        
        # Real-time monitoring
        self.monitor = None
        self.monitoring_config = None
    
    async def analyze_portfolio_comprehensive(self, 
                                            portfolio_id: str,
                                            returns: pd.Series,
                                            weights: pd.Series,
                                            asset_returns: pd.DataFrame = None,
                                            benchmark_returns: pd.Series = None,
                                            asset_metadata: pd.DataFrame = None) -> Dict:
        """
        Perform comprehensive portfolio analysis
        
        Args:
            portfolio_id: Portfolio identifier
            returns: Portfolio returns series
            weights: Current portfolio weights
            asset_returns: Individual asset returns matrix
            benchmark_returns: Benchmark returns for comparison
            asset_metadata: Asset metadata (sector, geography, etc.)
            
        Returns:
            Comprehensive analysis results
        """
        logger.info(f"Starting comprehensive analysis for portfolio {portfolio_id}")
        
        analysis_results = {
            'portfolio_id': portfolio_id,
            'analysis_timestamp': datetime.utcnow().isoformat(),
            'data_period': {
                'start': returns.index[0].isoformat() if len(returns) > 0 else None,
                'end': returns.index[-1].isoformat() if len(returns) > 0 else None,
                'num_observations': len(returns)
            }
        }
        
        try:
            # 1. Risk Analysis
            logger.info("Calculating risk metrics...")
            portfolio_value = (1 + returns).cumprod() * 100000  # Assume $100k start
            risk_metrics = self.risk_calculator.calculate_comprehensive_risk_metrics(
                returns, portfolio_value, benchmark_returns
            )
            analysis_results['risk_metrics'] = risk_metrics
            
            # 2. Performance Analysis
            logger.info("Calculating performance metrics...")
            performance_metrics = self.performance_analytics.calculate_comprehensive_performance_metrics(
                returns, portfolio_value, benchmark_returns
            )
            analysis_results['performance_metrics'] = performance_metrics
            
            # 3. Diversification Analysis
            if asset_returns is not None and not weights.empty:
                logger.info("Calculating diversification metrics...")
                diversification_metrics = self.diversification_analyzer.calculate_comprehensive_diversification_metrics(
                    asset_returns, weights, asset_metadata
                )
                analysis_results['diversification_metrics'] = diversification_metrics
                
                # Calculate diversification score
                diversification_score = self.diversification_analyzer.calculate_diversification_score(
                    asset_returns, weights
                )
                analysis_results['diversification_score'] = diversification_score
            
            # 4. Stress Testing
            if asset_returns is not None and not weights.empty:
                logger.info("Running stress tests...")
                stress_results = self.stress_tester.run_comprehensive_stress_test(
                    returns, weights, asset_returns
                )
                stress_report = self.stress_tester.generate_stress_test_report(stress_results)
                analysis_results['stress_test_results'] = stress_report
            
            # 5. Portfolio Optimization Suggestions
            if asset_returns is not None:
                logger.info("Generating optimization suggestions...")
                optimization_suggestions = await self._generate_optimization_suggestions(
                    asset_returns, weights
                )
                analysis_results['optimization_suggestions'] = optimization_suggestions
            
            # 6. Risk Alerts
            risk_alerts = await self._check_risk_alerts(portfolio_id, risk_metrics, performance_metrics)
            analysis_results['risk_alerts'] = risk_alerts
            
            # Cache results
            await self._cache_analysis_results(portfolio_id, analysis_results)
            
            logger.info(f"Comprehensive analysis completed for portfolio {portfolio_id}")
            return analysis_results
            
        except Exception as e:
            logger.error(f"Error in comprehensive analysis for portfolio {portfolio_id}: {str(e)}")
            analysis_results['error'] = str(e)
            return analysis_results
    
    async def optimize_portfolio(self, 
                               expected_returns: pd.Series,
                               covariance_matrix: pd.DataFrame,
                               optimization_method: str = 'max_sharpe',
                               constraints: Dict = None,
                               robust: bool = False) -> Dict:
        """
        Optimize portfolio using specified method
        
        Args:
            expected_returns: Expected returns for assets
            covariance_matrix: Asset covariance matrix
            optimization_method: Optimization objective
            constraints: Portfolio constraints
            robust: Use robust optimization
            
        Returns:
            Optimization results
        """
        try:
            if robust:
                result = self.robust_optimizer.optimize_robust_mvo(
                    expected_returns, covariance_matrix
                )
            else:
                result = self.optimizer.optimize_portfolio(
                    expected_returns, covariance_matrix, optimization_method, constraints
                )
            
            # Calculate efficient frontier if successful
            if result.get('success', False):
                frontier = self.optimizer.calculate_efficient_frontier(
                    expected_returns, covariance_matrix, constraints=constraints
                )
                result['efficient_frontier'] = frontier.to_dict('records') if not frontier.empty else []
            
            return result
            
        except Exception as e:
            logger.error(f"Error in portfolio optimization: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    async def start_real_time_monitoring(self, 
                                       portfolio_ids: List[str],
                                       config: MonitoringConfig = None):
        """
        Start real-time portfolio monitoring
        
        Args:
            portfolio_ids: List of portfolio IDs to monitor
            config: Monitoring configuration
        """
        if config is None:
            config = MonitoringConfig()
        
        self.monitoring_config = config
        self.monitor = RealTimePortfolioMonitor(config, self.cache_service, self.alert_service)
        
        await self.monitor.start_monitoring(portfolio_ids)
        logger.info(f"Started real-time monitoring for {len(portfolio_ids)} portfolios")
    
    async def stop_real_time_monitoring(self):
        """Stop real-time portfolio monitoring"""
        if self.monitor:
            await self.monitor.stop_monitoring()
            self.monitor = None
            logger.info("Stopped real-time monitoring")
    
    async def run_backtest(self, 
                         strategy_func,
                         asset_returns: pd.DataFrame,
                         config: BacktestConfig,
                         strategy_name: str = "Strategy",
                         benchmark_returns: pd.Series = None):
        """
        Run portfolio strategy backtest
        
        Args:
            strategy_func: Strategy function
            asset_returns: Historical asset returns
            config: Backtest configuration
            strategy_name: Strategy name
            benchmark_returns: Benchmark returns
            
        Returns:
            Backtest results
        """
        try:
            result = self.backtester.run_backtest(
                strategy_func, asset_returns, config, strategy_name, benchmark_returns
            )
            
            # Cache backtest results
            cache_key = f"backtest_result:{strategy_name}:{config.start_date}:{config.end_date}"
            await self._cache_data(cache_key, {
                'strategy_name': result.strategy_name,
                'performance_metrics': result.performance_metrics,
                'risk_metrics': result.risk_metrics,
                'final_value': result.portfolio_values.iloc[-1] if len(result.portfolio_values) > 0 else 0,
                'timestamp': datetime.utcnow().isoformat()
            })
            
            return result
            
        except Exception as e:
            logger.error(f"Error in backtesting: {str(e)}")
            return None
    
    async def generate_portfolio_report(self, 
                                      portfolio_id: str,
                                      report_type: str = 'comprehensive') -> Dict:
        """
        Generate comprehensive portfolio report
        
        Args:
            portfolio_id: Portfolio identifier
            report_type: Type of report ('comprehensive', 'risk', 'performance')
            
        Returns:
            Portfolio report
        """
        try:
            # Get cached analysis results
            cache_key = f"portfolio_analysis:{portfolio_id}"
            analysis_results = await self._get_cached_data(cache_key)
            
            if not analysis_results:
                return {'error': 'No analysis data found for portfolio'}
            
            report = {
                'portfolio_id': portfolio_id,
                'report_type': report_type,
                'generated_at': datetime.utcnow().isoformat(),
                'data_period': analysis_results.get('data_period', {}),
                'summary': self._generate_report_summary(analysis_results)
            }
            
            if report_type in ['comprehensive', 'risk']:
                report['risk_analysis'] = analysis_results.get('risk_metrics', {})
                report['stress_test_summary'] = analysis_results.get('stress_test_results', {})
            
            if report_type in ['comprehensive', 'performance']:
                report['performance_analysis'] = analysis_results.get('performance_metrics', {})
                report['diversification_analysis'] = analysis_results.get('diversification_metrics', {})
            
            if report_type == 'comprehensive':
                report['optimization_suggestions'] = analysis_results.get('optimization_suggestions', {})
                report['risk_alerts'] = analysis_results.get('risk_alerts', [])
            
            return report
            
        except Exception as e:
            logger.error(f"Error generating portfolio report: {str(e)}")
            return {'error': str(e)}

    # Private helper methods
    async def _generate_optimization_suggestions(self,
                                               asset_returns: pd.DataFrame,
                                               current_weights: pd.Series) -> Dict:
        """Generate portfolio optimization suggestions"""
        try:
            # Calculate expected returns (simple historical mean)
            expected_returns = asset_returns.mean() * 252  # Annualized
            covariance_matrix = asset_returns.cov() * 252  # Annualized

            suggestions = {}

            # Max Sharpe optimization
            max_sharpe_result = self.optimizer.optimize_portfolio(
                expected_returns, covariance_matrix, 'max_sharpe'
            )
            if max_sharpe_result.get('success', False):
                suggestions['max_sharpe'] = {
                    'weights': max_sharpe_result['weights'].to_dict(),
                    'expected_return': max_sharpe_result.get('expected_return', 0),
                    'volatility': max_sharpe_result.get('volatility', 0),
                    'sharpe_ratio': max_sharpe_result.get('sharpe_ratio', 0)
                }

            # Min variance optimization
            min_var_result = self.optimizer.optimize_portfolio(
                expected_returns, covariance_matrix, 'min_variance'
            )
            if min_var_result.get('success', False):
                suggestions['min_variance'] = {
                    'weights': min_var_result['weights'].to_dict(),
                    'expected_return': min_var_result.get('expected_return', 0),
                    'volatility': min_var_result.get('volatility', 0),
                    'sharpe_ratio': min_var_result.get('sharpe_ratio', 0)
                }

            # Risk parity optimization
            risk_parity_result = self.optimizer.optimize_risk_parity(
                expected_returns, covariance_matrix
            )
            if risk_parity_result.get('success', False):
                suggestions['risk_parity'] = {
                    'weights': risk_parity_result['weights'].to_dict(),
                    'expected_return': risk_parity_result.get('expected_return', 0),
                    'volatility': risk_parity_result.get('volatility', 0),
                    'sharpe_ratio': risk_parity_result.get('sharpe_ratio', 0)
                }

            return suggestions

        except Exception as e:
            logger.error(f"Error generating optimization suggestions: {str(e)}")
            return {}

    async def _check_risk_alerts(self,
                               portfolio_id: str,
                               risk_metrics: Dict,
                               performance_metrics: Dict) -> List[Dict]:
        """Check for risk-based alerts"""
        alerts = []

        # VaR threshold alert
        var_95 = risk_metrics.get('var_historical_95', 0)
        if var_95 < -0.05:  # 5% daily VaR threshold
            alerts.append({
                'type': 'risk_threshold',
                'severity': 'high',
                'message': f"Portfolio VaR (95%) exceeds threshold: {var_95:.2%}",
                'metric': 'var_95',
                'value': var_95,
                'threshold': -0.05
            })

        # Max drawdown alert
        max_drawdown = risk_metrics.get('max_drawdown', 0)
        if max_drawdown < -0.15:  # 15% max drawdown threshold
            alerts.append({
                'type': 'risk_threshold',
                'severity': 'high',
                'message': f"Portfolio max drawdown exceeds threshold: {max_drawdown:.2%}",
                'metric': 'max_drawdown',
                'value': max_drawdown,
                'threshold': -0.15
            })

        # Sharpe ratio alert
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)
        if sharpe_ratio < 0.5:  # Minimum Sharpe ratio threshold
            alerts.append({
                'type': 'performance_alert',
                'severity': 'medium',
                'message': f"Portfolio Sharpe ratio below threshold: {sharpe_ratio:.2f}",
                'metric': 'sharpe_ratio',
                'value': sharpe_ratio,
                'threshold': 0.5
            })

        # Send alerts through alert service
        for alert in alerts:
            self.alert_service.send_alert(
                alert['message'],
                tags=[alert['type'], 'portfolio', portfolio_id]
            )

        return alerts

    def _generate_report_summary(self, analysis_results: Dict) -> Dict:
        """Generate executive summary for portfolio report"""
        risk_metrics = analysis_results.get('risk_metrics', {})
        performance_metrics = analysis_results.get('performance_metrics', {})
        diversification_metrics = analysis_results.get('diversification_metrics', {})

        # Overall portfolio health score (0-100)
        health_score = self._calculate_portfolio_health_score(
            risk_metrics, performance_metrics, diversification_metrics
        )

        return {
            'portfolio_health_score': health_score,
            'key_metrics': {
                'total_return': performance_metrics.get('total_return', 0),
                'annualized_return': performance_metrics.get('annualized_return', 0),
                'volatility': performance_metrics.get('volatility', 0),
                'sharpe_ratio': performance_metrics.get('sharpe_ratio', 0),
                'max_drawdown': risk_metrics.get('max_drawdown', 0),
                'var_95': risk_metrics.get('var_historical_95', 0),
                'diversification_score': analysis_results.get('diversification_score', 0)
            },
            'risk_level': self._assess_risk_level(risk_metrics),
            'performance_rating': self._assess_performance_rating(performance_metrics),
            'diversification_rating': self._assess_diversification_rating(diversification_metrics)
        }

    def _calculate_portfolio_health_score(self,
                                        risk_metrics: Dict,
                                        performance_metrics: Dict,
                                        diversification_metrics: Dict) -> float:
        """Calculate overall portfolio health score (0-100)"""
        scores = []

        # Performance score (0-40 points)
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)
        performance_score = min(40, max(0, sharpe_ratio * 20))  # Sharpe > 2 = full points
        scores.append(performance_score)

        # Risk score (0-30 points)
        max_drawdown = abs(risk_metrics.get('max_drawdown', 0))
        risk_score = max(0, 30 - max_drawdown * 100)  # Lower drawdown = higher score
        scores.append(risk_score)

        # Diversification score (0-30 points)
        div_score = diversification_metrics.get('diversification_ratio', 1)
        diversification_score = min(30, max(0, (div_score - 1) * 30))
        scores.append(diversification_score)

        return sum(scores)

    def _assess_risk_level(self, risk_metrics: Dict) -> str:
        """Assess portfolio risk level"""
        var_95 = abs(risk_metrics.get('var_historical_95', 0))
        max_drawdown = abs(risk_metrics.get('max_drawdown', 0))

        if var_95 > 0.08 or max_drawdown > 0.25:
            return 'High'
        elif var_95 > 0.04 or max_drawdown > 0.15:
            return 'Medium'
        else:
            return 'Low'

    def _assess_performance_rating(self, performance_metrics: Dict) -> str:
        """Assess portfolio performance rating"""
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)

        if sharpe_ratio > 1.5:
            return 'Excellent'
        elif sharpe_ratio > 1.0:
            return 'Good'
        elif sharpe_ratio > 0.5:
            return 'Fair'
        else:
            return 'Poor'

    def _assess_diversification_rating(self, diversification_metrics: Dict) -> str:
        """Assess portfolio diversification rating"""
        div_ratio = diversification_metrics.get('diversification_ratio', 1)
        num_assets = diversification_metrics.get('num_assets', 1)

        if div_ratio > 1.3 and num_assets >= 15:
            return 'Excellent'
        elif div_ratio > 1.2 and num_assets >= 10:
            return 'Good'
        elif div_ratio > 1.1 and num_assets >= 5:
            return 'Fair'
        else:
            return 'Poor'

    # Cache helper methods
    async def _cache_analysis_results(self, portfolio_id: str, results: Dict):
        """Cache analysis results"""
        cache_key = f"portfolio_analysis:{portfolio_id}"
        await self._cache_data(cache_key, results, ttl=3600)  # 1 hour TTL

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
