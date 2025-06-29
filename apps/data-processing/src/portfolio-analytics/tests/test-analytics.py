import unittest
import pandas as pd
import numpy as np
from analytics import *

class TestAnalytics(unittest.TestCase):
    def setUp(self):
        dates = pd.date_range(start='2022-01-01', periods=5)
        self.prices = pd.DataFrame({
            'AAPL': [100, 102, 104, 103, 105],
            'GOOG': [200, 202, 203, 205, 207],
        }, index=dates)
        self.weights = {'AAPL': 0.6, 'GOOG': 0.4}
        self.portfolio_value = calculate_portfolio_value(self.prices, self.weights)
        self.returns = calculate_daily_returns(self.portfolio_value)

    def test_portfolio_value_not_empty(self):
        self.assertGreater(len(self.portfolio_value), 0)

    def test_cagr_positive(self):
        self.assertGreaterEqual(calculate_cagr(self.portfolio_value), 0)

    def test_sharpe_ratio(self):
        sharpe = calculate_sharpe_ratio(self.returns)
        self.assertTrue(np.isfinite(sharpe))

if __name__ == '__main__':
    unittest.main()