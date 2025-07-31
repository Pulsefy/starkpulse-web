# StarkPulse Distributed Content Validation Network

This system implements a distributed network for content validation, designed to maintain editorial independence while ensuring information accuracy through consensus mechanisms and reputation scoring.

## ✨ Features

### 🌐 Validation Network
-   **Distributed Validator Node System:** Supports multiple validator nodes (simulated within this application for demonstration) that review content.
-   **Consensus Mechanisms for Content Approval:** Implements a simplified voting-based consensus where content is approved if a configurable percentage of validators agree on its accuracy.
-   **Reputation-Based Validator Selection:** Selects validators for content review based on their reputation score, prioritizing more reliable participants.
-   **Slashing Mechanisms for Malicious Validators:** Reduces a validator's reputation score for incorrect votes or flagged malicious activity, discouraging bad behavior.

### 🔍 Content Verification
-   **Fact-Checking Algorithms (Simulated):** Provides a framework for integrating automated fact-checking. In this implementation, it's a simulated boolean outcome.
-   **Source Verification and Cross-Referencing (Conceptual):** The system allows for recording source URLs and comments, laying the groundwork for manual or automated source verification.
-   **Plagiarism Detection Systems (Simulated):** Includes a simulated plagiarism detection flag.
-   **Bias Detection and Neutrality Scoring (Simulated):** Incorporates a simulated bias score (0.0 to 1.0) to assess content neutrality.

### ⚖️ Editorial Independence
-   **Transparent Validation Processes:** All content submissions, validator votes, and consensus outcomes are logged and queryable via API.
-   **Conflict of Interest Detection (Conceptual):** Validator registration includes fields for organization and specialties, which can be used to implement conflict of interest checks.
-   **Editorial Board Governance Mechanisms (Conceptual):** The system provides endpoints for dispute resolution, which can be managed by an "editorial board."
-   **Appeals Process for Content Disputes:** Allows users or validators to submit disputes against content validation outcomes, which can then be reviewed and resolved.

## 🏗️ Architecture

-   **FastAPI**: High-performance web framework for the main API and validator node logic.
-   **PostgreSQL**: Robust relational database for storing content, validators, validation records, and disputes.
-   **SQLAlchemy**: Asynchronous ORM for database interactions.
-   **Redis**: Used for potential future caching or message queuing (currently not heavily utilized in this feature, but available).
-   **Pydantic**: For data validation and serialization.
-   **Structlog**: For structured, machine-readable logging.
-   **Prometheus Client**: For exposing application metrics.
-   **Asyncio**: For managing concurrent operations and background tasks (e.g., validator node monitoring loop).
-   **`httpx`**: For potential inter-node communication if validator nodes were separate processes.

## ⚙️ Setup and Installation

### Prerequisites
-   Python 3.9+
-   PostgreSQL database instance
-   Redis instance

