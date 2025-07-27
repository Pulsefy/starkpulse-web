"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "./error-boundary";
import { errorHandler } from "@/lib/error-handler";
import { useErrorActions } from "@/store/error-store";
import { useErrorToast } from "@/components/ui/error-toast";

// Component that throws an error for testing
function ErrorThrower({ errorType }: { errorType: string }) {
  const throwError = () => {
    switch (errorType) {
      case "react":
        throw new Error("This is a React component error for testing");
      case "network":
        throw new Error("Network connection failed");
      case "wallet":
        throw new Error("Wallet connection failed");
      case "blockchain":
        throw new Error("Blockchain transaction failed");
      case "api":
        throw new Error("API request failed");
      default:
        throw new Error("Unknown error type");
    }
  };

  return (
    <div className="p-4 border border-red-200 rounded-lg bg-red-50">
      <h3 className="font-semibold text-red-800 mb-2">
        Error Test Component ({errorType})
      </h3>
      <Button
        onClick={throwError}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        Throw {errorType} Error
      </Button>
    </div>
  );
}

export function ErrorTest() {
  const {
    handleNetworkError,
    handleWalletError,
    handleBlockchainError,
    handleApiError,
  } = useErrorActions();
  const { showErrorToast } = useErrorToast();

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const testNetworkError = () => {
    const error = new Error("Test network error");
    handleNetworkError(error, { url: "/api/test", method: "GET", status: 500 });
  };

  const testWalletError = () => {
    const error = new Error("Test wallet connection error");
    handleWalletError(error, { walletType: "argent", action: "connect" });
  };

  const testBlockchainError = () => {
    const error = new Error("Test blockchain transaction error");
    handleBlockchainError(error, {
      transactionHash: "0x123...",
      contractAddress: "0x456...",
      method: "transfer",
    });
  };

  const testApiError = () => {
    const error = new Error("Test API error");
    handleApiError(error, {
      endpoint: "/api/market-data",
      method: "POST",
      status: 400,
    });
  };

  const testUnhandledPromise = () => {
    Promise.reject(new Error("Test unhandled promise rejection"));
  };

  const testGlobalError = () => {
    setTimeout(() => {
      throw new Error("Test global error");
    }, 100);
  };

  const testErrorToast = () => {
    showErrorToast({
      id: "test-toast",
      message: "This is a test error toast",
      timestamp: new Date().toISOString(),
      errorType: "api",
      severity: "medium",
      context: { test: true },
    });
  };

  return (
    <div className="fixed top-4 left-4 z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-4 max-w-md">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        🧪 Error Testing Panel
      </h2>

      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Error Boundaries
          </h3>
          <div className="space-y-2">
            {["react", "network", "wallet", "blockchain", "api"].map((type) => (
              <ErrorBoundary key={type} errorMessage={`${type} Error Test`}>
                <ErrorThrower errorType={type} />
              </ErrorBoundary>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Error Handlers
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={testNetworkError}
              className="text-xs"
            >
              Network Error
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={testWalletError}
              className="text-xs"
            >
              Wallet Error
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={testBlockchainError}
              className="text-xs"
            >
              Blockchain Error
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={testApiError}
              className="text-xs"
            >
              API Error
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Global Errors
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={testUnhandledPromise}
              className="text-xs"
            >
              Unhandled Promise
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={testGlobalError}
              className="text-xs"
            >
              Global Error
            </Button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">UI Testing</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={testErrorToast}
            className="text-xs w-full"
          >
            Test Error Toast
          </Button>
        </div>

        <div className="pt-2 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            This panel is only visible in development mode.
          </p>
        </div>
      </div>
    </div>
  );
}
