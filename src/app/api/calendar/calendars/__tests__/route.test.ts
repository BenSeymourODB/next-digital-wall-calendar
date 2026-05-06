/**
 * Integration tests for /api/calendar/calendars route
 * Lists all calendars the user has access to with color information
 */
import { getAccessToken, getSession } from "@/lib/auth";
import {
  mockGoogleAccount,
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import { logger } from "@/lib/logger";
import {
  type ApiErrorResponse,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type CalendarsResponse, GET } from "../route";

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
// `CalendarsResponse` is imported from `../route` rather than re-declared
// locally — keeps the test contract single-sourced so a future field added
// to the route can't silently bypass the test schema.

describe("/api/calendar/calendars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/calendar/calendars", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Session expired. Please sign in again.");
      expect(data.requiresReauth).toBe(true);
    });

    it("returns calendar list with colors on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const mockCalendarList = {
        items: [
          {
            id: "primary",
            summary: "test@example.com",
            description: "Primary calendar",
            backgroundColor: "#4285f4",
            foregroundColor: "#ffffff",
            primary: true,
            selected: true,
            accessRole: "owner",
          },
          {
            id: "family@group.calendar.google.com",
            summary: "Family",
            description: "Shared family calendar",
            backgroundColor: "#7986cb",
            foregroundColor: "#ffffff",
            primary: false,
            selected: true,
            accessRole: "writer",
          },
          {
            id: "work@group.calendar.google.com",
            summary: "Work",
            backgroundColor: "#33b679",
            foregroundColor: "#ffffff",
            primary: false,
            selected: false,
            accessRole: "reader",
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCalendarList),
      });

      const response = await GET();
      const { status, data } = await parseResponse<CalendarsResponse>(response);

      expect(status).toBe(200);
      expect(data.calendars).toHaveLength(3);
      expect(data.calendars[0]).toEqual({
        id: "primary",
        summary: "test@example.com",
        description: "Primary calendar",
        backgroundColor: "#4285f4",
        foregroundColor: "#ffffff",
        primary: true,
        selected: true,
        accessRole: "owner",
      });
      expect(data.calendars[1]).toEqual({
        id: "family@group.calendar.google.com",
        summary: "Family",
        description: "Shared family calendar",
        backgroundColor: "#7986cb",
        foregroundColor: "#ffffff",
        primary: false,
        selected: true,
        accessRole: "writer",
      });
      expect(data.calendars[2].accessRole).toBe("reader");
    });

    it("defaults missing accessRole to 'reader' (read-only fallback)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            items: [
              {
                id: "no-role@group.calendar.google.com",
                summary: "No role",
                // accessRole omitted — Google's schema marks it optional
              },
            ],
          }),
      });

      const response = await GET();
      const { status, data } = await parseResponse<CalendarsResponse>(response);

      expect(status).toBe(200);
      expect(data.calendars[0].accessRole).toBe("reader");
    });

    it("returns empty array when no calendars exist", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: undefined }),
      });

      const response = await GET();
      const { status, data } = await parseResponse<CalendarsResponse>(response);

      expect(status).toBe(200);
      expect(data.calendars).toEqual([]);
    });

    it("calls Google Calendar API calendarList.list endpoint", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      await GET();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          "googleapis.com/calendar/v3/users/me/calendarList"
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockGoogleAccount.access_token}`,
          }),
        })
      );
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

      const response = await GET();
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
        status: 403,
        json: () => Promise.resolve({ error: "Forbidden" }),
      });

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Failed to fetch calendar list");
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockRejectedValue(new Error("Unexpected"));

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });

    describe("Zod validation of Google calendarList responses (#277)", () => {
      it("returns 502 with structured log when an entry is missing required id", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        // `id` is the only required field on `GoogleCalendarListEntrySchema`.
        // Drop it and the Zod parse fails — the route must surface a 502.
        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: [{ summary: "no id" }],
            }),
        });

        const response = await GET();
        const { status, data } =
          await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(502);
        expect(data.error).toMatch(/calendar/i);
        expect(vi.mocked(logger.error)).toHaveBeenCalledWith(
          expect.objectContaining({
            name: "GoogleApiValidationError",
          }),
          expect.objectContaining({
            endpoint: "calendarList.list",
          })
        );
      });

      it("returns 502 when items is the wrong type", async () => {
        vi.mocked(getSession).mockResolvedValue(mockSession);
        vi.mocked(getAccessToken).mockResolvedValue(
          mockGoogleAccount.access_token!
        );

        mockFetch.mockResolvedValue({
          ok: true,
          json: () =>
            Promise.resolve({
              items: "not an array",
            }),
        });

        const response = await GET();
        const { status } = await parseResponse<ApiErrorResponse>(response);

        expect(status).toBe(502);
        expect(vi.mocked(logger.error)).toHaveBeenCalled();
      });
    });

    it("handles calendars with missing optional fields", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const mockCalendarList = {
        items: [
          {
            id: "minimal@group.calendar.google.com",
            summary: "Minimal Calendar",
            // No description, backgroundColor, foregroundColor
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCalendarList),
      });

      const response = await GET();
      const { status, data } = await parseResponse<CalendarsResponse>(response);

      expect(status).toBe(200);
      expect(data.calendars).toHaveLength(1);
      expect(data.calendars[0].id).toBe("minimal@group.calendar.google.com");
      expect(data.calendars[0].summary).toBe("Minimal Calendar");
      // Should have default values for missing fields
      expect(data.calendars[0].backgroundColor).toBeDefined();
      expect(data.calendars[0].foregroundColor).toBeDefined();
    });
  });
});
