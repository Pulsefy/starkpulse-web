# StarkPulse Advanced Caching and Performance Optimization System

This system implements a comprehensive multi-layer caching and performance optimization strategy to ensure institutional-grade response times and scalability for the StarkPulse platform.

## ✨ Features

### 🚀 Multi-Layer Caching
-   **Application-Level Caching (Redis):** Utilizes Redis as an in-memory data store for fast retrieval of frequently accessed data.
-   **Database Query Result Caching:** Caches results of common database queries to reduce database load and latency.
-   **CDN Integration (Conceptual):** Designed to work seamlessly with Content Delivery Networks for static content delivery (e.g., images, CSS, JS).
-   **Browser Caching Strategies:** Implements HTTP caching headers (`Cache-Control`, `ETag`) for client-side caching of API responses.

### 🧠 Intelligent Cache Management
-   **Smart Cache Invalidation:** Automatically invalidates relevant cache entries upon data modification (create, update, delete) to maintain data consistency.
-   **Cache Warming and Preloading:** Background tasks to proactively load frequently accessed or critical data into the cache, reducing initial load times.
-   **Cache Hit Ratio Monitoring:** Integrates Prometheus metrics to track cache performance (hits, misses, hit ratio).
-   **Cache Partitioning:** Uses distinct Redis key prefixes to logically separate different data types within the cache, improving organization and targeted invalidation.

### 📈 Performance Optimization
-   **Database Query Optimization:** Leverages SQLAlchemy's ORM with efficient query patterns and proper indexing on database tables.
-   **Connection Pooling:** SQLAlchemy's engine automatically manages database connection pools, reducing overhead for new connections.
-   **Load Balancing & Auto-Scaling (Deployment Level):** Designed to operate efficiently behind load balancers and within auto-scaling groups (e.g., Kubernetes, Vercel deployments).
-   **Performance Monitoring and Alerting:** Exposes Prometheus metrics for API response times, cache operations, and other key performance indicators.

## 🏗️ Architecture

-   **FastAPI**: High-performance web framework for building RESTful APIs.
-   **PostgreSQL (or SQLite for local dev)**: Relational database for persistent data storage.
-   **SQLAlchemy**: Asynchronous ORM for database interactions.
-   **Redis**: Primary caching layer for application and database query results.
-   **Pydantic**: For data validation and serialization.
-   **Structlog**: For structured, machine-readable logging.
-   **Prometheus Client**: For exposing application metrics.
-   **Asyncio**: For managing concurrent operations and background tasks (e.g., cache warming).

## ⚙️ Setup and Installation

### Prerequisites
-   Python 3.9+
-   Redis instance
-   PostgreSQL database instance (or SQLite for quick local setup)

### 1. Clone the repository
\`\`\`bash
git clone <repository_url>
cd starkpulse-web/apps/backend-api/feature-4-caching-optimization
\`\`\`

### 2. Create a Python Virtual Environment
\`\`\`bash
python3 -m venv venv
source venv/bin/activate
\`\`\`

### 3. Install Dependencies
\`\`\`bash
pip install -r requirements.txt
\`\`\`

### 4. Environment Variables
Create a `.env` file in the `feature-4-caching-optimization` directory with the following variables:

\`\`\`env
# Redis Configuration
CACHING_REDIS_HOST="localhost"
CACHING_REDIS_PORT="6379"
CACHING_REDIS_PASSWORD="" # Leave empty if no password
CACHING_REDIS_DB="2" # Use a dedicated DB for caching

# Cache TTLs (Time To Live in seconds)
CACHING_DEFAULT_TTL="300" # 5 minutes
CACHING_LONG_TTL="3600" # 1 hour
CACHING_SHORT_TTL="60" # 1 minute

# Cache Warming/Preloading
CACHING_WARMING_INTERVAL="300" # Every 5 minutes

# API Configuration
CACHING_API_HOST="0.0.0.0"
CACHING_API_PORT="8005"

# Monitoring
CACHING_PROMETHEUS_PORT="8006"
CACHING_ENABLE_METRICS="true"

# Logging
CACHING_LOG_LEVEL="INFO"
CACHING_LOG_FILE="logs/caching_optimization.log"
\`\`\`

### 5. Database Setup
Run the database setup script to create tables (e.g., `products` table):
\`\`\`bash
python scripts/setup_database.py
\`\`\`

### 6. Generate Sample Data (Optional)
To populate your database with sample products for testing:
\`\`\`bash
python scripts/generate_sample_data.py
\`\`\`

### 7. Run the API Server
\`\`\`bash
uvicorn main:app --host 0.0.0.0 --port 8005 --reload
\`\`\`
The API will be accessible at `http://localhost:8005`.
API documentation (Swagger UI) will be available at `http://localhost:8005/docs`.
Prometheus metrics will be available at `http://localhost:8005/metrics`.

## 📚 API Endpoints

### Product Endpoints (with caching)

-   `POST /api/v1/products` - Create a new product.
-   `GET /api/v1/products` - Get all products (cached, with browser caching headers).
-   `GET /api/v1/products/{product_id}` - Get product by ID (cached, with browser caching headers).
-   `PUT /api/v1/products/{product_id}` - Update a product (invalidates relevant caches).
-   `DELETE /api/v1/products/{product_id}` - Delete a product (invalidates relevant caches).

### Cache Management Endpoints

-   `POST /api/v1/cache/invalidate` - Invalidate cache by pattern (e.g., `product:*`).
-   `POST /api/v1/cache/warm` - Manually trigger cache warming for products.
-   `GET /api/v1/cache/stats` - Get overall cache statistics (hits, misses, memory usage).

## 🧪 Testing

### Run Tests
\`\`\`bash
pytest tests/ -v --cov=core --cov=services --cov-report=html
\`\`\`

### Test Coverage
-   Unit tests for `CacheService` (get, set, delete, invalidate, decorator).
-   Integration tests for `ProductService` demonstrating caching and invalidation.

### Sample Test Commands
\`\`\`bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_cache_service.py -v

# Run with coverage
pytest --cov=core --cov=services --cov-report=term-missing
\`\`\`

## 📊 Monitoring and Metrics

### Prometheus Metrics

The system exposes comprehensive metrics at `/metrics`:

-   `cache_hits_total` / `cache_misses_total`: Total cache hits/misses by cache name and key prefix.
-   `cache_set_operations_total` / `cache_delete_operations_total`: Total cache write/delete operations.
-   `cache_item_count`: Number of items currently in cache.
-   `cache_operation_duration_seconds`: Histogram for cache operation latencies.
-   `api_requests_total`: Total API requests by method, endpoint, and status code.
-   `api_response_time_seconds`: Histogram for API response times.

### Health Checks

-   `/health` - API health status.
-   Redis connectivity check (implicitly part of cache operations).

## 🤝 Contributing

1.  Fork the repository
2.  Create a feature branch
3.  Add comprehensive tests
4.  Ensure compliance with security standards
5.  Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For issues and questions:
1.  Check the troubleshooting section
2.  Review the logs
3.  Verify Redis and database connectivity
4.  Open an issue with detailed information
