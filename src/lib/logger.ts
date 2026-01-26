/**
 * Unified Logger for Application Insights
 *
 * This module provides a simple, intuitive interface for logging that works in both
 * server and client contexts. It automatically detects the environment and uses
 * the appropriate SDK (Node.js or Browser).
 *
 * ## Core Concepts
 *
 * ### Properties (Structured Metadata)
 * Properties are key-value pairs that provide structured context to your logs.
 * They enable filtering, grouping, and analysis in Azure Portal.
 *
 * - **Type**: `Record<string, string | number | boolean>`
 * - **Purpose**: Add searchable, filterable context to every log entry
 * - **Examples**: userId, endpoint, operation, errorType, statusCode
 * - **Best Practice**: Use consistent property names across your application
 *
 * ```typescript
 * // Good: Structured properties enable powerful queries
 * logger.error(error, {
 *   userId: "123",           // string
 *   endpoint: "/api/users",  // string
 *   statusCode: 500,         // number
 *   retryable: true          // boolean
 * });
 *
 * // Bad: Embedding data in message string
 * logger.log(`User 123 error at /api/users with status 500`); // Not searchable!
 * ```
 *
 * ### Measurements (Numeric Metrics)
 * Measurements are numeric values tracked over time for analysis and charting.
 *
 * - **Type**: `Record<string, number>`
 * - **Purpose**: Track quantitative data (duration, count, amount, rate)
 * - **Examples**: duration, amount, quantity, responseTime
 * - **Use Case**: Performance metrics, business KPIs, aggregations
 *
 * ```typescript
 * logger.event('PurchaseCompleted',
 *   { userId: "123", productId: "ABC" },  // Properties (who/what)
 *   { amount: 99.99, quantity: 2 }        // Measurements (how much)
 * );
 * ```
 *
 * ## Simple API - Only 4 methods
 *
 * 1. **`logger.error(error, properties?)`** - Log errors/exceptions
 * 2. **`logger.log(message, properties?, level?)`** - Log diagnostic messages
 * 3. **`logger.event(name, properties?, measurements?)`** - Log user actions/events
 * 4. **`logger.dependency(name, target, duration, success, resultCode, type?)`** - Track external calls
 *
 * @example
 * // Error logging with context
 * logger.error(new Error('Failed to fetch'), {
 *   userId: '123',
 *   endpoint: '/api/users',
 *   operation: 'getUserProfile'
 * });
 *
 * // Diagnostic logging at different levels
 * logger.log('User logged in', { userId: '123', method: 'oauth' });
 * logger.log('Cache miss, using fallback', { key: 'user:123' }, LogLevel.Warn);
 * logger.log('Debug: Processing step 1', { step: 1, data: {...} }, LogLevel.Debug);
 *
 * // Or pass level directly without properties
 * logger.log('Cache miss', LogLevel.Warn);
 * logger.log('Debug info', LogLevel.Debug);
 *
 * // Event tracking with measurements
 * logger.event('ButtonClick', { buttonId: 'submit', page: '/checkout' });
 * logger.event('PurchaseCompleted',
 *   { userId: '123', productId: 'ABC' },
 *   { amount: 99.99, tax: 7.99, quantity: 2 }
 * );
 *
 * // Dependency tracking (server-only)
 * logger.dependency('GET /users', 'https://api.example.com/users', 245, true, 200);
 */

const isServer = typeof window === "undefined";

/**
 * Log levels for diagnostic messages
 *
 * - **Debug**: Detailed information for diagnosing issues (Severity 0)
 * - **Info**: General informational messages (Severity 1) - default
 * - **Warn**: Warning conditions that should be reviewed (Severity 2)
 *
 * @example
 * logger.log('Processing step 1', { step: 1 }, LogLevel.Debug);
 * logger.log('User logged in', { userId: '123' }, LogLevel.Info);
 * logger.log('Cache miss', { key: 'user:123' }, LogLevel.Warn);
 */
export enum LogLevel {
  Debug = "debug",
  Info = "info",
  Warn = "warn",
}

// Developer-facing types for structured telemetry
export type Properties = Record<string, string | number | boolean>;
export type Measurements = Record<string, number>;
export type LogLevelInput = LogLevel | "debug" | "info" | "warn";

/**
 * Severity level for Application Insights (internal)
 */
type SeverityLevel = 0 | 1 | 2 | 3 | 4;

