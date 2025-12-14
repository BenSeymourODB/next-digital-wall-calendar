/**
 * Application Insights Client SDK
 *
 * This module initializes the Browser SDK for client-side telemetry.
 * Used in: client components, browser context, and user interactions.
 *
 * Features:
 * - Auto-tracks: Page views, AJAX calls, unhandled exceptions
 * - Performance monitoring (page load times, AJAX performance)
 * - Custom event tracking
 * - Works in both development and production
 */

"use client";

import { DistributedTracingModes } from "@microsoft/applicationinsights-common";
import { ApplicationInsights } from "@microsoft/applicationinsights-web";

let appInsightsInstance: ApplicationInsights | null = null;
let isInitialized = false;

// Configure allow/deny lists for auto-tracked client dependencies (fetch/XHR)
// - If ALLOWLIST has entries, only matching URLs will be sent (others dropped)
// - DENYLIST is always applied to drop noisy/irrelevant endpoints
const DEPENDENCY_ALLOWLIST: RegExp[] = [
  // Example: only allow your app/API domains
  // /https?:\/\/api\.yourdomain\.com/i,
  // /https?:\/\/yourdomain\.com/i,
];

const DEPENDENCY_DENYLIST: RegExp[] = [
  /\/_next\//,
  /\/_next\/data\//,
  /\/static\//,
  /\.map($|\?)/,
  /dc\.services\.visualstudio\.com/i, // AI ingestion
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /analytics/i,
  /segment\.io/i,
  /fullstory\.com/i,
  /hotjar\.com/i,
];

/**
 * Initialize Application Insights Browser SDK
 * Should be called once on client mount (e.g., in a provider or layout effect)
 *
 * @returns ApplicationInsights instance or null if connection string missing
 */
export function initializeAppInsights(): ApplicationInsights | null {
  // Only run in browser
  if (typeof window === "undefined") {
    return null;
  }

  // Return existing instance if already initialized
  if (isInitialized && appInsightsInstance) {
    return appInsightsInstance;
  }

  const connectionString =
    process.env.NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[AppInsights] NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING not set. Client telemetry disabled."
      );
    }
    isInitialized = true;
    return null;
  }

  try {
    const isDevelopment = process.env.NODE_ENV !== "production";

    appInsightsInstance = new ApplicationInsights({
      config: {
        connectionString,
        enableAutoRouteTracking: true, // Track route changes automatically (Next.js router)
        enableRequestHeaderTracking: true, // Include request headers in telemetry
        enableResponseHeaderTracking: true, // Include response headers
        enableAjaxErrorStatusText: true, // Include detailed AJAX error text
        enableAjaxPerfTracking: true, // Track AJAX performance with window.performance
        maxAjaxPerfLookupAttempts: 3, // Attempts to find performance entries
        ajaxPerfLookupDelay: 25, // Delay in ms before lookup
        enableUnhandledPromiseRejectionTracking: true, // Track unhandled promise rejections
        disableFetchTracking: false, // Enable fetch tracking for client dependency telemetry and tracing
        disableAjaxTracking: false, // Track XMLHttpRequest calls
        disableExceptionTracking: false, // Track unhandled exceptions
        enableCorsCorrelation: true, // Enable CORS correlation for distributed tracing
        distributedTracingMode: DistributedTracingModes.AI_AND_W3C,
        // Avoid tracking internal Next.js/assets and AI ingestion
        excludeRequestFromAutoTrackingPatterns: [
          /\/_next\//,
          /\/_next\/data\//,
          /\/static\//,
          /\.map($|\?)/,
          /dc\.services\.visualstudio\.com/i,
        ],
        correlationHeaderExcludedDomains: ["dc.services.visualstudio.com"],
        enableDebug: isDevelopment, // Enable debug mode in development
        loggingLevelConsole: isDevelopment ? 2 : 0, // 0=OFF, 1=CRITICAL, 2=WARNING (verbose in dev)
        loggingLevelTelemetry: 1, // 0=OFF, 1=CRITICAL, 2=WARNING
        enablePerfMgr: true, // Enable performance manager for instrumentation
        samplingPercentage: isDevelopment ? 100 : 100, // 100% sampling (no dropping)
        maxBatchInterval: isDevelopment ? 2000 : 15000, // Send every 2s in dev, 15s in prod
        maxBatchSizeInBytes: isDevelopment ? 10000 : 1000000, // Smaller batches in dev (10KB vs 1MB)
        disableTelemetry: false, // Always enabled
      },
    });

    appInsightsInstance.loadAppInsights();

    // Telemetry initializer for allow/deny filtering of dependencies
    appInsightsInstance.addTelemetryInitializer((envelope) => {
      try {
        const baseType = (envelope as unknown as { baseType?: string })
          ?.baseType;
        if (baseType === "RemoteDependencyData") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const baseData = (envelope as unknown as { baseData?: any })
            ?.baseData;
          const target: string =
            (baseData?.target as string) || (baseData?.data as string) || "";

          if (DEPENDENCY_ALLOWLIST.length > 0) {
            const allowed = DEPENDENCY_ALLOWLIST.some((re) => re.test(target));
            if (!allowed) {
              return false; // drop
            }
          }
          const denied = DEPENDENCY_DENYLIST.some((re) => re.test(target));
          if (denied) {
            return false; // drop
          }
        }
      } catch {
        // best-effort; never throw from initializer
      }
      return true;
    });

    isInitialized = true;

    if (isDevelopment) {
      console.log(
        `[AppInsights] Client SDK initialized successfully (${isDevelopment ? "development" : "production"} mode)`
      );
      console.log(
        "[AppInsights] Development mode: Debug enabled, telemetry sent every 2 seconds, 100% sampling"
      );
    }
    return appInsightsInstance;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AppInsights] Failed to initialize client SDK:", error);
    }
    isInitialized = true;
    return null;
  }
}

