from loader import load_prices
from analytics import (
    calculate_portfolio_value,
    calculate_daily_returns,
    calculate_cagr,
    calculate_sharpe_ratio,
    calculate_volatility,
    calculate_max_drawdown,
    compare_to_benchmark
)
from visualizer import plot_value_curve


if __name__ == '__main__':
   
    prices = load_prices('data/prices.csv')

   
    weights = {
        'AAPL': 0.4,
        'GOOG': 0.3,
        'MSFT': 0.3
    }

    portfolio_value = calculate_portfolio_value(prices[weights.keys()], weights)
    daily_returns = calculate_daily_returns(portfolio_value)

    print("CAGR:", calculate_cagr(portfolio_value))
    print("Volatility:", calculate_volatility(daily_returns))
    print("Sharpe Ratio:", calculate_sharpe_ratio(daily_returns))
    print("Max Drawdown:", calculate_max_drawdown(portfolio_value))

    
    if 'SPY' in prices.columns:
        benchmark = prices['SPY']
        comparison_df = compare_to_benchmark(portfolio_value, benchmark)
        plot_value_curve(comparison_df)