"""
Portfolio Analytics Module

Comprehensive portfolio analytics engine with advanced risk metrics,
performance analysis, and real-time monitoring capabilities.

This module provides:
- Risk metrics and VaR calculations
- Performance analytics and benchmarking
- Portfolio optimization (Modern Portfolio Theory)
- Real-time monitoring and alerts
- Stress testing and scenario analysis
- Diversification analysis
- Backtesting framework
- Comprehensive reporting and visualization
"""

from .engine import PortfolioAnalyticsEngine
from .risk import RiskMetricsCalculator
from .analytics import PerformanceAnalytics
from .optimization import PortfolioOptimizer, RobustOptimizer
from .realtime_monitor import RealTimePortfolioMonitor, MonitoringConfig, AlertType
from .stress_testing import StressTester, StressScenario, ScenarioType
from .diversification import DiversificationAnalyzer
from .backtesting import PortfolioBacktester, BacktestConfig, RebalanceFrequency
from .reporting import PortfolioReportGenerator, ReportConfig
from .integration import EnhancedPortfolioProcessor

__version__ = "1.0.0"
__author__ = "StarkPulse Analytics Team"

__all__ = [
    # Main engine
    'PortfolioAnalyticsEngine',
    
    # Core analytics modules
    'RiskMetricsCalculator',
    'PerformanceAnalytics',
    'PortfolioOptimizer',
    'RobustOptimizer',
    'DiversificationAnalyzer',
    
    # Real-time monitoring
    'RealTimePortfolioMonitor',
    'MonitoringConfig',
    'AlertType',
    
    # Stress testing
    'StressTester',
    'StressScenario',
    'ScenarioType',
    
    # Backtesting
    'PortfolioBacktester',
    'BacktestConfig',
    'RebalanceFrequency',
    
    # Reporting
    'PortfolioReportGenerator',
    'ReportConfig',
    
    # Integration
    'EnhancedPortfolioProcessor'
]


def get_version():
    """Get the version of the portfolio analytics module"""
    return __version__


def create_analytics_engine(cache_service, alert_service, risk_free_rate=0.02):
    """
    Factory function to create a configured portfolio analytics engine
    
    Args:
        cache_service: Cache service instance
        alert_service: Alert service instance
        risk_free_rate: Risk-free rate for calculations (default 2%)
        
    Returns:
        Configured PortfolioAnalyticsEngine instance
    """
    return PortfolioAnalyticsEngine(
        cache_service=cache_service,
        alert_service=alert_service,
        risk_free_rate=risk_free_rate
    )


def create_enhanced_processor(database_service, cache_service, alert_service):
    """
    Factory function to create an enhanced portfolio processor with analytics
    
    Args:
        database_service: Database service instance
        cache_service: Cache service instance
        alert_service: Alert service instance
        
    Returns:
        Configured EnhancedPortfolioProcessor instance
    """
    return EnhancedPortfolioProcessor(
        database_service=database_service,
        cache_service=cache_service,
        alert_service=alert_service
    )
