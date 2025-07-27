"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ErrorReport } from "@/lib/error-handler";
import { useErrorActions } from "@/store/error-store";
import { useErrorSelectors } from "@/store/error-store";

interface ErrorToastProps {
  error: ErrorReport;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export function ErrorToast({ error, onRetry, onDismiss }: ErrorToastProps) {
  const { clearError, attemptRecovery } = useErrorActions();
  const { toast } = useToast();

  const handleRetry = async () => {
    if (onRetry) {
      onRetry();
    } else {
      // Default retry behavior
      const success = await attemptRecovery(error.id);
      if (success) {
        toast({
          title: "Success",
          description: "Operation completed successfully",
          variant: "default",
        });
      }
    }
  };

  const handleDismiss = () => {
    clearError(error.id);
    if (onDismiss) {
      onDismiss();
    }
  };

  const getErrorIcon = (errorType: ErrorReport["errorType"]) => {
    switch (errorType) {
      case "network":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
            />
          </svg>
        );
      case "wallet":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        );
      case "blockchain":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        );
      case "api":
        return (
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5"
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
        );
    }
  };

  const getSeverityColor = (severity: ErrorReport["severity"]) => {
    switch (severity) {
      case "critical":
        return "text-red-500 bg-red-50 border-red-200";
      case "high":
        return "text-orange-500 bg-orange-50 border-orange-200";
      case "medium":
        return "text-yellow-500 bg-yellow-50 border-yellow-200";
      case "low":
        return "text-blue-500 bg-blue-50 border-blue-200";
      default:
        return "text-gray-500 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div
      className={`flex items-start p-4 border rounded-lg ${getSeverityColor(
        error.severity
      )}`}
    >
      <div className="flex-shrink-0 mr-3 mt-0.5">
        {getErrorIcon(error.errorType)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 capitalize">
            {error.errorType} Error
          </h4>
          <span className="text-xs text-gray-500">
            {new Date(error.timestamp).toLocaleTimeString()}
          </span>
        </div>

        <p className="mt-1 text-sm text-gray-700">{error.message}</p>

        {error.context && process.env.NODE_ENV === "development" && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
              Error Details
            </summary>
            <pre className="mt-1 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-20">
              {JSON.stringify(error.context, null, 2)}
            </pre>
          </details>
        )}

        <div className="mt-3 flex space-x-2">
          {error.errorType !== "react" && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetry}
              className="text-xs px-3 py-1"
            >
              Retry
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-xs px-3 py-1 text-gray-500 hover:text-gray-700"
          >
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

// Hook to show error toast
export function useErrorToast() {
  const { toast } = useToast();
  const { addError } = useErrorActions();

  const showErrorToast = React.useCallback(
    (error: ErrorReport) => {
      // Add error to store
      addError(error);

      // Show toast
      toast({
        title: `${
          error.errorType.charAt(0).toUpperCase() + error.errorType.slice(1)
        } Error`,
        description: error.message,
        variant: error.severity === "critical" ? "destructive" : "default",
        duration: error.severity === "critical" ? 10000 : 5000, // Longer duration for critical errors
      });
    },
    [toast, addError]
  );

  return { showErrorToast };
}
