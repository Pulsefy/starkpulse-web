import pandas as pd

def load_prices(filepath: str) -> pd.DataFrame:
    try:
        df = pd.read_csv(filepath, parse_dates=['Date'], index_col='Date')
        df.sort_index(inplace=True)

        df.dropna(how='all', axis=0, inplace=True)

       
        df.fillna(method='ffill', inplace=True)

        return df
    except Exception as e:
        raise RuntimeError(f"Failed to load prices from {filepath}: {e}")
