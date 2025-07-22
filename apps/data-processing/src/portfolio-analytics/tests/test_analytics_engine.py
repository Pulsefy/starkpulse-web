"""
Comprehensive Test Suite for Portfolio Analytics Engine

This module provides comprehensive testing for all portfolio analytics components:
- Unit tests for individual modules
- Integration tests for the complete engine
- Performance tests for large datasets
- Mock data generation for testing
"""

import unittest
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import asyncio
from unittest.mock import Mock, AsyncMock, patch
import sys
import os

# Add the parent directory to the path to import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from engine import PortfolioAnalyticsEngine
from risk import RiskMetricsCalculator
from analytics import PerformanceAnalytics
from optimization import PortfolioOptimizer
from diversification import DiversificationAnalyzer
from stress_testing import StressTester
from backtesting import PortfolioBacktester, BacktestConfig
from reporting import PortfolioReportGenerator, ReportConfig


class TestDataGenerator:
    """Generate mock data for testing"""
    
    @staticmethod
    def generate_returns_data(n_assets: int = 5, n_periods: int = 252, seed: int = 42) -> pd.DataFrame:
        """Generate synthetic asset returns data"""
        np.random.seed(seed)
        
        # Generate correlated returns
        dates = pd.date_range(start='2023-01-01', periods=n_periods, freq='D')
        
        # Create correlation matrix
        correlation = np.random.uniform(0.1, 0.7, (n_assets, n_assets))
        correlation = (correlation + correlation.T) / 2
        np.fill_diagonal(correlation, 1.0)
        
        # Generate returns with specified correlation
        returns = np.random.multivariate_normal(
            mean=[0.0008] * n_assets,  # ~20% annual return
            cov=correlation * 0.0004,  # ~20% annual volatility
            size=n_periods
        )
        
        asset_names = [f'ASSET_{i+1}' for i in range(n_assets)]
        return pd.DataFrame(returns, index=dates, columns=asset_names)
    
    @staticmethod
    def generate_portfolio_weights(n_assets: int, seed: int = 42) -> pd.Series:
        """Generate random portfolio weights"""
        np.random.seed(seed)
        weights = np.random.dirichlet(np.ones(n_assets))
        asset_names = [f'ASSET_{i+1}' for i in range(n_assets)]
        return pd.Series(weights, index=asset_names)
    
    @staticmethod
    def generate_portfolio_returns(asset_returns: pd.DataFrame, weights: pd.Series) -> pd.Series:
        """Generate portfolio returns from asset returns and weights"""
        return (asset_returns * weights).sum(axis=1)


