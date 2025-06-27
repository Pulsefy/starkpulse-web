"""
Anomaly detection utilities for data streams
"""

from typing import List, Dict, Any
import statistics

class AnomalyDetector:
    @staticmethod
    def detect_price_anomalies(prices: List[float], threshold: float = 3.0) -> List[int]:
        """
        Detect price anomalies using z-score method
        Args:
            prices: List of price values
            threshold: Z-score threshold for anomaly
        Returns:
            List of indices in prices that are anomalies
        """
        if len(prices) < 2:
            return []
        mean = statistics.mean(prices)
        stdev = statistics.stdev(prices)
        if stdev == 0:
            return []
        anomalies = []
        for i, price in enumerate(prices):
            z = abs((price - mean) / stdev)
            if z > threshold:
                anomalies.append(i)
        return anomalies

    @staticmethod
    def detect_outliers_iqr(values: List[float]) -> List[int]:
        """
        Detect outliers using the IQR method
        Args:
            values: List of numeric values
        Returns:
            List of indices in values that are outliers
        """
        if len(values) < 4:
            return []
        sorted_vals = sorted(values)
        q1 = statistics.median(sorted_vals[:len(sorted_vals)//2])
        q3 = statistics.median(sorted_vals[(len(sorted_vals)+1)//2:])
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        return [i for i, v in enumerate(values) if v < lower or v > upper]
