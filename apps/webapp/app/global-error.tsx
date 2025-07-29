"use client";

import React from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { Button } from "@/components/ui/button";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  return (
    <html>
      <body>
        <ErrorBoundary
          errorMessage="Something went wrong"
          showRetry={true}
          showReport={true}
        >
          <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-violet-900 p-4">
            <div className="max-w-lg w-full text-center">
              {/* Error Icon */}
              <div className="mx-auto w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
                <svg
                  className="w-12 h-12 text-red-400"
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
              <h1 className="text-2xl font-bold text-white mb-4">
                Server Error
              </h1>

              <p className="text-gray-300 mb-6 text-lg">
                We&apos;re experiencing technical difficulties. Please try again
                later.
              </p>

              {/* Error Details (Development Only) */}
              {process.env.NODE_ENV === "development" && (
                <details className="text-left mb-6 bg-black/30 rounded-lg p-4">
                  <summary className="text-gray-300 cursor-pointer hover:text-white mb-2 font-medium">
                    Error Details
                  </summary>
                  <div className="text-xs text-gray-300 font-mono">
                    <div className="mb-2">
                      <strong>Message:</strong> {error.message}
                    </div>
                    {error.digest && (
                      <div className="mb-2">
                        <strong>Digest:</strong> {error.digest}
                      </div>
                    )}
                    {error.stack && (
                      <div>
                        <strong>Stack:</strong>
                        <pre className="whitespace-pre-wrap mt-1 overflow-auto max-h-40">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                </details>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={reset}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg transition-colors"
                >
                  Try Again
                </Button>

                <Button
                  variant="outline"
                  onClick={() => (window.location.href = "/")}
                  className="border-gray-600 text-gray-300 hover:bg-gray-800 px-8 py-3 rounded-lg transition-colors"
                >
                  Go Home
                </Button>
              </div>

              {/* Help Text */}
              <div className="mt-8 p-4 bg-white/5 backdrop-blur-lg rounded-lg border border-white/10">
                <p className="text-gray-400 text-sm mb-3">
                  If this problem persists, please contact our support team.
                </p>
                <div className="flex justify-center space-x-4 text-sm">
                  <a
                    href="mailto:support@starkpulse.com"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Email Support
                  </a>
                  <a
                    href="https://discord.gg/starkpulse"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Discord
                  </a>
                  <a
                    href="https://github.com/starkpulse/issues"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    GitHub Issues
                  </a>
                </div>
              </div>

              {/* Status Information */}
              <div className="mt-6 text-xs text-gray-500">
                <p>Error ID: {error.digest || "unknown"}</p>
                <p>Timestamp: {new Date().toISOString()}</p>
              </div>
            </div>
          </div>
        </ErrorBoundary>
      </body>
    </html>
  );
}
