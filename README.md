# StarkPulse Web ⚡🔒

StarkPulse is a cutting-edge, decentralized crypto news aggregator and portfolio management platform built on the StarkNet ecosystem. This monorepo contains the complete web application stack including frontend, backend API, and data processing modules.

## 🎯 Overview

StarkPulse Web delivers a comprehensive ecosystem for cryptocurrency enthusiasts, featuring real-time news aggregation, portfolio management, and StarkNet blockchain integration. The platform combines a futuristic UI design with powerful backend services and intelligent data processing capabilities.

## 🏗️ Architecture

This repository is organized as a monorepo containing three main modules:

```
starkpulse-web/
├── frontend/           # Next.js frontend application
├── backend-api/        # Express.js backend API
└── data-processing/    # Python data processing module
```

## ✨ Key Features

- **Futuristic UI/UX** 🎨: Sleek, modern interface with animated components and responsive design
- **StarkNet Wallet Integration** 🔐: Seamless connection with StarkNet wallets for secure authentication
- **News Aggregation Dashboard** 📰: Real-time crypto news from multiple trusted sources
- **Portfolio Visualization** 📊: Interactive charts and metrics for tracking crypto assets
- **Transaction History** 🔍: Comprehensive view of on-chain activities
- **Community Engagement Tools** 👥: Rating, commenting, and content contribution features
- **RESTful API** 🚀: Robust backend services for data management
- **Intelligent Data Processing** 📊: Advanced crypto data aggregation and analytics

## 🛠️ Tech Stack

### Frontend

- **Next.js 14**: App router, server components, and streaming
- **React 18**: Component-based UI development
- **TypeScript**: Type-safe code
- **TailwindCSS**: Utility-first styling
- **Zustand**: State management
- **Starknet.js**: StarkNet blockchain interaction
- **Lucide**: Modern icon library
- **Recharts**: Responsive charting library

### Backend API

- **Node.js**: Runtime environment
- **Express.js 4.18.2**: Web framework
- **RESTful Architecture**: Clean API design
- **CORS Support**: Cross-origin resource sharing
- **Nodemon 3.0.1**: Development hot reload

### Data Processing

- **Python 3.9+**: Core processing language
- **Crypto Data Processing**: Market data aggregation
- **News Processing**: Content aggregation and analysis
- **Portfolio Analytics**: Performance tracking
- **StarkNet Integration**: Blockchain data processing

## 🚀 Getting Started

### Prerequisites

- **Node.js 18.0.0** or higher
- **Python 3.9** or higher
- **npm** package manager
- **pip** package manager
- **Git**

### Quick Start

1. **Clone the repository**:

```bash
git clone https://github.com/Pulsefy/Starkpulse-web.git
cd starkpulse-web
```

2. **Setup Frontend**:

```bash
cd frontend
npm install
npm run dev
```

Access at: <http://localhost:3000>

3. **Setup Backend API**:

```bash
cd backend-api
npm install
npm start
```

API available at: <http://localhost:8000>

4. **Setup Data Processing** (Optional):

```bash
cd data-processing
pip install -r requirements.txt
python main.py
```

## 📁 Module Details

### Frontend (`/frontend`)

The Next.js frontend application providing the user interface.

**Key Directories:**

- `app/` - Next.js app router pages
- `components/` - Reusable UI components
- `hooks/` - Custom React hooks
- `lib/` - Utility functions and constants
- `public/` - Static assets
- `providers/` - Context providers

**Scripts:**

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run test` - Run tests

### Backend API (`/backend-api`)

Express.js backend providing RESTful API services.

**Features:**

- Health monitoring endpoints
- Comprehensive error handling
- JSON request parsing
- Development hot reload

**Scripts:**

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon

### Data Processing (`/data-processing`)

Python module for cryptocurrency data processing and analysis.

**Processors:**

- `CryptoDataProcessor` - Market data aggregation
- `NewsProcessor` - News content processing
- `PortfolioProcessor` - Portfolio analytics
- `StarkNetProcessor` - Blockchain data processing

## 🔧 Development

### Environment Setup

1. **Frontend Environment**:
   - Copy `.env.example` to `.env.local` in the frontend directory
   - Configure environment variables as needed

2. **Data Processing Environment**:
   - Copy `.env.example` to `.env` in the data-processing directory
   - Configure API keys and database connections

### Running in Development

For full development setup, run all modules simultaneously:

```bash
# Terminal 1 - Frontend
cd frontend && npm run dev

# Terminal 2 - Backend API
cd backend-api && npm run dev

# Terminal 3 - Data Processing (Optional)
cd data-processing && python main.py
```

## 🚀 Deployment

Each module can be deployed independently:

- **Frontend**: Deploy to Vercel
- **Backend API**: Deploy to Railway
- **Data Processing**: Deploy to cloud functions or container services

## 🤝 Contributing

We welcome contributions to StarkPulse Web! Please follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow the existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure all modules work together seamlessly

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 👥 Maintainers

- **Divineifed1** 👨‍💻
- **Cedarich** 👨‍💻

## 🔗 Links

- [Frontend Documentation](./frontend/README.md)
- [Backend API Documentation](./backend-api/README.md)
- [Data Processing Documentation](./data-processing/README.md)
- [StarkNet Documentation](https://docs.starknet.io/)

---

<p align="center">
  Built with ❤️ by the StarkPulse Team
</p>

# Environment Configuration

This project uses environment variables for configuration. Copy `.env.example` to `.env.development`, `.env.staging`, or `.env.production` as needed and fill in the values.

## Variables

- `DB_HOST`: Database host
- `DB_PORT`: Database port
- `DB_USER`: Database user
- `DB_PASS`: Database password (keep secret!)
- `API_KEY`: API key for external services (keep secret!)
- `NODE_ENV`: Application environment (`development`, `staging`, `production`)
- `PORT`: Port the app runs on (default: 3000)

**Never commit real secrets to version control. Use `.env.example` as a template only.**