### 1. Clone the repository
\`\`\`bash
git clone <repository_url>
cd starkpulse-web/apps/backend-api/feature-6-content-validation
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
Create a `.env` file in the `feature-6-content-validation` directory with the following variables:

\`\`\`env
# Database Configuration
VALIDATION_DATABASE_URL="postgresql+asyncpg://user:password@localhost/validation_db"

# Redis Configuration
VALIDATION_REDIS_HOST="localhost"
VALIDATION_REDIS_PORT="6379"
VALIDATION_REDIS_PASSWORD="" # Leave empty if no password
VALIDATION_REDIS_DB="4" # Use a dedicated DB for validation

# API Configuration
VALIDATION_API_HOST="0.0.0.0"
VALIDATION_API_PORT="8007"

# Monitoring
VALIDATION_PROMETHEUS_PORT="8009"
VALIDATION_ENABLE_METRICS="true"

# Logging
VALIDATION_LOG_LEVEL="INFO"
VALIDATION_LOG_FILE="logs/content_validation.log"

# Validation Network Parameters
MIN_VALIDATORS_PER_CONTENT="3" # Minimum validators required for content consensus
CONSENSUS_THRESHOLD_PERCENT="0.75" # 75% agreement for approval (e.g., 0.75 for 75%)
VALIDATION_TIMEOUT_SECONDS="3600" # 1 hour for validation process

# Reputation Scoring
INITIAL_REPUTATION="100.0"
REPUTATION_GAIN_ON_CORRECT_VOTE="1.0"
REPUTATION_LOSS_ON_INCORRECT_VOTE="5.0"
REPUTATION_LOSS_ON_MALICIOUS_ACTIVITY="20.0"
MIN_REPUTATION_FOR_SELECTION="50.0" # Minimum reputation for a validator to be selected

# Content Verification (Simplified thresholds)
PLAGIARISM_THRESHOLD="0.8" # 80% similarity for plagiarism (simulated)
BIAS_DETECTION_THRESHOLD="0.6" # 60% bias score (simulated)

# Validator Node Configuration (for this specific instance)
VALIDATOR_NODE_ID="validator_node_1"
VALIDATOR_NODE_API_URL="http://localhost:8007" # This node's own API URL
\`\`\`

### 5. Database Setup
Run the database setup script to create tables:
\`\`\`bash
python scripts/setup_database.py
\`\`\`

### 6. Generate Sample Data (Optional)
To populate your database with sample validators, content, and votes for testing:
\`\`\`bash
python scripts/generate_sample_data.py
\`\`\`

### 7. Run the API Server
\`\`\`bash
uvicorn main:app --host 0.0.0.0 --port 8007 --reload
\`\`\`
The API will be accessible at `http://localhost:8007`.
API documentation (Swagger UI) will be available at `http://localhost:8007/docs`.
Prometheus metrics will be available at `http://localhost:8007/metrics`.

**Note:** When you run `main.py`, a `ValidatorNode` instance will automatically start within the same process, register itself, and begin monitoring for content to validate. This simulates a single validator participating in the network.

## 📚 API Endpoints

### Content Endpoints

-   `POST /api/v1/content/submit` - Submit new content for validation.
-   `GET /api/v1/content/{content_uuid}` - Get content details by UUID.
-   `GET /api/v1/content` - Get content by validation status (e.g., `?status=PENDING`).

### Validator Endpoints

-   `POST /api/v1/validators/register` - Register a new validator node.
-   `GET /api/v1/validators/{validator_id}/reputation` - Get validator reputation score.
-   `GET /api/v1/validators` - Get all registered validators.

### Validation Vote Endpoints

-   `POST /api/v1/validation/vote` - Submit a validation vote for content.
-   `GET /api/v1/validation/records/{content_uuid}` - Get all validation records for a content item.

### Dispute Endpoints

-   `POST /api/v1/disputes/submit` - Submit a dispute for content validation.
-   `PUT /api/v1/disputes/{dispute_id}/resolve` - Resolve a content dispute.
-   `GET /api/v1/disputes` - Get all content disputes.

## 🧪 Testing

### Run Tests
\`\`\`bash
pytest tests/ -v --cov=core --cov-report=html
\`\`\`

### Test Coverage
-   Unit tests for `ReputationService` (registration, reputation updates, selection).
-   Unit tests for `ConsensusMechanism` (consensus evaluation, reputation updates based on consensus).
-   Unit tests for `ValidationService` (content submission, vote submission, dispute management).

### Sample Test Commands
\`\`\`bash
# Run all tests
pytest tests/ -v

# Run specific test file
pytest tests/test_reputation_service.py -v

# Run with coverage
pytest --cov=core --cov-report=term-missing
\`\`\`

## 📊 Monitoring and Metrics

### Prometheus Metrics

The system exposes comprehensive metrics at `/metrics`:

-   `api_requests_total`: Total API requests by method, endpoint, and status code.
-   `api_response_time_seconds`: Histogram for API response times.
-   Custom metrics can be added within services (e.g., `content_submitted_total`, `votes_submitted_total`, `reputation_score_gauge`).

### Health Checks

-   `/health` - API health status, including Redis and database connectivity.

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
