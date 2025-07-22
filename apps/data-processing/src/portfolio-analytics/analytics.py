"""
Advanced Portfolio Performance Analytics Module

This module provides comprehensive performance analysis capabilities including:
- Risk-adjusted performance metrics (Sharpe, Sortino, Calmar, etc.)
- Return attribution analysis
- Performance benchmarking and comparison
- Rolling performance metrics
- Factor-based performance analysis
"""

import numpy as np
import pandas as pd
from scipy import stats
from typing import Dict, List, Optional, Tuple, Union
from datetime import datetime, timedelta
import warnings

warnings.filterwarnings('ignore')


class PerformanceAnalytics:
    """
    Comprehensive portfolio performance analytics calculator
    """

    def __init__(self, risk_free_rate: float = 0.02):
        """
        Initialize performance analytics calculator

        Args:
            risk_free_rate: Annual risk-free rate (default 2%)
        """
        self.risk_free_rate = risk_free_rate
        self.daily_rf_rate = risk_free_rate / 252

    def calculate_comprehensive_performance_metrics(self,
                                                  returns: pd.Series,
                                                  portfolio_value: pd.Series = None,
                                                  benchmark_returns: pd.Series = None,
                                                  factor_returns: pd.DataFrame = None) -> Dict:
        """
        Calculate comprehensive performance metrics

        Args:
            returns: Daily returns series
            portfolio_value: Portfolio value series (optional)
            benchmark_returns: Benchmark returns for comparison
            factor_returns: Factor returns for attribution analysis

        Returns:
            Dictionary containing all performance metrics
        """
        if returns.empty:
            return self._get_empty_performance_metrics()

        returns = returns.dropna()
        if len(returns) < 30:
            return self._get_empty_performance_metrics()

        performance_metrics = {}

        # Basic performance metrics
        performance_metrics.update(self._calculate_basic_performance_metrics(returns))

        # Risk-adjusted performance metrics
        performance_metrics.update(self._calculate_risk_adjusted_metrics(returns))

        # Rolling performance analysis
        performance_metrics.update(self._calculate_rolling_performance(returns))

        # Portfolio value based metrics
        if portfolio_value is not None:
            performance_metrics.update(self._calculate_value_based_metrics(portfolio_value))

        # Benchmark comparison metrics
        if benchmark_returns is not None:
            performance_metrics.update(self._calculate_benchmark_metrics(returns, benchmark_returns))

        # Factor attribution analysis
        if factor_returns is not None:
            performance_metrics.update(self._calculate_factor_attribution(returns, factor_returns))

        return performance_metrics

    def _calculate_basic_performance_metrics(self, returns: pd.Series) -> Dict:
        """Calculate basic performance metrics"""
        # Annualized metrics
        total_return = (1 + returns).prod() - 1
        n_years = len(returns) / 252
        annualized_return = (1 + total_return) ** (1 / n_years) - 1 if n_years > 0 else 0

        # Volatility
        volatility = returns.std() * np.sqrt(252)

        # Win rate and average win/loss
        positive_returns = returns[returns > 0]
        negative_returns = returns[returns < 0]

        win_rate = len(positive_returns) / len(returns) if len(returns) > 0 else 0
        avg_win = positive_returns.mean() if len(positive_returns) > 0 else 0
        avg_loss = negative_returns.mean() if len(negative_returns) > 0 else 0

        return {
            'total_return': total_return,
            'annualized_return': annualized_return,
            'volatility': volatility,
            'win_rate': win_rate,
            'avg_win': avg_win,
            'avg_loss': avg_loss,
            'profit_factor': abs(avg_win / avg_loss) if avg_loss != 0 else 0,
            'best_day': returns.max(),
            'worst_day': returns.min(),
            'positive_periods': len(positive_returns),
            'negative_periods': len(negative_returns)
        }

    def _calculate_risk_adjusted_metrics(self, returns: pd.Series) -> Dict:
        """Calculate risk-adjusted performance metrics"""
        excess_returns = returns - self.daily_rf_rate

        # Sharpe Ratio
        sharpe_ratio = (excess_returns.mean() * 252) / (returns.std() * np.sqrt(252)) if returns.std() != 0 else 0

        # Sortino Ratio (using downside deviation)
        downside_returns = returns[returns < self.daily_rf_rate]
        downside_deviation = downside_returns.std() * np.sqrt(252) if len(downside_returns) > 0 else 0
        sortino_ratio = (excess_returns.mean() * 252) / downside_deviation if downside_deviation != 0 else 0

        # Calmar Ratio (annual return / max drawdown)
        cumulative_returns = (1 + returns).cumprod()
        running_max = cumulative_returns.cummax()
        drawdown = (cumulative_returns - running_max) / running_max
        max_drawdown = abs(drawdown.min())
        calmar_ratio = (excess_returns.mean() * 252) / max_drawdown if max_drawdown != 0 else 0

        # Omega Ratio
        omega_ratio = self._calculate_omega_ratio(returns, self.daily_rf_rate)

        # Gain-to-Pain Ratio
        gain_to_pain = self._calculate_gain_to_pain_ratio(returns)

        # Modified Sharpe (accounting for skewness and kurtosis)
        modified_sharpe = self._calculate_modified_sharpe(returns)

        return {
            'sharpe_ratio': sharpe_ratio,
            'sortino_ratio': sortino_ratio,
            'calmar_ratio': calmar_ratio,
            'omega_ratio': omega_ratio,
            'gain_to_pain_ratio': gain_to_pain,
            'modified_sharpe_ratio': modified_sharpe,
            'downside_deviation': downside_deviation
        }

    def _calculate_rolling_performance(self, returns: pd.Series) -> Dict:
        """Calculate rolling performance metrics"""
        # Rolling Sharpe ratios
        rolling_30d_sharpe = self._calculate_rolling_sharpe(returns, 30)
        rolling_90d_sharpe = self._calculate_rolling_sharpe(returns, 90)
        rolling_252d_sharpe = self._calculate_rolling_sharpe(returns, 252)

        # Rolling volatility
        rolling_30d_vol = returns.rolling(30).std() * np.sqrt(252)
        rolling_90d_vol = returns.rolling(90).std() * np.sqrt(252)

        # Rolling returns
        rolling_30d_ret = returns.rolling(30).apply(lambda x: (1 + x).prod() - 1) * (252/30)
        rolling_90d_ret = returns.rolling(90).apply(lambda x: (1 + x).prod() - 1) * (252/90)

        return {
            'rolling_sharpe_30d_current': rolling_30d_sharpe.iloc[-1] if len(rolling_30d_sharpe) > 30 else 0,
            'rolling_sharpe_90d_current': rolling_90d_sharpe.iloc[-1] if len(rolling_90d_sharpe) > 90 else 0,
            'rolling_sharpe_252d_current': rolling_252d_sharpe.iloc[-1] if len(rolling_252d_sharpe) > 252 else 0,
            'rolling_sharpe_30d_avg': rolling_30d_sharpe.mean() if len(rolling_30d_sharpe) > 30 else 0,
            'rolling_vol_30d_current': rolling_30d_vol.iloc[-1] if len(rolling_30d_vol) > 30 else 0,
            'rolling_vol_90d_current': rolling_90d_vol.iloc[-1] if len(rolling_90d_vol) > 90 else 0,
            'rolling_return_30d_current': rolling_30d_ret.iloc[-1] if len(rolling_30d_ret) > 30 else 0,
            'rolling_return_90d_current': rolling_90d_ret.iloc[-1] if len(rolling_90d_ret) > 90 else 0
        }

    def _calculate_value_based_metrics(self, portfolio_value: pd.Series) -> Dict:
        """Calculate metrics based on portfolio value series"""
        # CAGR calculation
        n_years = (portfolio_value.index[-1] - portfolio_value.index[0]).days / 365.25
        cagr = (portfolio_value.iloc[-1] / portfolio_value.iloc[0]) ** (1 / n_years) - 1 if n_years > 0 else 0

        # Drawdown analysis
        running_max = portfolio_value.cummax()
        drawdown = (portfolio_value - running_max) / running_max
        max_drawdown = drawdown.min()

        # Recovery analysis
        recovery_periods = self._analyze_recovery_periods(portfolio_value)

        return {
            'cagr': cagr,
            'max_drawdown_value_based': max_drawdown,
            'current_drawdown': drawdown.iloc[-1],
            'avg_recovery_time': recovery_periods['avg_recovery_time'],
            'max_recovery_time': recovery_periods['max_recovery_time'],
            'time_underwater': recovery_periods['time_underwater']
        }

    def _calculate_benchmark_metrics(self, returns: pd.Series, benchmark_returns: pd.Series) -> Dict:
        """Calculate performance metrics relative to benchmark"""
        # Align series
        aligned_data = pd.DataFrame({'portfolio': returns, 'benchmark': benchmark_returns}).dropna()

        if len(aligned_data) < 30:
            return {}

        portfolio_ret = aligned_data['portfolio']
        benchmark_ret = aligned_data['benchmark']

        # Alpha and Beta
        excess_portfolio = portfolio_ret - self.daily_rf_rate
        excess_benchmark = benchmark_ret - self.daily_rf_rate

        beta = np.cov(excess_portfolio, excess_benchmark)[0, 1] / np.var(excess_benchmark) if np.var(excess_benchmark) != 0 else 0
        alpha = (excess_portfolio.mean() - beta * excess_benchmark.mean()) * 252

        # Information ratio
        active_return = portfolio_ret - benchmark_ret
        tracking_error = active_return.std() * np.sqrt(252)
        information_ratio = (active_return.mean() * 252) / tracking_error if tracking_error != 0 else 0

        # Up/Down capture ratios
        up_capture, down_capture = self._calculate_capture_ratios(portfolio_ret, benchmark_ret)

        return {
            'alpha': alpha,
            'beta': beta,
            'information_ratio': information_ratio,
            'tracking_error': tracking_error,
            'correlation': portfolio_ret.corr(benchmark_ret),
            'up_capture_ratio': up_capture,
            'down_capture_ratio': down_capture,
            'active_return': active_return.mean() * 252
        }

    def _calculate_factor_attribution(self, returns: pd.Series, factor_returns: pd.DataFrame) -> Dict:
        """Calculate factor-based attribution analysis"""
        # Simple factor model: R_p = alpha + beta_1*F_1 + ... + beta_n*F_n + epsilon
        aligned_data = pd.concat([returns, factor_returns], axis=1).dropna()

        if len(aligned_data) < 30:
            return {}

        y = aligned_data.iloc[:, 0]  # Portfolio returns
        X = aligned_data.iloc[:, 1:]  # Factor returns

        # Add constant for alpha
        X_with_const = np.column_stack([np.ones(len(X)), X])

        try:
            # OLS regression
            coefficients = np.linalg.lstsq(X_with_const, y, rcond=None)[0]
            alpha = coefficients[0] * 252  # Annualized alpha
            factor_betas = coefficients[1:]

            # R-squared
            y_pred = X_with_const @ coefficients
            ss_res = np.sum((y - y_pred) ** 2)
            ss_tot = np.sum((y - np.mean(y)) ** 2)
            r_squared = 1 - (ss_res / ss_tot) if ss_tot != 0 else 0

            factor_attribution = {
                'factor_alpha': alpha,
                'factor_r_squared': r_squared
            }

            # Add individual factor betas
            for i, factor_name in enumerate(X.columns):
                factor_attribution[f'beta_{factor_name}'] = factor_betas[i]

            return factor_attribution

        except np.linalg.LinAlgError:
            return {}

    # Helper methods
    def _calculate_omega_ratio(self, returns: pd.Series, threshold: float) -> float:
        """Calculate Omega ratio"""
        excess_returns = returns - threshold
        gains = excess_returns[excess_returns > 0].sum()
        losses = abs(excess_returns[excess_returns < 0].sum())
        return gains / losses if losses != 0 else 0

    def _calculate_gain_to_pain_ratio(self, returns: pd.Series) -> float:
        """Calculate Gain-to-Pain ratio"""
        gains = returns[returns > 0].sum()
        losses = abs(returns[returns < 0].sum())
        return gains / losses if losses != 0 else 0

    def _calculate_modified_sharpe(self, returns: pd.Series) -> float:
        """Calculate Modified Sharpe ratio (Pezier and White)"""
        excess_returns = returns - self.daily_rf_rate

        if len(excess_returns) < 30:
            return 0

        mean_excess = excess_returns.mean()
        std_excess = excess_returns.std()
        skew = stats.skew(excess_returns)
        kurt = stats.kurtosis(excess_returns)

        # Modified Sharpe adjustment
        sharpe = (mean_excess * 252) / (std_excess * np.sqrt(252)) if std_excess != 0 else 0

        # Adjustment factor for skewness and kurtosis
        adjustment = (1 + (skew / 6) * sharpe - ((kurt - 3) / 24) * sharpe**2)

        return sharpe * adjustment

    def _calculate_rolling_sharpe(self, returns: pd.Series, window: int) -> pd.Series:
        """Calculate rolling Sharpe ratio"""
        excess_returns = returns - self.daily_rf_rate
        rolling_mean = excess_returns.rolling(window).mean()
        rolling_std = returns.rolling(window).std()
        return (rolling_mean / rolling_std) * np.sqrt(252)

    def _analyze_recovery_periods(self, portfolio_value: pd.Series) -> Dict:
        """Analyze recovery periods from drawdowns"""
        running_max = portfolio_value.cummax()
        drawdown = (portfolio_value - running_max) / running_max

        # Find recovery periods
        recovery_periods = []
        in_drawdown = False
        drawdown_start = None

        for i, dd in enumerate(drawdown):
            if dd < 0 and not in_drawdown:
                in_drawdown = True
                drawdown_start = i
            elif dd >= 0 and in_drawdown:
                in_drawdown = False
                if drawdown_start is not None:
                    recovery_periods.append(i - drawdown_start)

        # Current time underwater
        current_underwater = 0
        if drawdown.iloc[-1] < 0:
            for i in range(len(drawdown) - 1, -1, -1):
                if drawdown.iloc[i] < 0:
                    current_underwater += 1
                else:
                    break

        return {
            'avg_recovery_time': np.mean(recovery_periods) if recovery_periods else 0,
            'max_recovery_time': max(recovery_periods) if recovery_periods else 0,
            'time_underwater': current_underwater
        }

    def _calculate_capture_ratios(self, portfolio_returns: pd.Series, benchmark_returns: pd.Series) -> Tuple[float, float]:
        """Calculate up and down capture ratios"""
        # Up capture ratio
        up_market = benchmark_returns > 0
        if up_market.sum() > 0:
            up_portfolio = portfolio_returns[up_market].mean()
            up_benchmark = benchmark_returns[up_market].mean()
            up_capture = up_portfolio / up_benchmark if up_benchmark != 0 else 0
        else:
            up_capture = 0

        # Down capture ratio
        down_market = benchmark_returns < 0
        if down_market.sum() > 0:
            down_portfolio = portfolio_returns[down_market].mean()
            down_benchmark = benchmark_returns[down_market].mean()
            down_capture = down_portfolio / down_benchmark if down_benchmark != 0 else 0
        else:
            down_capture = 0

        return up_capture, down_capture

    def _get_empty_performance_metrics(self) -> Dict:
        """Return empty performance metrics structure"""
        return {
            'total_return': 0,
            'annualized_return': 0,
            'volatility': 0,
            'sharpe_ratio': 0,
            'sortino_ratio': 0,
            'calmar_ratio': 0,
            'max_drawdown': 0,
            'win_rate': 0
        }


