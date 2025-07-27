"use client";

import { useCallback, useState } from "react";
import { useErrorActions, useErrorSelectors } from "@/store/error-store";
import {
  errorHandler,
  handleAsyncError,
  ErrorReport,
} from "@/lib/error-handler";
import { useErrorToast } from "@/components/ui/error-toast";

// Hook for handling async operations with error handling
export function useAsyncErrorHandler<T = any>() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorReport | null>(null);
  const {
    handleNetworkError,
    handleApiError,
    handleWalletError,
    handleBlockchainError,
  } = useErrorActions();
  const { showErrorToast } = useErrorToast();

  const execute = useCallback(
    async (
      operation: () => Promise<T>,
      context?: Record<string, any>
    ): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await operation();
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const report = errorHandler.handleNetworkError(errorObj, context);

        setError(report);
        showErrorToast(report);

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [showErrorToast]
  );

  const executeWithRetry = useCallback(
    async (
      operation: () => Promise<T>,
      operationId: string,
      context?: Record<string, any>
    ): Promise<T | null> => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await errorHandler.withRetry(operation, operationId);
        return result;
      } catch (err) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        const report = errorHandler.handleNetworkError(errorObj, context);

        setError(report);
        showErrorToast(report);

        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [showErrorToast]
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    execute,
    executeWithRetry,
    isLoading,
    error,
    clearError,
  };
}

// Hook for handling wallet-specific errors
export function useWalletErrorHandler() {
  const { handleWalletError } = useErrorActions();
  const { showErrorToast } = useErrorToast();

  const handleWalletConnectionError = useCallback(
    (error: Error, walletType?: string) => {
      const report = errorHandler.handleWalletError(error, {
        walletType,
        action: "connect",
      });
      handleWalletError(error, { walletType, action: "connect" });
      showErrorToast(report);
      return report;
    },
    [handleWalletError, showErrorToast]
  );

  const handleWalletTransactionError = useCallback(
    (error: Error, transactionHash?: string) => {
      const report = errorHandler.handleWalletError(error, {
        action: "transaction",
      });
      handleWalletError(error, { action: "transaction" });
      showErrorToast(report);
      return report;
    },
    [handleWalletError, showErrorToast]
  );

  const handleWalletSignError = useCallback(
    (error: Error) => {
      const report = errorHandler.handleWalletError(error, { action: "sign" });
      handleWalletError(error, { action: "sign" });
      showErrorToast(report);
      return report;
    },
    [handleWalletError, showErrorToast]
  );

  return {
    handleWalletConnectionError,
    handleWalletTransactionError,
    handleWalletSignError,
  };
}

// Hook for handling blockchain-specific errors
export function useBlockchainErrorHandler() {
  const { handleBlockchainError } = useErrorActions();
  const { showErrorToast } = useErrorToast();

  const handleTransactionError = useCallback(
    (error: Error, transactionHash?: string, contractAddress?: string) => {
      const report = errorHandler.handleBlockchainError(error, {
        transactionHash,
        contractAddress,
        method: "transaction",
      });
      handleBlockchainError(error, {
        transactionHash,
        contractAddress,
        method: "transaction",
      });
      showErrorToast(report);
      return report;
    },
    [handleBlockchainError, showErrorToast]
  );

  const handleContractError = useCallback(
    (error: Error, contractAddress?: string, method?: string) => {
      const report = errorHandler.handleBlockchainError(error, {
        contractAddress,
        method,
      });
      handleBlockchainError(error, {
        contractAddress,
        method,
      });
      showErrorToast(report);
      return report;
    },
    [handleBlockchainError, showErrorToast]
  );

  return {
    handleTransactionError,
    handleContractError,
  };
}

