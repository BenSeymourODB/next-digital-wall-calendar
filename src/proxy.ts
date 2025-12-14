import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Represents the decision made by a middleware handler
 */
interface MiddlewareDecision {
  action: "redirect" | "rewrite" | "next";
  url?: URL;
  redirectUrl?: string;
  rewriteUrl?: string;
  status?: number;
}

// This middleware demonstrates several capabilities for Azure Web App testing
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  try {
    // Skip logging for browser-specific requests (DevTools, manifest, etc.)
    const shouldSkipLogging =
      pathname.includes("/.well-known/") ||
      pathname.includes("/manifest.json") ||
      pathname.includes("/__nextjs_original-stack-frame");

    // Log request details (useful for debugging in Azure)
    if (!shouldSkipLogging) {
      logger.info(`${request.method} ${pathname}${search}`, {
        method: request.method,
        pathname,
        search,
        userAgent: request.headers.get("user-agent") || "unknown",
      });
    }

    const decision: MiddlewareDecision = {
      action: "next",
    };

    // Example: Conditional redirect based on query parameter
    if (request.nextUrl.searchParams.get("redirect") === "home") {
      decision.action = "redirect";
      decision.redirectUrl = new URL("/", request.url).toString();
    }

    // Example: Block certain paths
    if (pathname.startsWith("/blocked")) {
      decision.action = "next";
      decision.status = 403;
    }

    // Example: Rewrite URLs (internal redirect, URL stays the same)
    if (pathname === "/old-path") {
      decision.action = "rewrite";
      decision.rewriteUrl = new URL("/new-path", request.url).toString();
    }

    return createResponse(decision, pathname, request);
  } catch (error) {
    // Log the error to Application Insights
    const errorObj =
      error instanceof Error ? error : new Error("Unknown middleware error");

    logger.error(errorObj, {
      pathname,
      search,
      method: request.method,
      userAgent: request.headers.get("user-agent") || "unknown",
      component: "middleware",
      severity: "critical", // Critical severity for filtering in Azure Portal
    });

    // Track as a custom event for easier querying
    logger.event("MiddlewareError", {
      pathname,
      errorType: errorObj.name,
      errorMessage: errorObj.message,
    });

    // Return a safe fallback response to prevent middleware from crashing
    return createFallbackResponse(request, pathname, error);
  }
}

/**
 * Creates a fallback response when middleware encounters an error
 */
function createFallbackResponse(
  request: NextRequest,
  pathname: string,
  error: unknown
): NextResponse {
  const isDev = process.env.NODE_ENV !== "production";

  // Create a simple next response without CSP to avoid further errors
  const response = NextResponse.next();

  // Add error tracking headers
  response.headers.set("X-Custom-Header", "ODBM-Custom-Middleware");
  response.headers.set("X-Request-Timestamp", new Date().toISOString());
  response.headers.set("X-Request-Path", pathname);
  response.headers.set("X-Middleware-Error", "true");

  // In development, add error details to response headers for debugging
  if (isDev && error instanceof Error) {
    response.headers.set("X-Error-Message", error.message);
  }

  return response;
}

/**
 * Adds custom tracking headers to any response
 */
function addCustomHeaders(
  response: NextResponse,
  pathname: string
): NextResponse {
  response.headers.set("X-Custom-Header", "ODBM-Custom-Middleware");
  response.headers.set("X-Request-Timestamp", new Date().toISOString());
  response.headers.set("X-Request-Path", pathname);
  return response;
}

/**
 * Generates Content Security Policy header value
 */
