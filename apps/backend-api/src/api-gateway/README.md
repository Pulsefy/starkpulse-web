# StarkPulse Institutional-Grade API Gateway

This system provides a robust API gateway with enterprise-level features, including request routing, rate limiting, authentication, monitoring, and SLA management, designed for institutional clients with high-volume requirements and strict uptime guarantees.

## ✨ Features

### 🌐 Gateway Core Features
-   **Request Routing and Load Balancing:** Routes incoming requests to appropriate upstream services with a simple round-robin load balancing strategy.
-   **Comprehensive Rate Limiting and Throttling:** Implements a Redis-backed fixed-window rate limiting mechanism per API key, with configurable tiers (basic, premium, unlimited).
-   **API Versioning and Backward Compatibility:** Supports routing to different API versions based on path prefixes. Request/response transformation can be extended for complex compatibility needs.
-   **Request/Response Transformation:** Modifies request headers (e.g., adding `X-Gateway-Request-ID`) before forwarding to upstream services.

### 🏢 Enterprise Features
-   **SLA Monitoring and Enforcement (Conceptual):** Integrates with Prometheus metrics to track response times and error rates, providing data points for external SLA enforcement systems.
-   **Usage Analytics and Billing Integration (Conceptual):** Logs detailed API call metadata (API key, endpoint, response time, status) to structured logs, which can be consumed by analytics and billing platforms.
-   **API Key Management and Rotation:** Manages API keys and their associated rate limit tiers (for demonstration, in-memory; in production, use a secure vault/database).
-   **White-label API Documentation:** Leverages FastAPI's built-in Swagger UI/ReDoc for self-documenting APIs.

### 📊 Monitoring & Analytics
-   **Real-time API Performance Monitoring:** Exposes Prometheus metrics for total gateway requests, end-to-end response times, and upstream service performance (requests, response times, health status).
-   **Error Tracking and Alerting:** Utilizes `structlog` for structured, machine-readable logging of errors and critical events, facilitating easy integration with log aggregation and alerting systems.
-   **Usage Analytics and Reporting:** The collected metrics and logs provide a rich dataset for generating comprehensive usage reports and analytics.
-   **Capacity Planning and Scaling Metrics:** Key performance indicators (RPS, latency, error rates) are available for informed capacity planning and auto-scaling decisions.

## 🏗️ Architecture

-   **FastAPI**: High-performance web framework for building the API Gateway.
-   **`httpx`**: Asynchronous HTTP client for forwarding requests to upstream services.
-   **Redis**: Used for storing rate limit counters and API key configurations.
-   **Pydantic**: For data validation and serialization.
-   **Structlog**: For structured, machine-readable logging.
-   **Prometheus Client**: For exposing application metrics.
-   **Asyncio**: For managing concurrent operations and non-blocking I/O.

## ⚙️ Setup and Installation

### Prerequisites
-   Python 3.9+
-   Redis instance
-   (Optional) Running instances of the "Advanced Real-Time Data Streaming Infrastructure" (port 8002) and "Comprehensive Audit and Compliance System" (port 8003) if you want to test routing to them. For the caching system, it runs on port 8005.

