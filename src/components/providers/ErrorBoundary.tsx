/**
 * Error Boundary Component
 *
 * Catches React rendering errors in client components and logs them
 * to Application Insights. Provides a user-friendly fallback UI.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <YourComponent />
 *   </ErrorBoundary>
 */

"use client";

import { logger } from "@/lib/logger";
import React, { Component, ReactNode } from "react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback UI (optional) */
  fallback?: (error: Error, resetError: () => void) => ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * React Error Boundary that logs errors to Application Insights
 */
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
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error to Application Insights
    logger.error(error, {
      severity: "critical",
      componentStack: errorInfo.componentStack || "N/A",
      errorBoundary: "ErrorBoundary",
      page: window.location.pathname,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call optional callback
    this.props.onError?.(error, errorInfo);

    // Log to console for development
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetError);
      }

      // Default fallback UI
      return (
        <DefaultErrorFallback
          error={this.state.error}
          resetError={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Default Error Fallback UI
 */
function DefaultErrorFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-red-50 p-3">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
        </div>

        {/* Error Title */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            We encountered an error while rendering this component. The issue
            has been logged and we&apos;ll look into it.
          </p>
        </div>

        {/* Error Details (dev mode only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="rounded-md bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-700">Error Details:</p>
            <p className="mt-1 font-mono text-xs wrap-break-word text-gray-600">
              {error.message}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={resetError}
            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook-based error boundary alternative (for function components)
 * Note: This doesn't actually catch errors, but provides a pattern for error handling
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      logger.error(error, {
        source: "useErrorHandler",
        page: window.location.pathname,
      });
    }
  }, [error]);

  return setError;
}
