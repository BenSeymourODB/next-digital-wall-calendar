/**
 * Application Insights Server SDK
 *
 * This module initializes the Node.js SDK for server-side telemetry.
 * Used in: middleware, API routes, server components, and server actions.
 *
 * Features:
 * - Auto-collects: HTTP requests, performance, exceptions, dependencies, console logs
 * - Works in both development and production
 * - Gracefully handles missing connection string
 */
import * as appInsights from "applicationinsights";

type TelemetryClient = appInsights.TelemetryClient;

let isInitialized = false;
let client: TelemetryClient | null = null;

/**
 * Initialize Application Insights Node.js SDK
 * Safe to call multiple times (idempotent)
 */
function initializeAppInsights(): void {
  if (isInitialized) {
    return;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    console.warn(
      "[AppInsights] APPLICATIONINSIGHTS_CONNECTION_STRING not set. Telemetry will only log to console."
    );
    isInitialized = true;
    return;
  }

  try {
    // Check if already initialized (prevents duplicate registration)
    if (appInsights.defaultClient) {
      client = appInsights.defaultClient;
      isInitialized = true;
      return;
    }

    const isDevelopment = process.env.NODE_ENV !== "production";

    appInsights
      .setup(connectionString)
      .setAutoCollectRequests(true) // Track HTTP requests
      .setAutoCollectPerformance(true, false) // Track performance metrics (extended metrics disabled)
      .setAutoCollectExceptions(true) // Track unhandled exceptions
      .setAutoCollectDependencies(true) // Track external dependencies (HTTP, DB, etc.)
      .setAutoCollectConsole(true, false) // Collect console logs (not winston/bunyan)
      .setAutoCollectPreAggregatedMetrics(true) // Pre-aggregated metrics
      .setSendLiveMetrics(true) // Enable Live Metrics Stream for real-time monitoring
      .setInternalLogging(isDevelopment, true) // Enable debug logging in dev for troubleshooting
      .start();

    client = appInsights.defaultClient;

    // Configure for better local development experience
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const appInsightsClient = appInsights.defaultClient as any;
    if (appInsightsClient?.config) {
      // Disable sampling in development so all telemetry is sent
      appInsightsClient.config.samplingPercentage = isDevelopment ? 100 : 100;

      // Reduce batch intervals in development for faster visibility
      // Production: 15000ms (15s), Development: 2000ms (2s)
      appInsightsClient.config.maxBatchIntervalMs = isDevelopment
        ? 2000
        : 15000;

      // Smaller batch size in development
      // Production: 250, Development: 10
      appInsightsClient.config.maxBatchSize = isDevelopment ? 10 : 250;

      // Enable more verbose telemetry in development
      if (isDevelopment) {
        appInsightsClient.config.enableAutoCollectExternalLoggers = true;
        appInsightsClient.config.enableAutoCollectConsole = true;
      }
    }

    isInitialized = true;

    console.log(
      `[AppInsights] Server SDK initialized successfully (${isDevelopment ? "development" : "production"} mode)`
    );
    console.log(
      "[AppInsights] Live Metrics Stream: ENABLED - View at Azure Portal > Live Metrics"
    );
    if (isDevelopment) {
      console.log(
        "[AppInsights] Development mode: Telemetry batched every 2 seconds, 100% sampling"
      );
    }
  } catch (error) {
    console.error("[AppInsights] Failed to initialize:", error);
    isInitialized = true; // Mark as initialized to prevent retries
  }
}

// Initialize on module load (server-side only)
if (typeof window === "undefined") {
  initializeAppInsights();

  // Flush telemetry on process exit to ensure nothing is lost
  // This is especially important in development and serverless environments
  const flushAndExit = (exitCode: number) => {
    if (client) {
      console.log("[AppInsights] Flushing telemetry before exit...");
      client.flush();
      // Give it a moment to send, then exit
      setTimeout(() => {
        process.exit(exitCode);
      }, 500);
    } else {
      process.exit(exitCode);
    }
  };

  // Handle various exit scenarios
  process.on("beforeExit", () => {
    if (client) {
      client.flush();
    }
  });

  process.on("exit", () => {
    if (client) {
      client.flush();
    }
  });

  // Handle Ctrl+C
  process.on("SIGINT", () => {
    flushAndExit(0);
  });

  // Handle kill command
  process.on("SIGTERM", () => {
    flushAndExit(0);
  });
}

