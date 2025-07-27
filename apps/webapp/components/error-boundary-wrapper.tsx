"use client";

import React from "react";
import { ErrorBoundary } from "./error-boundary";

interface ErrorBoundaryWrapperProps {
  children: React.ReactNode;
  componentName: string;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetKeys?: any[];
  showRetry?: boolean;
  showReport?: boolean;
  errorMessage?: string;
}

export function ErrorBoundaryWrapper({
  children,
  componentName,
  fallback,
  onError,
  resetKeys,
  showRetry = true,
  showReport = true,
  errorMessage,
}: ErrorBoundaryWrapperProps) {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error(`Error in ${componentName}:`, error, errorInfo);

    if (onError) {
      onError(error, errorInfo);
    }
  };

  const defaultFallback = (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-center">
        <svg
          className="w-5 h-5 text-red-400 mr-2"
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
        <span className="text-red-800 font-medium">{componentName} Error</span>
      </div>
      <p className="text-red-700 text-sm mt-1">
        Something went wrong with {componentName.toLowerCase()}. Please try
        again.
      </p>
    </div>
  );

  return (
    <ErrorBoundary
      fallback={fallback || defaultFallback}
      onError={handleError}
      resetKeys={resetKeys}
      errorMessage={errorMessage || `${componentName} Error`}
      showRetry={showRetry}
      showReport={showReport}
    >
      {children}
    </ErrorBoundary>
  );
}

// Specific error boundary wrappers for common use cases
export function WalletErrorBoundary({
  children,
  ...props
}: Omit<ErrorBoundaryWrapperProps, "componentName">) {
  return (
    <ErrorBoundaryWrapper
      componentName="Wallet"
      errorMessage="Wallet Connection Error"
      showRetry={true}
      showReport={true}
      {...props}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function BlockchainErrorBoundary({
  children,
  ...props
}: Omit<ErrorBoundaryWrapperProps, "componentName">) {
  return (
    <ErrorBoundaryWrapper
      componentName="Blockchain"
      errorMessage="Blockchain Operation Error"
      showRetry={true}
      showReport={true}
      {...props}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function NetworkErrorBoundary({
  children,
  ...props
}: Omit<ErrorBoundaryWrapperProps, "componentName">) {
  return (
    <ErrorBoundaryWrapper
      componentName="Network"
      errorMessage="Network Connection Error"
      showRetry={true}
      showReport={true}
      {...props}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function DataFetchErrorBoundary({
  children,
  ...props
}: Omit<ErrorBoundaryWrapperProps, "componentName">) {
  return (
    <ErrorBoundaryWrapper
      componentName="Data Fetch"
      errorMessage="Data Loading Error"
      showRetry={true}
      showReport={false}
      {...props}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}

export function UIErrorBoundary({
  children,
  ...props
}: Omit<ErrorBoundaryWrapperProps, "componentName">) {
  return (
    <ErrorBoundaryWrapper
      componentName="UI Component"
      errorMessage="Interface Error"
      showRetry={false}
      showReport={true}
      {...props}
    >
      {children}
    </ErrorBoundaryWrapper>
  );
}
