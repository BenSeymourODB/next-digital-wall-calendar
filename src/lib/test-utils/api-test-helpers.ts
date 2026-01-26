/**
 * Test helpers for API route testing
 */
import { NextRequest } from "next/server";

const BASE_URL = "http://localhost:3000";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Create a mock NextRequest for API route testing
 * URLs must be absolute for NextRequest
 */
export function createMockRequest(
  path: string,
  options: RequestOptions = {}
): NextRequest {
  const { method = "GET", body, headers = {} } = options;

  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;

  // Build the request init
  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    ...headers,
  });

  const requestBody = body !== undefined ? JSON.stringify(body) : undefined;

  return new NextRequest(url, {
    method,
    headers: requestHeaders,
    body: requestBody,
  });
}

/**
 * Parse a Response object and return status with typed data
 */
export async function parseResponse<T>(
  response: Response
): Promise<{ status: number; data: T }> {
  const data = (await response.json()) as T;
  return {
    status: response.status,
    data,
  };
}

/**
 * Standard error response type from API routes
 */
export interface ApiErrorResponse {
  error: string;
  requiresReauth?: boolean;
}

/**
 * Helper to assert response is an error
 */
export function isApiError(data: unknown): data is ApiErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ApiErrorResponse).error === "string"
  );
}

/**
 * Create mock headers with optional authorization
 */
export function createMockHeaders(
  accessToken?: string
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  return headers;
}
