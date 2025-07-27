import { create } from "zustand";
import { persist } from "zustand/middleware";
import { errorHandler, ErrorReport } from "@/lib/error-handler";

interface ErrorState {
  // Error state
  errors: ErrorReport[];
  currentError: ErrorReport | null;
  isErrorModalOpen: boolean;

  // Loading states
  isLoading: boolean;
  retryInProgress: boolean;

  // Error handling configuration
  autoRetry: boolean;
  maxRetries: number;
  retryDelay: number;

  // Actions
  addError: (error: ErrorReport) => void;
  clearError: (errorId: string) => void;
  clearAllErrors: () => void;
  setCurrentError: (error: ErrorReport | null) => void;
  openErrorModal: () => void;
  closeErrorModal: () => void;

  // Retry actions
  retryOperation: (
    operationId: string,
    operation: () => Promise<any>
  ) => Promise<any>;
  setRetryInProgress: (inProgress: boolean) => void;

  // Configuration actions
  setAutoRetry: (enabled: boolean) => void;
  setMaxRetries: (max: number) => void;
  setRetryDelay: (delay: number) => void;

  // Utility actions
  getErrorsByType: (type: ErrorReport["errorType"]) => ErrorReport[];
  getErrorsBySeverity: (severity: ErrorReport["severity"]) => ErrorReport[];
  getErrorStats: () => {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    recent: ErrorReport[];
  };

  // Recovery actions
  attemptRecovery: (errorId: string) => Promise<boolean>;
  dismissError: (errorId: string) => void;

  // Network error handling
  handleNetworkError: (error: Error, context?: Record<string, any>) => void;
  handleWalletError: (error: Error, context?: Record<string, any>) => void;
  handleBlockchainError: (error: Error, context?: Record<string, any>) => void;
  handleApiError: (error: Error, context?: Record<string, any>) => void;
}

export const useErrorStore = create<ErrorState>()(
  persist(
    (set, get) => ({
      // Initial state
      errors: [],
      currentError: null,
      isErrorModalOpen: false,
      isLoading: false,
      retryInProgress: false,
      autoRetry: false,
      maxRetries: 3,
      retryDelay: 1000,

      // Add error to store
      addError: (error: ErrorReport) => {
        set((state) => ({
          errors: [...state.errors, error].slice(-100), // Keep last 100 errors
          currentError: error,
        }));

        // Auto-retry if enabled and error is retryable
        if (get().autoRetry && isRetryableError(error)) {
          setTimeout(() => {
            get().attemptRecovery(error.id);
          }, get().retryDelay);
        }
      },

      // Clear specific error
      clearError: (errorId: string) => {
        set((state) => ({
          errors: state.errors.filter((error) => error.id !== errorId),
          currentError:
            state.currentError?.id === errorId ? null : state.currentError,
        }));
      },

      // Clear all errors
      clearAllErrors: () => {
        set({
          errors: [],
          currentError: null,
          isErrorModalOpen: false,
        });
      },

      // Set current error
      setCurrentError: (error: ErrorReport | null) => {
        set({ currentError: error });
      },

      // Modal controls
      openErrorModal: () => {
        set({ isErrorModalOpen: true });
      },

      closeErrorModal: () => {
        set({ isErrorModalOpen: false });
      },

      // Retry operation with exponential backoff
      retryOperation: async (
        operationId: string,
        operation: () => Promise<any>
      ) => {
        set({ retryInProgress: true, isLoading: true });

        try {
          const result = await errorHandler.withRetry(
            operation,
            operationId,
            get().maxRetries
          );

          // Clear any related errors on success
          const relatedErrors = get().errors.filter(
            (error) => error.context?.operationId === operationId
          );
          relatedErrors.forEach((error) => get().clearError(error.id));

          return result;
        } catch (error) {
          // Error will be handled by errorHandler
          throw error;
        } finally {
          set({ retryInProgress: false, isLoading: false });
        }
      },

      // Set retry progress
      setRetryInProgress: (inProgress: boolean) => {
        set({ retryInProgress: inProgress });
      },

      // Configuration setters
      setAutoRetry: (enabled: boolean) => {
        set({ autoRetry: enabled });
      },

      setMaxRetries: (max: number) => {
        set({ maxRetries: max });
      },

      setRetryDelay: (delay: number) => {
        set({ retryDelay: delay });
      },

      // Get errors by type
      getErrorsByType: (type: ErrorReport["errorType"]) => {
        return get().errors.filter((error) => error.errorType === type);
      },

      // Get errors by severity
      getErrorsBySeverity: (severity: ErrorReport["severity"]) => {
        return get().errors.filter((error) => error.severity === severity);
      },

      // Get error statistics
      getErrorStats: () => {
        const errors = get().errors;
        const stats = {
          total: errors.length,
          byType: {} as Record<string, number>,
          bySeverity: {} as Record<string, number>,
          recent: errors.slice(-10),
        };

        errors.forEach((error) => {
          stats.byType[error.errorType] =
            (stats.byType[error.errorType] || 0) + 1;
          stats.bySeverity[error.severity] =
            (stats.bySeverity[error.severity] || 0) + 1;
        });

        return stats;
      },

      // Attempt recovery for specific error
      attemptRecovery: async (errorId: string) => {
        const error = get().errors.find((e) => e.id === errorId);
        if (!error || !isRetryableError(error)) {
          return false;
        }

        set({ retryInProgress: true });

        try {
          // Simulate recovery attempt
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Clear the error on successful recovery
          get().clearError(errorId);
          return true;
        } catch (recoveryError) {
          // Recovery failed, keep the error
          console.error("Recovery failed for error:", errorId, recoveryError);
          return false;
        } finally {
          set({ retryInProgress: false });
        }
      },

      // Dismiss error (user action)
      dismissError: (errorId: string) => {
        get().clearError(errorId);
      },

      // Network error handling
      handleNetworkError: (error: Error, context?: Record<string, any>) => {
        const report = errorHandler.handleNetworkError(error, context);
        get().addError(report);
      },

      // Wallet error handling
      handleWalletError: (error: Error, context?: Record<string, any>) => {
        const report = errorHandler.handleWalletError(error, context);
        get().addError(report);
      },

      // Blockchain error handling
      handleBlockchainError: (error: Error, context?: Record<string, any>) => {
        const report = errorHandler.handleBlockchainError(error, context);
        get().addError(report);
      },

      // API error handling
      handleApiError: (error: Error, context?: Record<string, any>) => {
        const report = errorHandler.handleApiError(error, context);
        get().addError(report);
      },
    }),
    {
      name: "error-storage",
      partialize: (state) => ({
        errors: state.errors.slice(-20), // Only persist last 20 errors
        autoRetry: state.autoRetry,
        maxRetries: state.maxRetries,
        retryDelay: state.retryDelay,
      }),
    }
  )
);

