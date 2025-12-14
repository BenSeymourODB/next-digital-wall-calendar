/**
 * Route-level Error Handler
 *
 * Catches errors in page components and logs them to Application Insights.
 * This file follows Next.js error.tsx convention.
 *
 * Scope: Catches errors in nested routes (not root layout errors - use global-error.tsx for those)
 */

"use client";

import { logger } from "@/lib/logger";
import React, { useEffect } from "react";
import Link from "next/link";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log error to Application Insights
    logger.error(error, {
      digest: error.digest || "N/A",
      errorHandler: "error.tsx",
      page: window.location.pathname,
      errorName: error.name,
    });

    // Log to console for development
    console.error("[Error.tsx] Route error:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-lg border border-stone-200 bg-white p-8 shadow-sm">
        {/* Error Icon */}
        <div className="flex justify-center">
          <div className="rounded-full bg-rose-50 p-3">
            <svg
              className="h-10 w-10 text-rose-600"
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
          <h1 className="text-2xl font-semibold text-stone-900">
            Oops! Something went wrong
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            We encountered an unexpected error while loading this page. The
            issue has been automatically logged and our team will investigate.
          </p>
        </div>

        {/* Error Details (dev mode only) */}
        {process.env.NODE_ENV === "development" && (
          <div className="space-y-2 rounded-md bg-stone-50 p-4">
            <div>
              <p className="text-xs font-medium text-stone-700">Error Type:</p>
              <p className="mt-1 font-mono text-xs text-stone-600">
                {error.name}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-stone-700">
                Error Message:
              </p>
              <p className="mt-1 font-mono text-xs break-words text-stone-600">
                {error.message}
              </p>
            </div>
            {error.digest && (
              <div>
                <p className="text-xs font-medium text-stone-700">
                  Error Digest:
                </p>
                <p className="mt-1 font-mono text-xs text-stone-600">
                  {error.digest}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:outline-none"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="w-full rounded-md border border-stone-300 bg-white px-4 py-2 text-center text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 focus:outline-none"
          >
            Back to Home
          </Link>
        </div>

        {/* Help Text */}
        <p className="text-center text-xs text-stone-500">
          If this problem persists, please contact support with the error
          details above.
        </p>
      </div>
    </div>
  );
}
