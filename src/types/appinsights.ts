/**
 * TypeScript Type Definitions for Application Insights
 *
 * Provides strongly-typed interfaces for telemetry data
 */

/**
 * Severity levels for telemetry
 * - 0: Verbose (detailed diagnostic info)
 * - 1: Information (general informational messages)
 * - 2: Warning (warning messages)
 * - 3: Error (error messages)
 * - 4: Critical (critical failures requiring immediate attention)
 */
export type SeverityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Common properties that can be attached to any telemetry
 */
export type TelemetryProperties = Record<string, string | number | boolean>;

/**
 * Numeric measurements for events
 */
export type TelemetryMeasurements = Record<string, number>;

/**
 * Unified logger interface that works in both server and client contexts
 */
export interface LoggerInterface {
  /**
   * Log an error/exception
   */
  error(
    error: Error,
    properties?: TelemetryProperties,
    severityLevel?: SeverityLevel
  ): void;

  /**
   * Log a custom event (user actions, feature usage, business events)
   */
  event(
    name: string,
    properties?: TelemetryProperties,
    measurements?: TelemetryMeasurements
  ): void;

  /**
   * Log a custom metric (performance indicators, business metrics)
   */
  metric(name: string, value: number, properties?: TelemetryProperties): void;

  /**
   * Log a trace/diagnostic message
   */
  trace(
    message: string,
    severityLevel?: SeverityLevel,
    properties?: TelemetryProperties
  ): void;

  /**
   * Log a dependency call (external APIs, databases, third-party services)
   */
  dependency(
    name: string,
    data: string,
    duration: number,
    success: boolean,
    resultCode?: number | string,
    dependencyTypeName?: string
  ): void;

  /**
   * Flush all pending telemetry
   */
  flush(): Promise<void>;

  /**
   * Convenience: Log verbose/debug information
   */
  verbose(message: string, properties?: TelemetryProperties): void;

  /**
   * Convenience: Log informational message
   */
  info(message: string, properties?: TelemetryProperties): void;

  /**
   * Convenience: Log warning message
   */
  warn(message: string, properties?: TelemetryProperties): void;

  /**
   * Convenience: Log critical error
   */
  critical(error: Error, properties?: TelemetryProperties): void;
}

/**
 * Custom event types for business logic
 * Extend this type with your application-specific events
 */
export type CustomEventName =
  | "UserLogin"
  | "UserLogout"
  | "ButtonClick"
  | "FormSubmit"
  | "PaymentCompleted"
  | "FeatureUsed"
  | string;

/**
 * Custom metric names for performance and business metrics
 * Extend this type with your application-specific metrics
 */
export type CustomMetricName =
  | "API_ResponseTime"
  | "DatabaseQueryTime"
  | "PageLoadTime"
  | "RenderTime"
  | "CacheHitRate"
  | string;

/**
 * Dependency types
 */
export type DependencyType =
  | "HTTP"
  | "SQL"
  | "Redis"
  | "Azure"
  | "External"
  | string;

/**
 * Error context for structured error logging
 */
export type ErrorContext = Record<string, string | number | boolean>;

/**
 * Performance timing data
 */
export interface PerformanceTiming {
  /** Operation name */
  name: string;
  /** Start timestamp */
  startTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Whether the operation succeeded */
  success: boolean;
  /** Additional properties */
  properties?: TelemetryProperties;
}

/**
 * API Request telemetry
 */
export interface ApiRequestTelemetry {
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Status code */
  statusCode: number;
  /** Duration in milliseconds */
  duration: number;
  /** Whether the request succeeded */
  success: boolean;
  /** User ID if authenticated */
  userId?: string;
  /** Additional properties */
  properties?: TelemetryProperties;
}

/**
 * User action telemetry
 */
export interface UserActionTelemetry {
  /** Action name */
  action: CustomEventName;
  /** Component/page where action occurred */
  component: string;
  /** User ID if authenticated */
  userId?: string;
  /** Additional properties */
  properties?: TelemetryProperties;
}

/**
 * Business event telemetry
 */
export interface BusinessEventTelemetry {
  /** Event name */
  eventName: CustomEventName;
  /** Event category (e.g., "Sales", "Marketing", "Support") */
  category: string;
  /** Numeric value if applicable */
  value?: number;
  /** Additional properties */
  properties?: TelemetryProperties;
  /** Measurements */
  measurements?: TelemetryMeasurements;
}