// Helper function to determine if an error is retryable
function isRetryableError(error: ErrorReport): boolean {
  // Network and API errors are generally retryable
  if (error.errorType === "network" || error.errorType === "api") {
    // Don't retry 4xx client errors
    const status = error.context?.status;
    if (status && status >= 400 && status < 500) {
      return false;
    }
    return true;
  }

  // Wallet connection errors might be retryable
  if (error.errorType === "wallet") {
    return (
      error.message.includes("connection") || error.message.includes("timeout")
    );
  }

  // React errors are not retryable
  if (error.errorType === "react") {
    return false;
  }

  // Blockchain errors are generally not retryable
  if (error.errorType === "blockchain") {
    return false;
  }

  return false;
}

// Selectors for common use cases
export const useErrorSelectors = () => {
  const errors = useErrorStore((state) => state.errors);
  const currentError = useErrorStore((state) => state.currentError);
  const isLoading = useErrorStore((state) => state.isLoading);
  const retryInProgress = useErrorStore((state) => state.retryInProgress);

  return {
    errors,
    currentError,
    isLoading,
    retryInProgress,
    hasErrors: errors.length > 0,
    criticalErrors: errors.filter((error) => error.severity === "critical"),
    highSeverityErrors: errors.filter((error) => error.severity === "high"),
    recentErrors: errors.slice(-5),
  };
};

// Hook for error actions
export const useErrorActions = () => {
  return useErrorStore((state) => ({
    addError: state.addError,
    clearError: state.clearError,
    clearAllErrors: state.clearAllErrors,
    retryOperation: state.retryOperation,
    attemptRecovery: state.attemptRecovery,
    dismissError: state.dismissError,
    handleNetworkError: state.handleNetworkError,
    handleWalletError: state.handleWalletError,
    handleBlockchainError: state.handleBlockchainError,
    handleApiError: state.handleApiError,
  }));
};