class TestRiskMetricsCalculator(unittest.TestCase):
    """Test suite for risk metrics calculator"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.risk_calculator = RiskMetricsCalculator()
        self.returns_data = TestDataGenerator.generate_returns_data()
        self.portfolio_weights = TestDataGenerator.generate_portfolio_weights(5)
        self.portfolio_returns = TestDataGenerator.generate_portfolio_returns(
            self.returns_data, self.portfolio_weights
        )
    
    def test_comprehensive_risk_metrics(self):
        """Test comprehensive risk metrics calculation"""
        portfolio_value = (1 + self.portfolio_returns).cumprod() * 100000
        
        risk_metrics = self.risk_calculator.calculate_comprehensive_risk_metrics(
            self.portfolio_returns, portfolio_value
        )
        
        # Check that all expected metrics are present
        expected_metrics = [
            'volatility_daily', 'volatility_annualized', 'var_historical_95',
            'cvar_95', 'max_drawdown', 'skewness', 'kurtosis'
        ]
        
        for metric in expected_metrics:
            self.assertIn(metric, risk_metrics)
            self.assertIsInstance(risk_metrics[metric], (int, float))
    
    def test_var_calculations(self):
        """Test VaR calculations"""
        risk_metrics = self.risk_calculator.calculate_comprehensive_risk_metrics(
            self.portfolio_returns
        )
        
        var_95 = risk_metrics.get('var_historical_95', 0)
        cvar_95 = risk_metrics.get('cvar_95', 0)
        
        # VaR should be negative (loss)
        self.assertLess(var_95, 0)
        # CVaR should be more negative than VaR
        self.assertLess(cvar_95, var_95)
    
    def test_empty_data_handling(self):
        """Test handling of empty data"""
        empty_returns = pd.Series(dtype=float)
        risk_metrics = self.risk_calculator.calculate_comprehensive_risk_metrics(empty_returns)
        
        # Should return empty metrics structure
        self.assertIsInstance(risk_metrics, dict)
        self.assertEqual(risk_metrics.get('volatility_daily', 0), 0)


class TestPerformanceAnalytics(unittest.TestCase):
    """Test suite for performance analytics"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.performance_analytics = PerformanceAnalytics()
        self.returns_data = TestDataGenerator.generate_returns_data()
        self.portfolio_weights = TestDataGenerator.generate_portfolio_weights(5)
        self.portfolio_returns = TestDataGenerator.generate_portfolio_returns(
            self.returns_data, self.portfolio_weights
        )
    
    def test_comprehensive_performance_metrics(self):
        """Test comprehensive performance metrics calculation"""
        portfolio_value = (1 + self.portfolio_returns).cumprod() * 100000
        
        performance_metrics = self.performance_analytics.calculate_comprehensive_performance_metrics(
            self.portfolio_returns, portfolio_value
        )
        
        # Check expected metrics
        expected_metrics = [
            'total_return', 'annualized_return', 'volatility', 'sharpe_ratio',
            'sortino_ratio', 'win_rate', 'best_day', 'worst_day'
        ]
        
        for metric in expected_metrics:
            self.assertIn(metric, performance_metrics)
            self.assertIsInstance(performance_metrics[metric], (int, float))
    
    def test_sharpe_ratio_calculation(self):
        """Test Sharpe ratio calculation"""
        performance_metrics = self.performance_analytics.calculate_comprehensive_performance_metrics(
            self.portfolio_returns
        )
        
        sharpe_ratio = performance_metrics.get('sharpe_ratio', 0)
        
        # Sharpe ratio should be finite
        self.assertTrue(np.isfinite(sharpe_ratio))
    
    def test_benchmark_comparison(self):
        """Test benchmark comparison metrics"""
        # Generate benchmark returns
        benchmark_returns = TestDataGenerator.generate_returns_data(1)['ASSET_1']
        
        performance_metrics = self.performance_analytics.calculate_comprehensive_performance_metrics(
            self.portfolio_returns, benchmark_returns=benchmark_returns
        )
        
        # Should include benchmark comparison metrics
        self.assertIn('alpha', performance_metrics)
        self.assertIn('beta', performance_metrics)
        self.assertIn('information_ratio', performance_metrics)


