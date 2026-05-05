/**
 * Integration tests for the /api/auth/refresh-token route.
 *
 * Issue #275: this server-only route used to read the OAuth client id from
 * `process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID`, which Next.js inlines into the
 * browser bundle even though the route is never imported client-side. The
 * route now reads the unprefixed `GOOGLE_CLIENT_ID` (matching `auth.ts`); the
 * "reads GOOGLE_CLIENT_ID, ignores NEXT_PUBLIC_GOOGLE_CLIENT_ID" cases below
 * lock that in.
 */
import {
  GoogleTokenRefreshError,
  refreshGoogleAccessToken,
} from "@/lib/auth/refresh-google-token";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/auth/refresh-google-token", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/auth/refresh-google-token")
  >("@/lib/auth/refresh-google-token");
  return {
    ...actual,
    refreshGoogleAccessToken: vi.fn(),
  };
});

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

interface RefreshSuccessResponse {
  access_token: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

const SUCCESS_TOKENS = {
  access_token: "ya29.new-access-token",
  expires_in: 3600,
  scope: "https://www.googleapis.com/auth/calendar.readonly",
  token_type: "Bearer",
};

const ORIGINAL_ENV = { ...process.env };

describe("POST /api/auth/refresh-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Server-only env vars used by the route.
    process.env.GOOGLE_CLIENT_ID = "server-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "server-client-secret";
    // The legacy public var has a different value so any code path that still
    // reads it instead of GOOGLE_CLIENT_ID is caught by the assertion below.
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "public-client-id-LEAKED";
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns 400 when refreshToken is missing", async () => {
    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: {},
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toBe("Refresh token is required");
    expect(refreshGoogleAccessToken).not.toHaveBeenCalled();
  });

  it("returns 500 when GOOGLE_CLIENT_ID is missing (does NOT fall back to NEXT_PUBLIC_GOOGLE_CLIENT_ID)", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    // The public var is still set; if the route falls back to it the test
    // fails, which is the regression-prevention point of this case.
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID = "public-client-id-LEAKED";

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt-abc" },
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Server configuration error");
    expect(refreshGoogleAccessToken).not.toHaveBeenCalled();
  });

  it("returns 500 when GOOGLE_CLIENT_SECRET is missing", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt-abc" },
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Server configuration error");
    expect(refreshGoogleAccessToken).not.toHaveBeenCalled();
  });

  it("passes server-only GOOGLE_CLIENT_ID (not NEXT_PUBLIC_GOOGLE_CLIENT_ID) to refreshGoogleAccessToken", async () => {
    vi.mocked(refreshGoogleAccessToken).mockResolvedValue(SUCCESS_TOKENS);

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt-abc" },
    });

    await POST(request);

    expect(refreshGoogleAccessToken).toHaveBeenCalledTimes(1);
    expect(refreshGoogleAccessToken).toHaveBeenCalledWith(
      "rt-abc",
      "server-client-id",
      "server-client-secret"
    );
    // Belt-and-braces: the public-prefixed value must never reach Google.
    const [, clientId] = vi.mocked(refreshGoogleAccessToken).mock.calls[0]!;
    expect(clientId).not.toBe("public-client-id-LEAKED");
    expect(clientId).not.toMatch(/LEAKED/);
  });

  it("returns the parsed tokens on success", async () => {
    vi.mocked(refreshGoogleAccessToken).mockResolvedValue(SUCCESS_TOKENS);

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt-abc" },
    });

    const response = await POST(request);
    const { status, data } =
      await parseResponse<RefreshSuccessResponse>(response);

    expect(status).toBe(200);
    expect(data.access_token).toBe(SUCCESS_TOKENS.access_token);
    expect(data.expires_in).toBe(SUCCESS_TOKENS.expires_in);
    expect(data.scope).toBe(SUCCESS_TOKENS.scope);
    expect(data.token_type).toBe(SUCCESS_TOKENS.token_type);
  });

  it("returns 401 + requiresReauth on invalid_grant from Google", async () => {
    vi.mocked(refreshGoogleAccessToken).mockRejectedValue(
      new GoogleTokenRefreshError(400, {
        error: "invalid_grant",
        error_description: "Token has been expired or revoked.",
      })
    );

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "revoked-rt" },
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Invalid or expired refresh token");
    expect(data.requiresReauth).toBe(true);
  });

  it("returns 401 + requiresReauth on invalid_request from Google", async () => {
    vi.mocked(refreshGoogleAccessToken).mockRejectedValue(
      new GoogleTokenRefreshError(400, { error: "invalid_request" })
    );

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt" },
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.requiresReauth).toBe(true);
  });

  it("forwards the upstream status on other GoogleTokenRefreshError shapes", async () => {
    vi.mocked(refreshGoogleAccessToken).mockRejectedValue(
      new GoogleTokenRefreshError(503, { error: "service_unavailable" })
    );

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt" },
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(503);
    expect(data.error).toBe("Failed to refresh token");
    expect(data.requiresReauth).toBeUndefined();
  });

  it("returns 500 on unexpected non-GoogleTokenRefreshError throws", async () => {
    vi.mocked(refreshGoogleAccessToken).mockRejectedValue(
      new Error("network melted")
    );

    const request = createMockRequest("/api/auth/refresh-token", {
      method: "POST",
      body: { refreshToken: "rt" },
    });

    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Internal server error");
  });
});
