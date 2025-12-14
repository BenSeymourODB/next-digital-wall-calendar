/**
 * Global Error Handler
 *
 * Catches errors in the root layout (last resort error boundary).
 * This file follows Next.js global-error.tsx convention.
 *
 * IMPORTANT: Must include its own <html> and <body> tags.
 * Only catches errors in the root layout - route errors are handled by error.tsx
 */

"use client";

import { logger } from "@/lib/logger";
import { useEffect } from "react";
import Link from "next/link";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Log critical error to Application Insights
    logger.error(error, {
      severity: "critical",
      digest: error.digest || "N/A",
      errorHandler: "global-error.tsx",
      page:
        typeof window !== "undefined" ? window.location.pathname : "unknown",
      errorName: error.name,
    });

    // Log to console for development
    console.error("[Global-Error.tsx] Critical error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
          <div className="w-full max-w-md space-y-6 rounded-lg border border-stone-200 bg-white p-8 shadow-md">
            {/* Critical Error Icon */}
            <div className="flex justify-center">
              <div className="rounded-full bg-rose-100 p-4">
                <svg
                  className="h-12 w-12 text-rose-600"
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
              <h1 className="text-3xl font-bold text-stone-900">
                Critical Error
              </h1>
              <p className="mt-3 text-base text-stone-600">
                A critical error occurred that prevented the application from
                loading. The issue has been logged and our team will investigate
                immediately.
              </p>
            </div>

            {/* Error Details (dev mode only) */}
            {process.env.NODE_ENV === "development" && (
              <div className="space-y-3 rounded-md border border-rose-200 bg-rose-50 p-4">
                <div>
                  <p className="text-xs font-semibold text-rose-900">
                    Error Type:
                  </p>
                  <p className="mt-1 font-mono text-xs text-rose-700">
                    {error.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-rose-900">
                    Error Message:
                  </p>
                  <p className="mt-1 font-mono text-xs wrap-break-word text-rose-700">
                    {error.message}
                  </p>
                </div>
                {error.digest && (
                  <div>
                    <p className="text-xs font-semibold text-rose-900">
                      Error Digest:
                    </p>
                    <p className="mt-1 font-mono text-xs text-rose-700">
                      {error.digest}
                    </p>
                  </div>
                )}
                {error.stack && (
                  <div>
                    <p className="text-xs font-semibold text-rose-900">
                      Stack Trace:
                    </p>
                    <pre className="mt-1 max-h-40 overflow-auto font-mono text-xs whitespace-pre-wrap text-rose-700">
                      {error.stack}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <button
                onClick={reset}
                className="w-full rounded-md bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sky-700 focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 focus:outline-none"
              >
                Try to Recover
              </button>
              <Link
                href="/"
                className="w-full rounded-md border border-stone-300 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-700 transition-colors hover:bg-stone-50 focus:ring-2 focus:ring-stone-500 focus:ring-offset-2 focus:outline-none"
              >
                Reload Application
              </Link>
            </div>

            {/* Help Text */}
            <div className="rounded-md bg-stone-50 p-4">
              <p className="text-xs font-medium text-stone-700">
                Need immediate help?
              </p>
              <p className="mt-1 text-xs text-stone-600">
                If this error persists, please contact support and provide the
                error digest above (if available).
              </p>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