class TestPortfolioOptimizer(unittest.TestCase):
    """Test suite for portfolio optimizer"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.optimizer = PortfolioOptimizer()
        self.returns_data = TestDataGenerator.generate_returns_data()
        self.expected_returns = self.returns_data.mean() * 252
        self.covariance_matrix = self.returns_data.cov() * 252
    
    def test_max_sharpe_optimization(self):
        """Test maximum Sharpe ratio optimization"""
        result = self.optimizer.optimize_portfolio(
            self.expected_returns, self.covariance_matrix, 'max_sharpe'
        )
        
        self.assertTrue(result.get('success', False))
        self.assertIn('weights', result)
        self.assertIn('sharpe_ratio', result)
        
        # Weights should sum to 1
        weights = result['weights']
        self.assertAlmostEqual(weights.sum(), 1.0, places=6)
    
    def test_min_variance_optimization(self):
        """Test minimum variance optimization"""
        result = self.optimizer.optimize_portfolio(
            self.expected_returns, self.covariance_matrix, 'min_variance'
        )
        
        self.assertTrue(result.get('success', False))
        self.assertIn('weights', result)
        self.assertIn('volatility', result)
    
    def test_efficient_frontier(self):
        """Test efficient frontier calculation"""
        frontier = self.optimizer.calculate_efficient_frontier(
            self.expected_returns, self.covariance_matrix, num_points=10
        )
        
        self.assertIsInstance(frontier, pd.DataFrame)
        self.assertGreater(len(frontier), 0)
        
        # Check that frontier points have required columns
        expected_columns = ['expected_return', 'volatility', 'sharpe_ratio']
        for col in expected_columns:
            self.assertIn(col, frontier.columns)


class TestDiversificationAnalyzer(unittest.TestCase):
    """Test suite for diversification analyzer"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.diversification_analyzer = DiversificationAnalyzer()
        self.returns_data = TestDataGenerator.generate_returns_data()
        self.portfolio_weights = TestDataGenerator.generate_portfolio_weights(5)
    
    def test_comprehensive_diversification_metrics(self):
        """Test comprehensive diversification metrics"""
        div_metrics = self.diversification_analyzer.calculate_comprehensive_diversification_metrics(
            self.returns_data, self.portfolio_weights
        )
        
        # Check expected metrics
        expected_metrics = [
            'avg_correlation', 'herfindahl_index', 'effective_num_assets',
            'diversification_ratio', 'num_assets'
        ]
        
        for metric in expected_metrics:
            self.assertIn(metric, div_metrics)
    
    def test_diversification_score(self):
        """Test diversification score calculation"""
        score = self.diversification_analyzer.calculate_diversification_score(
            self.returns_data, self.portfolio_weights
        )
        
        # Score should be between 0 and 100
        self.assertGreaterEqual(score, 0)
        self.assertLessEqual(score, 100)
    
    def test_concentration_metrics(self):
        """Test concentration metrics"""
        div_metrics = self.diversification_analyzer.calculate_comprehensive_diversification_metrics(
            self.returns_data, self.portfolio_weights
        )
        
        hhi = div_metrics.get('herfindahl_index', 0)
        effective_assets = div_metrics.get('effective_num_assets', 0)
        
        # HHI should be between 1/n and 1
        n_assets = len(self.portfolio_weights)
        self.assertGreaterEqual(hhi, 1/n_assets)
        self.assertLessEqual(hhi, 1.0)
        
        # Effective assets should be between 1 and n
        self.assertGreaterEqual(effective_assets, 1)
        self.assertLessEqual(effective_assets, n_assets)


class TestStressTester(unittest.TestCase):
    """Test suite for stress tester"""

    def setUp(self):
        """Set up test fixtures"""
        self.stress_tester = StressTester()
        self.returns_data = TestDataGenerator.generate_returns_data()
        self.portfolio_weights = TestDataGenerator.generate_portfolio_weights(5)
        self.portfolio_returns = TestDataGenerator.generate_portfolio_returns(
            self.returns_data, self.portfolio_weights
        )

    def test_comprehensive_stress_test(self):
        """Test comprehensive stress testing"""
        stress_results = self.stress_tester.run_comprehensive_stress_test(
            self.portfolio_returns, self.portfolio_weights, self.returns_data
        )

        self.assertIsInstance(stress_results, dict)
        self.assertGreater(len(stress_results), 0)

        # Check that results contain expected fields
        for scenario_name, result in stress_results.items():
            self.assertIn('loss_percentage', result.__dict__)
            self.assertIn('stressed_value', result.__dict__)

    def test_stress_test_report_generation(self):
        """Test stress test report generation"""
        stress_results = self.stress_tester.run_comprehensive_stress_test(
            self.portfolio_returns, self.portfolio_weights, self.returns_data
        )

        report = self.stress_tester.generate_stress_test_report(stress_results)

        self.assertIn('summary', report)
        self.assertIn('detailed_results', report)
        self.assertIn('total_scenarios_tested', report['summary'])