// Hook for handling API errors
export function useApiErrorHandler() {
  const { handleApiError } = useErrorActions();
  const { showErrorToast } = useErrorToast();

  const handleApiRequestError = useCallback(
    (error: Error, endpoint?: string, method?: string, status?: number) => {
      const report = errorHandler.handleApiError(error, {
        endpoint,
        method,
        status,
      });
      handleApiError(error, { endpoint, method, status });
      showErrorToast(report);
      return report;
    },
    [handleApiError, showErrorToast]
  );

  const handleApiResponseError = useCallback(
    (error: Error, response?: any, endpoint?: string) => {
      const report = errorHandler.handleApiError(error, { response, endpoint });
      handleApiError(error, { response, endpoint });
      showErrorToast(report);
      return report;
    },
    [handleApiError, showErrorToast]
  );

  return {
    handleApiRequestError,
    handleApiResponseError,
  };
}

// Hook for handling network errors
export function useNetworkErrorHandler() {
  const { handleNetworkError } = useErrorActions();
  const { showErrorToast } = useErrorToast();

  const handleFetchError = useCallback(
    (error: Error, url?: string, method?: string, status?: number) => {
      const report = errorHandler.handleNetworkError(error, {
        url,
        method,
        status,
      });
      handleNetworkError(error, { url, method, status });
      showErrorToast(report);
      return report;
    },
    [handleNetworkError, showErrorToast]
  );

  const handleConnectionError = useCallback(
    (error: Error) => {
      const report = errorHandler.handleNetworkError(error, {
        url: "connection",
      });
      handleNetworkError(error, { url: "connection" });
      showErrorToast(report);
      return report;
    },
    [handleNetworkError, showErrorToast]
  );

  return {
    handleFetchError,
    handleConnectionError,
  };
}

// Hook for error recovery
export function useErrorRecovery() {
  const { attemptRecovery, retryOperation } = useErrorActions();
  const { errors, retryInProgress } = useErrorSelectors();
  const { showErrorToast } = useErrorToast();

  const recoverFromError = useCallback(
    async (errorId: string) => {
      const success = await attemptRecovery(errorId);
      if (success) {
        showErrorToast({
          id: "recovery-success",
          message: "Error recovered successfully",
          timestamp: new Date().toISOString(),
          errorType: "unknown",
          severity: "low",
        });
      }
      return success;
    },
    [attemptRecovery, showErrorToast]
  );

  const retryFailedOperation = useCallback(
    async (operationId: string, operation: () => Promise<any>) => {
      try {
        const result = await retryOperation(operationId, operation);
        showErrorToast({
          id: "retry-success",
          message: "Operation completed successfully",
          timestamp: new Date().toISOString(),
          errorType: "unknown",
          severity: "low",
        });
        return result;
      } catch (error) {
        // Error will be handled by the retry mechanism
        throw error;
      }
    },
    [retryOperation, showErrorToast]
  );

  return {
    recoverFromError,
    retryFailedOperation,
    retryInProgress,
    recoverableErrors: errors.filter(
      (error) => error.errorType === "network" || error.errorType === "api"
    ),
  };
}

// Hook for error monitoring and analytics
export function useErrorMonitoring() {
  const { errors } = useErrorSelectors();

  const getErrorStats = useCallback(() => {
    const stats = {
      total: errors.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
      recent: errors.slice(-10),
      critical: errors.filter((e) => e.severity === "critical").length,
      high: errors.filter((e) => e.severity === "high").length,
    };

    errors.forEach((error) => {
      stats.byType[error.errorType] = (stats.byType[error.errorType] || 0) + 1;
      stats.bySeverity[error.severity] =
        (stats.bySeverity[error.severity] || 0) + 1;
    });

    return stats;
  }, [errors]);

  const getErrorsByType = useCallback(
    (type: ErrorReport["errorType"]) => {
      return errors.filter((error) => error.errorType === type);
    },
    [errors]
  );

  const getErrorsBySeverity = useCallback(
    (severity: ErrorReport["severity"]) => {
      return errors.filter((error) => error.severity === severity);
    },
    [errors]
  );

  return {
    errors,
    getErrorStats,
    getErrorsByType,
    getErrorsBySeverity,
    hasErrors: errors.length > 0,
    hasCriticalErrors: errors.some((e) => e.severity === "critical"),
  };
}
