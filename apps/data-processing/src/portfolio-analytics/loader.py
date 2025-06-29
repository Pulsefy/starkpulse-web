import pandas as pd

def load_prices(filepath: str) -> pd.DataFrame:
    df = pd.read_csv(filepath, parse_dates=['Date'], index_col='Date')
    df.sort_index(inplace=True)
    return df