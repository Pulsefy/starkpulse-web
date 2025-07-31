# Blockchain Analytics and Intelligence Engine

## Overview
This engine provides institutional-grade analytics for on-chain activities, DeFi protocols, and market movements. It is designed for compliance, research, and investment decision-making.

## Features
### On-Chain Analysis
- Transaction flow analysis and visualization
- Address clustering and entity identification
- Smart contract interaction analysis
- MEV (Maximum Extractable Value) detection

### DeFi Intelligence
- Liquidity pool analysis and tracking
- Yield farming opportunity identification
- Protocol risk assessment tools
- Governance token analysis and voting patterns

### Market Intelligence
- Whale movement tracking and alerts
- Institutional flow analysis
- Market manipulation detection
- Cross-chain bridge monitoring

## API Endpoints
All endpoints are under `/analytics` (see `src/routes/analytics.js`).

### On-Chain
- `GET /analytics/onchain/transaction-flow?address=0x...`
- `GET /analytics/onchain/cluster-addresses?address=0x...`
- `GET /analytics/onchain/contract-interactions?address=0x...`
- `GET /analytics/onchain/mev?address=0x...`

### DeFi
- `GET /analytics/defi/liquidity-pools?protocol=...`
- `GET /analytics/defi/yield-farming?protocol=...`
- `GET /analytics/defi/protocol-risk?protocol=...`
- `GET /analytics/defi/governance?protocol=...`

### Market
- `GET /analytics/market/whale-movements`
- `GET /analytics/market/institutional-flows`
- `GET /analytics/market/manipulation`
- `GET /analytics/market/bridges`

## Extending
- Implement data fetching from blockchain providers (e.g., Infura, Alchemy, RPC nodes)
- Replace placeholders in `src/analytics/` with real analytics logic
- Add more endpoints as needed

## Testing
- See `tests/unit/analytics/` and `tests/integration/analytics/` for test coverage
- Performance and correctness are validated via automated tests
