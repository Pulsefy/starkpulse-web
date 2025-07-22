# Portfolio Analytics Engine

A comprehensive portfolio analytics engine with advanced risk metrics, performance analysis, and real-time monitoring capabilities.

## Features

### 🎯 Core Analytics
- **Risk Metrics**: VaR, CVaR, Monte Carlo simulations, drawdown analysis
- **Performance Analytics**: Sharpe, Sortino, Calmar ratios, risk-adjusted returns
- **Diversification Analysis**: Correlation analysis, concentration metrics, effective assets
- **Stress Testing**: Historical scenarios, Monte Carlo, hypothetical shocks

### 🚀 Advanced Capabilities
- **Portfolio Optimization**: Modern Portfolio Theory, efficient frontier, robust optimization
- **Real-time Monitoring**: Asyncio-based monitoring with automated alerts
- **Backtesting Framework**: Multiple strategies, transaction costs, benchmark comparison
- **Comprehensive Reporting**: Automated report generation with visualizations

### 🔧 Integration
- **Seamless Integration**: Works with existing portfolio processing system
- **Redis Caching**: Optimized performance with intelligent caching
- **Alert System**: Automated risk alerts and notifications
- **Scalable Architecture**: Handles large portfolios and datasets

## Quick Start

### Basic Usage

```python
from portfolio_analytics import create_analytics_engine
from services.cache_service import CacheService
from services.alert_service import AlertService

# Initialize services
cache_service = CacheService(settings)
alert_service = AlertService()

# Create analytics engine
engine = create_analytics_engine(cache_service, alert_service)

# Run comprehensive analysis
analysis_result = await engine.analyze_portfolio_comprehensive(
    portfolio_id='PORTFOLIO_001',
    returns=portfolio_returns,
    weights=portfolio_weights,
    asset_returns=asset_returns_matrix
)

print(f"Sharpe Ratio: {analysis_result['performance_metrics']['sharpe_ratio']:.2f}")
print(f"VaR (95%): {analysis_result['risk_metrics']['var_historical_95']:.2%}")
```

### Enhanced Portfolio Processing

```python
from portfolio_analytics import create_enhanced_processor

# Create enhanced processor with analytics
processor = create_enhanced_processor(
    database_service, cache_service, alert_service
)

# Process portfolios with analytics
results = await processor.process_portfolios_with_analytics(user_id='USER_123')

# Start real-time monitoring
await processor.start_real_time_monitoring(['PORTFOLIO_001', 'PORTFOLIO_002'])
```

### Portfolio Optimization

```python
# Optimize portfolio for maximum Sharpe ratio
optimization_result = await engine.optimize_portfolio(
    expected_returns=expected_returns,
    covariance_matrix=covariance_matrix,
    optimization_method='max_sharpe'
)

if optimization_result['success']:
    optimal_weights = optimization_result['weights']
    expected_sharpe = optimization_result['sharpe_ratio']
    print(f"Optimal Sharpe Ratio: {expected_sharpe:.2f}")
```

### Backtesting

```python
from portfolio_analytics.backtesting import BacktestConfig

# Configure backtest
config = BacktestConfig(
    start_date='2023-01-01',
    end_date='2023-12-31',
    initial_capital=100000,
    rebalance_frequency='monthly',
    transaction_cost=0.001
)

# Run backtest
backtest_result = await engine.run_backtest(
    strategy_func=momentum_strategy,
    asset_returns=historical_data,
    config=config,
    strategy_name='Momentum Strategy'
)
```

## Module Structure

```
portfolio-analytics/
├── __init__.py              # Module initialization
├── engine.py                # Main analytics engine
├── risk.py                  # Risk metrics calculator
├── analytics.py             # Performance analytics
├── optimization.py          # Portfolio optimization
├── realtime_monitor.py      # Real-time monitoring
├── stress_testing.py        # Stress testing framework
├── diversification.py       # Diversification analysis
├── backtesting.py          # Backtesting framework
├── reporting.py            # Report generation
├── integration.py          # System integration
└── tests/                  # Comprehensive test suite
    └── test_analytics_engine.py
```

## Key Components

### Risk Metrics Calculator
- Historical and parametric VaR
- Conditional VaR (Expected Shortfall)
- Monte Carlo simulations
- Drawdown analysis
- Volatility modeling

### Performance Analytics
- Risk-adjusted performance metrics
- Rolling performance analysis
- Benchmark comparison
- Factor attribution analysis

### Portfolio Optimizer
- Maximum Sharpe ratio optimization
- Minimum variance optimization
- Risk parity strategies
- Efficient frontier calculation
- Robust optimization techniques

### Real-time Monitor
- Asyncio-based real-time monitoring
- Risk threshold alerts
- Rebalancing suggestions
- Performance notifications

### Stress Tester
- Historical crisis scenarios
- Monte Carlo stress testing
- Hypothetical shock scenarios
- Factor-based stress tests

### Backtesting Framework
- Multiple strategy support
- Transaction cost modeling
- Benchmark comparison
- Performance attribution

## Configuration

### Monitoring Configuration
```python
from portfolio_analytics.realtime_monitor import MonitoringConfig

config = MonitoringConfig(
    update_interval=60,                    # Update every minute
    risk_threshold_var_95=-0.05,          # 5% VaR threshold
    max_drawdown_threshold=-0.15,         # 15% drawdown threshold
    rebalance_threshold=0.05,             # 5% weight deviation
    enable_risk_alerts=True,
    enable_performance_alerts=True
)
```

### Backtest Configuration
```python
from portfolio_analytics.backtesting import BacktestConfig, RebalanceFrequency

config = BacktestConfig(
    start_date='2023-01-01',
    end_date='2023-12-31',
    initial_capital=100000,
    rebalance_frequency=RebalanceFrequency.MONTHLY,
    transaction_cost=0.001,
    enable_transaction_costs=True
)
```

## Testing

Run the comprehensive test suite:

```bash
cd apps/data-processing/src/portfolio-analytics/tests
python -m pytest test_analytics_engine.py -v
```

### Test Coverage
- Unit tests for all modules
- Integration tests for complete workflows
- Performance tests for large datasets
- Mock data generation for testing

## Performance Considerations

- **Caching**: Redis caching for computed metrics
- **Async Processing**: Non-blocking real-time monitoring
- **Batch Operations**: Efficient bulk portfolio processing
- **Memory Management**: Optimized for large datasets

## Dependencies

Core dependencies are managed in `requirements.txt`:
- `numpy>=1.24.0` - Numerical computations
- `pandas>=2.0.0` - Data manipulation
- `scipy>=1.10.0` - Optimization algorithms
- `cvxpy>=1.4.0` - Convex optimization
- `redis>=4.6.0` - Caching
- `asyncio` - Asynchronous processing

## Integration Points

### Database Integration
- Seamless integration with existing portfolio models
- Efficient data retrieval and storage
- Historical data management

### Cache Integration
- Redis caching for performance optimization
- Intelligent cache invalidation
- Configurable TTL settings

### Alert Integration
- Integration with existing alert service
- Customizable alert thresholds
- Multi-channel notifications

## Future Enhancements

- Machine learning-based risk models
- Alternative risk measures (ES, spectral risk)
- Multi-asset class optimization
- ESG integration
- Real-time market data feeds
- Advanced visualization dashboards

## Support

For questions or issues, please refer to the comprehensive test suite and documentation within each module.
