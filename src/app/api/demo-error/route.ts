/**
 * Demo API Error Route
 *
 * Demonstrates server-side error logging with Application Insights.
 * Use query param ?type= to simulate different error scenarios:
 * - validation: Input validation error
 * - database: Database connection error
 * - external: External API error
 * - timeout: Timeout error
 * - auth: Authentication error
 * - default: Generic server error
 */
import { logger, startTimer } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const timer = startTimer();
  const errorType = request.nextUrl.searchParams.get("type") || "default";

  try {
    // Log incoming request
    logger.info("Demo API called", {
      errorType,
      method: "GET",
      path: "/api/demo-error",
    });

    // Simulate different error scenarios
    switch (errorType) {
      case "validation":
        throw new ValidationError("Invalid input: userId is required");

      case "database":
        // Simulate database query
        await simulateDelay(100);
        throw new DatabaseError(
          "Failed to connect to database: Connection timeout"
        );

      case "external":
        // Simulate external API call
        await simulateDelay(200);
        throw new ExternalAPIError(
          "External API returned 503: Service temporarily unavailable"
        );

      case "timeout":
        // Simulate long operation
        await simulateDelay(300);
        throw new TimeoutError("Operation timed out after 5000ms");

      case "auth":
        throw new AuthenticationError("Unauthorized: Invalid or expired token");

      case "success":
        // This should not error
        timer.end("demo_api_success");
        return NextResponse.json({
          success: true,
          message: "API call successful (no error)",
        });

      default:
        throw new Error("Generic server error occurred");
    }
  } catch (error) {
    // Log error with context
    const errorObj =
      error instanceof Error ? error : new Error("Unknown API error");

    logger.error(errorObj, {
      errorType,
      path: "/api/demo-error",
      method: "GET",
      userAgent: request.headers.get("user-agent") || "unknown",
    });

    // Optional: Also track error as custom event for easier querying
    logger.event("DemoAPIError", {
      errorType,
      errorName: errorObj.name,
      errorMessage: errorObj.message,
    });

    // Determine appropriate HTTP status code
    const statusCode = getStatusCode(errorObj);

    // Record error response time
    timer.end("demo_api_error", {
      errorType,
      statusCode: statusCode.toString(),
    });

    // Return error response
    return NextResponse.json(
      {
        error: errorObj.message,
        type: errorType,
        errorName: errorObj.name,
        timestamp: new Date().toISOString(),
      },
      { status: statusCode }
    );
  }
}

/**
 * Custom Error Classes
 */

class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

class ExternalAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExternalAPIError";
  }
}

class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

/**
 * Map error types to HTTP status codes
 */
function getStatusCode(error: Error): number {
  switch (error.name) {
    case "ValidationError":
      return 400; // Bad Request
    case "AuthenticationError":
      return 401; // Unauthorized
    case "DatabaseError":
      return 503; // Service Unavailable
    case "ExternalAPIError":
      return 502; // Bad Gateway
    case "TimeoutError":
      return 504; // Gateway Timeout
    default:
      return 500; // Internal Server Error
  }
}

/**
 * Simulate async delay (for realistic error scenarios)
 */
function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
