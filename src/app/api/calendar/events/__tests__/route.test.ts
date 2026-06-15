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
import { logger } from "@/lib/logger";
import {
  type ApiErrorResponse,
  createMockRequest,
  jsonResponse,
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

      // Issue #386 item 2 — the original "all calendars failed" branch fired
      // only when `calendarIds.length === 1`, so a multi-calendar all-fail
      // request still returned 200 with empty events[] and a populated
      // errors[]. A caller keying off the top-level status missed the
      // failure entirely. Drop the single-calendar guard and surface an
      // error status whenever every calendar in the request failed.
      describe("multi-calendar all-fail returns an error status (#386 item 2)", () => {
        it("returns the shared status when every calendar fails with the same Google status", async () => {
          vi.mocked(getSession).mockResolvedValue(mockSession);
          vi.mocked(getAccessToken).mockResolvedValue(
            mockGoogleAccount.access_token!
          );

          // Both calendars 404 — the typical "two stale ids in the saved
          // filter" scenario after a calendar share is revoked.
          mockFetch
            .mockResolvedValueOnce({
              ok: false,
              status: 404,
              json: () => Promise.resolve({ error: "Calendar not found" }),
            })
            .mockResolvedValueOnce({
              ok: false,
              status: 404,
              json: () => Promise.resolve({ error: "Calendar not found" }),
            });

          const request = createMockRequest(
            "/api/calendar/events?calendarIds=stale-a%40group.calendar.google.com,stale-b%40group.calendar.google.com"
          );
          const response = await GET(request);
          const { status, data } =
            await parseResponse<ApiErrorResponse>(response);

          expect(status).toBe(404);
          expect(data.error).toBe("Failed to fetch calendar events");
        });

        it("returns 502 when every calendar fails with mixed Google statuses", async () => {
          vi.mocked(getSession).mockResolvedValue(mockSession);
          vi.mocked(getAccessToken).mockResolvedValue(
            mockGoogleAccount.access_token!
          );

          // One 404 (stale id), one 502 (validation failure or upstream
          // outage). The caller cannot generally pick one as canonical, so
          // collapse to 502 — "we tried, nothing worked".
          mockFetch
            .mockResolvedValueOnce({
              ok: false,
              status: 404,
              json: () => Promise.resolve({ error: "Calendar not found" }),
            })
            .mockResolvedValueOnce({
              ok: true,
              json: () =>
                Promise.resolve({
                  // Validation failure: missing required `id` on the event.
                  items: [{ summary: "no id" }],
                }),
            });

          const request = createMockRequest(
            "/api/calendar/events?calendarIds=stale%40group.calendar.google.com,malformed%40group.calendar.google.com"
          );
          const response = await GET(request);
          const { status, data } =
            await parseResponse<ApiErrorResponse>(response);

          expect(status).toBe(502);
          expect(data.error).toBe("Failed to fetch calendar events");
        });

        it("returns 502 when every calendar fails with the same validation status", async () => {
          vi.mocked(getSession).mockResolvedValue(mockSession);
          vi.mocked(getAccessToken).mockResolvedValue(
            mockGoogleAccount.access_token!
          );

          // Both calendars send malformed event lists (no `id`) — the
          // "Google starts producing garbage across the whole calendar set"
          // scenario the issue calls out.
          mockFetch.mockResolvedValue({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [{ summary: "no id" }],
              }),
          });

          const request = createMockRequest(
            "/api/calendar/events?calendarIds=cal-a%40group.calendar.google.com,cal-b%40group.calendar.google.com"
          );
          const response = await GET(request);
          const { status, data } =
            await parseResponse<ApiErrorResponse>(response);

          expect(status).toBe(502);
          expect(data.error).toBe("Failed to fetch calendar events");
        });

        it("still returns 200 for partial failure (one ok, one fails)", async () => {
          vi.mocked(getSession).mockResolvedValue(mockSession);
          vi.mocked(getAccessToken).mockResolvedValue(
            mockGoogleAccount.access_token!
          );

          // Regression guard — the original partial-failure behaviour
          // (events[] + errors[] + 200) must remain intact.
          mockFetch
            .mockResolvedValueOnce({
              ok: true,
              json: () =>
                Promise.resolve({
                  items: [
                    {
                      id: "evt-good",
                      summary: "Good event",
                      start: { dateTime: "2026-05-01T14:00:00Z" },
                      end: { dateTime: "2026-05-01T15:00:00Z" },
                    },
                  ],
                  summary: "Primary",
                }),
            })
            .mockResolvedValueOnce({
              ok: false,
              status: 404,
              json: () => Promise.resolve({ error: "Calendar not found" }),
            });

          const request = createMockRequest(
            "/api/calendar/events?calendarIds=primary,stale%40group.calendar.google.com"
          );
          const response = await GET(request);
          const { status, data } = await parseResponse<{
            events: Array<{ id: string }>;
            errors?: Array<{ calendarId: string; status?: number }>;
          }>(response);

          expect(status).toBe(200);
          expect(data.events).toHaveLength(1);
          expect(data.errors).toHaveLength(1);
        });
      });
    });

    describe("Zod validation of Google list responses (#277)", () => {
      // Issue #277 — every server-side Google Calendar route now validates the
      // Google response with Zod at the boundary. Malformed payloads (e.g. an
      // event item missing the required `id`) become a 502 plus a structured
      // `logger.error` rather than crashing later in the mapper layer.
      it("returns 502 with structured log when an item is missing required id", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        // `id` is the only required field on `GoogleEventSchema`. Drop it and
        // the Zod parse fails — the route must surface a 502.
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ summary: "no id" }],
              summary: "Primary Calendar",
            }),
        });

        const request = createMockRequest("/api/calendar/events");
        const response = await GET(request);
        const { status, data } =
          await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(502);
        expect(data.error).toMatch(/calendar/i);
        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "GoogleApiValidationError",
          }),
          expect.objectContaining({
            endpoint: "events.list",
            calendarId: "primary",
          })
        );
      });

      it("returns 502 when the items array is itself the wrong shape", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        // `items` must be an array per the schema; a string trips it.
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: "definitely not an array",
            }),
        });

        const request = createMockRequest("/api/calendar/events");
        const response = await GET(request);
        const { status } = await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(502);
        expect(vi.mocked(logger.error)).toHaveBeenCalled();
      });

      it("treats a malformed response on one of two calendars as a per-calendar error", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        const goodEvent = {
          id: "evt-good",
          summary: "Good event",
          start: { dateTime: "2026-05-01T14:00:00Z" },
          end: { dateTime: "2026-05-01T15:00:00Z" },
        };

        // First calendar: well-formed. Second calendar: malformed (no id).
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [goodEvent],
                summary: "Primary Calendar",
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [{ summary: "no id" }],
                summary: "Family Calendar",
              }),
          });

        const request = createMockRequest(
          "/api/calendar/events?calendarIds=primary,family%40group.calendar.google.com"
        );
        const response = await GET(request);
        const { status, data } = await parseResponse<{
          events: Array<{ id: string; calendarId: string }>;
          errors?: Array<{ calendarId: string; status?: number }>;
        }>(response);

        // Multi-calendar partial failure: still 200 overall, the bad calendar
        // surfaces in `errors[]` with status 502.
        expect(status).toBe(200);
        expect(data.events).toHaveLength(1);
        expect(data.events[0].id).toBe("evt-good");
        expect(data.errors).toHaveLength(1);
        expect(data.errors![0].calendarId).toBe(
          "family@group.calendar.google.com"
        );
        expect(data.errors![0].status).toBe(502);
        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "GoogleApiValidationError",
          }),
          expect.objectContaining({
            endpoint: "events.list",
            calendarId: "family@group.calendar.google.com",
          })
        );
        // Validation failures self-log inside `fetchEventsFromCalendar` with
        // a rich `GoogleApiValidationError` + `validationIssues`. The outer
        // GET aggregation loop must NOT also fire its generic
        // `"Calendar fetch error"` log for the same failure — that would
        // double-log and dilute the structured signal.
        expect(vi.mocked(logger.error)).toHaveBeenCalledTimes(1);
        expect(vi.mocked(logger.error)).not.toHaveBeenCalledWith(
          expect.objectContaining({ message: "Calendar fetch error" }),
          expect.anything()
        );

        // The internal `logged` dedupe flag must not leak onto the wire.
        // Public callers should see only the documented error shape.
        expect(data.errors![0]).not.toHaveProperty("logged");
      });

      it("strips the internal logged flag from partial-failure errors[]", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        // Two calendars: one succeeds, the other returns a validation failure
        // (no `id`) so its CalendarFetchError carries `logged: true` server-side.
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [
                  {
                    id: "evt-good",
                    summary: "Good event",
                    start: { dateTime: "2026-05-01T14:00:00Z" },
                    end: { dateTime: "2026-05-01T15:00:00Z" },
                  },
                ],
              }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () =>
              Promise.resolve({
                items: [{ summary: "no id" }],
              }),
          });

        const request = createMockRequest(
          "/api/calendar/events?calendarIds=primary,family%40group.calendar.google.com"
        );
        const response = await GET(request);
        const { status, data } = await parseResponse<{
          events: Array<{ id: string }>;
          errors?: Array<Record<string, unknown>>;
        }>(response);

        expect(status).toBe(200);
        expect(data.errors).toHaveLength(1);
        const wireError = data.errors![0];
        expect(wireError).not.toHaveProperty("logged");
        expect(Object.keys(wireError).sort()).toEqual(
          ["calendarId", "error", "status"].sort()
        );
      });
    });

    describe("transient failure retries", () => {
      // Acceptance criterion of #217: this route's outbound fetch goes through
      // `fetchWithRetry`, so a 503 followed by a 200 should yield a single
      // 200 response without bubbling the transient failure to the client.
      it("retries a transient 503 from Google and returns the eventual 200", async () => {
        vi.useFakeTimers();
        try {
          vi.mocked(getSession).mockResolvedValue(mockSession);
          vi.mocked(getAccessToken).mockResolvedValue(
            mockGoogleAccount.access_token!
          );

          mockFetch
            .mockResolvedValueOnce(
              jsonResponse(
                { error: { message: "Service Unavailable" } },
                { status: 503 }
              )
            )
            .mockResolvedValueOnce(
              jsonResponse({
                items: [
                  {
                    id: "event-1",
                    summary: "Recovered",
                    start: { dateTime: "2024-03-15T10:00:00Z" },
                    end: { dateTime: "2024-03-15T11:00:00Z" },
                  },
                ],
                summary: "Primary Calendar",
              })
            );

          const request = createMockRequest("/api/calendar/events");
          const promise = GET(request);
          // Advance the retry sleep so the second attempt fires.
          await vi.runAllTimersAsync();
          const response = await promise;
          const { status, data } = await parseResponse<{
            events: Array<{ id: string; summary: string }>;
          }>(response);

          expect(mockFetch).toHaveBeenCalledTimes(2);
          // Pin that the second call is a retry of the *same* URL — without
          // this, the test would also pass if retry were disabled and an
          // unrelated second fetch happened to succeed (#276).
          expect(mockFetch.mock.calls[0][0]).toBe(mockFetch.mock.calls[1][0]);
          expect(status).toBe(200);
          expect(data.events).toHaveLength(1);
          expect(data.events[0].summary).toBe("Recovered");
        } finally {
          vi.useRealTimers();
        }
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

      // New wire format (#267): client sends YYYY-MM-DD strings directly.
      // Jul 4–7 inclusive (endDate = last included day).
      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-07-04",
          endDate: "2026-07-07",
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

      // New wire format (#267): single-day event sends same date for start/end.
      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-04-20",
          endDate: "2026-04-20",
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

    it("rejects an all-day request where startDate is an ISO datetime string (old wire format)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      // Pre-#267 clients sent ISO strings for all-day events. The new route
      // correctly rejects them so callers know to upgrade.
      const request = createMockRequest("/api/calendar/events", {
        method: "POST",
        body: makeBody({
          isAllDay: true,
          startDate: "2026-04-20T07:00:00.000Z",
          endDate: "2026-04-21T06:59:59.999Z",
          title: "Birthday",
        }),
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toMatch(/YYYY-MM-DD/i);
      expect(mockFetch).not.toHaveBeenCalled();
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

    describe("Zod validation of Google insert response (#277)", () => {
      it("returns 502 with structured log when Google's create response is missing the required id", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        // 200 from Google but the body fails `GoogleEventSchema` — no `id`.
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              summary: "Team offsite",
              start: { dateTime: "2026-05-01T14:00:00.000Z" },
              end: { dateTime: "2026-05-01T15:00:00.000Z" },
            }),
        });

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody(),
        });
        const response = await POST(request);
        const { status, data } =
          await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(502);
        expect(data.error).toMatch(/failed/i);
        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "GoogleApiValidationError",
          }),
          expect.objectContaining({
            endpoint: "events.insert",
            calendarId: "primary",
          })
        );
      });

      it("returns 502 when Google's create response is the wrong type (array instead of object)", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(["not", "an", "object"]),
        });

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody(),
        });
        const response = await POST(request);
        const { status } = await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(502);
        expect(vi.mocked(logger.error)).toHaveBeenCalled();
      });
    });

    /**
     * Wire-format tests for the YYYY-MM-DD all-day fix (#267).
     *
     * When isAllDay is true the client now sends YYYY-MM-DD strings for
     * startDate/endDate rather than ISO datetime strings. These tests verify
     * that the route records the correct local date regardless of the client's
     * UTC offset — the positive-offset case (UTC+12 / NZST) is the regression
     * scenario from #267.
     */
    describe("all-day YYYY-MM-DD wire format (#267)", () => {
      function makeAllDaySuccessResponse(
        startDate: string,
        endDate: string
      ): typeof mockFetch extends (...args: unknown[]) => unknown
        ? ReturnType<typeof mockFetch>
        : unknown {
        return mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              id: "evt-allday-tz",
              summary: "Holiday",
              start: { date: startDate },
              end: { date: endDate },
            }),
        });
      }

      it("UTC+12 (NZST): Apr-20 local sends YYYY-MM-DD and route passes Apr-20, not Apr-19", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );
        makeAllDaySuccessResponse("2026-04-20", "2026-04-21");

        // New wire format: client sends YYYY-MM-DD strings directly — no UTC
        // offset shift. A UTC+12 browser picking "Apr 20" sends "2026-04-20".
        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody({
            isAllDay: true,
            startDate: "2026-04-20",
            endDate: "2026-04-20",
            title: "Holiday",
          }),
        });
        const response = await POST(request);
        const { status } = await parseResponse(response);

        expect(status).toBe(201);
        const sentBody = JSON.parse(
          mockFetch.mock.calls[0][1].body as string
        ) as { start: { date?: string }; end: { date?: string } };

        expect(sentBody.start.date).toBe("2026-04-20");
        expect(sentBody.end.date).toBe("2026-04-21");
      });

      it("UTC+0 (London): Apr-20 local sends YYYY-MM-DD and route passes Apr-20", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );
        makeAllDaySuccessResponse("2026-04-20", "2026-04-21");

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody({
            isAllDay: true,
            startDate: "2026-04-20",
            endDate: "2026-04-20",
            title: "Holiday",
          }),
        });
        const response = await POST(request);
        const { status } = await parseResponse(response);

        expect(status).toBe(201);
        const sentBody = JSON.parse(
          mockFetch.mock.calls[0][1].body as string
        ) as { start: { date?: string }; end: { date?: string } };

        expect(sentBody.start.date).toBe("2026-04-20");
        expect(sentBody.end.date).toBe("2026-04-21");
      });

      it("UTC-7 (PST): Apr-20 local sends YYYY-MM-DD and route passes Apr-20", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );
        makeAllDaySuccessResponse("2026-04-20", "2026-04-21");

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody({
            isAllDay: true,
            startDate: "2026-04-20",
            endDate: "2026-04-20",
            title: "Holiday",
          }),
        });
        const response = await POST(request);
        const { status } = await parseResponse(response);

        expect(status).toBe(201);
        const sentBody = JSON.parse(
          mockFetch.mock.calls[0][1].body as string
        ) as { start: { date?: string }; end: { date?: string } };

        expect(sentBody.start.date).toBe("2026-04-20");
        expect(sentBody.end.date).toBe("2026-04-21");
      });

      it("multi-day: sends correct inclusive start and exclusive end", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );
        makeAllDaySuccessResponse("2026-07-04", "2026-07-08");

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody({
            isAllDay: true,
            startDate: "2026-07-04",
            endDate: "2026-07-07",
            title: "Vacation",
          }),
        });
        const response = await POST(request);
        const { status } = await parseResponse(response);

        expect(status).toBe(201);
        const sentBody = JSON.parse(
          mockFetch.mock.calls[0][1].body as string
        ) as { start: { date?: string }; end: { date?: string } };

        // Inclusive Jul 4–7 => exclusive end Jul 8
        expect(sentBody.start.date).toBe("2026-07-04");
        expect(sentBody.end.date).toBe("2026-07-08");
      });

      it("rejects an all-day request where startDate is not a valid YYYY-MM-DD string", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        const request = createMockRequest("/api/calendar/events", {
          method: "POST",
          body: makeBody({
            isAllDay: true,
            startDate: "not-a-date",
            endDate: "2026-04-20",
            title: "Holiday",
          }),
        });
        const response = await POST(request);
        const { status, data } =
          await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(400);
        expect(data.error).toMatch(/start/i);
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });
  });
});
