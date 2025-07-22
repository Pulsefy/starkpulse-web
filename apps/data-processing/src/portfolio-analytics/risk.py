"""
Enhanced Portfolio Risk Metrics Module

This module provides comprehensive risk analysis capabilities including:
- Value at Risk (VaR) and Conditional VaR calculations
- Monte Carlo simulations for risk assessment
- Advanced drawdown analysis
- Risk-adjusted performance metrics
- Volatility modeling and forecasting
"""

import numpy as np
import pandas as pd
from scipy import stats
from scipy.optimize import minimize
from typing import Dict, List, Optional, Tuple, Union
import warnings
from datetime import datetime, timedelta
import asyncio
from concurrent.futures import ThreadPoolExecutor

warnings.filterwarnings('ignore')


class RiskMetricsCalculator:
    """
    Advanced risk metrics calculator with comprehensive VaR, CVaR, and Monte Carlo capabilities
    """

    def __init__(self, confidence_levels: List[float] = [0.95, 0.99],
                 monte_carlo_simulations: int = 10000):
        """
        Initialize the risk metrics calculator

        Args:
            confidence_levels: List of confidence levels for VaR calculations
            monte_carlo_simulations: Number of Monte Carlo simulations to run
        """
        self.confidence_levels = confidence_levels
        self.monte_carlo_simulations = monte_carlo_simulations
        self.executor = ThreadPoolExecutor(max_workers=4)

    def calculate_comprehensive_risk_metrics(self, returns: pd.Series,
                                           portfolio_value: pd.Series = None,
                                           benchmark_returns: pd.Series = None) -> Dict:
        """
        Calculate comprehensive risk metrics for a portfolio

        Args:
            returns: Daily returns series
            portfolio_value: Portfolio value series (optional)
            benchmark_returns: Benchmark returns for relative risk metrics

        Returns:
            Dictionary containing all risk metrics
        """
        if returns.empty:
            return self._get_empty_risk_metrics()

        # Clean data
        returns = returns.dropna()
        if len(returns) < 30:  # Need minimum data for meaningful calculations
            return self._get_empty_risk_metrics()

        risk_metrics = {}

        # Basic risk metrics
        risk_metrics.update(self._calculate_basic_risk_metrics(returns))

        # VaR and CVaR calculations
        risk_metrics.update(self._calculate_var_cvar(returns))

        # Monte Carlo VaR
        risk_metrics.update(self._calculate_monte_carlo_var(returns))

        # Drawdown analysis
        if portfolio_value is not None:
            risk_metrics.update(self._calculate_drawdown_metrics(portfolio_value))

        # Volatility analysis
        risk_metrics.update(self._calculate_volatility_metrics(returns))

        # Tail risk metrics
        risk_metrics.update(self._calculate_tail_risk_metrics(returns))

        # Relative risk metrics (if benchmark provided)
        if benchmark_returns is not None:
            risk_metrics.update(self._calculate_relative_risk_metrics(returns, benchmark_returns))

        return risk_metrics

    def _calculate_basic_risk_metrics(self, returns: pd.Series) -> Dict:
        """Calculate basic risk metrics"""
        return {
            'volatility_daily': returns.std(),
            'volatility_annualized': returns.std() * np.sqrt(252),
            'skewness': stats.skew(returns),
            'kurtosis': stats.kurtosis(returns),
            'downside_deviation': self._calculate_downside_deviation(returns),
            'upside_deviation': self._calculate_upside_deviation(returns),
            'semi_variance': self._calculate_semi_variance(returns)
        }

    def _calculate_var_cvar(self, returns: pd.Series) -> Dict:
        """Calculate Value at Risk and Conditional VaR using multiple methods"""
        var_metrics = {}

        for confidence_level in self.confidence_levels:
            alpha = 1 - confidence_level

            # Historical VaR
            var_historical = np.percentile(returns, alpha * 100)

            # Parametric VaR (assuming normal distribution)
            var_parametric = stats.norm.ppf(alpha, returns.mean(), returns.std())

            # Modified Cornish-Fisher VaR (accounts for skewness and kurtosis)
            var_cornish_fisher = self._calculate_cornish_fisher_var(returns, alpha)

            # Conditional VaR (Expected Shortfall)
            cvar = returns[returns <= var_historical].mean()

            confidence_str = f"{int(confidence_level * 100)}"
            var_metrics.update({
                f'var_historical_{confidence_str}': var_historical,
                f'var_parametric_{confidence_str}': var_parametric,
                f'var_cornish_fisher_{confidence_str}': var_cornish_fisher,
                f'cvar_{confidence_str}': cvar,
                f'var_ratio_{confidence_str}': abs(cvar / var_historical) if var_historical != 0 else 0
            })

        return var_metrics

    def _calculate_monte_carlo_var(self, returns: pd.Series) -> Dict:
        """Calculate VaR using Monte Carlo simulation"""
        # Fit distribution to returns
        mu = returns.mean()
        sigma = returns.std()
        skew = stats.skew(returns)
        kurt = stats.kurtosis(returns)

        # Generate random scenarios
        np.random.seed(42)  # For reproducibility

        # Use skewed normal distribution if significant skewness
        if abs(skew) > 0.5:
            simulated_returns = stats.skewnorm.rvs(
                a=skew, loc=mu, scale=sigma, size=self.monte_carlo_simulations
            )
        else:
            simulated_returns = np.random.normal(mu, sigma, self.monte_carlo_simulations)

        mc_metrics = {}
        for confidence_level in self.confidence_levels:
            alpha = 1 - confidence_level
            var_mc = np.percentile(simulated_returns, alpha * 100)
            cvar_mc = simulated_returns[simulated_returns <= var_mc].mean()

            confidence_str = f"{int(confidence_level * 100)}"
            mc_metrics.update({
                f'var_monte_carlo_{confidence_str}': var_mc,
                f'cvar_monte_carlo_{confidence_str}': cvar_mc
            })

        return mc_metrics

    def _calculate_drawdown_metrics(self, portfolio_value: pd.Series) -> Dict:
        """Calculate comprehensive drawdown analysis"""
        # Calculate running maximum
        running_max = portfolio_value.cummax()
        drawdown = (portfolio_value - running_max) / running_max

        # Maximum drawdown
        max_drawdown = drawdown.min()

        # Average drawdown
        avg_drawdown = drawdown[drawdown < 0].mean() if (drawdown < 0).any() else 0

        # Drawdown duration analysis
        drawdown_periods = self._analyze_drawdown_periods(drawdown)

        # Calmar ratio (annual return / max drawdown)
        annual_return = (portfolio_value.iloc[-1] / portfolio_value.iloc[0]) ** (252 / len(portfolio_value)) - 1
        calmar_ratio = annual_return / abs(max_drawdown) if max_drawdown != 0 else 0

        return {
            'max_drawdown': max_drawdown,
            'avg_drawdown': avg_drawdown,
            'max_drawdown_duration': drawdown_periods['max_duration'],
            'avg_drawdown_duration': drawdown_periods['avg_duration'],
            'current_drawdown': drawdown.iloc[-1],
            'calmar_ratio': calmar_ratio,
            'recovery_factor': annual_return / abs(max_drawdown) if max_drawdown != 0 else 0
        }

    def _calculate_volatility_metrics(self, returns: pd.Series) -> Dict:
        """Calculate advanced volatility metrics"""
        # Rolling volatility analysis
        rolling_vol_30 = returns.rolling(30).std() * np.sqrt(252)
        rolling_vol_90 = returns.rolling(90).std() * np.sqrt(252)

        # GARCH-like volatility clustering
        vol_clustering = self._calculate_volatility_clustering(returns)

        return {
            'volatility_30d': rolling_vol_30.iloc[-1] if len(rolling_vol_30) > 30 else returns.std() * np.sqrt(252),
            'volatility_90d': rolling_vol_90.iloc[-1] if len(rolling_vol_90) > 90 else returns.std() * np.sqrt(252),
            'volatility_clustering': vol_clustering,
            'volatility_persistence': self._calculate_volatility_persistence(returns)
        }

    def _calculate_tail_risk_metrics(self, returns: pd.Series) -> Dict:
        """Calculate tail risk and extreme value metrics"""
        # Extreme value analysis
        extreme_losses = returns[returns < np.percentile(returns, 5)]
        extreme_gains = returns[returns > np.percentile(returns, 95)]

        # Tail ratio
        tail_ratio = abs(extreme_gains.mean()) / abs(extreme_losses.mean()) if len(extreme_losses) > 0 else 0

        # Expected shortfall at different levels
        es_1 = returns[returns <= np.percentile(returns, 1)].mean()
        es_5 = returns[returns <= np.percentile(returns, 5)].mean()

        return {
            'tail_ratio': tail_ratio,
            'expected_shortfall_1pct': es_1,
            'expected_shortfall_5pct': es_5,
            'extreme_loss_frequency': len(extreme_losses) / len(returns),
            'extreme_gain_frequency': len(extreme_gains) / len(returns),
            'pain_index': self._calculate_pain_index(returns)
        }

    def _calculate_relative_risk_metrics(self, returns: pd.Series, benchmark_returns: pd.Series) -> Dict:
        """Calculate risk metrics relative to benchmark"""
        # Align series
        aligned_data = pd.DataFrame({'portfolio': returns, 'benchmark': benchmark_returns}).dropna()

        if len(aligned_data) < 30:
            return {}

        portfolio_ret = aligned_data['portfolio']
        benchmark_ret = aligned_data['benchmark']

        # Tracking error
        tracking_error = (portfolio_ret - benchmark_ret).std() * np.sqrt(252)

        # Information ratio
        excess_return = portfolio_ret.mean() - benchmark_ret.mean()
        information_ratio = (excess_return * 252) / tracking_error if tracking_error != 0 else 0

        # Beta calculation
        covariance = np.cov(portfolio_ret, benchmark_ret)[0, 1]
        benchmark_variance = benchmark_ret.var()
        beta = covariance / benchmark_variance if benchmark_variance != 0 else 0

        # Treynor ratio
        risk_free_rate = 0.02 / 252  # Assume 2% annual risk-free rate
        treynor_ratio = (portfolio_ret.mean() - risk_free_rate) / beta if beta != 0 else 0

        return {
            'tracking_error': tracking_error,
            'information_ratio': information_ratio,
            'beta': beta,
            'treynor_ratio': treynor_ratio * 252,  # Annualized
            'correlation_with_benchmark': portfolio_ret.corr(benchmark_ret)
        }

    # Helper methods
    def _calculate_downside_deviation(self, returns: pd.Series, target_return: float = 0) -> float:
        """Calculate downside deviation"""
        downside_returns = returns[returns < target_return]
        return np.sqrt(((downside_returns - target_return) ** 2).mean()) if len(downside_returns) > 0 else 0

    def _calculate_upside_deviation(self, returns: pd.Series, target_return: float = 0) -> float:
        """Calculate upside deviation"""
        upside_returns = returns[returns > target_return]
        return np.sqrt(((upside_returns - target_return) ** 2).mean()) if len(upside_returns) > 0 else 0

    def _calculate_semi_variance(self, returns: pd.Series, target_return: float = 0) -> float:
        """Calculate semi-variance (downside variance)"""
        downside_returns = returns[returns < target_return]
        return ((downside_returns - target_return) ** 2).mean() if len(downside_returns) > 0 else 0

    def _calculate_cornish_fisher_var(self, returns: pd.Series, alpha: float) -> float:
        """Calculate Cornish-Fisher VaR adjustment for skewness and kurtosis"""
        mu = returns.mean()
        sigma = returns.std()
        skew = stats.skew(returns)
        kurt = stats.kurtosis(returns)

        # Standard normal quantile
        z_alpha = stats.norm.ppf(alpha)

        # Cornish-Fisher adjustment
        cf_adjustment = (z_alpha +
                        (z_alpha**2 - 1) * skew / 6 +
                        (z_alpha**3 - 3*z_alpha) * kurt / 24 -
                        (2*z_alpha**3 - 5*z_alpha) * skew**2 / 36)

        return mu + sigma * cf_adjustment

    def _analyze_drawdown_periods(self, drawdown: pd.Series) -> Dict:
        """Analyze drawdown periods and durations"""
        # Find drawdown periods
        in_drawdown = drawdown < 0
        drawdown_periods = []

        start_idx = None
        for i, is_dd in enumerate(in_drawdown):
            if is_dd and start_idx is None:
                start_idx = i
            elif not is_dd and start_idx is not None:
                drawdown_periods.append(i - start_idx)
                start_idx = None

        # Handle case where drawdown continues to end
        if start_idx is not None:
            drawdown_periods.append(len(drawdown) - start_idx)

        if not drawdown_periods:
            return {'max_duration': 0, 'avg_duration': 0}

        return {
            'max_duration': max(drawdown_periods),
            'avg_duration': np.mean(drawdown_periods)
        }

    def _calculate_volatility_clustering(self, returns: pd.Series) -> float:
        """Calculate volatility clustering measure"""
        # Simple volatility clustering measure using autocorrelation of squared returns
        squared_returns = returns ** 2
        if len(squared_returns) > 1:
            return squared_returns.autocorr(lag=1)
        return 0

    def _calculate_volatility_persistence(self, returns: pd.Series) -> float:
        """Calculate volatility persistence using ARCH effects"""
        # Simple ARCH test - correlation between current and lagged squared returns
        squared_returns = returns ** 2
        if len(squared_returns) > 5:
            lagged_sq_returns = squared_returns.shift(1).dropna()
            current_sq_returns = squared_returns[1:]
            return current_sq_returns.corr(lagged_sq_returns)
        return 0

    def _calculate_pain_index(self, returns: pd.Series) -> float:
        """Calculate pain index (average of squared drawdowns)"""
        cumulative_returns = (1 + returns).cumprod()
        running_max = cumulative_returns.cummax()
        drawdown = (cumulative_returns - running_max) / running_max
        return (drawdown ** 2).mean()

    def _get_empty_risk_metrics(self) -> Dict:
        """Return empty risk metrics structure"""
        return {
            'volatility_daily': 0,
            'volatility_annualized': 0,
            'skewness': 0,
            'kurtosis': 0,
            'max_drawdown': 0,
            'var_historical_95': 0,
            'var_historical_99': 0,
            'cvar_95': 0,
            'cvar_99': 0
        }


# Legacy function for backward compatibility
def calculate_risk_metrics(df):
    """
    Legacy function for backward compatibility
    """
    calculator = RiskMetricsCalculator()

    if 'portfolio_value' not in df.columns:
        return calculator._get_empty_risk_metrics()

    df['daily_return'] = df['portfolio_value'].pct_change()
    returns = df['daily_return'].dropna()

    if len(returns) == 0:
        return calculator._get_empty_risk_metrics()

    # Calculate basic metrics for backward compatibility
    cumulative_returns = (1 + returns).cumprod()
    peak = cumulative_returns.cummax()
    drawdown = (cumulative_returns - peak) / peak
    max_drawdown = drawdown.min()

    var_95 = np.percentile(returns, 5)

    return {
        'Max Drawdown': max_drawdown * 100,
        'VaR 95%': var_95 * 100
    }