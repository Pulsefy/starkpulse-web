# StarkPulse Frontend ⚡🔒

StarkPulse is a cutting-edge, decentralized crypto news aggregator and portfolio management platform built on the StarkNet ecosystem. This repository contains the frontend application code.

## Overview

The StarkPulse frontend delivers a seamless user experience with a futuristic UI design, StarkNet wallet integration, and real-time data visualization. Built with Next.js and React, it provides a responsive and performant interface for interacting with the StarkPulse ecosystem.

## Key Features

- **Futuristic UI/UX** 🎨: Sleek, modern interface with animated components and responsive design
- **StarkNet Wallet Integration** 🔐: Seamless connection with StarkNet wallets for secure authentication
- **News Aggregation Dashboard** 📰: Real-time crypto news from multiple trusted sources
- **Portfolio Visualization** 📊: Interactive charts and metrics for tracking crypto assets
- **Transaction History** 🔍: Comprehensive view of on-chain activities
- **Community Engagement Tools** 👥: Rating, commenting, and content contribution features
- **Comprehensive Error Handling** 🚨: Robust error boundaries, recovery mechanisms, and user-friendly error messages

## Tech Stack

- **Next.js 14**: App router, server components, and streaming
- **React 18**: Component-based UI development
- **TypeScript**: Type-safe code
- **TailwindCSS**: Utility-first styling
- **Zustand**: State management
- **Starknet.js**: StarkNet blockchain interaction
- **Lucide**: Modern icon library
- **Recharts**: Responsive charting library

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm
- Git

### Installation

1. Clone the repository:

```bash
git clone https://github.com/Pulsefy/Starkpulse.git
cd starkpulse
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Access the application at <http://localhost:3000>

## Project Structure

```
starkpulse/
├── app/             # Next.js app router pages
├── components/      # Reusable UI components
├── docs/            # Documentation (including error handling)
├── hooks/           # Custom React hooks
├── lib/             # Utility functions and constants
├── public/          # Static assets
├── services/        # API and blockchain services
├── store/           # Zustand state management
├── styles/          # Global styles
└── types/           # TypeScript type definitions
```

## Scripts

- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm run start`: Start production server
- `npm run lint`: Run ESLint
- `npm run test`: Run tests

## Connecting to Backend

The frontend connects to the StarkPulse backend API for data fetching and blockchain interactions. See the backend repository for API documentation and setup instructions.

## Error Handling System

This application includes a comprehensive error handling system that provides:

- **Error Boundaries**: React error boundaries for graceful error recovery
- **Error Monitoring**: Real-time error tracking and reporting
- **User-Friendly Messages**: Clear error messages with recovery options
- **Retry Mechanisms**: Automatic and manual retry for failed operations
- **Error Analytics**: Error statistics and monitoring tools

### Error Handling Features

- ✅ Global error boundary for the entire application
- ✅ Page-level error boundaries for route-specific errors
- ✅ Component-level error boundaries for critical components
- ✅ Fallback UI components for different error scenarios
- ✅ Error logging and reporting system
- ✅ User-friendly error messages and recovery options
- ✅ Retry mechanisms for failed operations
- ✅ Network errors and API failures handling
- ✅ Global error handlers for unhandled promises
- ✅ Error tracking for wallet connection issues
- ✅ Error handling for blockchain transaction failures
- ✅ Error state management in Zustand stores
- ✅ Error page components (404, 500)
- ✅ Error toast notifications
- ✅ Loading error states for data fetching
- ✅ Error reporting service integration (optional)
- ✅ Error analytics and tracking
- ✅ Error boundary telemetry
- ✅ Error logs for development debugging

For detailed documentation, see [Error Handling Documentation](./docs/ERROR_HANDLING.md).

## Contributing

We welcome contributions to StarkPulse! Please follow these steps:

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add some amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Maintainers

- Divineifed1 👨‍💻
- Cedarich 👨‍💻

<p align="center">
  Built with ❤️ by the StarkPulse Team
</p>
