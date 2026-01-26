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
import { GET } from "../route";

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
        events: typeof mockEvents;
        summary?: string;
        timeZone?: string;
      }>(response);

      expect(status).toBe(200);
      expect(data.events).toEqual(mockEvents);
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
  });
});
