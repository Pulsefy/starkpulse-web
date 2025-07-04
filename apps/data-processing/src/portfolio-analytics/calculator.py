import pandas as pd

def calculate_portfolio_performance(df):
    df['daily_return'] = df['portfolio_value'].pct_change()
    total_return = (df['portfolio_value'].iloc[-1] / df['portfolio_value'].iloc[0]) - 1
    cagr = (1 + total_return) ** (252 / len(df)) - 1
    volatility = df['daily_return'].std() * (252 ** 0.5)
    sharpe_ratio = (df['daily_return'].mean() * 252) / volatility

    return {
        'Total Return': total_return * 100,
        'CAGR': cagr * 100,
        'Volatility': volatility * 100,
        'Sharpe Ratio': sharpe_ratio
    }