class TestPortfolioBacktester(unittest.TestCase):
    """Test suite for portfolio backtester"""

    def setUp(self):
        """Set up test fixtures"""
        self.backtester = PortfolioBacktester()
        self.returns_data = TestDataGenerator.generate_returns_data(n_periods=100)

        # Simple equal weight strategy for testing
        def equal_weight_strategy(returns_data):
            n_assets = len(returns_data.columns)
            return pd.Series(1/n_assets, index=returns_data.columns)

        self.strategy_func = equal_weight_strategy

        self.config = BacktestConfig(
            start_date='2023-01-01',
            end_date='2023-03-31',
            initial_capital=100000,
            rebalance_frequency='monthly'
        )

    def test_backtest_execution(self):
        """Test backtest execution"""
        result = self.backtester.run_backtest(
            self.strategy_func, self.returns_data, self.config
        )

        self.assertIsNotNone(result)
        self.assertEqual(result.strategy_name, "Strategy")
        self.assertGreater(len(result.portfolio_values), 0)
        self.assertGreater(len(result.returns), 0)

    def test_multiple_strategies_backtest(self):
        """Test multiple strategies backtesting"""
        def momentum_strategy(returns_data):
            if len(returns_data) < 30:
                n_assets = len(returns_data.columns)
                return pd.Series(1/n_assets, index=returns_data.columns)

            recent_returns = returns_data.tail(30)
            momentum_scores = (1 + recent_returns).prod() - 1
            top_assets = momentum_scores.nlargest(3)

            weights = pd.Series(0, index=returns_data.columns)
            weights[top_assets.index] = 1 / len(top_assets)
            return weights

        strategies = {
            'Equal Weight': self.strategy_func,
            'Momentum': momentum_strategy
        }

        results = self.backtester.run_multiple_strategies_backtest(
            strategies, self.returns_data, self.config
        )

        self.assertEqual(len(results), 2)
        self.assertIn('Equal Weight', results)
        self.assertIn('Momentum', results)


class TestPortfolioReportGenerator(unittest.TestCase):
    """Test suite for portfolio report generator"""

    def setUp(self):
        """Set up test fixtures"""
        self.report_generator = PortfolioReportGenerator()

        # Mock analysis results
        self.analysis_results = {
            'portfolio_id': 'TEST_PORTFOLIO',
            'data_period': {
                'start': '2023-01-01',
                'end': '2023-12-31',
                'num_observations': 252
            },
            'performance_metrics': {
                'total_return': 0.15,
                'annualized_return': 0.15,
                'volatility': 0.20,
                'sharpe_ratio': 0.75,
                'sortino_ratio': 1.0,
                'win_rate': 0.55
            },
            'risk_metrics': {
                'var_historical_95': -0.03,
                'cvar_95': -0.045,
                'max_drawdown': -0.12,
                'volatility_annualized': 0.20
            },
            'diversification_score': 65,
            'diversification_metrics': {
                'herfindahl_index': 0.25,
                'effective_num_assets': 4.0,
                'diversification_ratio': 1.15
            }
        }

    def test_comprehensive_report_generation(self):
        """Test comprehensive report generation"""
        config = ReportConfig(report_type='comprehensive')

        report = self.report_generator.generate_comprehensive_report(
            self.analysis_results, config
        )

        # Check report structure
        self.assertIn('metadata', report)
        self.assertIn('executive_summary', report)
        self.assertIn('performance_analysis', report)
        self.assertIn('risk_analysis', report)
        self.assertIn('diversification_analysis', report)

    def test_executive_summary_generation(self):
        """Test executive summary generation"""
        summary = self.report_generator._generate_executive_summary(self.analysis_results)

        self.assertIn('key_performance_indicators', summary)
        self.assertIn('portfolio_health_score', summary)
        self.assertIn('risk_level', summary)
        self.assertIn('performance_rating', summary)

        # Health score should be between 0 and 100
        health_score = summary['portfolio_health_score']
        self.assertGreaterEqual(health_score, 0)
        self.assertLessEqual(health_score, 100)


