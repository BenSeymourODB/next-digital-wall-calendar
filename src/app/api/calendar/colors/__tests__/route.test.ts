/**
 * Integration tests for /api/calendar/colors route
 * Returns color mappings for all calendars (calendarId -> Tailwind color)
 */
import { getAccessToken, getSession } from "@/lib/auth";
import {
  mockGoogleAccount,
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import {
  type ApiErrorResponse,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import type { TEventColor } from "@/types/calendar";
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

// Type definitions for color mappings response
interface CalendarColorMapping {
  calendarId: string;
  hexColor: string;
  tailwindColor: TEventColor;
}

interface ColorsResponse {
  colorMappings: CalendarColorMapping[];
}

describe("/api/calendar/colors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/calendar/colors", () => {
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

    it("returns color mappings on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      // Mock Google Calendar API calendarList.list response
      const mockCalendarList = {
        items: [
          {
            id: "primary",
            summary: "test@example.com",
            backgroundColor: "#3b82f6", // blue-500
            foregroundColor: "#ffffff",
            primary: true,
            selected: true,
          },
          {
            id: "family@group.calendar.google.com",
            summary: "Family",
            backgroundColor: "#a855f7", // purple-500
            foregroundColor: "#ffffff",
            primary: false,
            selected: true,
          },
          {
            id: "work@group.calendar.google.com",
            summary: "Work",
            backgroundColor: "#22c55e", // green-500
            foregroundColor: "#ffffff",
            primary: false,
            selected: true,
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCalendarList),
      });

      const response = await GET();
      const { status, data } = await parseResponse<ColorsResponse>(response);

      expect(status).toBe(200);
      expect(data.colorMappings).toHaveLength(3);

      // Verify each mapping has the expected structure
      expect(data.colorMappings[0]).toEqual({
        calendarId: "primary",
        hexColor: "#3b82f6",
        tailwindColor: "blue",
      });
      expect(data.colorMappings[1]).toEqual({
        calendarId: "family@group.calendar.google.com",
        hexColor: "#a855f7",
        tailwindColor: "purple",
      });
      expect(data.colorMappings[2]).toEqual({
        calendarId: "work@group.calendar.google.com",
        hexColor: "#22c55e",
        tailwindColor: "green",
      });
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
      const { status, data } = await parseResponse<ColorsResponse>(response);

      expect(status).toBe(200);
      expect(data.colorMappings).toEqual([]);
    });

    it("maps hex colors to closest Tailwind colors", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      // Use various Google Calendar colors that should map to different Tailwind colors
      const mockCalendarList = {
        items: [
          {
            id: "red-calendar",
            summary: "Red Calendar",
            backgroundColor: "#ef4444", // Exact red-500
            foregroundColor: "#ffffff",
          },
          {
            id: "yellow-calendar",
            summary: "Yellow Calendar",
            backgroundColor: "#eab308", // Exact yellow-500
            foregroundColor: "#000000",
          },
          {
            id: "orange-calendar",
            summary: "Orange Calendar",
            backgroundColor: "#f97316", // Exact orange-500
            foregroundColor: "#ffffff",
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCalendarList),
      });

      const response = await GET();
      const { status, data } = await parseResponse<ColorsResponse>(response);

      expect(status).toBe(200);
      expect(data.colorMappings).toHaveLength(3);

      const redMapping = data.colorMappings.find(
        (m) => m.calendarId === "red-calendar"
      );
      const yellowMapping = data.colorMappings.find(
        (m) => m.calendarId === "yellow-calendar"
      );
      const orangeMapping = data.colorMappings.find(
        (m) => m.calendarId === "orange-calendar"
      );

      expect(redMapping?.tailwindColor).toBe("red");
      expect(yellowMapping?.tailwindColor).toBe("yellow");
      expect(orangeMapping?.tailwindColor).toBe("orange");
    });

    it("handles calendars with missing backgroundColor", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const mockCalendarList = {
        items: [
          {
            id: "no-color-calendar",
            summary: "No Color Calendar",
            // No backgroundColor
          },
        ],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockCalendarList),
      });

      const response = await GET();
      const { status, data } = await parseResponse<ColorsResponse>(response);

      expect(status).toBe(200);
      expect(data.colorMappings).toHaveLength(1);
      // Should default to blue when no color is specified
      expect(data.colorMappings[0].tailwindColor).toBe("blue");
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
        status: 500,
        json: () => Promise.resolve({ error: "Internal error" }),
      });

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to fetch calendar colors");
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockRejectedValue(new Error("Unexpected"));

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });
  });
});
