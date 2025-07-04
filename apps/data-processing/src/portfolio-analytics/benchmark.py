import pandas as pd

def compare_to_benchmark(portfolio_df, benchmark_symbol): 
    benchmark_df = portfolio_df.copy()
    benchmark_df['benchmark_value'] = portfolio_df['portfolio_value'].iloc[0] * (1 + 0.0004).cumprod()
    benchmark_df['benchmark_return'] = benchmark_df['benchmark_value'].pct_change()

    port_return = portfolio_df['portfolio_value'].pct_change()
    bench_return = benchmark_df['benchmark_return']

    tracking_error = (port_return - bench_return).std() * (252 ** 0.5)
    relative_return = port_return.mean() - bench_return.mean()

    return {
        'Tracking Error': tracking_error * 100,
        'Relative Return': relative_return * 100
    }