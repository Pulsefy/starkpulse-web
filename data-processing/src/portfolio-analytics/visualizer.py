import matplotlib.pyplot as plt
import pandas as pd

def plot_value_curve(df: pd.DataFrame, title: str = 'Portfolio vs Benchmark'):
    df.plot(figsize=(10, 6))
    plt.title(title)
    plt.ylabel('Normalized Value')
    plt.grid(True)
    plt.show()
