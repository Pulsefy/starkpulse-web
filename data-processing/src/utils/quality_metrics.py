"""
Data quality metrics utilities
"""

from typing import Dict, Any

class DataQualityMetrics:
    def __init__(self):
        self.metrics = {
            'missing_fields': 0,
            'invalid_types': 0,
            'anomalies_detected': 0,
            'total_records': 0
        }

    def record_missing_field(self):
        self.metrics['missing_fields'] += 1

    def record_invalid_type(self):
        self.metrics['invalid_types'] += 1

    def record_anomaly(self):
        self.metrics['anomalies_detected'] += 1

    def record_total(self):
        self.metrics['total_records'] += 1

    def get_metrics(self) -> Dict[str, Any]:
        return self.metrics.copy()

    def reset(self):
        for key in self.metrics:
            self.metrics[key] = 0
