# StarkPulse API Testing Documentation

This document provides a comprehensive guide to the testing infrastructure and strategies used in the StarkPulse backend API.

## Table of Contents

1. [Testing Overview](#testing-overview)
2. [Test Structure](#test-structure)
3. [Unit Tests](#unit-tests)
4. [Integration Tests](#integration-tests)
5. [Performance Tests](#performance-tests)
6. [Mock Data Utilities](#mock-data-utilities)
7. [Test Coverage](#test-coverage)
8. [CI/CD Integration](#cicd-integration)
9. [Running Tests](#running-tests)

## Testing Overview

Our testing approach follows a comprehensive strategy with multiple layers:

- **Unit Tests**: Test individual components (controllers, services, models) in isolation
- **Integration Tests**: Test API endpoints and interactions between components
- **Performance Tests**: Evaluate system performance under various load conditions
- **Mock Data Generation**: Create consistent test data across all test types

## Test Structure

```bash
tests/
├── fixtures/           # Test data and mock utilities
├── integration/        # API endpoint tests
├── performance/        # Load and performance tests
├── unit/               # Individual component tests
├── setup.js            # Global test setup and configuration
└── README.md           # This documentation
```

## Unit Tests

Unit tests focus on testing individual components in isolation, with dependencies mocked. We use Jest and jest-mock-extended for mocking.

Key characteristics:

- Fast execution
- No database connections or external services
- High code coverage
- Clear failure diagnosis

Run unit tests with:

```bash
npm test -- --testMatch="<rootDir>/tests/unit/**/*.test.js"
```

## Integration Tests

Integration tests verify that different parts of the application work together correctly. They test API endpoints with a real MongoDB instance (in-memory) and mocked external services.

Key characteristics:

- Test complete request/response cycles
- Validate API contracts
- Ensure components integrate correctly
- Test error handling and edge cases

Run integration tests with:

```bash
npm test -- --testMatch="<rootDir>/tests/integration/**/*.test.js"
```

## Performance Tests

Performance tests evaluate how the system behaves under various load conditions. We use Artillery for performance testing.

Test scenarios include:

- Normal load
- Peak load
- Sustained high load
- Gradual traffic increase

Run performance tests with:

```bash
npx artillery run tests/performance/auth-performance.yml
```

Configure different environments using:

```bash
npx artillery run tests/performance/auth-performance.yml -e production|staging
```

## Mock Data Utilities

We provide extensive mock data utilities to create consistent test data across all test types. These utilities are available in `tests/fixtures/mockData.js`.

Available generators:

- `generateMockUser()`: Creates mock user data
- `generateAuthTokens()`: Creates mock authentication tokens
- `generateMockCryptoAssets()`: Creates mock cryptocurrency data
- `generateMockPortfolio()`: Creates mock user portfolio data
- `generateMockNewsArticles()`: Creates mock news articles

## Test Coverage

We maintain a high test coverage requirement (>90%) for all production code. Coverage reports are generated as part of the test process.

Generate a coverage report with:

```bash
npm run test:coverage
```

View the HTML report in `coverage/lcov-report/index.html`

## CI/CD Integration

Tests run automatically on:

- Pull requests to main/develop branches
- Direct pushes to main/develop branches

The CI/CD pipeline includes:

1. Unit tests
2. Integration tests
3. Coverage reporting
4. Performance tests (on pull requests)

## Running Tests

**All tests:**

```bash
npm test
```

**Unit tests only:**

```bash
npm test -- --testMatch="<rootDir>/tests/unit/**/*.test.js"
```

**Integration tests only:**

```bash
npm test -- --testMatch="<rootDir>/tests/integration/**/*.test.js"
```

**With coverage report:**

```bash
npm run test:coverage
```

**Performance tests:**

```bash
npx artillery run tests/performance/auth-performance.yml
```