/**
 * Convert user-friendly log level to Application Insights severity
 */
function normalizeLevel(level: LogLevelInput): LogLevel {
  // Handle both enum values and string literals
  switch (level) {
    case LogLevel.Debug:
    case "debug":
      return LogLevel.Debug;
    case LogLevel.Info:
    case "info":
      return LogLevel.Info;
    case LogLevel.Warn:
    case "warn":
      return LogLevel.Warn;
    default:
      return LogLevel.Info;
  }
}

function logLevelToSeverity(level: LogLevelInput): SeverityLevel {
  const normalized = normalizeLevel(level);
  switch (normalized) {
    case LogLevel.Debug:
      return 0; // Verbose
    case LogLevel.Info:
      return 1; // Information
    case LogLevel.Warn:
      return 2; // Warning
    default:
      return 1; // Default to info
  }
}

/**
 * Unified Logger Implementation
 */
class Logger {
  private readonly defaultProperties: Properties;

  constructor(defaultProperties: Properties = {}) {
    this.defaultProperties = defaultProperties;
  }

  /**
   * Log an error or exception
   *
   * Use this for **unexpected errors** like API failures, database errors, network issues,
   * or uncaught exceptions. For **expected issues** like validation errors, use
   * `logger.log(message, properties, 'warn')` instead.
   *
   * Works in both server and client contexts - automatically uses the correct SDK.
   *
   * @param error - The Error object to log (includes stack trace automatically)
   * @param properties - Optional structured metadata for filtering/grouping in Azure Portal.
   *                     Common properties: userId, endpoint, operation, errorType, statusCode.
   *                     Add `severity: "critical"` for critical errors that need immediate attention.
   *                     See "Properties (Structured Metadata)" in module docs for details.
   *
   * @example
   * // API/Database error (unexpected)
   * try {
   *   await database.users.create(data);
   * } catch (error) {
   *   logger.error(error as Error, {
   *     operation: 'create-user',
   *     userId: data.email,
   *     database: 'postgres'
   *   });
   *   throw error;
   * }
   *
   * @example
   * // Critical error requiring immediate attention
   * logger.error(error as Error, {
   *   operation: 'payment-processing',
   *   severity: 'critical',  // Filter in Azure Portal for critical errors
   *   paymentId: '12345'
   * });
   *
   * @example
   * // ❌ Wrong - Don't use for validation errors
   * if (!email) {
   *   logger.error(new Error('Email missing')); // NO!
   * }
   *
   * // ✅ Right - Use logger.log for validation
   * if (!email) {
   *   logger.log('Email validation failed', { field: 'email' }, 'warn');
   * }
   */
  error(error: Error, properties?: Properties): void {
    const merged = {
      ...this.defaultProperties,
      ...(properties ?? {}),
    };
    if (isServer) {
      // Use server SDK
      import("./appinsights-server").then(({ logError }) => {
        logError(error, merged, 3); // Severity 3 = Error
      });
    } else {
      // Use client SDK
      import("./appinsights-client").then(({ trackException }) => {
        trackException(error, 3, merged);
      });
    }
  }

  /**
   * Convenience: Critical error (Severity 4)
   *
   * Use for outages, data loss, security incidents, or anything requiring immediate attention.
   */
  critical(error: Error, properties?: Properties): void {
    const merged = {
      ...this.defaultProperties,
      ...(properties ?? {}),
    };
    if (isServer) {
      import("./appinsights-server").then(({ logError }) => {
        logError(error, merged, 4); // Severity 4 = Critical
      });
    } else {
      import("./appinsights-client").then(({ trackException }) => {
        trackException(error, 4, merged);
      });
    }
  }

