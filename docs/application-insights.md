# Application Insights Logging

This template includes comprehensive Application Insights integration for structured logging and telemetry. The logging system works in both development and production, automatically detecting whether code runs on server or client.

## Table of Contents

- [Quick Decision Guide: Which Logging Method to Use?](#quick-decision-guide-which-logging-method-to-use)
- [Application Insights Telemetry Types](#application-insights-telemetry-types)
- [Quick Reference Table](#quick-reference-table)
- [Advanced Features](#advanced-features)
- [Automatic Linting Enforcement](#automatic-linting-enforcement)
- [Features](#features)
  - [Distributed Tracing](#distributed-tracing)
  - [Dependency Filtering](#dependency-filtering)
- [Setup](#setup)
- [Usage Examples](#usage-examples)
- [Error Boundaries](#error-boundaries)
- [Middleware Logging](#middleware-logging)
- [Severity Levels](#severity-levels)
- [Best Practices](#best-practices)
- [Live Metrics Stream](#live-metrics-stream)
- [Demo Page](#demo-page)
- [Graceful Degradation](#graceful-degradation)
- [Development vs Production Behavior](#development-vs-production-behavior)
- [Troubleshooting: "I don't see my telemetry in Azure Portal"](#troubleshooting-i-dont-see-my-telemetry-in-azure-portal)
- [Environment Variables](#environment-variables)

## Quick Decision Guide: Which Logging Method to Use?

**✅ ALWAYS use the unified [`logger`](../src/lib/logger.ts) from `@/lib/logger` everywhere**

The logger automatically detects whether your code is running on the server or client and uses the appropriate SDK.

### Server-Side (API Routes, Server Components, Middleware)

```typescript
import { LogLevel, logger } from "@/lib/logger";

// ✅ Correct - Server-side
logger.error(error, { context: "details" });
logger.event("UserAction", { userId: "123" });
logger.info("Operation completed", { duration: 100 }); // Prefer shorthand

// Use LogLevel enum (recommended)
logger.debug("Debug details", { step: 1 });
logger.warn("Warning message", { cache: "miss" });

// Or string literals (also supported)
logger.debug("Debug details", { step: 1 });
logger.warn("Warning message", { cache: "miss" });

// Convenience methods (no need to pass level)
logger.debug("Debug checkpoint", { step: 1 });
logger.info("Operation completed", { duration: 100 });
logger.warn("Cache miss", { key: "user:123" });
```

### Client-Side (Client Components, Browser)

```typescript
"use client";

import { LogLevel, logger } from "@/lib/logger";

// ✅ Correct - Client-side (same API!)
logger.error(error, { component: "MyComponent" });
logger.event("ButtonClick", { buttonId: "submit" });
logger.info("User action completed");

// All convenience methods work on client too
logger.debug("Debug info");
logger.warn("Warning condition");
```

**✅ Always use `logger`** - Never import from `@/lib/appinsights-client` or `@/lib/appinsights-server` directly.

### Error Handling: When to Use What

**Crystal Clear Rule:**

- **`logger.error(error, properties?)`** - For unexpected errors, exceptions, failures
  - API failures, database errors, network issues
  - Anything that shouldn't happen under normal circumstances
- **`logger.critical(error, properties?)`** - For critical failures that require immediate attention
  - Outages, security incidents, data loss, cross-tenant data exposure

- **`logger.log(message, properties?, LogLevel.Warn)`** or **`logger.warn(message, properties?)`** - For expected issues, validation failures
  - User input validation errors
  - "Not found" scenarios
  - Expected business logic conditions

**Examples:**

```typescript
// ✅ Validation error (expected) - use logger.warn or logger.log with LogLevel.Warn
if (!email || !isValidEmail(email)) {
  logger.warn("Invalid email provided", { field: "email" });
  // Or: logger.log("Invalid email provided", { field: "email" }, LogLevel.Warn);
  return { error: "Please provide a valid email" };
}

// ✅ Database error (unexpected) - use logger.error
try {
  await database.users.create({ email });
} catch (error) {
  logger.error(error as Error, { operation: "create-user" });
  return { error: "Unable to create account. Please try again." };
}

// ✅ Critical system error - use logger.critical
try {
  await criticalSystemOperation();
} catch (error) {
  logger.critical(error as Error, {
    operation: "critical-system-op"
  });
}
```

## Application Insights Telemetry Types

### 1. **Exceptions** - Track Errors and Failures

**When to use:**

- Caught exceptions in try-catch blocks
- API failures and database errors
- Unhandled errors in error boundaries
- Any unexpected errors

**Server-side example:**

```typescript
import { logger } from "@/lib/logger";

try {
  await riskyOperation();
} catch (error) {
  logger.error(error as Error, {
    context: "operation-name",
    userId: "123",
  });
  throw error; // Re-throw or return error response
}
```

**Client-side example:**

```typescript
"use client";
import { logger } from "@/lib/logger";

function MyComponent() {
  const handleClick = async () => {
    try {
      await submitForm();
    } catch (error) {
      logger.error(error as Error, {
        component: "MyComponent",
        action: "submitForm",
      });
      // Show user-friendly error message
    }
  };
}
```

**For validation errors:** Use `logger.log()` with `"warn"` level instead of `logger.error()`:

```typescript
// Validation error (expected, not exceptional)
if (!userId || userId.length === 0) {
  logger.log("Validation failed: User ID required", {
    field: "userId",
    endpoint: "/api/users"
  }, "warn");
  return NextResponse.json({ error: "User ID is required" }, { status: 400 });
}

// Unexpected error (exceptional)
try {
  await database.query();
} catch (error) {
  logger.error(error as Error, { operation: "database-query" });
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}
```

**Works everywhere** - Server components, API routes, and client components.

### 2. **Custom Events** - Track User Actions and Business Events

**When to use:**

- Button clicks and user interactions
- Feature usage ("dark mode enabled", "filter applied")
- Business events ("payment completed", "user registered")
- Navigation events ("viewed product details")
- A/B test variants

**Example:**

```typescript
import { logger } from "@/lib/logger";

// User action
logger.event("ButtonClick", { buttonId: "checkout", page: "/cart" });

// Business event with measurements
logger.event(
  "PurchaseCompleted",
  { userId: "123", productId: "ABC" },
  { amount: 99.99, quantity: 2 }
);

// Feature usage
logger.event("FeatureToggled", { feature: "dark-mode", enabled: true });
```

### 3. **Dependencies** - Track External Service Calls

**When to use:**

- HTTP calls to external APIs
- Database queries (SQL, MongoDB, etc.)
- Redis/cache operations
- Third-party service calls (Stripe, SendGrid, etc.)
- Any operation that depends on external systems

**Example:**

```typescript
import { logger } from "@/lib/logger";

const startTime = Date.now();

try {
  const response = await fetch("https://api.example.com/data");
  const duration = Date.now() - startTime;

  logger.dependency(
    "GET /data", // Operation name
    "https://api.example.com/data", // Target
    duration, // Duration in ms
    response.ok, // Success
    response.status, // Result code
    "HTTP" // Dependency type
  );
} catch (error) {
  const duration = Date.now() - startTime;
  logger.dependency("GET /data", "https://api.example.com/data", duration, false, 0, "HTTP");
  throw error;
}
```

### 4. **Traces** - Diagnostic Logging

**When to use:**

- Debug information during development
- Informational messages about app state
- Warning conditions (cache miss, fallback used)
- Operational messages (user logged in, session started)
- Flow tracking (entering/exiting functions)

**Example:**

```typescript
import { LogLevel, logger } from "@/lib/logger";

// Use logger.log() with different severity levels (using enum)
logger.debug("Detailed debug info", { step: 1, data: complexObject });
logger.info("User logged in", { userId: "123", method: "oauth" });
logger.warn("Cache miss, fetching from database", { key: "user:123" });

// Improved DX - pass level directly without properties
logger.warn("Cache miss, using fallback");
logger.debug("Debug checkpoint reached");
```

### 5. **Measurements (via Custom Events)** - Performance and Business Metrics

**When to use:**

- Custom performance measurements (operation durations)
- Business KPIs (active users, conversion rates)
- Resource utilization (memory, CPU)
- Queue lengths, cache hit rates
- Any numeric value you want to track over time

**Example:**

```typescript
import { logger, startTimer } from "@/lib/logger";

// Performance metric using timer
const timer = startTimer();
await performOperation();
timer.end("operation_duration", { endpoint: "/api/users" }); // Logs as event with duration measurement

// Business metrics using custom events with measurements
logger.event("ActiveUsers", { region: "US" }, { count: 1523 });
logger.event("CachePerformance", { cache: "redis" }, { hitRate: 0.87 });
```

**Note:** There is no separate "metric logging" API. Metrics should be logged as **custom events with measurements** for better correlation and flexible querying.

## Quick Reference Table

| Telemetry Type                   | When to Use                   | Logger Method                               | Example Use Case                      |
| -------------------------------- | ----------------------------- | ------------------------------------------- | ------------------------------------- |
| **Exceptions**                   | Unexpected errors, failures   | `logger.error(error, props?)`               | API call failed, database error       |
| **Validation/Expected Issues**   | Expected errors, validation   | `logger.warn(msg, props?)`                  | Invalid email, missing required field |
| **Custom Events**                | User actions, business events | `logger.event(name, props?, measures?)`     | Button click, purchase completed      |
| **Dependencies**                 | External service calls        | `logger.dependency(...)`                    | Database query, API call              |
| **Traces**                       | Debug/diagnostic logs         | `logger.info/debug/warn` (or `logger.log`)  | User logged in, cache miss            |
| **Custom Events + Measurements** | Performance/business KPIs     | `logger.event(name, props?, measurements?)` | API response time, active users       |
| **Page Views**                   | Navigation tracking           | Automatic (no code)                         | Route changes (automatic)             |

**Note:** All methods work in both server and client contexts. The logger automatically detects the environment and uses the appropriate SDK (Node.js or Browser).

**Simplified API - 4 core methods + 3 convenience methods:**

### 1. `logger.error(error, properties?)`

**Use when:** Unexpected errors and failures (NOT validation errors - use `logger.log(..., "warn")` for those)

```typescript
try {
  await riskyOperation();
} catch (error) {
  logger.error(error as Error, { userId: "123", operation: "checkout" });
}
```

### 2. `logger.log(message, level?)` or `logger.log(message, properties?, level?)`

**Use when:** You need diagnostic information - debug logs, info messages, warnings

```typescript
import { LogLevel } from "@/lib/logger";

// With properties and level (using enum - recommended)
logger.info("User logged in", { userId: "123" });
logger.debug("Processing step 1", { data: {...} });
logger.warn("Cache miss, using fallback", { key: "user:123" });

// Or with string literals (also supported)
logger.debug("Debug checkpoint");
logger.warn("Warning condition");

// Improved DX - pass level directly without properties
logger.warn("Cache miss");
logger.debug("Debug checkpoint");
```

### 2a-c. Convenience Methods (shortcuts for common levels)

**Use when:** You want cleaner syntax without passing the level parameter

```typescript
// Equivalent to logger.log(message, properties, LogLevel.Debug)
logger.debug("Debug checkpoint", { step: 1 });

// Equivalent to logger.log(message, properties, LogLevel.Info)
logger.info("User logged in", { userId: "123" });

// Equivalent to logger.log(message, properties, LogLevel.Warn)
logger.warn("Cache miss", { key: "user:123" });
```

### 3. `logger.event(name, properties?, measurements?)`

**Use when:** Tracking user actions, business events, or performance metrics

```typescript
// User action
logger.event("ButtonClick", { buttonId: "submit", page: "/checkout" });

// Business event with metrics
logger.event(
  "PurchaseCompleted",
  { userId: "123", productId: "ABC" },
  { amount: 99.99, quantity: 2 }
);

// Performance metric
const timer = startTimer();
await operation();
timer.end("operation_duration", { operationType: "data-fetch" });
```

### 4. `logger.dependency(name, target, duration, success, resultCode, type?)`

**Use when:** Calling external services - APIs, databases, third-party services (server-side only)

```typescript
const startTime = Date.now();
try {
  const response = await fetch("https://api.example.com/data");
  const duration = Date.now() - startTime;
  logger.dependency(
    "GET /data",
    "https://api.example.com/data",
    duration,
    response.ok,
    response.status
  );
} catch (error) {
  const duration = Date.now() - startTime;
  logger.dependency("GET /data", "https://api.example.com/data", duration, false, 0);
}
```

**Bonus: User Context (Client-side only)**

```typescript
// After login
await logger.setUserContext("user-123", "account-456");

// After logout
await logger.clearUserContext();
```

### What “user context” does

- Sets the authenticated user ID (and optional account/tenant ID) in the browser SDK so all client-side telemetry is tagged with the user.
- Helps you filter and correlate client events, exceptions, and dependencies by user in Application Insights.
- Note: This does NOT automatically tag server-side telemetry. Add `userId` as a property on server logs if you want parity (see “Server correlation tips” below).

### When to call it

- After a successful login or whenever the authenticated identity changes.
- On logout, call `clearUserContext()` immediately to avoid tagging subsequent telemetry with the wrong user.
- Do not call it on every render; set once per session (e.g., in an auth listener or layout effect that runs when auth state changes).

### What to pass

- Use a stable, non-PII ID string for `userId` (e.g., database user ID or hash).
- Optionally pass `accountId` for multi-tenant scenarios (e.g., organization or workspace ID).

### Privacy and PII

- Do not pass emails, full names, or other PII as `userId` or `accountId`.
- Prefer pseudonymous IDs. If you must join to PII, do that in your own systems—not in telemetry.

### Persistence and scope

- The client SDK persists authenticated user context using a cookie (this template enables it).
- Context persists across page reloads in the same browser profile until you call `clearUserContext()`.
- Incognito windows and different browsers maintain independent context.

### Correlation with server telemetry

- Client requests are correlated with server telemetry through distributed tracing headers (already enabled).
- Server logs will not automatically include the authenticated user from the browser. To see user across both sides:
  - Attach `userId` to server telemetry using a child logger scoped per request:

```typescript
// In a server handler after you determine the current user
import { logger } from "@/lib/logger";

const requestLogger = logger.withProperties({ userId: currentUserId });
requestLogger.info("Request started");
```

### Example: Integrating with your auth flow

```typescript
"use client";
import { logger } from "@/lib/logger";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

// or your auth hook

export function AuthUserContextSync() {
  const { data, status } = useSession(); // status: "loading" | "authenticated" | "unauthenticated"

  useEffect(() => {
    if (status === "authenticated" && data?.user?.id) {
      // Set once per session when auth becomes available
      logger.setUserContext(
        String(data.user.id),
        data.user.orgId ? String(data.user.orgId) : undefined
      );
    }
    if (status === "unauthenticated") {
      logger.clearUserContext();
    }
  }, [status, data?.user?.id, data?.user?.orgId]);

  return null;
}
```

### KQL: Query by user

```kusto
union traces, customEvents, exceptions, dependencies
| where timestamp > ago(24h)
| where tostring(customDimensions["userId"]) == "user-123" // if you add as a property on server
   or user_Id == "user-123" // client-set authenticated user
| order by timestamp desc
```

Tip: On the server, prefer adding `userId` as a custom property via `logger.withProperties({ userId })`. On the client, `user_Id` is populated by `setUserContext`.

### Troubleshooting

- “I still see the previous user after logout”: Ensure `logger.clearUserContext()` runs on logout and any cached pages don’t issue telemetry before it fires.
- “Some events lack user info”: Set context as early as possible after login; events emitted before the call won’t be tagged.
- “I need different user scopes per tab”: The SDK uses a cookie; tabs share the same context. If per-tab scoping is required, include a `tabId` property in your own logs.

## Advanced Features

### Child Loggers with Default Properties

Create child loggers that automatically attach context to all log calls:

```typescript
import { type Properties, logger } from "@/lib/logger";

// Create a module-specific logger
const apiLogger = logger.withProperties({
  component: "api",
  service: "user-service",
});

// All logs from apiLogger include the default properties
apiLogger.info("Fetching users"); // Includes: { component: 'api', service: 'user-service' }
apiLogger.error(error, { userId: "123" }); // Includes: { component: 'api', service: 'user-service', userId: '123' }

// Use case: Request-scoped logging
export async function GET(request: Request) {
  const requestLogger = logger.withProperties({
    requestId: crypto.randomUUID(),
    endpoint: "/api/users",
    method: "GET",
  });

  requestLogger.info("Request started");

  try {
    const users = await getUsers();
    requestLogger.info("Request successful", { count: users.length });
    return Response.json(users);
  } catch (error) {
    requestLogger.error(error as Error);
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}
```

### Exported Type Aliases

The logger exports helpful type aliases for better TypeScript experience:

```typescript
import {
  LogLevel,
  // Record<string, number>
  type LogLevelInput,
  // LogLevel | "debug" | "info" | "warn"
  // Record<string, string | number | boolean>
  type Measurements,
  type Properties,
  logger,
} from "@/lib/logger";

// Use in your own function signatures
function trackUserAction(action: string, props: Properties, metrics?: Measurements) {
  logger.event(action, props, metrics);
}

// Type-safe log level parameter
function conditionalLog(message: string, level: LogLevelInput) {
  logger.log(message, level);
}
```

### Function Wrapper with Auto-Logging

Wrap async functions to automatically track duration and errors:

```typescript
import { withLogging } from "@/lib/logger";

// Wrap a data fetching function
const fetchUser = withLogging("fetch_user", async (userId: string) => {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) throw new Error("Failed to fetch user");
  return response.json();
});

// Usage - automatically logs:
// - Event: "fetch_user_duration" with measurement: { duration: 245 }
// - Property: { success: true }
// - On error: logs error with { function: 'fetch_user', args: '["123"]' }
const user = await fetchUser("123");

// Create a service layer with auto-logging
export const UserService = {
  getUser: withLogging("user_service_get", async (id: string) => {
    return await db.users.findById(id);
  }),

  createUser: withLogging("user_service_create", async (data: UserInput) => {
    return await db.users.create(data);
  }),

  deleteUser: withLogging("user_service_delete", async (id: string) => {
    return await db.users.delete(id);
  }),
};
```

## Automatic Linting Enforcement

This project includes **custom ESLint rules** to enforce best practices and prevent common Application Insights mistakes:

### Rule 1: `no-direct-appinsights-client-import` (Error)

Prevents direct imports of `@/lib/appinsights-client` anywhere except in the logger implementation. **Always use the unified `logger` from `@/lib/logger` instead.**

**Allowed only in:**

- `src/lib/logger.ts`
- `src/components/providers/AppInsightsProvider.tsx`

**❌ Will cause ESLint error:**

```typescript
// src/app/api/users/route.ts
import { trackException } from "@/lib/appinsights-client";

// ❌ ERROR: noDirectImport

export async function GET() {
  try {
    // ...
  } catch (error) {
    trackException(error as Error, 3, {}); // Not allowed!
  }
}
```

**✅ Correct approach:**

```typescript
// src/app/api/users/route.ts
import { logger } from "@/lib/logger";

// ✅ Always use logger

export async function GET() {
  try {
    // ...
  } catch (error) {
    logger.error(error as Error, { endpoint: "/api/users" }); // ✅ Works everywhere
  }
}
```

### Rule 2: `no-direct-appinsights-server-import` (Error)

Prevents direct imports of `@/lib/appinsights-server` anywhere except in the logger implementation.

**Allowed only in:**

- `src/lib/logger.ts`

**❌ Will cause ESLint error:**

```typescript
// src/app/api/users/route.ts
import { logError } from "@/lib/appinsights-server";

// ❌ ERROR: noDirectImport

export async function GET() {
  try {
    // ...
  } catch (error) {
    logError(error, {}, 3); // Not allowed!
  }
}
```

**✅ Correct approach:**

```typescript
// src/app/api/users/route.ts
import { logger } from "@/lib/logger";

// ✅ Always use logger

export async function GET() {
  try {
    // ...
  } catch (error) {
    logger.error(error as Error, { endpoint: "/api/users" }); // ✅ Correct
  }
}
```

### Rule 3: `prefer-logger-over-console` (Warning)

Warns when using `console.log`, `console.error`, etc. in server-side code. Encourages structured logging for better telemetry.

**Applies to:**

- API routes (`/app/api/`, `/api/`)
- Middleware files
- Server-specific files (`.server.ts`, `.server.js`)

**⚠️ Will cause ESLint warning:**

```typescript
// src/app/api/users/route.ts
export async function GET() {
  console.log("User requested data"); // ⚠️ WARNING: useLogger
  console.error("Error occurred"); // ⚠️ WARNING: useLogger
  console.debug("Debug info"); // ⚠️ WARNING: useLogger
  console.warn("Warning"); // ⚠️ WARNING: useLogger
}
```

**✅ Recommended approach:**

```typescript
// src/app/api/users/route.ts
import { logger } from "@/lib/logger";

export async function GET() {
  logger.info("User requested data"); // ✅ Tracked in Application Insights
  logger.error(new Error("Error occurred")); // ✅ With stack trace
  logger.debug("Debug info"); // ✅ Filterable by severity
  logger.warn("Warning"); // ✅ Searchable in Azure Portal
}
```

**Note:** These rules automatically detect server-side vs client-side code by:

- File location (e.g., `/app/api/`, `middleware.ts`)
- `'use client'` directive presence
- File naming conventions (`.server.ts`, `.client.ts`)

The linter will **prevent builds** if you try to import from `appinsights-client` or `appinsights-server` directly (Rules 1 & 2), and will **warn** about using `console` methods in server code (Rule 3).

## Features

- **Dual SDK Support**: Node.js SDK for server-side (middleware, API routes, server components) and Browser SDK for client-side (client components, browser errors)
- **Unified Logger Interface**: Single `logger` object that works everywhere on the server
- **Automatic Error Tracking**: React Error Boundaries, API error handlers, middleware error catching
- **Performance Monitoring**: API latency, database query times, custom metrics
- **Custom Events**: User actions, feature usage, business metrics
- **Dependency Tracking**: External API calls, database queries
- **Distributed Tracing**: W3C trace context propagation for end-to-end request correlation
- **Smart Dependency Filtering**: Configurable allow/deny lists to reduce telemetry noise
- **Demo Page**: Interactive examples at `/demo-logging`
- **Custom ESLint Rules**: Prevents common logging mistakes automatically

### Distributed Tracing

The client SDK includes **distributed tracing** with W3C trace context propagation. This allows you to:

- Correlate client-side requests with server-side operations
- Track requests across multiple services
- See the full request journey in Application Insights

**How it works:**

1. Client makes a fetch request to your API
2. Browser SDK automatically adds trace headers (`traceparent`, `tracestate`)
3. Server SDK correlates the request using these headers
4. Both client and server telemetry appear in the same transaction in Application Insights

**Configuration (already enabled):**

```typescript
// src/lib/appinsights-client.ts
enableCorsCorrelation: true,  // Enable CORS correlation
distributedTracingMode: DistributedTracingModes.AI_AND_W3C,  // W3C + Application Insights
```

**No code changes needed** - tracing works automatically for all fetch/XHR requests.

### Dependency Filtering

To reduce telemetry noise, the client SDK filters out internal/irrelevant dependencies using allow/deny lists.

**Default exclusions** (already configured):

- Next.js internal routes (`/_next/`, `/_next/data/`)
- Static assets (`/static/`, `.map` files)
- Application Insights ingestion endpoints
- Common analytics services (Google Analytics, Segment, Hotjar, etc.)

**How to customize:**

Edit `src/lib/appinsights-client.ts`:

```typescript
// Allow only specific domains (empty = allow all)
const DEPENDENCY_ALLOWLIST: RegExp[] = [
  /https?:\/\/api\.yourdomain\.com/i,
  /https?:\/\/yourdomain\.com/i,
];

// Always deny these URLs (applied even if allowlist matches)
const DEPENDENCY_DENYLIST: RegExp[] = [
  /\/_next\//,
  /dc\.services\.visualstudio\.com/i,
  /analytics/i,
  // Add your own patterns here
];
```

**Use cases:**

- **Allow only your API**: Set allowlist to your domain to ignore third-party services
- **Block noisy endpoints**: Add patterns to denylist to exclude health checks, polling, etc.
- **Debug mode**: Empty both lists to see all dependencies (useful for troubleshooting)

## Setup

1. **Get Application Insights Connection String**:
   - Go to Azure Portal > Application Insights > Overview
   - Copy the "Connection String"

2. **Configure Environment Variables**:

   ```bash
   # Copy template
   cp .env.local.template .env.local

   # Edit .env.local and add your connection string
   APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string-here
   NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=your-connection-string-here
   ```

3. **For Azure Web App Deployment**:
   - Set both environment variables in Azure Portal > Configuration > Application Settings
   - The app will automatically start sending telemetry

## Usage Examples

### Basic Error Logging

```typescript
import { logger } from "@/lib/logger";

try {
  await riskyOperation();
} catch (error) {
  logger.error(error as Error, {
    userId: "123",
    operation: "riskyOperation",
    timestamp: Date.now(),
  });
  throw error;
}
```

### Custom Events (User Actions, Feature Usage)

```typescript
import { logger } from "@/lib/logger";

// Track button click
logger.event("ButtonClick", {
  buttonId: "submit-form",
  page: "/contact",
  userId: "123",
});

// Track feature usage
logger.event("FeatureUsed", {
  featureName: "dark-mode",
  enabled: true,
});

// Track business event with measurements
logger.event("PaymentCompleted", { userId: "123", plan: "pro" }, { amount: 99.99, tax: 7.99 });
```

### Performance Tracking

```typescript
import { startTimer } from "@/lib/logger";

const timer = startTimer();

// Perform operation
const data = await fetchDataFromAPI();

// Log duration
timer.end("api_fetch_users", {
  endpoint: "/api/users",
  resultCount: data.length,
});
```

### API Route Error Handling with Specific Error Types

**Best Practice:** Always catch specific error types and provide user-friendly messages while logging detailed technical information.

```typescript
// src/app/api/users/route.ts
import { logger, startTimer } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

// Define custom error types for better error handling
class ValidationError extends Error {
  constructor(
    message: string,
    public field?: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

class DatabaseError extends Error {
  constructor(
    message: string,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "DatabaseError";
  }
}

class NotFoundError extends Error {
  constructor(
    message: string,
    public resourceType?: string
  ) {
    super(message);
    this.name = "NotFoundError";
  }
}

export async function GET(request: NextRequest) {
  const timer = startTimer();

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    // Validate input
    if (!userId || userId.length === 0) {
      throw new ValidationError("User ID is required", "id");
    }

    if (!/^[a-zA-Z0-9-_]+$/.test(userId)) {
      throw new ValidationError("Invalid user ID format", "id");
    }

    // Fetch data with error handling
    let user;
    try {
      user = await database.users.findUnique({
        where: { id: userId },
        include: { profile: true },
      });
    } catch (dbError) {
      throw new DatabaseError("Failed to query user", dbError);
    }

    if (!user) {
      throw new NotFoundError("User not found", "user");
    }

    // Log successful operation
    timer.end("database_query", {
      operation: "findUnique",
      collection: "users",
      userId,
    });

    logger.log("User fetched successfully", {
      userId,
      endpoint: "/api/users",
      hasProfile: !!user.profile,
    });

    return NextResponse.json({ user });
  } catch (error) {
    // Handle ValidationError - client error
    if (error instanceof ValidationError) {
      logger.log(
        "Validation error in API request",
        {
          error: error.message,
          field: error.field,
          endpoint: "/api/users",
          method: "GET",
        },
        "warn"
      );

      return NextResponse.json(
        {
          error: error.message,
          field: error.field,
        },
        { status: 400 }
      );
    }

    // Handle NotFoundError - resource not found
    if (error instanceof NotFoundError) {
      logger.log(
        "Resource not found",
        {
          error: error.message,
          resourceType: error.resourceType,
          endpoint: "/api/users",
          searchParams: request.url,
        },
        "warn"
      );

      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Handle DatabaseError - service unavailable
    if (error instanceof DatabaseError) {
      logger.error(error, {
        endpoint: "/api/users",
        errorType: "database",
        originalError: error.originalError,
      });

      return NextResponse.json(
        {
          error: "Unable to retrieve user data. Please try again later.",
          retryable: true,
        },
        { status: 503 }
      );
    }

    // Handle unexpected errors
    logger.error(error as Error, {
      endpoint: "/api/users",
      errorType: "unexpected",
      method: "GET",
    });

    return NextResponse.json(
      {
        error: "An unexpected error occurred. Please try again.",
        retryable: true,
      },
      { status: 500 }
    );
  }
}
```

**Key Points:**

1. **Custom Error Types**: Define specific error classes (`ValidationError`, `DatabaseError`, `NotFoundError`) for better error handling
2. **User-Friendly Messages**: Return clear, actionable error messages to users
3. **Detailed Logging**: Log technical details to Application Insights for debugging
4. **Appropriate Status Codes**: Use correct HTTP status codes (400, 404, 503, 500)
5. **Severity Levels**: Use `logger.log(..., "warn")` for client errors, `logger.error()` for server errors
6. **Context Information**: Include relevant metadata (endpoint, operation, userId) in all logs

### Dependency Tracking with Error Handling (External APIs)

**Best Practice:** Track all external dependencies and handle failures gracefully with user-friendly messages.

```typescript
import { logger } from "@/lib/logger";

// Custom error for external API failures
class ExternalAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public apiName?: string,
    public isRetryable: boolean = true
  ) {
    super(message);
    this.name = "ExternalAPIError";
  }
}

async function fetchUserFromExternalAPI(userId: string) {
  const apiUrl = `https://api.example.com/users/${userId}`;
  const startTime = Date.now();
  let response: Response | undefined;

  try {
    // Make the API call with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.API_TOKEN}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const duration = Date.now() - startTime;

    // Check response status
    if (!response.ok) {
      // Log failed dependency
      logger.dependency("GET /users/:id", apiUrl, duration, false, response.status, "HTTP");

      // Handle specific status codes
      if (response.status === 404) {
        throw new ExternalAPIError(
          "User not found in external system",
          404,
          "ExampleAPI",
          false // Not retryable
        );
      }

      if (response.status === 429) {
        throw new ExternalAPIError(
          "Rate limit exceeded",
          429,
          "ExampleAPI",
          true // Retryable after delay
        );
      }

      if (response.status >= 500) {
        throw new ExternalAPIError(
          "External API is temporarily unavailable",
          response.status,
          "ExampleAPI",
          true // Retryable
        );
      }

      throw new ExternalAPIError(
        `Failed to fetch user from external API: ${response.statusText}`,
        response.status,
        "ExampleAPI"
      );
    }

    // Parse response
    const data = await response.json();

    // Log successful dependency
    logger.dependency("GET /users/:id", apiUrl, duration, true, response.status, "HTTP");

    logger.log("Successfully fetched user from external API", {
      userId,
      apiName: "ExampleAPI",
      duration,
    });

    return data;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Handle network errors (fetch abort, timeout, connection refused)
    if (error instanceof Error && error.name === "AbortError") {
      logger.dependency("GET /users/:id", apiUrl, duration, false, 0, "HTTP");

      logger.error(error, {
        errorType: "timeout",
        apiName: "ExampleAPI",
        userId,
        duration,
      });

      throw new ExternalAPIError("Request to external API timed out", 0, "ExampleAPI", true);
    }

    // If it's already our custom error, log and rethrow
    if (error instanceof ExternalAPIError) {
      logger.error(error, {
        errorType: "external_api",
        apiName: error.apiName,
        statusCode: error.statusCode,
        isRetryable: error.isRetryable,
        userId,
      });

      throw error;
    }

    // Log failed dependency for unexpected errors
    logger.dependency("GET /users/:id", apiUrl, duration, false, 0, "HTTP");

    // Handle unexpected errors
    logger.error(error as Error, {
      errorType: "unexpected",
      apiName: "ExampleAPI",
      userId,
      operation: "fetchUserFromExternalAPI",
    });

    throw new ExternalAPIError(
      "An unexpected error occurred while fetching user data",
      0,
      "ExampleAPI",
      true
    );
  }
}

// Usage in an API route
export async function GET(request: NextRequest) {
  try {
    const userId = request.nextUrl.searchParams.get("id");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const userData = await fetchUserFromExternalAPI(userId);

    return NextResponse.json({ user: userData });
  } catch (error) {
    if (error instanceof ExternalAPIError) {
      // Return appropriate status code and user-friendly message
      if (error.statusCode === 404) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      if (error.statusCode === 429) {
        return NextResponse.json(
          {
            error: "Too many requests. Please try again in a moment.",
            retryable: true,
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: "Unable to retrieve user data from external service. Please try again later.",
          retryable: error.isRetryable,
        },
        { status: error.statusCode && error.statusCode >= 500 ? 503 : 500 }
      );
    }

    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
```

**Key Points:**

1. **Timeout Handling**: Use `AbortController` to prevent hanging requests
2. **Dependency Tracking**: Log all external API calls with duration and status
3. **Status Code Handling**: Handle common HTTP status codes appropriately
4. **Retry Hints**: Include `isRetryable` flag to indicate if the operation can be retried
5. **Detailed Logging**: Log error context including API name, duration, and error type
6. **User-Friendly Messages**: Translate technical errors into actionable user messages

### Client-Side Error Tracking with User-Friendly Messages

**Best Practice:** Show users clear error messages while tracking detailed information in Application Insights.

```typescript
'use client';

import { useState } from 'react';
import { logger } from '@/lib/logger';

// Define client-side error types
class NetworkError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = 'NetworkError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public fields?: string[]) {
    super(message);
    this.name = 'ValidationError';
  }
}

function UserProfileForm() {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: FormData) => {
    setError(null);
    setIsSubmitting(true);

    try {
      const name = formData.get('name') as string;
      const email = formData.get('email') as string;

      // Client-side validation
      if (!name || name.length < 2) {
        throw new ValidationError('Name must be at least 2 characters', ['name']);
      }

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ValidationError('Please enter a valid email address', ['email']);
      }

      // Make API call
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new NetworkError(
          errorData.error || 'Failed to update profile',
          response.status
        );
      }

      // Success - reset form
      setError(null);

    } catch (error) {
      // Handle ValidationError - show field-specific messages
      if (error instanceof ValidationError) {
        setError(error.message);

        // Log validation error as warning (not exceptional)
        logger.log('Client validation failed', {
          component: 'UserProfileForm',
          action: 'submit',
          errorType: 'validation',
          fields: error.fields?.join(', '),
          message: error.message
        }, 'warn');
        return;
      }

      // Handle NetworkError - differentiate between client/server errors
      if (error instanceof NetworkError) {
        if (error.statusCode && error.statusCode >= 500) {
          setError('Our servers are experiencing issues. Please try again in a few moments.');
        } else if (error.statusCode === 429) {
          setError('Too many requests. Please wait a moment and try again.');
        } else if (error.statusCode === 401) {
          setError('Your session has expired. Please sign in again.');
        } else {
          setError(error.message);
        }

        // Log network error
        logger.error(error, {
          component: 'UserProfileForm',
          action: 'submit',
          errorType: 'network',
          statusCode: error.statusCode,
          endpoint: '/api/profile'
        });
        return;
      }

      // Handle unexpected errors
      setError('Something went wrong. Please try again.');

      // Log unexpected error
      logger.error(error as Error, {
        component: 'UserProfileForm',
        action: 'submit',
        errorType: 'unexpected'
      });

    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form action={handleSubmit}>
      {error && (
        <div className="rounded-md bg-rose-50 border border-rose-200 p-4 mb-4">
          <p className="text-rose-700 text-sm">{error}</p>
        </div>
      )}

      <input
        type="text"
        name="name"
        placeholder="Your name"
        className="border border-stone-200 rounded px-3 py-2"
        disabled={isSubmitting}
      />

      <input
        type="email"
        name="email"
        placeholder="your@email.com"
        className="border border-stone-200 rounded px-3 py-2"
        disabled={isSubmitting}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded"
      >
        {isSubmitting ? 'Saving...' : 'Save Profile'}
      </button>
    </form>
  );
}
```

**Key Points:**

1. **User-Facing Error Messages**: Display clear, actionable messages to users
2. **Technical Logging**: Track detailed error information in Application Insights
3. **Error Handling Strategy**:
   - **Validation errors** (expected): Use `logger.log(..., "warn")` - not exceptional
   - **Network errors** (unexpected): Use `logger.error()` - something went wrong
   - **Critical errors** (unexpected): Use `logger.critical()`
4. **Error Context**: Include component name, action, error type, and relevant metadata
5. **HTTP Status Code Handling**: Provide specific messages for common status codes (401, 429, 500+)
6. **Loading States**: Disable UI during operations to prevent duplicate submissions

### Trace/Diagnostic Logging

```typescript
import { logger } from "@/lib/logger";

// Different severity levels using logger.log()
logger.debug("Detailed debug info", { step: 1 });
logger.info("User logged in", { userId: "123" }); // Info level (default)
logger.warn("Cache miss", { key: "user:123" });

// Errors use logger.error()
logger.error(new Error("Payment failed"), { context: "payment" });
// Critical failures use logger.critical()
logger.critical(new Error("System failure"), { incident: true });
```

## Error Boundaries

The template includes three levels of error handling:

1. **ErrorBoundary Component** (`src/components/providers/ErrorBoundary.tsx`):
   - Catches React rendering errors in client components
   - Logs to Application Insights with component stack
   - Shows user-friendly fallback UI
   - Usage: Wrap components that might error

2. **Route-level Error Handler** (`src/app/error.tsx`):
   - Catches errors in page components
   - Automatically logs to Application Insights
   - Provides "Try Again" and "Back to Home" actions

3. **Global Error Handler** (`src/app/global-error.tsx`):
   - Last resort for root layout errors
   - Critical error logging
   - Minimal fallback UI

## Middleware Logging

Middleware (`src/proxy.ts`) automatically logs:

- All requests (method, path, user agent)
- Middleware errors with full context
- CSP violations (if configured)

## Severity Levels

Use appropriate severity levels with `logger.log()`, `logger.error()`, and `logger.critical()`:

**For diagnostic messages (`logger.log()`):**

- **`"debug"`** (Severity 0): Detailed debugging info (e.g., variable values, flow tracking)
- **`"info"`** (Severity 1): General informational messages (e.g., "User logged in") - **default**
- **`"warn"`** (Severity 2): Warning conditions (e.g., "Cache miss", "Using fallback")

**For errors:**

- `logger.error()` records Exceptions at severity level 3 (Error)
- `logger.critical()` records Exceptions at severity level 4 (Critical)

## Best Practices

### Error Handling Best Practices

1. **Define Custom Error Types**
   - Create specific error classes for different failure scenarios
   - Include relevant metadata in error objects (statusCode, field, resourceType)
   - Use consistent naming conventions (`ValidationError`, `DatabaseError`, `NotFoundError`)

2. **User-Friendly Error Messages**
   - **DO**: "Unable to retrieve user data. Please try again later."
   - **DON'T**: "Internal server error" or showing stack traces to users
   - Provide actionable guidance ("Please check your email format", "Try again in a few moments")
   - Include retry hints when appropriate (`retryable: true`)

3. **Appropriate HTTP Status Codes**
   - `400 Bad Request` - Client validation errors
   - `401 Unauthorized` - Authentication required
   - `403 Forbidden` - Insufficient permissions
   - `404 Not Found` - Resource doesn't exist
   - `429 Too Many Requests` - Rate limiting
   - `500 Internal Server Error` - Unexpected server errors
   - `503 Service Unavailable` - Database or external service failures

4. **Log Severity Guidelines**
   - Use `logger.log(..., "warn")` for expected/client errors (validation, not found)
   - Use `logger.error()` for unexpected errors (database, external API failures)
   - Use `logger.critical()` for critical failures requiring immediate attention
   - Include `errorType` in metadata for easier filtering

5. **Error Context and Metadata**
   - Always include endpoint/route information
   - Add operation names for tracking specific flows
   - Include user context when available (userId, sessionId)
   - Log original error details for debugging

### General Logging Best Practices

1. **Always log context**: Include relevant properties (userId, operation name, endpoint)
2. **Track performance**: Use timers for operations > 100ms
3. **Log business events**: Track user actions and feature usage with custom events
4. **Test logging**: Visit `/demo-logging` to verify telemetry is working
5. **Check Azure Portal**: View logs in Application Insights > Logs, Transaction search, Failures
6. **Never log sensitive data**: Avoid logging passwords, tokens, credit card numbers, or PII

## Live Metrics Stream

**Live Metrics Stream** provides **real-time telemetry** with near-zero latency (< 1 second). It's perfect for:

- 🔴 **Live debugging** during development
- 🚀 **Production monitoring** during deployments
- 📊 **Real-time performance analysis**
- 🐛 **Immediate error detection**

### What You'll See in Live Metrics

**Server-side (Node.js SDK) - Appears in Live Metrics:**

- ✅ Incoming HTTP requests (method, path, duration, status code)
- ✅ Exceptions and errors (with stack traces) via `logger.error()`
- ✅ Dependency calls (database, APIs, external services) via `logger.dependency()`
- ✅ Custom events (`logger.event()`)
- ✅ Custom traces/diagnostic logs (`logger.log()`)
- ✅ Performance metrics (via `logger.event()` with measurements)
- ✅ Server health (CPU, memory, request rate)

**Client-side (Browser SDK) - Does NOT appear in Live Metrics:**

- ✅ Page views and route changes (Transaction Search only)
- ✅ Browser exceptions (Transaction Search only)
- ✅ Custom events from React components (Transaction Search only)
- ✅ Performance metrics (Transaction Search only)

**IMPORTANT**: Live Metrics Stream only shows **server-side telemetry** in real-time. Client-side (browser) telemetry appears in **Transaction Search** and **Logs** after 2-30 seconds, but never in Live Metrics. This is a platform limitation, not a configuration issue.

### How to Access Live Metrics

1. Go to **Azure Portal** > Your Application Insights resource
2. Click **Live Metrics** in the left navigation (under "Investigate")
3. You should see your application connected (green indicator)
4. Trigger actions in your app (click buttons, make requests)
5. Watch telemetry appear **instantly** (< 1 second)

### Troubleshooting Live Metrics

**Not seeing your application connected?**

1. **Verify SDK is initialized**: Check console for this message:

   ```text
   [AppInsights] Live Metrics Stream: ENABLED
   ```

2. **Check connection string**: Live Metrics requires a valid connection string with the correct endpoint

3. **Firewall/Network**: Ensure your network can reach:
   - `https://rt.services.visualstudio.com` (Live Metrics endpoint)
   - `https://dc.services.visualstudio.com` (Telemetry ingestion)

4. **Wait a few seconds**: Initial connection can take 5-10 seconds after app starts

5. **Restart your dev server**: Fresh connection often helps

**Seeing connection but no telemetry?**

1. **Trigger actions**: Live Metrics only shows data when events occur
2. **Check filters**: Remove any filters in the Live Metrics UI
3. **Try the demo page**: Visit `/demo-logging` and click buttons

### Live Metrics vs Transaction Search vs Logs

| Feature             | Live Metrics         | Transaction Search   | Logs (KQL)           |
| ------------------- | -------------------- | -------------------- | -------------------- |
| **Latency**         | < 1 second           | 2-30 seconds         | 2-5 minutes          |
| **Use Case**        | Real-time monitoring | Recent transactions  | Historical analysis  |
| **Data Retention**  | Last 60 seconds only | Last 7 days          | Up to 730 days       |
| **Filtering**       | Basic                | Advanced             | Full KQL queries     |
| **Best For**        | Debugging, deploys   | Recent error hunting | Trends, aggregations |
| **Auto-refresh**    | Yes                  | Manual               | Manual               |
| **Server + Client** | Combined view        | Separate views       | Queryable together   |

### Performance Impact

Live Metrics has **minimal performance impact**:

- Uses a separate lightweight channel
- Data sent in near real-time (not batched)
- Sampling available if needed (100% by default)
- Can be disabled in production if desired

**Development**: Always enabled (great for debugging)
**Production**: Enabled by default (recommended for monitoring)

If you want to disable it in production for any reason, you can conditionally enable it:

```typescript
// In appinsights-server.ts
.setSendLiveMetrics(isDevelopment) // Only enable in development
```

## Demo Page

Visit `/demo-logging` for an interactive demonstration of all logging capabilities:

- Client-side error tracking
- Server-side error tracking
- Custom events
- Performance metrics
- Dependency tracking
- Trace logging at all severity levels

**Note**: The demo page can be safely removed in production. It's included as a reference implementation.

## Graceful Degradation

If Application Insights is not configured (missing connection string):

- All logging functions still work
- Telemetry is logged to console only
- No errors or crashes
- Perfect for local development without Azure

## Development vs Production Behavior

The Application Insights SDK is **optimized for local development**:

**Development Mode (`NODE_ENV !== "production"`):**

- ✅ Telemetry batched every **2 seconds** (faster feedback)
- ✅ Smaller batch sizes (10 items server, 10KB client)
- ✅ 100% sampling (no telemetry dropped)
- ✅ Debug logging enabled
- ✅ Verbose console output
- ✅ Automatic flush on process exit (Ctrl+C)

**Production Mode:**

- ⚡ Telemetry batched every **15 seconds** (optimized for performance)
- ⚡ Larger batch sizes (250 items server, 1MB client)
- ⚡ 100% sampling (configurable)
- ⚡ Minimal console output
- ⚡ Standard flush behavior

## Troubleshooting: "I don't see my telemetry in Azure Portal"

If telemetry isn't appearing in Application Insights after configuring your connection string:

### 1. Wait 2-5 seconds in development

Telemetry is batched and sent every 2 seconds in dev mode. Wait a moment after triggering an action.

### 2. Verify connection string is set correctly

```bash
# Check your .env.local file
cat .env.local | grep APPLICATIONINSIGHTS_CONNECTION_STRING

# Should show both variables:
APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=InstrumentationKey=...
```

**Important**: Both variables must use the **same connection string**.

### 3. Restart your dev server

Environment variables are loaded at startup:

```bash
# Stop server (Ctrl+C), then restart
pnpm dev
```

Look for these console messages:

```text
[AppInsights] Server SDK initialized successfully (development mode)
[AppInsights] Development mode: Telemetry batched every 2 seconds, 100% sampling
[AppInsights] Client SDK initialized successfully (development mode)
[AppInsights] Development mode: Debug enabled, telemetry sent every 2 seconds, 100% sampling
```

### 4. Test with the demo page

Visit `http://localhost:3000/demo-logging` and click any button. Check:

1. **Browser Console**: Should see `[AppInsights]` logs with details
2. **Azure Portal**: Go to Application Insights > Transaction search
3. **Wait 2-5 seconds**, then click "Refresh"

### 5. Check Azure Portal delay

Application Insights has a small ingestion delay (usually 1-2 minutes):

- Telemetry appears in **Transaction search** first (near real-time)
- Appears in **Logs/Analytics** after 2-5 minutes (indexed)
- Check **Transaction search** for immediate feedback

### 6. Verify network connectivity

The SDK sends to `https://dc.services.visualstudio.com/v2/track`. Check:

```bash
# Test connectivity (should return 200)
curl -I https://dc.services.visualstudio.com
```

### 7. Enable verbose logging

Check browser console and terminal for any errors. Development mode automatically enables verbose logging.

### 8. Test with a simple trace

Add this to any page to test:

```typescript
import { logger } from "@/lib/logger";

logger.log("Test message from development", { test: true });
```

### 9. Common Issues

| Issue                                | Solution                                                                |
| ------------------------------------ | ----------------------------------------------------------------------- |
| Wrong connection string format       | Should start with `InstrumentationKey=`                                 |
| Only server OR client working        | Check both env vars are set (with and without `NEXT_PUBLIC_`)           |
| Old .env.local not loaded            | Restart dev server completely                                           |
| Firewall/proxy blocking              | Check network can reach `*.visualstudio.com`                            |
| Connection string from wrong AI      | Ensure using connection string from correct Application Insights        |
| Telemetry in wrong workspace         | Verify connection string matches intended Application Insights resource |
| Duplicate OpenTelemetry registration | Already fixed: SDK checks for existing client before initializing       |

### 10. Duplicate OpenTelemetry Registration (Fixed)

If you see errors like:

```text
Error: @opentelemetry/api: Attempted duplicate registration of API: context
Error: @opentelemetry/api: Attempted duplicate registration of API: propagation
Setup has already been called once.
```

This was a known issue when the Application Insights SDK was imported by multiple server chunks (middleware + logger). **The fix is already implemented** in `src/lib/appinsights-server.ts`:

```typescript
// Check if already initialized (prevents duplicate registration)
if (appInsights.defaultClient) {
  client = appInsights.defaultClient;
  isInitialized = true;
  return;
}
```

This singleton pattern ensures the SDK only initializes once, even if the module is imported multiple times across different server chunks. The error should not appear in new installations.

### 11. Query telemetry in Azure Portal

Go to Application Insights > Logs and run:

```kusto
union traces, requests, exceptions, customEvents
| where timestamp > ago(10m)
| order by timestamp desc
| take 20
```

This shows recent telemetry of all types.

## Environment Variables

Azure Web App environment variables must be configured in Azure Portal > Configuration. Common variables:

- `NODE_ENV=production`
- `APPLICATIONINSIGHTS_CONNECTION_STRING=<your-connection-string>` - Server-side telemetry
- `NEXT_PUBLIC_APPLICATIONINSIGHTS_CONNECTION_STRING=<your-connection-string>` - Client-side telemetry
- Any API keys or secrets
