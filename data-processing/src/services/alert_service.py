"""
Alert service for data anomalies and quality issues
"""

from typing import List
import logging

class AlertService:
    def __init__(self):
        self.logger = logging.getLogger("AlertService")

    def send_alert(self, message: str, tags: List[str] = None):
        # For now, just log the alert. Extend to email, Slack, etc. as needed.
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        self.logger.warning(f"ALERT{tag_str}: {message}")