  /**
   * Log a diagnostic message (trace)
   *
   * Use this for informational messages, debug traces, warnings, and **validation errors**.
   * This is the most versatile logging method - covers everything except unexpected exceptions.
   *
   * Works in both server and client contexts - automatically uses the correct SDK.
   *
   * @param message - Human-readable message describing what happened. Keep it concise and consistent.
   * @param properties - Optional structured metadata for filtering/grouping in Azure Portal.
   *                     Common properties: userId, operation, component, action, field.
   *                     See "Properties (Structured Metadata)" in module docs for details.
   * @param level - Severity level (default: LogLevel.Info):
   *                - **LogLevel.Debug** (Severity 0): Detailed diagnostic info for troubleshooting
   *                - **LogLevel.Info** (Severity 1): General informational messages - DEFAULT
   *                - **LogLevel.Warn** (Severity 2): Warning conditions, validation errors, expected issues
   *
   * @example
   * // Info level (default) - general messages
   * logger.log('User logged in successfully', {
   *   userId: '123',
   *   method: 'oauth',
   *   provider: 'google'
   * });
   *
   * @example
   * // Debug level - detailed diagnostic info (with enum)
   * logger.log('Processing payment workflow', {
   *   step: 'validate-card',
   *   cardType: 'visa',
   *   last4: '1234'
   * }, LogLevel.Debug);
   *
   * @example
   * // Warning level - validation errors and expected issues
   * if (!email || !isValidEmail(email)) {
   *   logger.log('Invalid email provided', {
   *     field: 'email',
   *     value: email || 'empty',
   *     component: 'signup-form'
   *   }, LogLevel.Warn);
   *   return { error: 'Please provide a valid email' };
   * }
   *
   * @example
   * // Improved DX - pass level directly without properties
   * logger.log('Cache miss, falling back to database', LogLevel.Warn);
   * logger.log('Cache miss, falling back to database', 'warn'); // also supported
   * logger.log('Debugging step 1', LogLevel.Debug);
   * logger.log('Operation completed'); // Defaults to LogLevel.Info
   *
   * @example
   * // ❌ Wrong - Don't use for unexpected errors
   * logger.log('Database connection failed', LogLevel.Warn); // NO! Use logger.error()
   *
   * // ✅ Right - Use logger.error for unexpected errors
   * try {
   *   await connectDatabase();
   * } catch (error) {
   *   logger.error(error as Error, { operation: 'connect-db' });
   * }
   */
  log(message: string, level?: LogLevelInput): void;
  log(message: string, properties?: Properties, level?: LogLevelInput): void;
  log(
    message: string,
    propertiesOrLevel?: Properties | LogLevelInput,
    level?: LogLevelInput
  ): void {
    // Determine if second argument is level or properties
    let actualProperties: Properties | undefined;
    let actualLevel: LogLevelInput = LogLevel.Info;

    if (propertiesOrLevel !== undefined) {
      // Check if it's a LogLevel enum value
      if (
        typeof propertiesOrLevel === "string" &&
        (Object.values(LogLevel) as string[]).includes(
          propertiesOrLevel as LogLevel
        )
      ) {
        actualLevel = propertiesOrLevel as LogLevel;
        actualProperties = undefined;
      } else if (
        typeof propertiesOrLevel === "string" &&
        (propertiesOrLevel === "debug" ||
          propertiesOrLevel === "info" ||
          propertiesOrLevel === "warn")
      ) {
        actualLevel = propertiesOrLevel as LogLevelInput;
        actualProperties = undefined;
      } else if (
        typeof propertiesOrLevel === "object" &&
        propertiesOrLevel !== null
      ) {
        actualProperties = propertiesOrLevel;
        actualLevel = level ?? LogLevel.Info;
      }
    } else {
      actualLevel = level ?? LogLevel.Info;
    }

    const severity = logLevelToSeverity(actualLevel);
    const merged = {
      ...this.defaultProperties,
      ...(actualProperties ?? {}),
    };

    if (isServer) {
      import("./appinsights-server").then(({ logTrace }) => {
        logTrace(message, severity, merged);
      });
    } else {
      import("./appinsights-client").then(({ trackTrace }) => {
        trackTrace(message, severity, merged);
      });
    }
  }

  /**
   * Convenience: Debug level message
   */
  debug(message: string, properties?: Properties): void {
    this.log(message, properties, LogLevel.Debug);
  }

  /**
   * Convenience: Info level message
   */
  info(message: string, properties?: Properties): void {
    this.log(message, properties, LogLevel.Info);
  }

  /**
   * Convenience: Warn level message
   */
  warn(message: string, properties?: Properties): void {
    this.log(message, properties, LogLevel.Warn);
  }

