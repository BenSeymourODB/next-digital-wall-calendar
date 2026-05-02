/**
 * Integration tests for /api/calendar/events/[id] route.
 *
 * Establishes the per-event mutation route for the cluster #115/#116/#118.
 * Mirrors the auth + Google API forwarding pattern used by
 * /api/calendar/events GET so the rest of the cluster can drop alongside.
 */
import { getAccessToken, getSession } from "@/lib/auth";
import {
  mockGoogleAccount,
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import {
  type ApiErrorResponse,
  createMockRequest,
  createParams,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "../route";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getAccessToken: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("DELETE /api/calendar/events/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = createMockRequest("/api/calendar/events/evt-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 with requiresReauth when session has RefreshTokenError", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

    const request = createMockRequest("/api/calendar/events/evt-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.requiresReauth).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when calendarId query param is missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/calendar/events/evt-1", {
      method: "DELETE",
    });
    const response = await DELETE(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/calendarId/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the event id is empty", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest(
      "/api/calendar/events/%20?calendarId=primary",
      { method: "DELETE" }
    );
    const response = await DELETE(request, { params: createParams("   ") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/event/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls Google Calendar events.delete with the event and calendar id and returns 204", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      // Google delete returns no body
      json: () => Promise.resolve({}),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "DELETE" }
    );
    const response = await DELETE(request, { params: createParams("evt-1") });

    expect(response.status).toBe(204);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = mockFetch.mock.calls[0];
    expect(String(calledUrl)).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events/evt-1"
    );
    expect(init).toMatchObject({
      method: "DELETE",
      headers: expect.objectContaining({
        Authorization: `Bearer ${mockGoogleAccount.access_token}`,
      }),
    });
  });

  it("URL-encodes calendarId and event id when forwarding to Google", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.resolve({}),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt%20with%20spaces?calendarId=work%40example.com",
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: createParams("evt with spaces"),
    });

    expect(response.status).toBe(204);
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain("/calendars/work%40example.com/events/");
    expect(calledUrl).toContain("evt%20with%20spaces");
  });

  it("treats Google's 410 Gone response as success (already deleted)", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: false,
      status: 410,
      json: () =>
        Promise.resolve({ error: { message: "Resource has been deleted" } }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "DELETE" }
    );
    const response = await DELETE(request, { params: createParams("evt-1") });

    expect(response.status).toBe(204);
  });

  it("returns 404 when Google reports the event does not exist", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: { message: "Not Found" } }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-missing?calendarId=primary",
      { method: "DELETE" }
    );
    const response = await DELETE(request, {
      params: createParams("evt-missing"),
    });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });

  it("returns 403 when the user lacks write access to the calendar", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: () =>
        Promise.resolve({
          error: { message: "Forbidden: read-only calendar" },
        }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=readonly%40group.calendar.google.com",
      { method: "DELETE" }
    );
    const response = await DELETE(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(403);
    expect(data.error).toMatch(/permission|read-only|forbidden/i);
  });

  it("returns 401 with requiresReauth when Google rejects the access token", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: { message: "Unauthorized" } }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "DELETE" }
    );
    const response = await DELETE(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.requiresReauth).toBe(true);
  });

  it("returns 502 when Google returns an unexpected 5xx", async () => {
    // 5xx responses go through `fetchWithRetry`, so use fake timers to skip
    // the inter-attempt sleeps and `headers` so the retry's Retry-After
    // lookup doesn't trip over a partial mock.
    vi.useFakeTimers();
    try {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: "Internal" } }),
      });

      const request = createMockRequest(
        "/api/calendar/events/evt-1?calendarId=primary",
        { method: "DELETE" }
      );
      const promise = DELETE(request, { params: createParams("evt-1") });
      await vi.runAllTimersAsync();
      const response = await promise;
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(502);
      expect(data.error).toMatch(/calendar/i);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns 500 when an unexpected exception occurs", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockRejectedValue(new Error("boom"));

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "DELETE" }
    );
    const response = await DELETE(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toMatch(/unexpected/i);
  });
});