# Legacy functions for backward compatibility
def calculate_portfolio_value(prices: pd.DataFrame, weights: dict) -> pd.Series:
    """Legacy function for backward compatibility"""
    normalized = prices / prices.iloc[0]
    weighted = normalized * pd.Series(weights)
    portfolio_value = weighted.sum(axis=1)
    return portfolio_value

def calculate_daily_returns(portfolio_value: pd.Series) -> pd.Series:
    """Legacy function for backward compatibility"""
    return portfolio_value.pct_change().dropna()

def calculate_cagr(portfolio_value: pd.Series) -> float:
    """Legacy function for backward compatibility"""
    n_years = (portfolio_value.index[-1] - portfolio_value.index[0]).days / 365.25
    return (portfolio_value.iloc[-1] / portfolio_value.iloc[0]) ** (1 / n_years) - 1

def calculate_volatility(daily_returns: pd.Series) -> float:
    """Legacy function for backward compatibility"""
    return daily_returns.std() * np.sqrt(252)

def calculate_sharpe_ratio(daily_returns: pd.Series, risk_free_rate: float = 0.01) -> float:
    """Legacy function for backward compatibility"""
    excess_returns = daily_returns - (risk_free_rate / 252)
    return excess_returns.mean() / excess_returns.std() * np.sqrt(252)

def calculate_max_drawdown(portfolio_value: pd.Series) -> float:
    """Legacy function for backward compatibility"""
    cumulative_max = portfolio_value.cummax()
    drawdown = (portfolio_value - cumulative_max) / cumulative_max
    return drawdown.min()

def compare_to_benchmark(portfolio_value: pd.Series, benchmark: pd.Series) -> pd.DataFrame:
    """Legacy function for backward compatibility"""
    df = pd.DataFrame({
        'Portfolio': portfolio_value / portfolio_value.iloc[0],
        'Benchmark': benchmark / benchmark.iloc[0]
    })
    return df