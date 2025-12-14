/**
 * Application Insights Logging Demo Page
 *
 * Interactive demonstration of all Application Insights logging capabilities:
 * - Client-side error tracking
 * - Server-side error tracking (via API)
 * - Custom events
 * - Performance metrics
 * - Dependency tracking
 *
 * This page is part of the template for demonstration purposes.
 * You can remove it or use it as a reference for implementing logging in your app.
 */

"use client";

import { logger, startTimer, withLogging } from "@/lib/logger";
import { useState } from "react";
import Link from "next/link";

export default function DemoLoggingPage() {
  const [output, setOutput] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addOutput = (message: string) => {
    setOutput((prev) => [
      ...prev,
      `[${new Date().toLocaleTimeString()}] ${message}`,
    ]);
  };

  // Client-side error tracking
  const handleClientError = (errorType: "caught" | "uncaught") => {
    addOutput(`Triggering ${errorType} client error...`);

    if (errorType === "uncaught") {
      // This will be caught by ErrorBoundary
      throw new Error("Demo uncaught client error");
    } else {
      try {
        // Simulate error
        throw new Error("Demo caught client error");
      } catch (error) {
        logger.error(error as Error, {
          demoType: "client-error-caught",
          userAction: "button-click",
        });
        addOutput("✓ Caught error logged to Application Insights");
      }
    }
  };

  // Client-side critical error (explicit severity 4)
  const handleClientCritical = () => {
    addOutput("Triggering CRITICAL client error...");
    try {
      throw new Error("Demo critical client error");
    } catch (error) {
      logger.critical(error as Error, {
        demoType: "client-error-critical",
        userAction: "button-click",
        incident: true,
      });
      addOutput("✓ Critical error logged as Exception (severity=Critical)");
    }
  };

  // Server-side error tracking
  const handleServerError = async (errorType: string) => {
    setIsLoading(true);
    addOutput(`Calling API with error type: ${errorType}...`);

    try {
      const response = await fetch(`/api/demo-error?type=${errorType}`);
      const data = await response.json();

      if (!response.ok) {
        addOutput(
          `✓ Server error logged: ${data.errorName} (${response.status})`
        );
        addOutput(`  Message: ${data.error}`);
      } else {
        addOutput(`✓ API call successful (no error)`);
      }
    } catch (error) {
      logger.error(error as Error, {
        demoType: "api-call-failed",
        errorType,
      });
      addOutput(`✗ API call failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Custom event tracking
  const handleCustomEvent = () => {
    const eventName = "DemoButtonClick";
    addOutput(`Tracking custom event: ${eventName}...`);

    logger.event(
      eventName,
      {
        buttonId: "demo-custom-event",
        page: "/demo-logging",
        userRole: "demo-user",
      },
      {
        clickCount: 1,
      }
    );

    addOutput(`✓ Custom event logged to Application Insights`);
  };

  // Performance metric tracking
  const handlePerformanceMetric = () => {
    addOutput("Simulating operation and tracking performance...");

    const timer = startTimer();

    // Simulate work
    setTimeout(
      () => {
        const duration = timer.end("demo_operation_duration", {
          operationType: "simulated-work",
        });

        addOutput(`✓ Performance metric logged: ${duration}ms`);
      },
      Math.random() * 1000 + 500
    );
  };

  // Trace/diagnostic logging (using convenience methods)
  const handleDebugTrace = () => {
    addOutput("Logging DEBUG trace...");

    logger.debug("Debug checkpoint reached", {
      component: "demo-logging-page",
      action: "trace-button-click",
      step: 1,
    });

    addOutput("✓ DEBUG trace logged (using logger.debug())");
  };

  const handleInfoTrace = () => {
    addOutput("Logging INFO trace...");

    logger.info("Operation completed successfully", {
      component: "demo-logging-page",
      action: "trace-button-click",
      duration: 150,
    });

    addOutput("✓ INFO trace logged (using logger.info())");
  };

  const handleWarnTrace = () => {
    addOutput("Logging WARNING trace...");

    logger.warn("Cache miss, using fallback", {
      component: "demo-logging-page",
      cacheKey: "user:demo",
      fallbackUsed: true,
    });

    addOutput("✓ WARNING trace logged (using logger.warn())");
  };

  // Validation error example (expected issue, not exceptional)
  const handleValidationError = () => {
    addOutput("Simulating validation error (expected, not exceptional)...");

    // Use logger.warn() for expected validation issues
    logger.warn("Validation failed: Invalid email format", {
      component: "demo-logging-page",
      field: "email",
      value: "invalid-email",
    });

    addOutput("✓ Validation error logged as WARNING (not an exception)");
  };

  // Dependency tracking (automatic for fetch, but showing manual tracking too)
  const handleDependencyTracking = async () => {
    setIsLoading(true);
    addOutput("Making external API call (auto-tracked by browser SDK)...");

    try {
      // fetch() calls are automatically tracked by Application Insights browser SDK
      const response = await fetch("https://api.github.com/zen");
      const data = await response.text();

      addOutput(`✓ Fetch call auto-tracked (Status: ${response.status})`);
      addOutput(`  Response: "${data}"`);
      addOutput(
        "  Note: Dependencies are automatically tracked - no manual logging needed!"
      );
    } catch (error) {
      addOutput(`✗ API call failed: ${(error as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Business event example
  const handleBusinessEvent = () => {
    addOutput("Tracking business event...");

    logger.event(
      "FeatureUsed",
      {
        featureName: "demo-logging",
        category: "engagement",
        userId: "demo-user-123",
      },
      {
        sessionDuration: 120,
        actionCount: 5,
      }
    );

    addOutput(`✓ Business event logged`);
  };

  // Child logger example (scoped context)
  const handleChildLogger = () => {
    addOutput("Creating child logger with default properties...");

    // Create a child logger with default context
    const pageLogger = logger.withProperties({
      component: "demo-logging-page",
      sessionId: "demo-session-123",
      userId: "demo-user",
    });

    // All logs from pageLogger automatically include the default properties
    pageLogger.info("User action started");
    pageLogger.debug("Processing step 1", { step: 1 });
    pageLogger.warn("Rate limit approaching", { requestCount: 95 });

    addOutput("✓ Child logger created and used");
    addOutput("  All logs include: component, sessionId, userId");
  };

  // Auto-logging with withLogging wrapper
  const simulateDataFetch = withLogging(
    "demo_data_fetch",
    async (userId: string) => {
      // Simulate async operation
      await new Promise((resolve) =>
        setTimeout(resolve, Math.random() * 800 + 200)
      );

      // Simulate some work
      return { userId, data: "Sample data", recordCount: 42 };
    }
  );

  const handleAutoLogging = async () => {
    setIsLoading(true);
    addOutput("Calling function wrapped with withLogging()...");

    try {
      const result = await simulateDataFetch("demo-user-123");

      addOutput("✓ Function completed successfully");
      addOutput(`  Returned: ${JSON.stringify(result)}`);
      addOutput(
        "  Note: Duration and success/failure automatically logged as event!"
      );
    } catch (error) {
      addOutput(`✗ Function failed: ${(error as Error).message}`);
      addOutput("  Note: Error automatically logged with function context!");
    } finally {
      setIsLoading(false);
    }
  };

  const clearOutput = () => {
    setOutput([]);
  };

  return (
    <div className="min-h-screen bg-stone-50 px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="mb-4 inline-flex items-center text-sm font-medium text-sky-600 hover:text-sky-700"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            <svg
              className="mr-2 h-5 w-5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              {/* Application Insights Icon - Graph/Chart representation */}
              <path d="M3 18h18v2H3v-2zm2-8h2v6H5v-6zm4-4h2v10H9V6zm4 2h2v8h-2V8zm4-4h2v12h-2V4z" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-stone-900">
            Application Insights Demo
          </h1>
          <p className="mt-2 text-lg text-stone-600">
            Interactive demonstration of logging and telemetry capabilities
          </p>
        </div>

        {/* Legend */}
        <div className="mb-6 rounded-lg border border-sky-200 bg-sky-50 p-4">
          <div className="flex items-start gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 font-medium text-blue-700">
                CLIENT
              </span>
              <span className="text-sky-900">
                Browser SDK - Transaction Search only
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-700">
                SERVER
              </span>
              <svg
                className="h-4 w-4 text-rose-500"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
              </svg>
              <span className="text-sky-900">
                Node.js SDK - Live Metrics + Transaction Search
              </span>
            </div>
          </div>
        </div>

        {/* Demo Sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Client Errors */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Client-Side Errors
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Test error tracking in browser context. Errors are logged to
              Application Insights with full context.
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> customEvents | where name ==
              &quot;Exception&quot; and customDimensions.demoType contains
              &quot;client-error&quot;
            </div>
            <div className="space-y-3">
              <button
                onClick={() => handleClientError("caught")}
                className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
              >
                Trigger Caught Error
              </button>
              <button
                onClick={() => handleClientError("uncaught")}
                className="w-full rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-700"
              >
                Trigger Uncaught Error (ErrorBoundary)
              </button>
              <button
                onClick={handleClientCritical}
                className="w-full rounded-md bg-rose-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-rose-800"
              >
                Trigger Critical Error (logger.critical)
              </button>
            </div>
          </div>

          {/* Server Errors */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Server-Side Errors
              </h2>
              <div className="flex items-center gap-1">
                <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                  SERVER
                </span>
                <svg
                  className="h-4 w-4 text-rose-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-label="Appears in Live Metrics"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                </svg>
              </div>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Test API error logging. Different error types return appropriate
              HTTP status codes.
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> traces | where message contains
              &quot;Validation&quot; or exceptions | where problemId contains
              &quot;api/demo-error&quot;
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleServerError("validation")}
                disabled={isLoading}
                className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                Validation Error (400)
              </button>
              <button
                onClick={() => handleServerError("auth")}
                disabled={isLoading}
                className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                Auth Error (401)
              </button>
              <button
                onClick={() => handleServerError("database")}
                disabled={isLoading}
                className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
              >
                Database Error (503)
              </button>
            </div>
          </div>

          {/* Custom Events */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Custom Events
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Track user actions, feature usage, and business events. Use for
              analytics and usage patterns.
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> customEvents | where name ==
              &quot;DemoButtonClick&quot; or name == &quot;FeatureUsed&quot;
            </div>
            <div className="space-y-3">
              <button
                onClick={handleCustomEvent}
                className="w-full rounded-md bg-lime-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-lime-700"
              >
                Track Button Click Event
              </button>
              <button
                onClick={handleBusinessEvent}
                className="w-full rounded-md bg-lime-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-lime-700"
              >
                Track Business Event
              </button>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Performance & Dependencies
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Track operation duration with startTimer(). External API calls
              (fetch/XHR) are automatically tracked by the browser SDK.
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> customEvents | where name ==
              &quot;demo_operation_duration&quot; | dependencies | where target
              contains &quot;github.com&quot;
            </div>
            <div className="space-y-3">
              <button
                onClick={handlePerformanceMetric}
                className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
              >
                Track Operation Duration (Manual)
              </button>
              <button
                onClick={handleDependencyTracking}
                disabled={isLoading}
                className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                External API Call (Auto-Tracked)
              </button>
            </div>
          </div>

          {/* Automatic Page Views */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Automatic Page View Tracking
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <div className="rounded-md bg-sky-50 p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="mt-0.5 h-5 w-5 shrink-0 text-sky-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex-1 text-sm text-sky-900">
                  <p className="mb-2 font-semibold">
                    ✓ Page views are tracked automatically - no code needed!
                  </p>
                  <p className="mb-3">
                    The browser SDK automatically tracks all page navigation in
                    your Next.js app, including client-side route changes. This
                    happened when you navigated to this page.
                  </p>
                  <div className="mb-3 rounded-md bg-white p-3">
                    <p className="mb-1 text-xs font-semibold text-stone-700">
                      What&apos;s tracked:
                    </p>
                    <ul className="ml-4 list-disc space-y-1 text-xs text-stone-700">
                      <li>Page URL and route name</li>
                      <li>Navigation duration</li>
                      <li>Referrer information</li>
                      <li>Client-side route changes (Next.js Link clicks)</li>
                    </ul>
                  </div>
                  <div className="rounded-md bg-stone-50 p-2 text-xs text-stone-700">
                    <strong>Find in AI:</strong> pageViews | where name contains
                    &quot;demo-logging&quot; | project timestamp, name, url,
                    duration
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trace Logging */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Trace/Diagnostic Logging (Convenience Methods)
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Log diagnostic messages using convenience methods: logger.debug(),
              logger.info(), logger.warn()
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> traces | where
              customDimensions.component == &quot;demo-logging-page&quot; |
              where severityLevel in (0,1,2)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={handleDebugTrace}
                className="rounded-md bg-stone-200 px-3 py-2 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-300"
              >
                Debug (logger.debug)
              </button>
              <button
                onClick={handleInfoTrace}
                className="rounded-md bg-sky-200 px-3 py-2 text-xs font-medium text-sky-700 transition-colors hover:bg-sky-300"
              >
                Info (logger.info)
              </button>
              <button
                onClick={handleWarnTrace}
                className="rounded-md bg-amber-200 px-3 py-2 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-300"
              >
                Warning (logger.warn)
              </button>
            </div>
          </div>

          {/* Validation Errors */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Validation Errors (Expected Issues)
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              For validation errors and expected issues, use logger.warn()
              instead of logger.error() - these are not exceptional conditions.
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> traces | where severityLevel == 2 and
              message contains &quot;Validation failed&quot;
            </div>
            <button
              onClick={handleValidationError}
              className="w-full rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
            >
              Simulate Validation Error (uses logger.warn, not logger.error)
            </button>
          </div>

          {/* Child Loggers */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Child Loggers (Scoped Context)
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Create child loggers with default properties. All logs
              automatically include the context without repetition.
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> traces | where
              customDimensions.sessionId == &quot;demo-session-123&quot;
            </div>
            <button
              onClick={handleChildLogger}
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-700"
            >
              Create and Use Child Logger
            </button>
          </div>
        </div>

        {/* Advanced Features */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Auto-Logging Wrapper */}
          <div className="rounded-lg border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-stone-900">
                Auto-Logging with withLogging() Wrapper
              </h2>
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                CLIENT
              </span>
            </div>
            <p className="mb-4 text-sm text-stone-600">
              Wrap async functions to automatically track duration, success, and
              errors. No manual logging needed - it&apos;s all automatic!
            </p>
            <div className="mb-3 rounded-md bg-stone-50 p-2 text-xs text-stone-700">
              <strong>Find in AI:</strong> customEvents | where name ==
              &quot;demo_data_fetch_duration&quot; | project timestamp, name,
              customMeasurements.duration
            </div>
            <button
              onClick={handleAutoLogging}
              disabled={isLoading}
              className="w-full rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
            >
              Call Auto-Logged Function (withLogging wrapper)
            </button>
            <div className="mt-3 rounded-md bg-purple-50 p-3 text-xs text-purple-900">
              <strong>What gets logged automatically:</strong>
              <ul className="mt-1 ml-4 list-disc space-y-1">
                <li>
                  Event: &quot;demo_data_fetch_duration&quot; with duration
                  measurement
                </li>
                <li>Property: success = true/false</li>
                <li>On error: Logs error with function name and args</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Output Console */}
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-stone-900">
              Output Console
            </h3>
            <button
              onClick={clearOutput}
              className="rounded-md bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-200"
            >
              Clear
            </button>
          </div>
          <div className="h-64 overflow-y-auto rounded-md bg-stone-900 p-4 font-mono text-xs text-stone-100">
            {output.length === 0 ? (
              <p className="text-stone-500">
                Click any button above to see output...
              </p>
            ) : (
              output.map((line, index) => (
                <div key={index} className="mb-1">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Usage Instructions */}
        <div className="mt-6 rounded-lg border border-sky-200 bg-sky-50 p-6">
          <h3 className="mb-3 text-lg font-semibold text-sky-900">
            Usage in Your Code
          </h3>
          <div className="space-y-4 text-sm text-sky-900">
            <div>
              <p className="mb-1 font-medium">Import the unified logger:</p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                import {"{ logger }"} from &apos;@/lib/logger&apos;;
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">Log an error:</p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                logger.error(error, {"{ userId: '123', action: 'submit' }"});
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">Track a custom event:</p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                logger.event(&apos;ButtonClick&apos;, {"{ buttonId: 'submit' }"}
                );
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">Track performance:</p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                const timer = startTimer();
                <br />
                {/* ... do work ... */}
                <br />
                timer.end(&apos;operation_name&apos;);
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">
                Convenience methods (no need to pass level):
              </p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                logger.debug(&apos;Debug info&apos;, {"{ step: 1 }"});
                <br />
                logger.info(&apos;User logged in&apos;, {"{ userId: '123' }"});
                <br />
                logger.warn(&apos;Cache miss&apos;, {"{ key: 'user:123' }"});
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">
                Validation errors (use warn, not error):
              </p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                logger.warn(&apos;Invalid email&apos;, {"{ field: 'email' }"});
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">
                Child logger with default context:
              </p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                const reqLogger = logger.withProperties({"{ requestId: '123' }"}
                );
                <br />
                reqLogger.info(&apos;Started&apos;); // Includes requestId
              </code>
            </div>
            <div>
              <p className="mb-1 font-medium">Auto-logging wrapper:</p>
              <code className="block rounded bg-sky-100 p-2 font-mono text-xs">
                const fn = withLogging(&apos;my_operation&apos;, async () =&gt;{" "}
                {"{ ... }"});
                <br />
                await fn(); // Duration & errors auto-logged
              </code>
            </div>
          </div>
        </div>

        {/* Note */}
        <div className="mt-6 rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-xs text-stone-600">
            <strong>Note:</strong> This demo page is part of the template for
            demonstration purposes. All telemetry is sent to Application
            Insights (if configured) and also logged to the browser console. You
            can safely remove this page once you&apos;ve implemented logging in
            your application.
          </p>
        </div>
      </div>
    </div>
  );
}