/**
 * Get the default Application Insights client
 * Returns null if not initialized or connection string missing
 */
export function getClient(): TelemetryClient | null {
  return client;
}

/**
 * Log an error/exception to Application Insights
 *
 * @param error - The error object
 * @param properties - Additional context properties
 * @param severityLevel - Error severity (0=Verbose, 1=Info, 2=Warning, 3=Error, 4=Critical)
 */
export function logError(
  error: Error,
  properties?: Record<string, string | number | boolean>,
  severityLevel: 0 | 1 | 2 | 3 | 4 = 3
): void {
  const props = {
    ...properties,
    timestamp: new Date().toISOString(),
  };

  if (client) {
    // Include built-in severity for native filtering in Azure Portal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const telemetry: any = {
      exception: error,
      properties: props,
      severity: severityLevel, // Node SDK expects "severity"
      severityLevel, // Added for compatibility (ignored by Node but harmless)
    };
    client.trackException(telemetry);
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production" || !client) {
    console.error("[AppInsights] Error:", error.message, props);
  }
}

/**
 * Log a custom event to Application Insights
 * Use for business events, user actions, feature usage, etc.
 *
 * @param name - Event name (e.g., "UserLogin", "PaymentCompleted")
 * @param properties - Event properties
 * @param measurements - Numeric measurements
 */
export function logEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
  measurements?: Record<string, number>
): void {
  if (client) {
    client.trackEvent({
      name,
      properties,
      measurements,
    });
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production" || !client) {
    console.log(`[AppInsights] Event: ${name}`, properties, measurements);
  }
}

/**
 * Log a trace/diagnostic message to Application Insights
 * Use for debugging, audit trails, diagnostic information
 *
 * @param message - Trace message
 * @param severityLevel - 0=Verbose, 1=Info, 2=Warning, 3=Error, 4=Critical
 * @param properties - Additional context
 */
export function logTrace(
  message: string,
  severityLevel: 0 | 1 | 2 | 3 | 4 = 1,
  properties?: Record<string, string | number | boolean>
): void {
  const props = {
    ...properties,
    severityLevel: severityLevel.toString(),
  };

  if (client) {
    // Include built-in severity for native filtering in Azure Portal
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const telemetry: any = {
      message,
      properties: props,
      severity: severityLevel, // Node SDK expects "severity"
    };
    client.trackTrace(telemetry);
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production" || !client) {
    const level = ["VERBOSE", "INFO", "WARNING", "ERROR", "CRITICAL"][
      severityLevel
    ];
    console.log(`[AppInsights] Trace [${level}]: ${message}`, properties);
  }
}

/**
 * Log a dependency call to Application Insights
 * Use for external API calls, database queries, third-party services
 *
 * @param name - Dependency name (e.g., "GET /api/users")
 * @param data - Command/query executed (e.g., SQL query, HTTP URL)
 * @param duration - Duration in milliseconds
 * @param success - Whether the call succeeded
 * @param resultCode - Response code (e.g., HTTP status, DB error code)
 * @param dependencyTypeName - Type (e.g., "HTTP", "SQL", "Redis")
 */
export function logDependency(
  name: string,
  data: string,
  duration: number,
  success: boolean,
  resultCode: number | string = 0,
  dependencyTypeName = "HTTP"
): void {
  if (client) {
    client.trackDependency({
      name,
      data,
      duration,
      success,
      resultCode,
      dependencyTypeName,
      target: data, // URL or server name
    });
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production" || !client) {
    console.log(
      `[AppInsights] Dependency: ${name} (${dependencyTypeName}) - ${duration}ms - ${success ? "Success" : "Failed"} (${resultCode})`
    );
  }
}

/**
 * Flush all telemetry to Application Insights
 * Useful before serverless function termination or process exit
 */
export async function flush(): Promise<void> {
  if (client) {
    client.flush();
    console.log("[AppInsights] Telemetry flushed");
    // Add small delay to ensure flush completes
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

// Export the raw SDK for advanced usage
export { appInsights };
export default client;
