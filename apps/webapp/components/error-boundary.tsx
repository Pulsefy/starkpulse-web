"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: any[];
  errorMessage?: string;
  showRetry?: boolean;
  showReport?: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });

    // Log error for debugging
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Report error to external service (if configured)
    this.reportError(error, errorInfo);

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state if resetKeys change
    if (this.state.hasError && this.props.resetKeys) {
      const prevKeys = JSON.stringify(prevProps.resetKeys);
      const currentKeys = JSON.stringify(this.props.resetKeys);

      if (prevKeys !== currentKeys) {
        this.setState({
          hasError: false,
          error: null,
          errorInfo: null,
          errorId: "",
        });
      }
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    const errorReport = {
      errorId: this.state.errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent:
        typeof window !== "undefined" ? window.navigator.userAgent : "server",
      url: typeof window !== "undefined" ? window.location.href : "server",
    };

    // In development, log to console
    if (process.env.NODE_ENV === "development") {
      console.group("🚨 Error Report");
      console.log("Error ID:", errorReport.errorId);
      console.log("Error:", errorReport);
      console.groupEnd();
    }

    // In production, you can send to error reporting service
    if (process.env.NODE_ENV === "production") {
      // Example: Send to error reporting service
      // this.sendToErrorService(errorReport);

      // For now, store in localStorage for debugging
      if (typeof window !== "undefined") {
        const errorLogs = JSON.parse(
          localStorage.getItem("error-logs") || "[]"
        );
        errorLogs.push(errorReport);
        localStorage.setItem(
          "error-logs",
          JSON.stringify(errorLogs.slice(-10))
        ); // Keep last 10 errors
      }
    }
  };

  private handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: "",
    });
  };

  private handleReport = () => {
    const { error, errorInfo, errorId } = this.state;
    if (!error) return;

    const errorReport = {
      errorId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "server",
    };

    // Copy to clipboard
    if (typeof window !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(errorReport, null, 2));
    }

    // Show toast notification
    if (typeof window !== "undefined") {
      // We'll handle this in the ErrorFallback component
      window.dispatchEvent(
        new CustomEvent("show-error-toast", {
          detail: { message: "Error report copied to clipboard" },
        })
      );
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          onRetry={this.handleRetry}
          onReport={this.handleReport}
          showRetry={this.props.showRetry ?? true}
          showReport={this.props.showReport ?? true}
          errorMessage={this.props.errorMessage}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  onRetry: () => void;
  onReport: () => void;
  showRetry: boolean;
  showReport: boolean;
  errorMessage?: string;
}

function ErrorFallback({
  error,
  errorInfo,
  errorId,
  onRetry,
  onReport,
  showRetry,
  showReport,
  errorMessage,
}: ErrorFallbackProps) {
  const { toast } = useToast();

  React.useEffect(() => {
    const handleShowToast = (event: CustomEvent) => {
      toast({
        title: "Error Report",
        description: event.detail.message,
        variant: "default",
      });
    };

    window.addEventListener(
      "show-error-toast",
      handleShowToast as EventListener
    );
    return () => {
      window.removeEventListener(
        "show-error-toast",
        handleShowToast as EventListener
      );
    };
  }, [toast]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-lg rounded-2xl p-8 border border-white/20 shadow-2xl">
        <div className="text-center">
          {/* Error Icon */}
          <div className="mx-auto w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
          </div>

          {/* Error Title */}
          <h1 className="text-2xl font-bold text-white mb-2">
            {errorMessage || "Something went wrong"}
          </h1>

          {/* Error ID */}
          <p className="text-gray-300 text-sm mb-4">Error ID: {errorId}</p>

          {/* Error Details (Development Only) */}
          {process.env.NODE_ENV === "development" && error && (
            <details className="text-left mb-6">
              <summary className="text-gray-300 cursor-pointer hover:text-white mb-2">
                Error Details
              </summary>
              <div className="bg-black/30 rounded-lg p-4 text-xs text-gray-300 font-mono overflow-auto max-h-40">
                <div className="mb-2">
                  <strong>Message:</strong> {error.message}
                </div>
                {error.stack && (
                  <div className="mb-2">
                    <strong>Stack:</strong>
                    <pre className="whitespace-pre-wrap">{error.stack}</pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <strong>Component Stack:</strong>
                    <pre className="whitespace-pre-wrap">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
              </div>
            </details>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {showRetry && (
              <Button
                onClick={onRetry}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Try Again
              </Button>
            )}

            {showReport && (
              <Button
                onClick={onReport}
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800 px-6 py-2 rounded-lg transition-colors"
              >
                Report Error
              </Button>
            )}
          </div>

          {/* Help Text */}
          <p className="text-gray-400 text-sm mt-6">
            If this problem persists, please contact support with the error ID
            above.
          </p>
        </div>
      </div>
    </div>
  );
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, "children">
) {
  return function WithErrorBoundary(props: P) {
    return (
      <ErrorBoundary {...errorBoundaryProps}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Hook for functional components to handle errors
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const handleError = React.useCallback((error: Error) => {
    console.error("Error caught by useErrorHandler:", error);
    setError(error);

    // Report error
    const errorReport = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      url: typeof window !== "undefined" ? window.location.href : "server",
    };

    if (process.env.NODE_ENV === "development") {
      console.group("🚨 useErrorHandler Error Report");
      console.log("Error:", errorReport);
      console.groupEnd();
    }
  }, []);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  return { error, handleError, clearError };
}