  /**
   * Log a custom event
   *
   * Use this for **user actions** (button clicks, navigation), **business events**
   * (purchase completed, subscription created), **feature usage** (dark mode enabled,
   * filter applied), and **A/B test tracking**. Events are ideal for analytics and
   * understanding user behavior patterns.
   *
   * Works in both server and client contexts - automatically uses the correct SDK.
   *
   * @param name - Event name using PascalCase (e.g., 'ButtonClick', 'PurchaseCompleted', 'FeatureToggled').
   *               Use consistent naming for easier querying in Azure Portal.
   * @param properties - Optional structured metadata describing the event context (WHO/WHAT/WHERE).
   *                     Common properties: userId, buttonId, page, feature, component, action.
   *                     See "Properties (Structured Metadata)" in module docs for details.
   * @param measurements - Optional numeric metrics associated with the event (HOW MUCH/HOW MANY).
   *                       Common measurements: amount, quantity, duration, count, responseTime.
   *                       See "Measurements (Numeric Metrics)" in module docs for details.
   *
   * @example
   * // User action - button click
   * logger.event('ButtonClick', {
   *   buttonId: 'submit-form',
   *   page: '/checkout',
   *   userId: '123',
   *   authenticated: true
   * });
   *
   * @example
   * // Business event with financial measurements
   * logger.event('PurchaseCompleted',
   *   {
   *     userId: '123',
   *     productId: 'ABC-789',
   *     paymentMethod: 'credit-card',
   *     country: 'US'
   *   },
   *   {
   *     amount: 99.99,        // Total price
   *     tax: 7.99,            // Tax amount
   *     shipping: 5.00,       // Shipping cost
   *     quantity: 2           // Number of items
   *   }
   * );
   *
   * @example
   * // Feature usage tracking
   * logger.event('FeatureToggled', {
   *   feature: 'dark-mode',
   *   enabled: true,
   *   userId: '123',
   *   source: 'settings-page'
   * });
   *
   * @example
   * // A/B test variant tracking
   * logger.event('ExperimentVariantAssigned', {
   *   experimentId: 'checkout-redesign',
   *   variantId: 'variant-b',
   *   userId: '123'
   * });
   *
   * @example
   * // Performance event with timer (see startTimer() helper)
   * const timer = startTimer();
   * await performOperation();
   * timer.end('OperationCompleted', {
   *   operationType: 'data-export',
   *   recordCount: 1000
   * });
   * // Automatically logs { duration: 245 } as measurement
   */
  event(
    name: string,
    properties?: Properties,
    measurements?: Measurements
  ): void {
    const merged = {
      ...this.defaultProperties,
      ...(properties ?? {}),
    };
    if (isServer) {
      import("./appinsights-server").then(({ logEvent }) => {
        logEvent(name, merged, measurements);
      });
    } else {
      import("./appinsights-client").then(({ trackEvent }) => {
        trackEvent(name, merged, measurements);
      });
    }
  }

