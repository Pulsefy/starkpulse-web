"""
Portfolio Backtesting Framework

This module provides comprehensive backtesting capabilities including:
- Historical performance backtesting
- Multiple strategy comparison
- Benchmark analysis
- Transaction cost modeling
- Risk-adjusted performance metrics
- Rolling window analysis
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Optional, Tuple, Union, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass
from enum import Enum
import warnings

from .analytics import PerformanceAnalytics
from .risk import RiskMetricsCalculator
from .diversification import DiversificationAnalyzer

warnings.filterwarnings('ignore')


class RebalanceFrequency(Enum):
    """Rebalancing frequency options"""
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUALLY = "annually"
    NEVER = "never"


@dataclass
class BacktestConfig:
    """Backtesting configuration"""
    start_date: str
    end_date: str
    initial_capital: float = 100000
    rebalance_frequency: RebalanceFrequency = RebalanceFrequency.MONTHLY
    transaction_cost: float = 0.001  # 0.1% per trade
    min_trade_size: float = 100  # Minimum trade size
    benchmark_symbol: Optional[str] = None
    risk_free_rate: float = 0.02
    enable_transaction_costs: bool = True
    enable_slippage: bool = False
    slippage_rate: float = 0.0005  # 0.05% slippage


@dataclass
class BacktestResult:
    """Backtesting result"""
    strategy_name: str
    config: BacktestConfig
    portfolio_values: pd.Series
    returns: pd.Series
    weights_history: pd.DataFrame
    trades: pd.DataFrame
    performance_metrics: Dict
    risk_metrics: Dict
    benchmark_comparison: Optional[Dict] = None


class PortfolioBacktester:
    """
    Comprehensive portfolio backtesting engine
    """
    
    def __init__(self):
        """Initialize backtester"""
        self.performance_analytics = PerformanceAnalytics()
        self.risk_calculator = RiskMetricsCalculator()
        self.diversification_analyzer = DiversificationAnalyzer()
    
    def run_backtest(self, 
                    strategy_func: Callable,
                    asset_returns: pd.DataFrame,
                    config: BacktestConfig,
                    strategy_name: str = "Strategy",
                    benchmark_returns: pd.Series = None) -> BacktestResult:
        """
        Run comprehensive backtest for a portfolio strategy
        
        Args:
            strategy_func: Function that returns portfolio weights given market data
            asset_returns: Historical asset returns matrix
            config: Backtesting configuration
            strategy_name: Name of the strategy
            benchmark_returns: Benchmark returns for comparison
            
        Returns:
            BacktestResult containing all backtest metrics and data
        """
        # Filter data for backtest period
        start_date = pd.to_datetime(config.start_date)
        end_date = pd.to_datetime(config.end_date)
        
        period_mask = (asset_returns.index >= start_date) & (asset_returns.index <= end_date)
        period_returns = asset_returns[period_mask].copy()
        
        if len(period_returns) == 0:
            raise ValueError(f"No data found for period {config.start_date} to {config.end_date}")
        
        # Initialize tracking variables
        portfolio_values = []
        weights_history = []
        trades_list = []
        current_weights = None
        current_value = config.initial_capital
        
        # Get rebalancing dates
        rebalance_dates = self._get_rebalance_dates(period_returns.index, config.rebalance_frequency)
        
        # Run backtest day by day
        for date in period_returns.index:
            daily_returns = period_returns.loc[date]
            
            # Check if rebalancing is needed
            if date in rebalance_dates or current_weights is None:
                # Get new target weights from strategy
                lookback_data = period_returns.loc[:date].iloc[:-1]  # Exclude current day
                if len(lookback_data) >= 30:  # Need minimum history
                    new_weights = strategy_func(lookback_data)
                    
                    if new_weights is not None and len(new_weights) > 0:
                        # Normalize weights
                        new_weights = new_weights / new_weights.sum()
                        
                        # Execute rebalancing
                        if current_weights is not None:
                            trades = self._execute_rebalancing(
                                current_weights, new_weights, current_value, date, config
                            )
                            trades_list.extend(trades)
                            
                            # Apply transaction costs
                            if config.enable_transaction_costs:
                                total_trade_value = sum(abs(trade['value']) for trade in trades)
                                transaction_costs = total_trade_value * config.transaction_cost
                                current_value -= transaction_costs
                        
                        current_weights = new_weights
            
            # Apply daily returns
            if current_weights is not None:
                # Calculate portfolio return
                portfolio_return = (current_weights * daily_returns).sum()
                current_value *= (1 + portfolio_return)
            
            # Record daily values
            portfolio_values.append(current_value)
            if current_weights is not None:
                weights_history.append(current_weights.copy())
            else:
                weights_history.append(pd.Series(dtype=float))
        
        # Convert to DataFrames/Series
        portfolio_values = pd.Series(portfolio_values, index=period_returns.index)
        weights_history = pd.DataFrame(weights_history, index=period_returns.index)
        trades_df = pd.DataFrame(trades_list) if trades_list else pd.DataFrame()
        
        # Calculate returns
        returns = portfolio_values.pct_change().dropna()
        
        # Calculate performance metrics
        performance_metrics = self.performance_analytics.calculate_comprehensive_performance_metrics(
            returns, portfolio_values
        )
        
        # Calculate risk metrics
        risk_metrics = self.risk_calculator.calculate_comprehensive_risk_metrics(
            returns, portfolio_values
        )
        
        # Benchmark comparison
        benchmark_comparison = None
        if benchmark_returns is not None:
            benchmark_comparison = self._calculate_benchmark_comparison(
                returns, benchmark_returns, config
            )
        
        return BacktestResult(
            strategy_name=strategy_name,
            config=config,
            portfolio_values=portfolio_values,
            returns=returns,
            weights_history=weights_history,
            trades=trades_df,
            performance_metrics=performance_metrics,
            risk_metrics=risk_metrics,
            benchmark_comparison=benchmark_comparison
        )
    
    def run_multiple_strategies_backtest(self,
                                       strategies: Dict[str, Callable],
                                       asset_returns: pd.DataFrame,
                                       config: BacktestConfig,
                                       benchmark_returns: pd.Series = None) -> Dict[str, BacktestResult]:
        """
        Run backtest for multiple strategies and compare results
        
        Args:
            strategies: Dictionary of strategy name -> strategy function
            asset_returns: Historical asset returns matrix
            config: Backtesting configuration
            benchmark_returns: Benchmark returns for comparison
            
        Returns:
            Dictionary of strategy name -> BacktestResult
        """
        results = {}
        
        for strategy_name, strategy_func in strategies.items():
            try:
                result = self.run_backtest(
                    strategy_func, asset_returns, config, strategy_name, benchmark_returns
                )
                results[strategy_name] = result
            except Exception as e:
                print(f"Error running backtest for strategy {strategy_name}: {str(e)}")
                continue
        
        return results
    
    def _get_rebalance_dates(self, date_index: pd.DatetimeIndex, frequency: RebalanceFrequency) -> List:
        """Get rebalancing dates based on frequency"""
        if frequency == RebalanceFrequency.NEVER:
            return [date_index[0]]  # Only rebalance at start
        elif frequency == RebalanceFrequency.DAILY:
            return date_index.tolist()
        elif frequency == RebalanceFrequency.WEEKLY:
            return [date for date in date_index if date.weekday() == 0]  # Mondays
        elif frequency == RebalanceFrequency.MONTHLY:
            return [date for date in date_index if date.day <= 7 and date.weekday() == 0]  # First Monday
        elif frequency == RebalanceFrequency.QUARTERLY:
            return [date for date in date_index 
                   if date.month in [1, 4, 7, 10] and date.day <= 7 and date.weekday() == 0]
        elif frequency == RebalanceFrequency.ANNUALLY:
            return [date for date in date_index 
                   if date.month == 1 and date.day <= 7 and date.weekday() == 0]
        else:
            return [date_index[0]]
    
    def _execute_rebalancing(self, 
                           current_weights: pd.Series,
                           target_weights: pd.Series,
                           portfolio_value: float,
                           date: pd.Timestamp,
                           config: BacktestConfig) -> List[Dict]:
        """Execute rebalancing trades"""
        trades = []
        
        # Align weights
        all_assets = current_weights.index.union(target_weights.index)
        current_aligned = current_weights.reindex(all_assets, fill_value=0)
        target_aligned = target_weights.reindex(all_assets, fill_value=0)
        
        # Calculate required trades
        weight_changes = target_aligned - current_aligned
        
        for asset in all_assets:
            weight_change = weight_changes[asset]
            trade_value = portfolio_value * weight_change
            
            if abs(trade_value) >= config.min_trade_size:
                trades.append({
                    'date': date,
                    'asset': asset,
                    'action': 'buy' if trade_value > 0 else 'sell',
                    'value': abs(trade_value),
                    'weight_change': weight_change
                })
        
        return trades

    def _calculate_benchmark_comparison(self,
                                      portfolio_returns: pd.Series,
                                      benchmark_returns: pd.Series,
                                      config: BacktestConfig) -> Dict:
        """Calculate benchmark comparison metrics"""
        # Align returns
        aligned_data = pd.DataFrame({
            'portfolio': portfolio_returns,
            'benchmark': benchmark_returns
        }).dropna()

        if len(aligned_data) < 30:
            return {}

        portfolio_ret = aligned_data['portfolio']
        benchmark_ret = aligned_data['benchmark']

        # Performance comparison
        portfolio_total_return = (1 + portfolio_ret).prod() - 1
        benchmark_total_return = (1 + benchmark_ret).prod() - 1

        # Risk comparison
        portfolio_vol = portfolio_ret.std() * np.sqrt(252)
        benchmark_vol = benchmark_ret.std() * np.sqrt(252)

        # Risk-adjusted metrics
        excess_returns = portfolio_ret - benchmark_ret
        tracking_error = excess_returns.std() * np.sqrt(252)
        information_ratio = (excess_returns.mean() * 252) / tracking_error if tracking_error != 0 else 0

        # Beta and alpha
        covariance = np.cov(portfolio_ret, benchmark_ret)[0, 1]
        benchmark_variance = benchmark_ret.var()
        beta = covariance / benchmark_variance if benchmark_variance != 0 else 0

        rf_rate = config.risk_free_rate / 252
        alpha = (portfolio_ret.mean() - rf_rate) - beta * (benchmark_ret.mean() - rf_rate)
        alpha_annualized = alpha * 252

        # Up/down capture
        up_periods = benchmark_ret > 0
        down_periods = benchmark_ret < 0

        up_capture = (portfolio_ret[up_periods].mean() / benchmark_ret[up_periods].mean()) if up_periods.sum() > 0 else 0
        down_capture = (portfolio_ret[down_periods].mean() / benchmark_ret[down_periods].mean()) if down_periods.sum() > 0 else 0

        return {
            'portfolio_total_return': portfolio_total_return,
            'benchmark_total_return': benchmark_total_return,
            'excess_return': portfolio_total_return - benchmark_total_return,
            'portfolio_volatility': portfolio_vol,
            'benchmark_volatility': benchmark_vol,
            'tracking_error': tracking_error,
            'information_ratio': information_ratio,
            'beta': beta,
            'alpha': alpha_annualized,
            'correlation': portfolio_ret.corr(benchmark_ret),
            'up_capture_ratio': up_capture,
            'down_capture_ratio': down_capture
        }

    def generate_backtest_report(self, results: Dict[str, BacktestResult]) -> Dict:
        """Generate comprehensive backtest comparison report"""
        if not results:
            return {'error': 'No backtest results provided'}

        # Summary table
        summary_data = []
        for strategy_name, result in results.items():
            perf = result.performance_metrics
            risk = result.risk_metrics

            summary_data.append({
                'strategy': strategy_name,
                'total_return': perf.get('total_return', 0),
                'annualized_return': perf.get('annualized_return', 0),
                'volatility': perf.get('volatility', 0),
                'sharpe_ratio': perf.get('sharpe_ratio', 0),
                'sortino_ratio': perf.get('sortino_ratio', 0),
                'max_drawdown': risk.get('max_drawdown', 0),
                'calmar_ratio': perf.get('calmar_ratio', 0),
                'win_rate': perf.get('win_rate', 0),
                'final_value': result.portfolio_values.iloc[-1] if len(result.portfolio_values) > 0 else 0
            })

        summary_df = pd.DataFrame(summary_data)

        # Best/worst performers
        best_return = summary_df.loc[summary_df['total_return'].idxmax()] if len(summary_df) > 0 else None
        best_sharpe = summary_df.loc[summary_df['sharpe_ratio'].idxmax()] if len(summary_df) > 0 else None
        lowest_drawdown = summary_df.loc[summary_df['max_drawdown'].idxmax()] if len(summary_df) > 0 else None

        return {
            'summary_table': summary_df.to_dict('records'),
            'best_performers': {
                'highest_return': best_return.to_dict() if best_return is not None else {},
                'highest_sharpe': best_sharpe.to_dict() if best_sharpe is not None else {},
                'lowest_drawdown': lowest_drawdown.to_dict() if lowest_drawdown is not None else {}
            },
            'num_strategies': len(results),
            'backtest_period': {
                'start': list(results.values())[0].config.start_date,
                'end': list(results.values())[0].config.end_date
            },
            'timestamp': datetime.utcnow().isoformat()
        }


# Example strategy functions
def equal_weight_strategy(returns_data: pd.DataFrame) -> pd.Series:
    """Equal weight strategy"""
    n_assets = len(returns_data.columns)
    return pd.Series(1/n_assets, index=returns_data.columns)


def momentum_strategy(returns_data: pd.DataFrame, lookback_days: int = 60) -> pd.Series:
    """Momentum strategy based on recent performance"""
    if len(returns_data) < lookback_days:
        return equal_weight_strategy(returns_data)

    # Calculate momentum scores (cumulative returns over lookback period)
    recent_returns = returns_data.tail(lookback_days)
    momentum_scores = (1 + recent_returns).prod() - 1

    # Select top 50% performers
    top_performers = momentum_scores.nlargest(len(momentum_scores) // 2)

    # Equal weight among top performers
    weights = pd.Series(0, index=returns_data.columns)
    weights[top_performers.index] = 1 / len(top_performers)

    return weights


def mean_reversion_strategy(returns_data: pd.DataFrame, lookback_days: int = 30) -> pd.Series:
    """Mean reversion strategy"""
    if len(returns_data) < lookback_days:
        return equal_weight_strategy(returns_data)

    # Calculate recent performance
    recent_returns = returns_data.tail(lookback_days)
    recent_performance = (1 + recent_returns).prod() - 1

    # Select bottom 50% performers (mean reversion)
    bottom_performers = recent_performance.nsmallest(len(recent_performance) // 2)

    # Equal weight among bottom performers
    weights = pd.Series(0, index=returns_data.columns)
    weights[bottom_performers.index] = 1 / len(bottom_performers)

    return weights


def minimum_variance_strategy(returns_data: pd.DataFrame, min_periods: int = 60) -> pd.Series:
    """Minimum variance strategy"""
    if len(returns_data) < min_periods:
        return equal_weight_strategy(returns_data)

    # Use recent data for covariance estimation
    recent_data = returns_data.tail(min(252, len(returns_data)))  # Max 1 year
    cov_matrix = recent_data.cov()

    # Simple minimum variance (inverse volatility weighting)
    volatilities = recent_data.std()
    inv_vol_weights = 1 / volatilities
    weights = inv_vol_weights / inv_vol_weights.sum()

    return weights
