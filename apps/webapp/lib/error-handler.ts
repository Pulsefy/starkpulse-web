// Error handling utilities and types
export interface ErrorReport {
  id: string;
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  userAgent?: string;
  url?: string;
  userId?: string;
  walletAddress?: string;
  errorType: "react" | "network" | "wallet" | "blockchain" | "api" | "unknown";
  severity: "low" | "medium" | "high" | "critical";
  context?: Record<string, any>;
}

export interface ErrorHandlerConfig {
  enableReporting: boolean;
  enableLogging: boolean;
  enableRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  errorReportingEndpoint?: string;
}

// Default configuration
const defaultConfig: ErrorHandlerConfig = {
  enableReporting: true,
  enableLogging: true,
  enableRetry: true,
  maxRetries: 3,
  retryDelay: 1000,
};

class ErrorHandler {
  private config: ErrorHandlerConfig;
  private errorLogs: ErrorReport[] = [];
  private retryCounts: Map<string, number> = new Map();

  constructor(config: Partial<ErrorHandlerConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    this.initializeGlobalHandlers();
  }

  private initializeGlobalHandlers() {
    if (typeof window !== "undefined") {
      // Handle unhandled promise rejections
      window.addEventListener("unhandledrejection", (event) => {
        this.handleUnhandledRejection(event.reason);
      });

      // Handle global errors
      window.addEventListener("error", (event) => {
        this.handleGlobalError(event.error);
      });
    }
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create error report
  private createErrorReport(
    error: Error | string,
    errorType: ErrorReport["errorType"],
    severity: ErrorReport["severity"] = "medium",
    context?: Record<string, any>
  ): ErrorReport {
    const errorMessage = typeof error === "string" ? error : error.message;
    const errorStack = typeof error === "string" ? undefined : error.stack;

    return {
      id: this.generateErrorId(),
      message: errorMessage,
      stack: errorStack,
      timestamp: new Date().toISOString(),
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : undefined,
      url: typeof window !== "undefined" ? window.location.href : undefined,
      errorType,
      severity,
      context,
    };
  }

  // Handle React component errors
  handleReactError(error: Error, errorInfo?: { componentStack?: string }) {
    const report = this.createErrorReport(error, "react", "high", {
      componentStack: errorInfo?.componentStack,
    });

    this.logError(report);
    this.reportError(report);

    return report;
  }

  // Handle network/API errors
  handleNetworkError(
    error: Error,
    context?: { url?: string; method?: string; status?: number }
  ) {
    const severity = this.getNetworkErrorSeverity(context?.status);
    const report = this.createErrorReport(error, "network", severity, context);

    this.logError(report);
    this.reportError(report);

    return report;
  }

  // Handle wallet connection errors
  handleWalletError(
    error: Error,
    context?: { walletType?: string; action?: string }
  ) {
    const report = this.createErrorReport(error, "wallet", "high", context);

    this.logError(report);
    this.reportError(report);

    return report;
  }

  // Handle blockchain transaction errors
  handleBlockchainError(
    error: Error,
    context?: {
      transactionHash?: string;
      contractAddress?: string;
      method?: string;
      gasUsed?: string;
    }
  ) {
    const report = this.createErrorReport(
      error,
      "blockchain",
      "critical",
      context
    );

    this.logError(report);
    this.reportError(report);

    return report;
  }

  // Handle API errors
  handleApiError(
    error: Error,
    context?: {
      endpoint?: string;
      method?: string;
      status?: number;
      response?: any;
    }
  ) {
    const severity = this.getApiErrorSeverity(context?.status);
    const report = this.createErrorReport(error, "api", severity, context);

    this.logError(report);
    this.reportError(report);

    return report;
  }

  // Handle unhandled promise rejections
  private handleUnhandledRejection(reason: any) {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    const report = this.createErrorReport(error, "unknown", "critical", {
      unhandledRejection: true,
      reason: reason,
    });

    this.logError(report);
    this.reportError(report);
  }

  // Handle global errors
  private handleGlobalError(error: Error) {
    const report = this.createErrorReport(error, "unknown", "critical", {
      globalError: true,
    });

    this.logError(report);
    this.reportError(report);
  }

  // Log error to console and localStorage
  private logError(report: ErrorReport) {
    if (!this.config.enableLogging) return;

    // Console logging
    if (process.env.NODE_ENV === "development") {
      console.group(`🚨 ${report.errorType.toUpperCase()} Error`);
      console.log("Error ID:", report.id);
      console.log("Message:", report.message);
      console.log("Severity:", report.severity);
      console.log("Timestamp:", report.timestamp);
      if (report.context) {
        console.log("Context:", report.context);
      }
      if (report.stack) {
        console.log("Stack:", report.stack);
      }
      console.groupEnd();
    }

    // Store in localStorage for debugging
    if (typeof window !== "undefined") {
      this.errorLogs.push(report);
      // Keep only last 50 errors
      if (this.errorLogs.length > 50) {
        this.errorLogs = this.errorLogs.slice(-50);
      }
      localStorage.setItem(
        "starkpulse-error-logs",
        JSON.stringify(this.errorLogs)
      );
    }
  }

  // Report error to external service
  private async reportError(report: ErrorReport) {
    if (!this.config.enableReporting) return;

    try {
      if (this.config.errorReportingEndpoint) {
        await fetch(this.config.errorReportingEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(report),
        });
      }
    } catch (error) {
      console.error("Failed to report error:", error);
    }
  }