  /**
   * Track a dependency call (external service)
   *
   * Use this to monitor **external service calls**: HTTP APIs, database queries, Redis/cache
   * operations, blob storage, message queues, third-party services (Stripe, SendGrid, Twilio).
   * Helps identify slow dependencies and track service health.
   *
   * **Server-side only** - Client-side HTTP dependencies (fetch, XHR) are auto-tracked by the
   * browser SDK, so you don't need to manually log them in client components.
   *
   * @param name - Operation name describing the action (e.g., 'GET /users', 'redis.get',
   *               'database.query', 'stripe.createCharge'). Keep consistent for aggregation.
   * @param target - Target URL or connection string identifying where the call went
   *                 (e.g., 'https://api.example.com', 'postgres://db.example.com', 'redis-cache').
   * @param duration - How long the call took in milliseconds. Use `Date.now() - startTime`.
   * @param success - Whether the call succeeded (true) or failed (false).
   * @param resultCode - HTTP status code (200, 404, 500) or database error code.
   *                     Use 0 for unknown/network failures.
   * @param type - Dependency type for grouping (default: 'HTTP').
   *               Common types: 'HTTP', 'SQL', 'Redis', 'Azure blob', 'Azure table',
   *               'Azure queue', 'MongoDB', 'Stripe', 'SendGrid'.
   *
   * @example
   * // HTTP API call with full error handling
   * const startTime = Date.now();
   * try {
   *   const response = await fetch('https://api.example.com/users');
   *   const data = await response.json();
   *   const duration = Date.now() - startTime;
   *
   *   logger.dependency(
   *     'GET /users',                      // Operation name
   *     'https://api.example.com/users',   // Target URL
   *     duration,                          // Duration in ms
   *     response.ok,                       // Success (true if 2xx)
   *     response.status,                   // HTTP status code
   *     'HTTP'                             // Dependency type
   *   );
   *
   *   return data;
   * } catch (error) {
   *   const duration = Date.now() - startTime;
   *
   *   // Log failed dependency
   *   logger.dependency(
   *     'GET /users',
   *     'https://api.example.com/users',
   *     duration,
   *     false,  // Failed
   *     0,      // No HTTP status (network error)
   *     'HTTP'
   *   );
   *
   *   // Also log the error for debugging
   *   logger.error(error as Error, {
   *     operation: 'fetch-users',
   *     endpoint: '/users'
   *   });
   *
   *   throw error;
   * }
   *
   * @example
   * // Database query
   * const startTime = Date.now();
   * try {
   *   const users = await db.query('SELECT * FROM users WHERE active = true');
   *   logger.dependency(
   *     'database.query',
   *     'postgres://db.example.com/myapp',
   *     Date.now() - startTime,
   *     true,
   *     200,  // Success code
   *     'SQL'
   *   );
   * } catch (error) {
   *   logger.dependency(
   *     'database.query',
   *     'postgres://db.example.com/myapp',
   *     Date.now() - startTime,
   *     false,
   *     500,  // Error code
   *     'SQL'
   *   );
   * }
   *
   * @example
   * // Redis cache operation
   * const startTime = Date.now();
   * const value = await redis.get('user:123');
   * logger.dependency(
   *   'redis.get',
   *   'redis-cache.example.com',
   *   Date.now() - startTime,
   *   value !== null,  // Success if value found
   *   value !== null ? 200 : 404,
   *   'Redis'
   * );
   *
   * @example
   * // Third-party service (Stripe)
   * const startTime = Date.now();
   * try {
   *   const charge = await stripe.charges.create({ amount: 1000, currency: 'usd' });
   *   logger.dependency(
   *     'stripe.createCharge',
   *     'https://api.stripe.com',
   *     Date.now() - startTime,
   *     true,
   *     200,
   *     'Stripe'
   *   );
   * } catch (error) {
   *   logger.dependency(
   *     'stripe.createCharge',
   *     'https://api.stripe.com',
   *     Date.now() - startTime,
   *     false,
   *     error.statusCode || 500,
   *     'Stripe'
   *   );
   * }
   */
  dependency(
    name: string,
    target: string,
    duration: number,
    success: boolean,
    resultCode: number | string = 0,
    type = "HTTP"
  ): void {
    if (isServer) {
      import("./appinsights-server").then(({ logDependency }) => {
        logDependency(name, target, duration, success, resultCode, type);
      });
    } else {
      // Client-side dependencies are auto-tracked
      if (process.env.NODE_ENV !== "production") {
        console.log(
          `[AppInsights] Dependency: ${name} (${type}) - ${duration}ms - ${success ? "Success" : "Failed"} (${resultCode})`
        );
      }
    }
  }

  /**
   * Flush all pending telemetry
   *
   * Useful before process exit or in serverless functions.
   * Automatically called on process exit in server environments.
   */
  async flush(): Promise<void> {
    if (isServer) {
      const { flush } = await import("./appinsights-server");
      return flush();
    } else {
      const { flush } = await import("./appinsights-client");
      flush();
    }
  }

  /**
   * Set authenticated user context (client-side only)
   *
   * Use this after user login to track user-specific telemetry.
   * This method only works in client components (browser).
   *
   * @param userId - Unique user identifier
   * @param accountId - Account/tenant identifier (optional)
   *
   * @example
   * // After user login
   * logger.setUserContext('user-123', 'account-456');
   */
  async setUserContext(userId: string, accountId?: string): Promise<void> {
    if (!isServer) {
      const { setAuthenticatedUserContext } =
        await import("./appinsights-client");
      setAuthenticatedUserContext(userId, accountId);
    } else {
      console.warn(
        "[Logger] setUserContext() is only available on the client side"
      );
    }
  }

  /**
   * Clear authenticated user context (client-side only)
   *
   * Use this after user logout to stop tracking user-specific telemetry.
   * This method only works in client components (browser).
   *
   * @example
   * // After user logout
   * logger.clearUserContext();
   */
  async clearUserContext(): Promise<void> {
    if (!isServer) {
      const { clearAuthenticatedUserContext } =
        await import("./appinsights-client");
      clearAuthenticatedUserContext();
    } else {
      console.warn(
        "[Logger] clearUserContext() is only available on the client side"
      );
    }
  }

