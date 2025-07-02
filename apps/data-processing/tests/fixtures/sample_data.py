"""
Sample data for testing
"""

SAMPLE_CRYPTO_DATA = [
    {
        "symbol": "BTC",
        "name": "Bitcoin", 
        "price_usd": 45000.00,
        "volume_24h": 1000000
    },
    {
        "symbol": "ETH",
        "name": "Ethereum",
        "price_usd": 3000.00,
        "volume_24h": 500000
    }
]

SAMPLE_NEWS_DATA = [
    {
        "title": "Bitcoin reaches new highs",
        "url": "https://example.com/news1",
        "source": "CryptoNews",
        "published_at": "2024-01-01T12:00:00Z"
    }
]

SAMPLE_PORTFOLIO_DATA = {
    "user_id": "user123",
    "name": "My Portfolio",
    "positions": [
        {
            "symbol": "BTC",
            "quantity": 0.5,
            "average_cost": 40000.00
        }
    ]
}
