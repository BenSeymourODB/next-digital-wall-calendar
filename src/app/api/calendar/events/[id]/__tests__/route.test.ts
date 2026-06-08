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
import { DELETE, PATCH } from "../route";

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

describe("PATCH /api/calendar/events/[id]", () => {
  /**
   * Build a minimal valid PATCH body. Defaults are a 60-minute timed event on
   * the primary calendar so individual tests override only what they care
   * about. Shape mirrors the POST validator's `EventBody`.
   */
  function makeBody(
    overrides: Partial<{
      title: string;
      startDate: string;
      endDate: string;
      color: string;
      description: string;
      isAllDay: boolean;
    }> = {}
  ) {
    return {
      title: "Renamed offsite",
      startDate: "2026-05-01T15:00:00.000Z",
      endDate: "2026-05-01T16:00:00.000Z",
      color: "green",
      description: "Now in the afternoon",
      isAllDay: false,
      ...overrides,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 401 with requiresReauth when session has RefreshTokenError", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.requiresReauth).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when calendarId query param is missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/calendar/events/evt-1", {
      method: "PATCH",
      body: makeBody(),
    });
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/calendarId/);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the event id is empty", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest(
      "/api/calendar/events/%20?calendarId=primary",
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("   ") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/event/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when the JSON body is malformed", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = new Request(
      "http://localhost:3000/api/calendar/events/evt-1?calendarId=primary",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: "{not-valid-json",
      }
    ) as unknown as Parameters<typeof PATCH>[0];
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/json|body/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when title is missing or whitespace", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "PATCH", body: makeBody({ title: "   " }) }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/title/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when color is not one of the supported palette entries", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      { method: "PATCH", body: makeBody({ color: "magenta" }) }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/color/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 400 when end is not after start", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      {
        method: "PATCH",
        body: makeBody({
          startDate: "2026-05-01T10:00:00.000Z",
          endDate: "2026-05-01T10:00:00.000Z",
        }),
      }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/end/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("forwards a timed event to Google with calendarId in the URL and returns the normalised event", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    const googleResponse = {
      id: "evt-1",
      summary: "Renamed offsite",
      description: "Now in the afternoon",
      start: { dateTime: "2026-05-01T15:00:00.000Z" },
      end: { dateTime: "2026-05-01T16:00:00.000Z" },
      colorId: "2",
    };

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(googleResponse),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=work%40example.com",
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<{
      event: typeof googleResponse & { calendarId: string };
    }>(response);

    expect(status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledOptions] = mockFetch.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe(
      "https://www.googleapis.com/calendar/v3/calendars/work%40example.com/events/evt-1"
    );
    expect(calledOptions.method).toBe("PATCH");
    expect(
      (calledOptions.headers as Record<string, string>).Authorization
    ).toBe(`Bearer ${mockGoogleAccount.access_token}`);

    const sentBody = JSON.parse(calledOptions.body as string);
    expect(sentBody.summary).toBe("Renamed offsite");
    expect(sentBody.description).toBe("Now in the afternoon");
    // Explicit `date: null` clears the previously-stored all-day value on
    // a PATCH type-switch (all-day → timed). See the type-switch test
    // below for the inverse direction.
    expect(sentBody.start).toEqual({
      dateTime: "2026-05-01T15:00:00.000Z",
      date: null,
    });
    expect(sentBody.end).toEqual({
      dateTime: "2026-05-01T16:00:00.000Z",
      date: null,
    });
    expect(sentBody.colorId).toBe("2"); // green

    expect(data.event.id).toBe("evt-1");
    expect(data.event.calendarId).toBe("work@example.com");
  });

  it("formats an all-day patch as YYYY-MM-DD with exclusive end date", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "evt-allday",
          summary: "Vacation",
          start: { date: "2026-07-04" },
          end: { date: "2026-07-08" },
        }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-allday?calendarId=primary",
      {
        method: "PATCH",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-07-04",
          endDate: "2026-07-07",
          title: "Vacation",
        }),
      }
    );
    const response = await PATCH(request, {
      params: createParams("evt-allday"),
    });
    const { status } = await parseResponse(response);

    expect(status).toBe(200);
    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string) as {
      start: { date?: string | null; dateTime?: string | null };
      end: { date?: string | null; dateTime?: string | null };
    };

    // Google's all-day convention: end.date is EXCLUSIVE.
    expect(sentBody.start.date).toBe("2026-07-04");
    expect(sentBody.end.date).toBe("2026-07-08");
    // Explicit `dateTime: null` so a PATCH on a previously-timed event
    // clears the stored time; otherwise Google would reject the body for
    // having both `date` and `dateTime` populated on the same time object.
    expect(sentBody.start.dateTime).toBeNull();
    expect(sentBody.end.dateTime).toBeNull();
  });

  it("clears the previously-stored time fields when patching a timed event to all-day", async () => {
    // Regression: Google's `events.patch` merges the body over the stored
    // event, so an all-day PATCH on a previously-timed event must
    // explicitly null out `start.dateTime` / `end.dateTime`. Without
    // this, Google rejects the body for having both `date` and `dateTime`
    // populated on the same time object.
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "evt-was-timed",
          summary: "Now all-day",
          start: { date: "2026-08-01" },
          end: { date: "2026-08-02" },
        }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-was-timed?calendarId=primary",
      {
        method: "PATCH",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-08-01",
          endDate: "2026-08-01",
          title: "Now all-day",
        }),
      }
    );
    await PATCH(request, { params: createParams("evt-was-timed") });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.start.date).toBe("2026-08-01");
    expect(sentBody.end.date).toBe("2026-08-02");
    expect(sentBody.start.dateTime).toBeNull();
    expect(sentBody.end.dateTime).toBeNull();
  });

  it("clears the previously-stored date fields when patching an all-day event to timed", async () => {
    // Inverse of the test above: timed PATCH on a previously-all-day
    // event must null out `start.date` / `end.date`.
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "evt-was-allday",
          summary: "Now timed",
          start: { dateTime: "2026-08-01T09:00:00.000Z" },
          end: { dateTime: "2026-08-01T10:00:00.000Z" },
        }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-was-allday?calendarId=primary",
      {
        method: "PATCH",
        body: makeBody({
          isAllDay: false,
          startDate: "2026-08-01T09:00:00.000Z",
          endDate: "2026-08-01T10:00:00.000Z",
          title: "Now timed",
        }),
      }
    );
    await PATCH(request, { params: createParams("evt-was-allday") });

    const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body as string);
    expect(sentBody.start.dateTime).toBe("2026-08-01T09:00:00.000Z");
    expect(sentBody.end.dateTime).toBe("2026-08-01T10:00:00.000Z");
    expect(sentBody.start.date).toBeNull();
    expect(sentBody.end.date).toBeNull();
  });

  it("rejects an all-day patch where startDate is an ISO datetime string", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      {
        method: "PATCH",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-04-20T07:00:00.000Z",
          endDate: "2026-04-21T06:59:59.999Z",
        }),
      }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toMatch(/YYYY-MM-DD/i);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("URL-encodes calendarId and event id when forwarding to Google", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "evt with spaces",
          summary: "x",
          start: { dateTime: "2026-05-01T15:00:00.000Z" },
          end: { dateTime: "2026-05-01T16:00:00.000Z" },
        }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt%20with%20spaces?calendarId=work%40example.com",
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, {
      params: createParams("evt with spaces"),
    });

    expect(response.status).toBe(200);
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain("/calendars/work%40example.com/events/");
    expect(calledUrl).toContain("evt%20with%20spaces");
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
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.requiresReauth).toBe(true);
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
        Promise.resolve({ error: { message: "Forbidden: read-only" } }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=readonly%40group.calendar.google.com",
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(403);
    expect(data.error).toMatch(/permission|read-only|forbidden/i);
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
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, {
      params: createParams("evt-missing"),
    });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(404);
    expect(data.error).toMatch(/not found/i);
  });

  it("returns 502 when Google returns an unexpected 5xx", async () => {
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
        { method: "PATCH", body: makeBody() }
      );
      const promise = PATCH(request, { params: createParams("evt-1") });
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
      { method: "PATCH", body: makeBody() }
    );
    const response = await PATCH(request, { params: createParams("evt-1") });
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toMatch(/unexpected/i);
  });

  it("ignores a calendarId field in the body — the route trusts the query string", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue(
      mockGoogleAccount.access_token!
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          id: "evt-1",
          summary: "x",
          start: { dateTime: "2026-05-01T15:00:00.000Z" },
          end: { dateTime: "2026-05-01T16:00:00.000Z" },
        }),
    });

    const request = createMockRequest(
      "/api/calendar/events/evt-1?calendarId=primary",
      {
        method: "PATCH",
        body: { ...makeBody(), calendarId: "sneaky@example.com" },
      }
    );
    await PATCH(request, { params: createParams("evt-1") });

    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain("/calendars/primary/events/evt-1");
    expect(calledUrl).not.toContain("sneaky");
  });
});
