# Error Handling System Documentation

## Overview

This document describes the comprehensive error handling system implemented for the StarkPulse web application. The system provides graceful error recovery, user-friendly error messages, and proper error reporting to improve user experience and help with debugging and monitoring.

## Architecture

### Core Components

1. **Error Boundaries** (`components/error-boundary.tsx`)

   - React error boundaries for catching component errors
   - Fallback UI components for different error scenarios
   - Error reporting and recovery mechanisms

2. **Error Handler** (`lib/error-handler.ts`)

   - Centralized error handling utilities
   - Error logging and reporting system
   - Retry mechanisms with exponential backoff
   - Global error handlers for unhandled promises

3. **Error Store** (`store/error-store.ts`)

   - Zustand store for error state management
   - Error persistence and recovery
   - Error statistics and monitoring

4. **Error UI Components** (`components/ui/error-toast.tsx`)

   - Error toast notifications
   - Error fallback UI components
   - User-friendly error messages

5. **Error Pages** (`app/not-found.tsx`, `app/global-error.tsx`)
   - Custom 404 and 500 error pages
   - Navigation and recovery options

## Error Types

The system categorizes errors into the following types:

- **React**: Component rendering errors
- **Network**: Network connection and fetch errors
- **Wallet**: Wallet connection and transaction errors
- **Blockchain**: Smart contract and transaction errors
- **API**: API request and response errors
- **Unknown**: Unhandled errors

### Error Severity Levels

- **Critical**: Application-breaking errors
- **High**: Important errors that affect functionality
- **Medium**: Moderate errors with limited impact
- **Low**: Minor errors with minimal impact

## Usage

### Basic Error Boundary

```tsx
import { ErrorBoundary } from "@/components/error-boundary";

function MyComponent() {
  return (
    <ErrorBoundary
      errorMessage="Something went wrong"
      showRetry={true}
      showReport={true}
    >
      <YourComponent />
    </ErrorBoundary>
  );
}
```

### Specific Error Boundaries

```tsx
import {
  WalletErrorBoundary,
  BlockchainErrorBoundary,
  NetworkErrorBoundary,
} from "@/components/error-boundary-wrapper";

function WalletComponent() {
  return (
    <WalletErrorBoundary>
      <WalletConnect />
    </WalletErrorBoundary>
  );
}
```

### Error Handling Hooks

```tsx
import {
  useAsyncErrorHandler,
  useWalletErrorHandler,
} from "@/hooks/use-error-handling";

function MyComponent() {
  const { execute, isLoading, error } = useAsyncErrorHandler();
  const { handleWalletConnectionError } = useWalletErrorHandler();

  const handleAsyncOperation = async () => {
    const result = await execute(async () => {
      // Your async operation
      return await fetch("/api/data");
    });
  };

  const handleWalletError = (error: Error) => {
    handleWalletConnectionError(error, "argent");
  };
}
```

### Error Reporting

```tsx
import { errorHandler } from "@/lib/error-handler";

// Handle specific error types
errorHandler.handleNetworkError(error, { url: "/api/data", status: 500 });
errorHandler.handleWalletError(error, {
  walletType: "argent",
  action: "connect",
});
errorHandler.handleBlockchainError(error, { transactionHash: "0x123..." });
errorHandler.handleApiError(error, { endpoint: "/api/users", status: 400 });
```

## Error Recovery

### Automatic Recovery

The system automatically attempts to recover from certain types of errors:

- **Network errors**: Retry with exponential backoff
- **API errors**: Retry for 5xx errors, not for 4xx errors
- **Wallet connection errors**: Retry for connection timeouts

### Manual Recovery

Users can manually retry failed operations:

```tsx
import { useErrorRecovery } from "@/hooks/use-error-handling";

function ErrorComponent() {
  const { recoverFromError, retryFailedOperation } = useErrorRecovery();

  const handleRetry = async (errorId: string) => {
    const success = await recoverFromError(errorId);
    if (success) {
      console.log("Error recovered successfully");
    }
  };
}
```

## Error Monitoring

### Development Tools

In development mode, the system provides:

1. **Error Monitor** (`components/error-monitor.tsx`)

   - Real-time error dashboard
   - Error filtering and statistics
   - Manual recovery options

