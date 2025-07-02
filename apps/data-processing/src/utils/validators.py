"""
Data validation utilities
"""

import re
from typing import Optional, List, Dict, Any
from urllib.parse import urlparse
from datetime import datetime

def validate_email(email: str) -> bool:
    """
    Validate email address format
    
    Args:
        email: Email address to validate
        
    Returns:
        True if valid, False otherwise
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))

def validate_url(url: str) -> bool:
    """
    Validate URL format
    
    Args:
        url: URL to validate
        
    Returns:
        True if valid, False otherwise
    """
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False

def validate_crypto_symbol(symbol: str) -> bool:
    """
    Validate cryptocurrency symbol format
    
    Args:
        symbol: Crypto symbol to validate
        
    Returns:
        True if valid, False otherwise
    """
    if not symbol or not isinstance(symbol, str):
        return False
    
    # Symbol should be 2-10 characters, alphanumeric
    pattern = r'^[A-Z0-9]{2,10}$'
    return bool(re.match(pattern, symbol.upper()))

def validate_price_data(data: Dict[str, Any]) -> List[str]:
    """
    Validate price data structure
    
    Args:
        data: Price data dictionary
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    required_fields = ['price_usd', 'timestamp', 'cryptocurrency_id']
    
    for field in required_fields:
        if field not in data:
            errors.append(f"Missing required field: {field}")
    
    return errors

def validate_news_article(data: Dict[str, Any]) -> List[str]:
    """
    Validate news article data structure
    
    Args:
        data: News article dictionary
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    required_fields = ['title', 'url', 'published_at', 'source_id']
    
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate URL
    if 'url' in data and data['url']:
        if not validate_url(data['url']):
            errors.append("Invalid URL format")
    
    # Validate title length
    if 'title' in data and data['title']:
        if len(data['title']) > 500:
            errors.append("Title too long (max 500 characters)")
    
    return errors

def validate_portfolio_data(data: Dict[str, Any]) -> List[str]:
    """
    Validate portfolio data structure
    
    Args:
        data: Portfolio dictionary
        
    Returns:
        List of validation errors (empty if valid)
    """
    errors = []
    required_fields = ['user_id', 'name']
    
    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")
    
    # Validate name length
    if 'name' in data and data['name']:
        if len(data['name']) > 100:
            errors.append("Portfolio name too long (max 100 characters)")
    
    # Validate base currency
    if 'base_currency' in data and data['base_currency']:
        valid_currencies = ['USD', 'EUR', 'GBP', 'BTC', 'ETH']
        if data['base_currency'] not in valid_currencies:
            errors.append(f"Invalid base currency. Must be one of: {', '.join(valid_currencies)}")
    
    return errors

def sanitize_string(text: str, max_length: int = None) -> str:
    """
    Sanitize string input
    
    Args:
        text: Text to sanitize
        max_length: Maximum length to truncate to
        
    Returns:
        Sanitized string
    """
    if not text:
        return ""
    
    # Remove control characters
    sanitized = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', text)
    sanitized = re.sub(r'\s+', ' ', sanitized).strip()
    
    if max_length and len(sanitized) > max_length:
        sanitized = sanitized[:max_length].rstrip()
    
    return sanitized