  /**
   * Create a child logger that automatically merges given properties
   *
   * Useful for modules/components that want to attach consistent context.
   *
   * @example
   * const apiLogger = logger.withProperties({ component: 'api', endpoint: '/users' });
   * apiLogger.info('Fetching users');
   */
  withProperties(properties: Properties): Logger {
    return new Logger({ ...this.defaultProperties, ...properties });
  }
}

// Export singleton instance
export const logger = new Logger();

/**
 * Create a performance timer
 *
 * Helper utility to measure operation duration and automatically log it as a custom event
 * with measurement. Simplifies performance tracking by eliminating manual timestamp math.
 *
 * The timer logs the duration as a **custom event** (via `logger.event()`) with the
 * duration as a **measurement**. This allows you to:
 * - Chart performance trends over time in Azure Portal
 * - Set up alerts for slow operations
 * - Analyze performance by properties (userId, region, etc.)
 *
 * @returns An object with two methods:
 *   - `end(name, properties?)`: Stop timer, log event with duration measurement, return duration
 *   - `elapsed()`: Get current elapsed time without logging (useful for conditional logging)
 *
 * @example
 * // Basic usage - measure and log automatically
 * const timer = startTimer();
 * const data = await fetchDataFromAPI();
 * timer.end('api_fetch_duration', {
 *   endpoint: '/users',
 *   source: 'external-api'
 * });
 * // Logs event: "api_fetch_duration" with measurement: { duration: 245 }
 *
 * @example
 * // Conditional logging - only log if slow
 * const timer = startTimer();
 * await processData();
 *
 * const elapsed = timer.elapsed(); // Get time without logging
 * if (elapsed > 1000) {
 *   logger.log('Operation exceeded threshold', {
 *     operation: 'process-data',
 *     elapsed,
 *     threshold: 1000
 *   }, 'warn');
 * }
 *
 * timer.end('process_data_duration', { slow: elapsed > 1000 });
 *
 * @example
 * // API route performance tracking
 * export async function GET(request: Request) {
 *   const timer = startTimer();
 *
 *   try {
 *     const users = await database.users.findMany();
 *     const duration = timer.end('api_get_users_duration', {
 *       resultCount: users.length,
 *       cached: false
 *     });
 *
 *     return NextResponse.json({ users, _meta: { duration } });
 *   } catch (error) {
 *     timer.end('api_get_users_duration', {
 *       error: true,
 *       errorType: (error as Error).name
 *     });
 *     throw error;
 *   }
 * }
 *
 * @example
 * // Multi-step operation tracking
 * const totalTimer = startTimer();
 *
 * const step1Timer = startTimer();
 * await validateInput(data);
 * step1Timer.end('validation_duration', { step: 1 });
 *
 * const step2Timer = startTimer();
 * await saveToDatabase(data);
 * step2Timer.end('database_save_duration', { step: 2 });
 *
 * totalTimer.end('total_operation_duration', {
 *   steps: 2,
 *   operation: 'create-user'
 * });
 */
export function startTimer() {
  const startTime = Date.now();

  return {
    /**
     * End the timer and log the duration
     *
     * Stops the timer and automatically logs a custom event with the duration as a measurement.
     * The event can be queried and charted in Azure Portal for performance analysis.
     *
     * @param name - Event/metric name (e.g., 'api_fetch_duration', 'database_query_duration').
     *               Use snake_case for consistency. This will be the event name in Azure Portal.
     * @param properties - Optional structured metadata to categorize the performance metric.
     *                     Common properties: operation, endpoint, resultCount, cached, userId.
     *                     See "Properties (Structured Metadata)" in module docs for details.
     * @returns The duration in milliseconds (useful for returning to client or logging manually)
     */
    end(
      name: string,
      properties?: Record<string, string | number | boolean>
    ): number {
      const duration = Date.now() - startTime;

      // Log as custom event with duration measurement
      logger.event(name, properties, { duration });

      return duration;
    },

    /**
     * Get elapsed time without logging
     *
     * Returns the current elapsed time since the timer started, without logging anything
     * to Application Insights. Useful for conditional logging or progress checks.
     *
     * @returns The elapsed time in milliseconds (number)
     *
     * @example
     * const timer = startTimer();
     * await step1();
     *
     * if (timer.elapsed() > 5000) {
     *   logger.log('Step 1 is slow', { elapsed: timer.elapsed() }, 'warn');
     * }
     *
     * await step2();
     * timer.end('total_operation');
     */
    elapsed(): number {
      return Date.now() - startTime;
    },
  };
}

