/**
 * Integration tests for /api/calendar/events route
 */
// Import after mocks
import { getAccessToken, getSession } from "@/lib/auth";
import {
  mockGoogleAccount,
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "../route";

// Mock modules BEFORE imports
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

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("/api/calendar/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/calendar/events", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Session expired. Please sign in again.");
      expect(data.requiresReauth).toBe(true);
    });

    it("returns calendar events on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const mockEvents = [
        {
          id: "event-1",
          summary: "Meeting",
          start: { dateTime: "2024-03-15T10:00:00Z" },
          end: { dateTime: "2024-03-15T11:00:00Z" },
        },
        {
          id: "event-2",
          summary: "Lunch",
          start: { dateTime: "2024-03-15T12:00:00Z" },
          end: { dateTime: "2024-03-15T13:00:00Z" },
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: mockEvents,
            summary: "Primary Calendar",
            timeZone: "America/New_York",
          }),
      });

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        events: Array<(typeof mockEvents)[0] & { calendarId: string }>;
        summary?: string;
        timeZone?: string;
      }>(response);

      expect(status).toBe(200);
      // Events now include calendarId
      expect(data.events).toHaveLength(2);
      expect(data.events[0].id).toBe("event-1");
      expect(data.events[0].summary).toBe("Meeting");
      expect(data.events[0].calendarId).toBe("primary");
      expect(data.events[1].id).toBe("event-2");
      expect(data.events[1].calendarId).toBe("primary");
      expect(data.summary).toBe("Primary Calendar");
      expect(data.timeZone).toBe("America/New_York");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("googleapis.com/calendar/v3"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockGoogleAccount.access_token}`,
          }),
        })
      );
    });

    it("preserves extended Google Calendar v3 fields on each event", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const enrichedEvent = {
        id: "evt-rich",
        summary: "Design review",
        start: { dateTime: "2026-05-01T14:00:00Z" },
        end: { dateTime: "2026-05-01T15:00:00Z" },
        status: "confirmed",
        location: "Room 1",
        htmlLink: "https://www.google.com/calendar/event?eid=abc",
        iCalUID: "evt-rich@google.com",
        etag: '"etag-xyz"',
        organizer: { email: "alice@example.com", displayName: "Alice" },
        attendees: [
          {
            email: "bob@example.com",
            displayName: "Bob",
            responseStatus: "accepted",
          },
        ],
        recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
        eventType: "default",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [enrichedEvent],
            summary: "Primary Calendar",
            timeZone: "UTC",
          }),
      });

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        events: Array<
          typeof enrichedEvent & {
            calendarId: string;
          }
        >;
      }>(response);

      expect(status).toBe(200);
      expect(data.events).toHaveLength(1);
      const returned = data.events[0];
      expect(returned.calendarId).toBe("primary");
      expect(returned.status).toBe("confirmed");
      expect(returned.location).toBe("Room 1");
      expect(returned.htmlLink).toBe(enrichedEvent.htmlLink);
      expect(returned.iCalUID).toBe("evt-rich@google.com");
      expect(returned.etag).toBe('"etag-xyz"');
      expect(returned.organizer?.email).toBe("alice@example.com");
      expect(returned.attendees).toHaveLength(1);
      expect(returned.attendees?.[0]?.responseStatus).toBe("accepted");
      expect(returned.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
      expect(returned.eventType).toBe("default");
    });

    it("returns empty array when no events exist", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: undefined }),
      });

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<{ events: unknown[] }>(
        response
      );

      expect(status).toBe(200);
      expect(data.events).toEqual([]);
    });

    it("uses default calendarId when not specified", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const request = createMockRequest("/api/calendar/events");
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/primary/events"),
        expect.any(Object)
      );
    });

    it("uses specified calendarId", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const request = createMockRequest(
        "/api/calendar/events?calendarId=work%40example.com"
      );
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/calendars/work%40example.com/events"),
        expect.any(Object)
      );
    });

    it("passes query parameters correctly", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const timeMin = "2024-03-01T00:00:00Z";
      const timeMax = "2024-03-31T23:59:59Z";
      const request = createMockRequest(
        `/api/calendar/events?timeMin=${timeMin}&timeMax=${timeMax}&maxResults=50`
      );
      await GET(request);

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain(`timeMin=${encodeURIComponent(timeMin)}`);
      expect(calledUrl).toContain(`timeMax=${encodeURIComponent(timeMax)}`);
      expect(calledUrl).toContain("maxResults=50");
    });

    it("returns 401 with requiresReauth when Google API returns 401", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe(
        "Google authentication failed. Please sign in again."
      );
      expect(data.requiresReauth).toBe(true);
    });

    it("returns error status from Google API for other errors", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Calendar not found" }),
      });

      const request = createMockRequest(
        "/api/calendar/events?calendarId=nonexistent"
      );
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Failed to fetch calendar events");
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockRejectedValue(new Error("Unexpected"));

      const request = createMockRequest("/api/calendar/events");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });

    it("defaults singleEvents to true", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const request = createMockRequest("/api/calendar/events");
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("singleEvents=true"),
        expect.any(Object)
      );
    });

    it("allows singleEvents to be set to false", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const request = createMockRequest(
        "/api/calendar/events?singleEvents=false"
      );
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("singleEvents=false"),
        expect.any(Object)
      );
    });

    // Multi-calendar support tests
    describe("multiple calendars support", () => {
      it("fetches from multiple calendars when calendarIds is provided", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        const primaryEvents = [
          {
            id: "event-1",
            summary: "Primary Meeting",
            start: { dateTime: "2024-03-15T10:00:00Z" },
            end: { dateTime: "2024-03-15T11:00:00Z" },
          },
        ];

        const familyEvents = [
          {
            id: "event-2",
            summary: "Family Dinner",
            start: { dateTime: "2024-03-15T18:00:00Z" },
            end: { dateTime: "2024-03-15T20:00:00Z" },
          },
        ];

        // Mock responses for each calendar
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: primaryEvents,
                summary: "Primary Calendar",
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: familyEvents,
                summary: "Family Calendar",
              }),
          });

        const request = createMockRequest(
          "/api/calendar/events?calendarIds=primary,family%40group.calendar.google.com"
        );
        const response = await GET(request);
        const { status, data } = await parseResponse<{
          events: Array<{ id: string; calendarId: string }>;
        }>(response);

        expect(status).toBe(200);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(data.events).toHaveLength(2);
        // Events should include calendarId
        expect(data.events[0].calendarId).toBe("primary");
        expect(data.events[1].calendarId).toBe(
          "family@group.calendar.google.com"
        );
      });

      it("includes calendarId in each event when using calendarIds", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        const workEvents = [
          {
            id: "work-1",
            summary: "Work Meeting",
            start: { dateTime: "2024-03-15T09:00:00Z" },
            end: { dateTime: "2024-03-15T10:00:00Z" },
          },
          {
            id: "work-2",
            summary: "Sprint Planning",
            start: { dateTime: "2024-03-15T14:00:00Z" },
            end: { dateTime: "2024-03-15T15:00:00Z" },
          },
        ];

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: workEvents,
              summary: "Work Calendar",
            }),
        });

        const request = createMockRequest(
          "/api/calendar/events?calendarIds=work%40example.com"
        );
        const response = await GET(request);
        const { status, data } = await parseResponse<{
          events: Array<{ id: string; calendarId: string }>;
        }>(response);

        expect(status).toBe(200);
        expect(data.events).toHaveLength(2);
        expect(data.events[0].calendarId).toBe("work@example.com");
        expect(data.events[1].calendarId).toBe("work@example.com");
      });

      it("handles partial failure when one calendar fails", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        const primaryEvents = [
          {
            id: "event-1",
            summary: "Primary Meeting",
            start: { dateTime: "2024-03-15T10:00:00Z" },
            end: { dateTime: "2024-03-15T11:00:00Z" },
          },
        ];

        // Primary succeeds, family fails with 404
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: primaryEvents,
                summary: "Primary Calendar",
              }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            json: () => Promise.resolve({ error: "Calendar not found" }),
          });

        const request = createMockRequest(
          "/api/calendar/events?calendarIds=primary,nonexistent%40group.calendar.google.com"
        );
        const response = await GET(request);
        const { status, data } = await parseResponse<{
          events: Array<{ id: string; calendarId: string }>;
          errors?: Array<{ calendarId: string; error: string }>;
        }>(response);

        // Should still return 200 with partial results
        expect(status).toBe(200);
        expect(data.events).toHaveLength(1);
        expect(data.events[0].calendarId).toBe("primary");
        // Should include error info for failed calendar
        expect(data.errors).toBeDefined();
        expect(data.errors).toHaveLength(1);
        expect(data.errors![0].calendarId).toBe(
          "nonexistent@group.calendar.google.com"
        );
      });

      it("falls back to single calendarId when calendarIds not provided", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });

        const request = createMockRequest(
          "/api/calendar/events?calendarId=work%40example.com"
        );
        await GET(request);

        // Should only call once for the single calendar
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("/calendars/work%40example.com/events"),
          expect.any(Object)
        );
      });

      it("includes calendarId in single calendar response", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        const mockEvents = [
          {
            id: "event-1",
            summary: "Meeting",
            start: { dateTime: "2024-03-15T10:00:00Z" },
            end: { dateTime: "2024-03-15T11:00:00Z" },
          },
        ];

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: mockEvents,
              summary: "Primary Calendar",
            }),
        });

        const request = createMockRequest("/api/calendar/events");
        const response = await GET(request);
        const { status, data } = await parseResponse<{
          events: Array<{ id: string; calendarId: string }>;
        }>(response);

        expect(status).toBe(200);
        expect(data.events[0].calendarId).toBe("primary");
      });
    });
  });

  describe("POST /api/calendar/events", () => {
    /**
     * Build a minimal valid POST body. Defaults are a 60-minute timed event in
     * May 2026 on the primary calendar so individual tests can override only
     * the fields they care about.
     */
    function makeBody(
      overrides: Partial<{
        title: string;
        startDate: string;
        endDate: string;
        color: string;
        description: string;
        isAllDay: boolean;
        calendarId: string;
      }> = {}
    ) {
      return {
        title: "Team offsite",
        startDate: "2026-05-01T14:00:00.000Z",
        endDate: "2026-05-01T15:00:00.000Z",
        color: "blue",
        description: "Quarterly planning",
        isAllDay: false,
        calendarId: "primary",
        ...overrides,
      };
    }

    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody(),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody(),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.requiresReauth).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when title is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({ title: "   " }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/title/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when startDate is missing or invalid", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({ startDate: "not-a-date" }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/start/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when end is not after start", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          startDate: "2026-05-01T10:00:00.000Z",
          endDate: "2026-05-01T10:00:00.000Z",
        }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/end/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when color is not one of the supported values", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({ color: "magenta" }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/color/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns 400 when JSON body is malformed", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const request = new Request("http://localhost:3000/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-valid-json",
      }) as unknown as Parameters<typeof POST>[0];
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/json|body/i);
    });

    it("forwards a timed event to Google with calendarId in the URL", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const googleResponse = {
        id: "google-event-id-1",
        summary: "Team offsite",
        description: "Quarterly planning",
        start: { dateTime: "2026-05-01T14:00:00.000Z" },
        end: { dateTime: "2026-05-01T15:00:00.000Z" },
        colorId: "1",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(googleResponse),
      });

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({ calendarId: "work@example.com" }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{
        event: typeof googleResponse & { calendarId: string };
      }>(response);

      expect(status).toBe(201);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [calledUrl, calledOptions] = mockFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(calledUrl).toContain("/calendars/work%40example.com/events");
      expect(calledOptions.method).toBe("POST");
      expect(
        (calledOptions.headers as Record<string, string>).Authorization
      ).toBe(`Bearer ${mockGoogleAccount.access_token}`);

      const sentBody = JSON.parse(calledOptions.body as string);
      expect(sentBody.summary).toBe("Team offsite");
      expect(sentBody.description).toBe("Quarterly planning");
      expect(sentBody.start).toEqual({ dateTime: "2026-05-01T14:00:00.000Z" });
      expect(sentBody.end).toEqual({ dateTime: "2026-05-01T15:00:00.000Z" });
      expect(sentBody.colorId).toBe("1"); // blue
      expect(sentBody.start.date).toBeUndefined();

      expect(data.event.id).toBe("google-event-id-1");
      expect(data.event.calendarId).toBe("work@example.com");
    });

    it("defaults calendarId to 'primary' when not specified", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "evt-default",
            summary: "Default cal",
            start: { dateTime: "2026-05-01T14:00:00.000Z" },
            end: { dateTime: "2026-05-01T15:00:00.000Z" },
          }),
      });

      const body = makeBody();
      const { calendarId: _omit, ...rest } = body;
      void _omit;
      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: rest,
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{
        event: { calendarId: string };
      }>(response);

      expect(status).toBe(201);
      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("/calendars/primary/events");
      expect(data.event.calendarId).toBe("primary");
    });

    it("formats all-day events as YYYY-MM-DD with exclusive end date", async () => {
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

      // Use Date.UTC to lock the input to a TZ-independent moment so the
      // assertion holds whether the test runs in CI (UTC) or a developer's
      // local box. Convention: the dialog encodes local-midnight start and
      // local-end-of-day end as UTC ISOs; we reproduce a UTC-client send
      // here (UTC == local) so the route's UTC-component math is exercised.
      const start = new Date(Date.UTC(2026, 6, 4, 0, 0, 0, 0));
      const end = new Date(Date.UTC(2026, 6, 7, 23, 59, 59, 999));

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          isAllDay: true,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          title: "Vacation",
        }),
      });
      const response = await POST(request);
      const { status } = await parseResponse(response);

      expect(status).toBe(201);
      const sentBody = JSON.parse(
        mockFetch.mock.calls[0][1].body as string
      ) as {
        start: { date?: string; dateTime?: string };
        end: { date?: string; dateTime?: string };
      };

      // Google's all-day convention: end.date is EXCLUSIVE (the day after
      // the last included day). Jul 4–7 inclusive => end.date = "2026-07-08".
      expect(sentBody.start.date).toBe("2026-07-04");
      expect(sentBody.end.date).toBe("2026-07-08");
      expect(sentBody.start.dateTime).toBeUndefined();
      expect(sentBody.end.dateTime).toBeUndefined();
    });

    it("formats a single all-day event with end exclusive of the next day", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "evt-allday-single",
            summary: "Birthday",
            start: { date: "2026-04-20" },
            end: { date: "2026-04-21" },
          }),
      });

      const start = new Date(Date.UTC(2026, 3, 20, 0, 0, 0, 0));
      const end = new Date(Date.UTC(2026, 3, 20, 23, 59, 59, 999));

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          isAllDay: true,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          title: "Birthday",
        }),
      });
      const response = await POST(request);
      await parseResponse(response);

      const sentBody = JSON.parse(
        mockFetch.mock.calls[0][1].body as string
      ) as { start: { date: string }; end: { date: string } };
      expect(sentBody.start.date).toBe("2026-04-20");
      expect(sentBody.end.date).toBe("2026-04-21");
    });

    it("emits the correct exclusive-end for a UTC-7 client (negative offset)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            id: "evt-allday-pdt",
            summary: "Birthday",
            start: { date: "2026-04-20" },
            end: { date: "2026-04-21" },
          }),
      });

      // Simulate what a UTC-7 (PDT) browser sends for "Apr 20 all-day":
      // local midnight Apr 20 PDT = Apr 20 07:00:00 UTC. Local end-of-day
      // Apr 20 23:59:59.999 PDT = Apr 21 06:59:59.999 UTC. Without the
      // duration-based exclusive-end, `setUTCHours(0)` + `+1 day` would
      // emit "2026-04-22" here.
      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-04-20T07:00:00.000Z",
          endDate: "2026-04-21T06:59:59.999Z",
          title: "Birthday",
        }),
      });
      await parseResponse(await POST(request));

      const sentBody = JSON.parse(
        mockFetch.mock.calls[0][1].body as string
      ) as { start: { date: string }; end: { date: string } };
      expect(sentBody.start.date).toBe("2026-04-20");
      expect(sentBody.end.date).toBe("2026-04-21");
    });

    it("rejects an array body with a 400", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: ["not", "an", "object"],
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/object/i);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("maps each TEventColor to a Google colorId", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const expected: Record<string, string> = {
        blue: "1",
        green: "2",
        purple: "3",
        red: "4",
        yellow: "5",
        orange: "6",
      };

      for (const [color, colorId] of Object.entries(expected)) {
        mockFetch.mockClear();
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: `evt-${color}`,
              summary: "x",
              start: { dateTime: "2026-05-01T14:00:00.000Z" },
              end: { dateTime: "2026-05-01T15:00:00.000Z" },
            }),
        });

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody({ color }),
        });
        const response = await POST(request);
        expect(response.status).toBe(201);

        const sentBody = JSON.parse(
          mockFetch.mock.calls[0][1].body as string
        ) as { colorId?: string };
        expect(sentBody.colorId).toBe(colorId);
      }
    });

    it("treats Google 401 as requiresReauth", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({ error: { message: "Invalid Credentials" } }),
      });

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody(),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.requiresReauth).toBe(true);
    });

    it("treats Google 403 as a permission error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: () => Promise.resolve({ error: { message: "Forbidden" } }),
      });

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody(),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toMatch(/permission/i);
    });

    it("treats Google 404 as calendar-not-found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: { message: "Not Found" } }),
      });

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({ calendarId: "missing@example.com" }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toMatch(/not found/i);
    });

    it("returns 502 for other Google errors", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () =>
          Promise.resolve({ error: { message: "Internal Server Error" } }),
      });

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody(),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(502);
      expect(data.error).toMatch(/failed/i);
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockRejectedValue(new Error("kaboom"));

      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody(),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });
  });
});
