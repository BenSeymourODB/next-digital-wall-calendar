/**
 * Integration tests for /api/auth/account route
 */
import { getGoogleAccount, getSession } from "@/lib/auth";
import {
  mockGoogleAccount,
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import {
  type ApiErrorResponse,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountInfo } from "../route";
import { GET } from "../route";

// Mock modules BEFORE imports
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getGoogleAccount: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

describe("/api/auth/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/auth/account", () => {
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

    it("returns 404 when no Google account linked", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getGoogleAccount).mockResolvedValue(null);

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("No Google account linked");
    });

    it("returns account info on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getGoogleAccount).mockResolvedValue(mockGoogleAccount);

      const response = await GET();
      const { status, data } = await parseResponse<AccountInfo>(response);

      expect(status).toBe(200);
      expect(data.email).toBe(mockSession.user.email);
      expect(data.name).toBe(mockSession.user.name);
      expect(data.image).toBe(mockSession.user.image);
      expect(data.calendarIds).toEqual(["primary"]);
    });

    it("handles missing session user fields gracefully", async () => {
      const sessionWithMinimalUser = {
        user: {
          id: "user-123",
          name: null,
          email: null,
          image: null,
        },
        expires: "2024-12-31T23:59:59.999Z",
      };

      vi.mocked(getSession).mockResolvedValue(sessionWithMinimalUser);
      vi.mocked(getGoogleAccount).mockResolvedValue(mockGoogleAccount);

      const response = await GET();
      const { status, data } = await parseResponse<AccountInfo>(response);

      expect(status).toBe(200);
      expect(data.email).toBe("");
      expect(data.name).toBeNull();
      expect(data.image).toBeNull();
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockRejectedValue(new Error("Database error"));

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });
  });
});