class TestPortfolioAnalyticsEngineIntegration(unittest.TestCase):
    """Integration tests for the complete portfolio analytics engine"""

    def setUp(self):
        """Set up test fixtures"""
        # Mock services
        self.mock_cache_service = Mock()
        self.mock_alert_service = Mock()

        # Initialize engine
        self.engine = PortfolioAnalyticsEngine(
            self.mock_cache_service,
            self.mock_alert_service
        )

        # Test data
        self.returns_data = TestDataGenerator.generate_returns_data()
        self.portfolio_weights = TestDataGenerator.generate_portfolio_weights(5)
        self.portfolio_returns = TestDataGenerator.generate_portfolio_returns(
            self.returns_data, self.portfolio_weights
        )

    async def test_comprehensive_analysis(self):
        """Test comprehensive portfolio analysis"""
        # Mock cache methods
        self.mock_cache_service.set = Mock()
        self.mock_cache_service.get = Mock(return_value=None)

        result = await self.engine.analyze_portfolio_comprehensive(
            portfolio_id='TEST_001',
            returns=self.portfolio_returns,
            weights=self.portfolio_weights,
            asset_returns=self.returns_data
        )

        # Check result structure
        self.assertIn('portfolio_id', result)
        self.assertIn('risk_metrics', result)
        self.assertIn('performance_metrics', result)
        self.assertIn('diversification_metrics', result)
        self.assertEqual(result['portfolio_id'], 'TEST_001')

    async def test_portfolio_optimization(self):
        """Test portfolio optimization"""
        expected_returns = self.returns_data.mean() * 252
        covariance_matrix = self.returns_data.cov() * 252

        result = await self.engine.optimize_portfolio(
            expected_returns, covariance_matrix, 'max_sharpe'
        )

        self.assertIn('success', result)
        if result['success']:
            self.assertIn('weights', result)
            self.assertIn('efficient_frontier', result)

    async def test_report_generation(self):
        """Test portfolio report generation"""
        # Mock cached analysis results
        mock_analysis = {
            'portfolio_id': 'TEST_001',
            'performance_metrics': {'sharpe_ratio': 1.2, 'total_return': 0.15},
            'risk_metrics': {'max_drawdown': -0.10, 'var_historical_95': -0.025},
            'diversification_score': 70
        }

        self.mock_cache_service.get = Mock(return_value=mock_analysis)

        report = await self.engine.generate_portfolio_report('TEST_001')

        self.assertIn('portfolio_id', report)
        self.assertIn('summary', report)


class TestPerformanceAndScalability(unittest.TestCase):
    """Performance and scalability tests"""

    def test_large_dataset_performance(self):
        """Test performance with large datasets"""
        import time

        # Generate large dataset
        large_returns = TestDataGenerator.generate_returns_data(n_assets=50, n_periods=2520)  # 10 years
        large_weights = TestDataGenerator.generate_portfolio_weights(50)

        # Test risk calculation performance
        risk_calculator = RiskMetricsCalculator()
        portfolio_returns = TestDataGenerator.generate_portfolio_returns(large_returns, large_weights)

        start_time = time.time()
        risk_metrics = risk_calculator.calculate_comprehensive_risk_metrics(portfolio_returns)
        risk_time = time.time() - start_time

        # Should complete within reasonable time (< 5 seconds)
        self.assertLess(risk_time, 5.0)
        self.assertIsInstance(risk_metrics, dict)
        self.assertGreater(len(risk_metrics), 0)

    def test_memory_usage(self):
        """Test memory usage with large datasets"""
        import psutil
        import os

        process = psutil.Process(os.getpid())
        initial_memory = process.memory_info().rss / 1024 / 1024  # MB

        # Generate and process large dataset
        large_returns = TestDataGenerator.generate_returns_data(n_assets=100, n_periods=5040)  # 20 years
        large_weights = TestDataGenerator.generate_portfolio_weights(100)

        diversification_analyzer = DiversificationAnalyzer()
        div_metrics = diversification_analyzer.calculate_comprehensive_diversification_metrics(
            large_returns, large_weights
        )

        final_memory = process.memory_info().rss / 1024 / 1024  # MB
        memory_increase = final_memory - initial_memory

        # Memory increase should be reasonable (< 500 MB)
        self.assertLess(memory_increase, 500)


if __name__ == '__main__':
    # Run all tests
    unittest.main(verbosity=2)
