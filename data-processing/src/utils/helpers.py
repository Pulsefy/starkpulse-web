"""
Helper utility functions
"""

import re
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Union, Dict, Any, List
import hashlib
import json

def format_currency(amount: Union[float, Decimal], currency: str = 'USD') -> str:
    """
    Format currency amount for display
    
    Args:
        amount: Amount to format
        currency: Currency code
        
    Returns:
        Formatted currency string
    """
    try:
        return f"{float(amount):,.2f} {currency}"
    except (ValueError, TypeError):
        return f"0.00 {currency}"

def calculate_percentage_change(old_value: Union[float, Decimal], 
                              new_value: Union[float, Decimal]) -> Optional[float]:
    """
    Calculate percentage change between two values
    
    Args:
        old_value: Original value
        new_value: New value
        
    Returns:
        Percentage change or None if calculation not possible
    """
    try:
        old_val = float(old_value)
        new_val = float(new_value)
        
        if old_val == 0:
            return None
        
        change = ((new_val - old_val) / old_val) * 100
        return round(change, 4)
    except (ValueError, TypeError, ZeroDivisionError):
        return None

def parse_datetime(date_string: str) -> Optional[datetime]:
    """
    Parse datetime string with multiple format attempts
    
    Args:
        date_string: Date string to parse
        
    Returns:
        Parsed datetime or None if parsing fails
    """
    if not date_string:
        return None
    
    formats = [
        '%Y-%m-%dT%H:%M:%SZ',           # ISO format with Z
        '%Y-%m-%d %H:%M:%S',            # Standard format
        '%Y-%m-%d'                     # Date only
    ]
    
    for fmt in formats:
        try:
            parsed_dt = datetime.strptime(date_string, fmt)
            
            # Ensure timezone awareness
            if parsed_dt.tzinfo is None:
                parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)
            
            return parsed_dt
        except ValueError:
            continue
    
    return None

def generate_hash(data: Union[str, Dict, List]) -> str:
    """
    Generate SHA256 hash of data
    
    Args:
        data: Data to hash
        
    Returns:
        Hexadecimal hash string
    """
    if isinstance(data, (dict, list)):
        data_str = json.dumps(data, sort_keys=True, default=str)
    else:
        data_str = str(data)
    
    return hashlib.sha256(data_str.encode('utf-8')).hexdigest()

def chunk_list(lst: List[Any], chunk_size: int) -> List[List[Any]]:
    """
    Split list into chunks of specified size
    
    Args:
        lst: List to chunk
        chunk_size: Size of each chunk
        
    Returns:
        List of chunks
    """
    return [lst[i:i + chunk_size] for i in range(0, len(lst), chunk_size)]

def safe_divide(numerator: Union[float, Decimal], 
                denominator: Union[float, Decimal], 
                default: float = 0.0) -> float:
    """
    Safely divide two numbers, returning default if division by zero
    
    Args:
        numerator: Numerator
        denominator: Denominator
        default: Default value if division by zero
        
    Returns:
        Division result or default value
    """
    try:
        num = float(numerator)
        den = float(denominator)
        
        if den == 0:
            return default
        
        return num / den
    except (ValueError, TypeError):
        return default

def extract_domain(url: str) -> Optional[str]:
    """
    Extract domain from URL
    
    Args:
        url: URL to extract domain from
        
    Returns:
        Domain string or None if extraction fails
    """
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        return parsed.netloc.lower()
    except Exception:
        return None

def clean_text(text: str, remove_html: bool = True, 
               remove_extra_spaces: bool = True) -> str:
    """
    Clean and normalize text
    
    Args:
        text: Text to clean
        remove_html: Whether to remove HTML tags
        remove_extra_spaces: Whether to normalize whitespace
        
    Returns:
        Cleaned text
    """
    if not text:
        return ""
    
    cleaned = text
    
    # Remove HTML tags
    if remove_html:
        cleaned = re.sub(r'<[^>]+>', '', cleaned)
    
    # Remove extra whitespace
    if remove_extra_spaces:
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    
    return cleaned

def calculate_moving_average(values: List[Union[float, Decimal]], 
                           window: int) -> List[float]:
    """
    Calculate moving average of values
    
    Args:
        values: List of numeric values
        window: Window size for moving average
        
    Returns:
        List of moving average values
    """
    if len(values) < window:
        return []
    
    moving_averages = []
    for i in range(window - 1, len(values)):
        window_values = values[i - window + 1:i + 1]
        avg = sum(float(v) for v in window_values) / window
        moving_averages.append(round(avg, 8))
    
    return moving_averages

def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human readable format
    
    Args:
        size_bytes: Size in bytes
        
    Returns:
        Formatted size string
    """
    if size_bytes == 0:
        return "0B"
    
    size_names = ["B", "KB", "MB", "GB", "TB"]
    i = 0
    
    while size_bytes >= 1024 and i < len(size_names) - 1:
        size_bytes /= 1024.0
        i += 1
    
    return f"{size_bytes:.1f}{size_names[i]}"
