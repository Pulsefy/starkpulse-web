"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useErrorMonitoring,
  useErrorRecovery,
} from "@/hooks/use-error-handling";
import { ErrorReport } from "@/lib/error-handler";

export function ErrorMonitor() {
  const {
    errors,
    getErrorStats,
    getErrorsByType,
    getErrorsBySeverity,
    hasErrors,
    hasCriticalErrors,
  } = useErrorMonitoring();
  const {
    recoverFromError,
    retryFailedOperation,
    retryInProgress,
    recoverableErrors,
  } = useErrorRecovery();
  const [selectedErrorType, setSelectedErrorType] = useState<
    ErrorReport["errorType"] | "all"
  >("all");
  const [selectedSeverity, setSelectedSeverity] = useState<
    ErrorReport["severity"] | "all"
  >("all");
  const [isExpanded, setIsExpanded] = useState(false);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  const stats = getErrorStats();
  const filteredErrors = errors.filter((error) => {
    if (selectedErrorType !== "all" && error.errorType !== selectedErrorType)
      return false;
    if (selectedSeverity !== "all" && error.severity !== selectedSeverity)
      return false;
    return true;
  });

  const handleRecoverAll = async () => {
    for (const error of recoverableErrors) {
      await recoverFromError(error.id);
    }
  };

  const handleClearAll = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("starkpulse-error-logs");
      window.location.reload();
    }
  };

  const getSeverityColor = (severity: ErrorReport["severity"]) => {
    switch (severity) {
      case "critical":
        return "text-red-500 bg-red-100";
      case "high":
        return "text-orange-500 bg-orange-100";
      case "medium":
        return "text-yellow-500 bg-yellow-100";
      case "low":
        return "text-blue-500 bg-blue-100";
      default:
        return "text-gray-500 bg-gray-100";
    }
  };

  const getErrorTypeColor = (type: ErrorReport["errorType"]) => {
    switch (type) {
      case "network":
        return "text-blue-500 bg-blue-100";
      case "wallet":
        return "text-purple-500 bg-purple-100";
      case "blockchain":
        return "text-green-500 bg-green-100";
      case "api":
        return "text-indigo-500 bg-indigo-100";
      case "react":
        return "text-red-500 bg-red-100";
      default:
        return "text-gray-500 bg-gray-100";
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Toggle Button */}
      <Button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative ${
          hasCriticalErrors
            ? "bg-red-600 hover:bg-red-700"
            : "bg-gray-800 hover:bg-gray-700"
        } text-white px-4 py-2 rounded-lg shadow-lg transition-all`}
      >
        🚨 Errors ({errors.length})
        {hasCriticalErrors && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
        )}
      </Button>

      {/* Expanded Panel */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-2 w-96 max-h-96 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Error Monitor</h3>
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRecoverAll}
                  disabled={retryInProgress || recoverableErrors.length === 0}
                >
                  Recover All
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAll}>
                  Clear All
                </Button>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="p-4 bg-gray-50 border-b border-gray-200">
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="text-center">
                <div className="font-semibold">{stats.total}</div>
                <div className="text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-red-500">
                  {stats.critical}
                </div>
                <div className="text-gray-500">Critical</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-orange-500">
                  {stats.high}
                </div>
                <div className="text-gray-500">High</div>
              </div>
              <div className="text-center">
                <div className="font-semibold text-blue-500">
                  {recoverableErrors.length}
                </div>
                <div className="text-gray-500">Recoverable</div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-3 bg-gray-50 border-b border-gray-200">
            <div className="flex space-x-2">
              <select
                value={selectedErrorType}
                onChange={(e) => setSelectedErrorType(e.target.value as any)}
                className="text-xs px-2 py-1 border border-gray-300 rounded"
              >
                <option value="all">All Types</option>
                <option value="network">Network</option>
                <option value="wallet">Wallet</option>
                <option value="blockchain">Blockchain</option>
                <option value="api">API</option>
                <option value="react">React</option>
              </select>
              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value as any)}
                className="text-xs px-2 py-1 border border-gray-300 rounded"
              >
                <option value="all">All Severities</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* Error List */}
          <div className="max-h-64 overflow-y-auto">
            {filteredErrors.length === 0 ? (
              <div className="p-4 text-center text-gray-500 text-sm">
                No errors to display
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredErrors
                  .slice(-10)
                  .reverse()
                  .map((error) => (
                    <div key={error.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getErrorTypeColor(
                                error.errorType
                              )}`}
                            >
                              {error.errorType}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor(
                                error.severity
                              )}`}
                            >
                              {error.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-900 truncate">
                            {error.message}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(error.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex space-x-1 ml-2">
                          {recoverableErrors.some((e) => e.id === error.id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => recoverFromError(error.id)}
                              disabled={retryInProgress}
                              className="text-xs px-2 py-1"
                            >
                              Retry
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Error Details (Collapsible) */}
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
                          Details
                        </summary>
                        <div className="mt-2 text-xs bg-gray-100 p-2 rounded">
                          <div className="mb-1">
                            <strong>ID:</strong> {error.id}
                          </div>
                          {error.context && (
                            <div className="mb-1">
                              <strong>Context:</strong>
                              <pre className="mt-1 text-xs overflow-auto max-h-20">
                                {JSON.stringify(error.context, null, 2)}
                              </pre>
                            </div>
                          )}
                          {error.stack && (
                            <div>
                              <strong>Stack:</strong>
                              <pre className="mt-1 text-xs overflow-auto max-h-20">
                                {error.stack}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
