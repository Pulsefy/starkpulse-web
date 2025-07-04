import numpy as np

def calculate_risk_metrics(df):
    df['daily_return'] = df['portfolio_value'].pct_change()
    cumulative_returns = (1 + df['daily_return']).cumprod()
    peak = cumulative_returns.cummax()
    drawdown = (cumulative_returns - peak) / peak
    max_drawdown = drawdown.min()

  
    var_95 = np.percentile(df['daily_return'].dropna(), 5)

    return {
        'Max Drawdown': max_drawdown * 100,
        'VaR 95%': var_95 * 100
    }