function generateCSPHeader(): string {
  const isDev = process.env.NODE_ENV !== "production";

  const cspHeader = `
  default-src 'self';
  connect-src 'self' ${isDev ? `webpack://* ${process.env.NEXT_PUBLIC_API_ENDPOINT?.replace("/api", "")}` : ""} https://cg.optimizely.com https://*.odbm.org https://api.stripe.com https://api.addressy.com https://*.google.com https://js.monitor.azure.com https://*.applicationinsights.azure.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://*.google-analytics.com https://*.google.com https://*.google.co.uk https://*.cookiebot.eu https://*.cookiebot.com https://*.usercentrics.eu https://*.usercentrics.com;
  script-src 'self' ${isDev ? "'unsafe-eval'" : ""} 'unsafe-inline' https://p.typekit.net https://js.stripe.com https://*.js.stripe.com https://www.google.com https://www.gstatic.com https://www.googletagmanager.com https://*.cookiebot.eu https://*.cookiebot.com;
  style-src 'self' 'unsafe-inline' p.typekit.net;
  img-src 'self' blob: data: https://www.googletagmanager.com https://avatars.githubusercontent.com https://www.google.co.uk https://github.com https://www.google.com https://*.usercentrics.eu https://*.usercentrics.com;
  font-src 'self' use.typekit.net;
  frame-src 'self' https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com https://www.google.com https://*.cookiebot.eu https://*.cookiebot.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  ${isDev ? "" : "upgrade-insecure-requests;"}
`;

  return cspHeader.replace(/\s{2,}/g, " ").trim();
}

/**
 * Creates a redirect response
 */
function createRedirectResponse(
  decision: MiddlewareDecision,
  pathname: string
): NextResponse {
  const redirectTarget = decision.redirectUrl || decision.url?.toString();

  if (!redirectTarget) {
    throw new Error(
      `Redirect requires either 'redirectUrl' or 'url' property. Decision: ${JSON.stringify(decision)}`
    );
  }

  try {
    const response = NextResponse.redirect(redirectTarget);
    return addCustomHeaders(response, pathname);
  } catch (error) {
    throw new Error(
      `Failed to create redirect to "${redirectTarget}": ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Creates a rewrite response
 */
function createRewriteResponse(
  decision: MiddlewareDecision,
  pathname: string
): NextResponse {
  const rewriteUrl = decision.rewriteUrl || decision.url?.toString();

  if (!rewriteUrl) {
    throw new Error(
      `Rewrite requires either 'rewriteUrl' or 'url' property. Decision: ${JSON.stringify(decision)}`
    );
  }

  try {
    const response = NextResponse.rewrite(rewriteUrl);
    return addCustomHeaders(response, pathname);
  } catch (error) {
    throw new Error(
      `Failed to create rewrite to "${rewriteUrl}": ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Creates an error response (4xx status codes)
 */
function createErrorResponse(
  decision: MiddlewareDecision,
  pathname: string
): NextResponse {
  if (!decision.status) {
    throw new Error(
      `Error response requires a 'status' property. Decision: ${JSON.stringify(decision)}`
    );
  }

  if (decision.status < 400 || decision.status >= 600) {
    throw new Error(
      `Invalid error status code: ${decision.status}. Must be between 400-599.`
    );
  }

  try {
    const response = NextResponse.json(
      {
        error: "Access denied or resource not available",
        statusCode: decision.status,
      },
      { status: decision.status }
    );

    return addCustomHeaders(response, pathname);
  } catch (error) {
    throw new Error(
      `Failed to create error response with status ${decision.status}: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Creates a next response with CSP headers
 */
function createNextResponse(
  request: NextRequest,
  pathname: string
): NextResponse {
  try {
    const cspHeaderValue = generateCSPHeader();

    // Prepare headers for the response
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("Content-Security-Policy", cspHeaderValue);

    // Create the next response
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });

    // Add custom headers
    addCustomHeaders(response, pathname);

    // All other high level security headers should be set in WAF layer (Azure Front Door) including:
    // - Strict-Transport-Security
    // - X-Frame-Options
    // - X-Content-Type-Options
    // - X-XSS-Protection
    // - Referrer-Policy
    // - Permissions-Policy

    response.headers.set("Content-Security-Policy", cspHeaderValue);

    return response;
  } catch (error) {
    throw new Error(
      `Failed to create next response with CSP headers: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}

/**
 * Creates a response based on the middleware decision and applies security headers
 */
function createResponse(
  decision: MiddlewareDecision,
  pathname: string,
  request: NextRequest
): NextResponse {
  if (decision.action === "redirect") {
    return createRedirectResponse(decision, pathname);
  }

  if (decision.action === "rewrite") {
    return createRewriteResponse(decision, pathname);
  }

  if (decision.status && decision.status >= 400) {
    return createErrorResponse(decision, pathname);
  }

  return createNextResponse(request, pathname);
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - ODBM-Mark_RGB.webp (logo file)
     * - auth (Signin/Signout/Transfer)
     * - Ignore matching prefetches (from next/link) that don't need the CSP header.
     */
    {
      source:
        "/((?!api|_next/static|_next/image|public|favicon.ico|sitemap.xml|robots.txt|ODBM-Mark_RGB.webp|auth).*)",
      missing: [
        {
          type: "header",
          key: "next-router-prefetch",
        },
        {
          type: "header",
          key: "purpose",
          value: "prefetch",
        },
        {
          type: "query",
          key: "_rsc",
        },
      ],
    },
  ],
};