/**
 * Wrap an async function with automatic error logging and performance tracking
 *
 * Higher-order function that wraps any async function to automatically:
 * 1. Track execution duration (via `startTimer()`)
 * 2. Log success/failure as a custom event with `{name}_duration` measurement
 * 3. Log errors with full context (via `logger.error()`)
 * 4. Preserve original function behavior (arguments, return value, thrown errors)
 *
 * Use this to add observability to utility functions, API calls, or data processing
 * without cluttering the original code with logging statements.
 *
 * @param name - Operation name for logging. Used as prefix for event names (`{name}_duration`).
 *               Keep concise and use snake_case (e.g., 'fetch_user', 'process_payment').
 * @param fn - The async function to wrap. Can have any arguments and return any value.
 * @returns A wrapped version of the function with identical signature and behavior,
 *          but with automatic logging added.
 *
 * @example
 * // Wrap a data fetching function
 * const fetchUser = withLogging('fetch_user', async (userId: string) => {
 *   const response = await fetch(`/api/users/${userId}`);
 *   if (!response.ok) throw new Error('Failed to fetch user');
 *   return response.json();
 * });
 *
 * // Usage - automatically logs duration and errors
 * try {
 *   const user = await fetchUser('123');
 *   // Logs event: "fetch_user_duration" with measurement: { duration: 245 }
 *   //             and property: { success: true }
 * } catch (error) {
 *   // Logs event: "fetch_user_duration" with measurement: { duration: 250 }
 *   //             and property: { success: false }
 *   // Also logs error: logger.error(error, { function: 'fetch_user', args: '["123"]' })
 * }
 *
 * @example
 * // Wrap a database operation
 * const createUser = withLogging('create_user', async (email: string, name: string) => {
 *   const user = await database.users.create({ email, name });
 *   return user;
 * });
 *
 * const user = await createUser('test@example.com', 'Test User');
 * // Automatically logs performance and any errors
 *
 * @example
 * // Wrap multiple functions in a service module
 * export const UserService = {
 *   getUser: withLogging('user_service_get', async (id: string) => {
 *     return await db.users.findById(id);
 *   }),
 *
 *   createUser: withLogging('user_service_create', async (data: UserInput) => {
 *     return await db.users.create(data);
 *   }),
 *
 *   deleteUser: withLogging('user_service_delete', async (id: string) => {
 *     return await db.users.delete(id);
 *   })
 * };
 *
 * @example
 * // Complex data processing
 * const processLargeDataset = withLogging('process_dataset', async (data: Data[]) => {
 *   const filtered = data.filter(isValid);
 *   const transformed = filtered.map(transform);
 *   const results = await Promise.all(transformed.map(save));
 *   return results;
 * });
 *
 * const results = await processLargeDataset(largeData);
 * // Logs: "process_dataset_duration" with success/failure + error details if failed
 */
export function withLogging<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  return (async (...args: TArgs) => {
    const timer = startTimer();
    try {
      const result = await fn(...args);
      timer.end(`${name}_duration`, { success: true });
      return result;
    } catch (error) {
      timer.end(`${name}_duration`, { success: false });
      logger.error(error as Error, {
        function: name,
        // Avoid leaking secrets or excessive data in args; limit size
        args: safeStringifyArgs(args),
      });
      throw error;
    }
  }) as (...args: TArgs) => Promise<TResult>;
}

/**
 * Best-effort safe stringify for function args (avoid circular refs and secrets)
 * Truncates long strings to keep telemetry small.
 */
function safeStringifyArgs(args: unknown[]): string {
  const seen = new WeakSet<object>();
  const replacer = (_key: string, value: unknown) => {
    if (typeof value === "string") {
      // Truncate very long strings
      return value.length > 500 ? `${value.slice(0, 500)}…[truncated]` : value;
    }
    if (typeof value === "object" && value !== null) {
      if (seen.has(value as object)) return "[Circular]";
      seen.add(value as object);
    }
    return value;
  };
  try {
    return JSON.stringify(args, replacer);
  } catch {
    return "[Unserializable args]";
  }
}