/**
 * Get the Application Insights instance
 * Automatically initializes if not already done
 */
export function getAppInsights(): ApplicationInsights | null {
  if (!appInsightsInstance && !isInitialized) {
    return initializeAppInsights();
  }
  return appInsightsInstance;
}

/**
 * Track an exception/error in the browser
 *
 * @param error - Error object or ErrorEvent
 * @param severityLevel - 0=Verbose, 1=Info, 2=Warning, 3=Error, 4=Critical
 * @param properties - Additional context properties
 */
export function trackException(
  error: Error | ErrorEvent,
  severityLevel: 0 | 1 | 2 | 3 | 4 = 3,
  properties?: Record<string, string | number | boolean>
): void {
  const ai = getAppInsights();

  const errorObj =
    error instanceof ErrorEvent
      ? error.error || new Error(error.message)
      : error;

  const props = {
    ...properties,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  if (ai) {
    ai.trackException({
      exception: errorObj,
      severityLevel,
      properties: props,
    });
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production") {
    console.error("[AppInsights] Exception:", errorObj.message, props);
  }
}

/**
 * Track a custom event (user actions, feature usage, business events)
 *
 * @param name - Event name (e.g., "ButtonClick", "FormSubmit")
 * @param properties - Event properties
 * @param measurements - Numeric measurements
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string | number | boolean>,
  measurements?: Record<string, number>
): void {
  const ai = getAppInsights();

  if (ai) {
    ai.trackEvent({
      name,
      properties,
      measurements,
    });
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production") {
    console.log(`[AppInsights] Event: ${name}`, properties, measurements);
  }
}

/**
 * Track a trace/diagnostic message
 *
 * @param message - Trace message
 * @param severityLevel - 0=Verbose, 1=Info, 2=Warning, 3=Error, 4=Critical
 * @param properties - Additional context
 */
export function trackTrace(
  message: string,
  severityLevel: 0 | 1 | 2 | 3 | 4 = 1,
  properties?: Record<string, string | number | boolean>
): void {
  const ai = getAppInsights();

  if (ai) {
    ai.trackTrace({
      message,
      severityLevel,
      properties,
    });
  }

  // Log to console in development or if App Insights not configured
  if (process.env.NODE_ENV !== "production") {
    const level = ["VERBOSE", "INFO", "WARNING", "ERROR", "CRITICAL"][
      severityLevel
    ];
    console.log(`[AppInsights] Trace [${level}]: ${message}`, properties);
  }
}

/**
 * Flush all pending telemetry
 * Useful before page unload or component unmount
 */
export function flush(): void {
  const ai = getAppInsights();

  if (ai) {
    ai.flush();
    if (process.env.NODE_ENV !== "production") {
      console.log("[AppInsights] Client telemetry flushed");
    }
  }
}

/**
 * Set authenticated user context
 * Use this after user login to track user-specific telemetry
 *
 * @param userId - Unique user identifier
 * @param accountId - Account/tenant identifier (optional)
 */
export function setAuthenticatedUserContext(
  userId: string,
  accountId?: string
): void {
  const ai = getAppInsights();

  if (ai) {
    ai.setAuthenticatedUserContext(userId, accountId, true);
    if (process.env.NODE_ENV !== "production") {
      console.log(`[AppInsights] User context set: ${userId}`, accountId);
    }
  }
}

/**
 * Clear authenticated user context
 * Use this after user logout
 */
export function clearAuthenticatedUserContext(): void {
  const ai = getAppInsights();

  if (ai) {
    ai.clearAuthenticatedUserContext();
    if (process.env.NODE_ENV !== "production") {
      console.log("[AppInsights] User context cleared");
    }
  }
}

// Export the raw instance for advanced usage
export { appInsightsInstance };