  // Get severity based on HTTP status code
  private getNetworkErrorSeverity(status?: number): ErrorReport["severity"] {
    if (!status) return "medium";

    if (status >= 500) return "high";
    if (status >= 400) return "medium";
    return "low";
  }

  // Get severity based on API status code
  private getApiErrorSeverity(status?: number): ErrorReport["severity"] {
    if (!status) return "medium";

    if (status >= 500) return "high";
    if (status === 429) return "medium"; // Rate limit
    if (status >= 400) return "medium";
    return "low";
  }

  // Retry mechanism for failed operations
  async withRetry<T>(
    operation: () => Promise<T>,
    operationId: string,
    maxRetries: number = this.config.maxRetries
  ): Promise<T> {
    if (!this.config.enableRetry) {
      return operation();
    }

    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          // Final attempt failed, log the error
          this.handleNetworkError(lastError, {
            url: operationId, // Use operationId as url for context
            method: "retry",
            status: 500,
          });
          throw lastError;
        }

        // Wait before retrying
        await this.delay(this.config.retryDelay * Math.pow(2, attempt));
      }
    }

    throw lastError!;
  }

  // Delay utility
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Get error logs
  getErrorLogs(): ErrorReport[] {
    return [...this.errorLogs];
  }

  // Clear error logs
  clearErrorLogs() {
    this.errorLogs = [];
    if (typeof window !== "undefined") {
      localStorage.removeItem("starkpulse-error-logs");
    }
  }

  // Get error statistics
  getErrorStats() {
    const stats = {
      total: this.errorLogs.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recent: this.errorLogs.slice(-10),
    };

    this.errorLogs.forEach((log) => {
      stats.byType[log.errorType] = (stats.byType[log.errorType] || 0) + 1;
      stats.bySeverity[log.severity] =
        (stats.bySeverity[log.severity] || 0) + 1;
    });

    return stats;
  }

  // Update configuration
  updateConfig(newConfig: Partial<ErrorHandlerConfig>) {
    this.config = { ...this.config, ...newConfig };
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler();

// Utility functions for common error scenarios
export const handleAsyncError = async <T>(
  promise: Promise<T>,
  context?: Record<string, any>
): Promise<{ data: T | null; error: ErrorReport | null }> => {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    const errorObj = error instanceof Error ? error : new Error(String(error));
    const report = errorHandler.handleNetworkError(errorObj, context);
    return { data: null, error: report };
  }
};

export const createErrorBoundary = (
  errorType: ErrorReport["errorType"] = "react"
) => {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    return errorHandler.handleReactError(error, errorInfo);
  };
};

// Error types for better type safety
export class NetworkError extends Error {
  constructor(message: string, public status?: number, public url?: string) {
    super(message);
    this.name = "NetworkError";
  }
}

export class WalletError extends Error {
  constructor(
    message: string,
    public walletType?: string,
    public action?: string
  ) {
    super(message);
    this.name = "WalletError";
  }
}

export class BlockchainError extends Error {
  constructor(
    message: string,
    public transactionHash?: string,
    public contractAddress?: string
  ) {
    super(message);
    this.name = "BlockchainError";
  }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public endpoint?: string,
    public response?: any
  ) {
    super(message);
    this.name = "ApiError";
  }
}
