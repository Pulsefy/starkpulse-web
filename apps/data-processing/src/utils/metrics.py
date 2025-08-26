from prometheus_client import Counter, Gauge, Histogram

# Counter for the total number of articles processed, labeled by source
ARTICLES_PROCESSED_TOTAL = Counter(
    'articles_processed_total',
    'Total number of news articles processed',
    ['source']  # Example label: 'news_api' or 'rss_feed'
)

# Counter for errors encountered, labeled by error type
ERRORS_TOTAL = Counter(
    'errors_total',
    'Total number of errors encountered during processing',
    ['type']  # Example label: 'api_error' or 'database_error'
)

# Histogram to track the latency of external API calls
API_REQUEST_LATENCY = Histogram(
    'api_request_latency_seconds',
    'Latency of external API requests',
    ['api_name']  # Example label: 'NewsAPIClient'
)