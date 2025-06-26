"""
StarkPulse Data Processing Module
"""

__version__ = "1.0.0"
__author__ = "StarkPulse Team"
__email__ = "dev@starkpulse.com"

from .config.settings import Settings
from .utils.logger import setup_logger

# Initialize default logger
logger = setup_logger(__name__)

__all__ = [
    "Settings",
    "setup_logger",
    "logger"
]
