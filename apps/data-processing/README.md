# StarkPulse Data Processing Module

A comprehensive and scalable data processing system for cryptocurrency data, news feeds, portfolio analytics, and StarkNet blockchain data.

## 🏗️ Project Structure

\`\`\`
data-processing/
├── src/
│   ├── config/              # Configuration management
│   ├── models/              # Data models
│   ├── services/            # Core services
│   ├── processors/          # Data processors
│   ├── utils/               # Utility functions
│   └── schedulers/          # Task scheduling
├── tests/
│   ├── unit/                # Unit tests
│   ├── integration/         # Integration tests
│   └── fixtures/            # Test fixtures
├── scripts/                 # Setup and migration scripts
├── logs/                    # Log files
└── docs/                    # Documentation
\`\`\`

## 🚀 Features

- **Cryptocurrency Data Processing**: Real-time price data, market metrics, and analytics
- **News Processing**: Automated news collection, sentiment analysis, and relevance scoring
- **Portfolio Analytics**: Portfolio tracking, performance calculations, and risk metrics
- **StarkNet Integration**: Blockchain data processing and DeFi protocol monitoring
- **Scalable Architecture**: Modular design with proper separation of concerns
- **Comprehensive Testing**: Unit and integration tests with high coverage
- **Automated Scheduling**: Background task processing with configurable intervals

## 📋 Requirements

- Python 3.8+
- PostgreSQL 12+
- Redis 6+
- Required API keys (CoinMarketCap, News API, etc.)

## 🛠️ Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd data-processing
   \`\`\`

2. **Create virtual environment**
   \`\`\`bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   \`\`\`

3. **Install dependencies**
   \`\`\`bash
   pip install -r requirements.txt
   pip install -r requirements-dev.txt  # For development
   \`\`\`

4. **Setup environment variables**
   \`\`\`bash
   cp .env.example .env

   # Edit .env with your configuration

   \`\`\`

5. **Initialize database**
   \`\`\`bash
   python scripts/setup.py
   \`\`\`

## 🔧 Configuration

Configure the application by setting environment variables in `.env`:

- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `COINMARKETCAP_API_KEY`: CoinMarketCap API key
- `NEWS_API_KEY`: News API key
- `STARKNET_RPC_URL`: StarkNet RPC endpoint

## 🏃 Usage

### Running the Main Application

\`\`\`bash
python main.py
\`\`\`

### Running Individual Processors

```python
from src.processors import CryptoDataProcessor

# Initialize and run crypto data processor
processor = CryptoDataProcessor(db_service, cache_service)
await processor.update_prices(['BTC', 'ETH'])
