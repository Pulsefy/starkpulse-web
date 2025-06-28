import numpy as np
import pandas as pd

def calculate_portfolio_value(prices: pd.DataFrame, weights: dict) -> pd.Series:
    normalized = prices / prices.iloc[0]
    weighted = normalized * pd.Series(weights)
    portfolio_value = weighted.sum(axis=1)
    return portfolio_value

def calculate_daily_returns(portfolio_value: pd.Series) -> pd.Series:
    return portfolio_value.pct_change().dropna()

def calculate_cagr(portfolio_value: pd.Series) -> float:
    n_years = (portfolio_value.index[-1] - portfolio_value.index[0]).days / 365.25
    return (portfolio_value.iloc[-1] / portfolio_value.iloc[0]) ** (1 / n_years) - 1

def calculate_volatility(daily_returns: pd.Series) -> float:
    return daily_returns.std() * np.sqrt(252)

def calculate_sharpe_ratio(daily_returns: pd.Series, risk_free_rate: float = 0.01) -> float:
    excess_returns = daily_returns - (risk_free_rate / 252)
    return excess_returns.mean() / excess_returns.std() * np.sqrt(252)

def calculate_max_drawdown(portfolio_value: pd.Series) -> float:
    cumulative_max = portfolio_value.cummax()
    drawdown = (portfolio_value - cumulative_max) / cumulative_max
    return drawdown.min()

def compare_to_benchmark(portfolio_value: pd.Series, benchmark: pd.Series) -> pd.DataFrame:
    df = pd.DataFrame({
        'Portfolio': portfolio_value / portfolio_value.iloc[0],
        'Benchmark': benchmark / benchmark.iloc[0]
    })
    return df