### 1. Clone the repository
\`\`\`bash
git clone <repository_url>
cd starkpulse-web/apps/backend-api/feature-5-api-gateway
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
Create a `.env` file in the `feature-5-api-gateway` directory with the following variables:

\`\`\`env
# Gateway Core Configuration
GATEWAY_API_HOST="0.0.0.0"
GATEWAY_API_PORT="8000"

# Upstream Services Configuration (Example: map path prefixes to service URLs)
# Ensure these match the actual URLs of your running upstream services
UPSTREAM_PRODUCTS_V1="http://localhost:8005/api/v1/products" # From Caching & Optimization feature
UPSTREAM_AUDIT_V1="http://localhost:8003/api/v1/audit"     # From Audit & Compliance feature
UPSTREAM_NEWS_V1="http://localhost:8007/api/v1/news"       # Placeholder for a new service

# Redis Configuration for Rate Limiting and API Key storage
GATEWAY_REDIS_HOST="localhost"
GATEWAY_REDIS_PORT="6379"
GATEWAY_REDIS_PASSWORD="" # Leave empty if no password
GATEWAY_REDIS_DB="3" # Use a dedicated DB for gateway

# Monitoring
GATEWAY_PROMETHEUS_PORT="8008"
GATEWAY_ENABLE_METRICS="true"

# Logging
GATEWAY_LOG_LEVEL="INFO"
GATEWAY_LOG_FILE="logs/api_gateway.log"

# SLA Monitoring (conceptual thresholds)
SLA_MAX_RESPONSE_TIME_MS="500"
SLA_MAX_ERROR_RATE_PERCENT="1.0" # 1%
\`\`\`

**Note on API Keys:** The `config.py` file contains hardcoded API keys for demonstration. In a production environment, these should be managed securely (e.g., via environment variables, a secrets manager, or a dedicated API key management system).

### 5. Run the API Gateway Server
\`\`\`bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
\`\`\`
The API Gateway will be accessible at `http://localhost:8000`.
API documentation (Swagger UI) will be available at `http://localhost:8000/docs`.
Prometheus metrics will be available at `http://localhost:8000/metrics`.

## 📚 API Endpoints

The API Gateway acts as a reverse proxy. You will access your upstream services through the gateway's URL.

**Example Usage:**

To access the products endpoint (from the Caching & Optimization feature) through the gateway:

\`\`\`bash
# Get all products (using a basic API key)
curl -X GET "http://localhost:8000/api/products" \
     -H "X-API-Key: YOUR_BASIC_API_KEY"

# Get a specific product
curl -X GET "http://localhost:8000/api/products/1" \
     -H "X-API-Key: YOUR_PREMIUM_API_KEY"

# Create an audit log (from the Audit & Compliance feature)
curl -X POST "http://localhost:8000/api/audit/log" \
     -H "X-API-Key: YOUR_UNLIMITED_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
           "user_id": "gateway_test_user",
           "action": "access_gateway",
           "resource_type": "gateway",
           "resource_id": "request_123",
           "details": {"path": "/api/audit/log"}
         }'
\`\`\`

**Gateway Specific Endpoints:**

-   `GET /health` - Health check for the API Gateway itself.
-   `GET /metrics` - Prometheus metrics endpoint.

## 🧪 Testing

### Run Tests
\`\`\`bash
pytest tests/ -v --cov=core --cov-report=html
\`\`\`

### Test Coverage
-   Unit tests for `RateLimiter` (rate limit checks, status).
-   Unit tests for `AuthMiddleware` (API key authentication).
-   Unit tests for `APIRouter` (request routing, load balancing, error handling).

### Sample Test Commands
\`\`\`bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_rate_limiter.py -v

# Run with coverage
pytest --cov=core --cov-report=term-missing
\`\`\`

## 📊 Monitoring and Metrics

### Prometheus Metrics

The system exposes comprehensive metrics at `/metrics`:

-   `gateway_requests_total`: Total requests processed by the gateway (by method, path prefix, status code, API key).
-   `gateway_response_time_seconds`: Histogram for gateway end-to-end response times.
-   `upstream_requests_total`: Total requests sent to upstream services (by service name, URL, status code).
-   `upstream_response_time_seconds`: Histogram for upstream service response times.
-   `upstream_health_status`: Health status of upstream services (1=healthy, 0=unhealthy).
-   `gateway_rate_limit_exceeded_total`: Total requests rejected due to rate limiting.
-   `gateway_current_rate_limit_usage`: Current rate limit usage for a given key and endpoint.

### Health Checks

-   `/health` - API Gateway health status, including Redis connectivity.
-   Upstream service health checks (performed by the `APIRouter` before routing).

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
3.  Verify Redis and upstream service connectivity
4.  Open an issue with detailed information