2. **Error Test Panel** (`components/error-test.tsx`)
   - Test error boundaries
   - Simulate different error types
   - Validate error handling

### Error Logging

Errors are logged to:

- **Console**: Detailed error information in development
- **localStorage**: Error logs for debugging
- **External services**: Configurable error reporting endpoints

### Error Statistics

```tsx
import { useErrorMonitoring } from "@/hooks/use-error-handling";

function ErrorStats() {
  const { getErrorStats, hasErrors, hasCriticalErrors } = useErrorMonitoring();
  const stats = getErrorStats();

  return (
    <div>
      <p>Total Errors: {stats.total}</p>
      <p>Critical Errors: {stats.critical}</p>
      <p>High Severity: {stats.high}</p>
    </div>
  );
}
```

## Configuration

### Error Handler Configuration

```tsx
import { errorHandler } from "@/lib/error-handler";

// Update configuration
errorHandler.updateConfig({
  enableReporting: true,
  enableLogging: true,
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
  errorReportingEndpoint: "https://your-error-service.com/api/errors",
});
```

### Error Store Configuration

```tsx
import { useErrorStore } from "@/store/error-store";

function configureErrorHandling() {
  const { setAutoRetry, setMaxRetries, setRetryDelay } = useErrorStore();

  setAutoRetry(true);
  setMaxRetries(5);
  setRetryDelay(2000);
}
```

## Best Practices

### 1. Use Appropriate Error Boundaries

- Wrap critical components with specific error boundaries
- Use global error boundary for the entire application
- Implement page-level error boundaries for route-specific errors

### 2. Handle Errors Gracefully

- Provide user-friendly error messages
- Offer recovery options when possible
- Don't expose technical details to users in production

### 3. Log Errors Properly

- Include relevant context with errors
- Use appropriate error types and severity levels
- Implement proper error reporting for production

### 4. Test Error Scenarios

- Test error boundaries with different error types
- Validate error recovery mechanisms
- Ensure error UI is accessible and user-friendly

### 5. Monitor Error Patterns

- Track error frequency and types
- Identify common error scenarios
- Implement preventive measures

## Testing

### Manual Testing

Use the Error Test Panel in development mode to:

1. Test error boundaries
2. Simulate different error types
3. Validate error recovery
4. Check error UI components

### Automated Testing

```tsx
// Test error boundary
import { render, screen } from "@testing-library/react";
import { ErrorBoundary } from "@/components/error-boundary";

test("error boundary catches errors", () => {
  const ThrowError = () => {
    throw new Error("Test error");
  };

  render(
    <ErrorBoundary>
      <ThrowError />
    </ErrorBoundary>
  );

  expect(screen.getByText("Something went wrong")).toBeInTheDocument();
});
```

## Troubleshooting

### Common Issues

1. **Error boundaries not catching errors**

   - Ensure error boundaries are properly nested
   - Check that errors are thrown in render or lifecycle methods

2. **Error recovery not working**

   - Verify error is retryable
   - Check retry configuration
   - Ensure proper error context

3. **Error logs not persisting**
   - Check localStorage availability
   - Verify error logging is enabled
   - Check browser storage limits

### Debug Mode

Enable debug mode for detailed error information:

```tsx
// In development, errors are logged with full context
console.log("Error logs:", errorHandler.getErrorLogs());
console.log("Error stats:", errorHandler.getErrorStats());
```

## Future Enhancements

1. **Error Analytics Dashboard**

   - Real-time error monitoring
   - Error trend analysis
   - Performance impact tracking

2. **Advanced Recovery Strategies**

   - Circuit breaker pattern
   - Fallback data sources
   - Graceful degradation

3. **Error Reporting Integration**

   - Sentry integration
   - Custom error reporting services
   - Error alerting system

4. **User Feedback System**
   - Error reporting from users
   - User error context collection
   - Feedback loop for error resolution

## Conclusion

The error handling system provides a robust foundation for managing errors in the StarkPulse application. It ensures users have a smooth experience even when errors occur, while providing developers with the tools needed to identify and resolve issues quickly.

For questions or issues with the error handling system, please refer to the development team or create an issue in the project repository.
