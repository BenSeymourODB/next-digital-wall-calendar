/**
 * Integration tests for /api/settings routes
 * Following TDD - tests are written before implementation
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "../route";

// Mock modules BEFORE imports
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    userSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  userSettings: {
    findUnique: ReturnType<typeof vi.fn>;
    upsert: ReturnType<typeof vi.fn>;
  };
};

const mockSettings = {
  id: "settings-1",
  userId: "test-user-123",
  defaultTaskPoints: 10,
  rewardSystemEnabled: false,
  theme: "light",
  defaultZoomLevel: 1.0,
  timeFormat: "12h",
  dateFormat: "MM/DD/YYYY",
  showPointsOnCompletion: true,
};

describe("/api/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/settings", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns existing settings for authenticated user", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.userSettings.findUnique.mockResolvedValue(mockSettings);

      const response = await GET();
      const { status, data } =
        await parseResponse<typeof mockSettings>(response);

      expect(status).toBe(200);
      expect(data.theme).toBe("light");
      expect(data.defaultTaskPoints).toBe(10);
      expect(data.timeFormat).toBe("12h");
      expect(data.dateFormat).toBe("MM/DD/YYYY");
    });

    it("creates default settings if none exist", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.userSettings.findUnique.mockResolvedValue(null);
      mockPrisma.userSettings.upsert.mockResolvedValue(mockSettings);

      const response = await GET();
      const { status, data } =
        await parseResponse<typeof mockSettings>(response);

      expect(status).toBe(200);
      expect(mockPrisma.userSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockSession.user.id },
          create: expect.objectContaining({
            userId: mockSession.user.id,
          }),
          update: {},
        })
      );
      expect(data.theme).toBe("light");
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.userSettings.findUnique.mockRejectedValue(
        new Error("Database error")
      );

      const response = await GET();
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to fetch settings");
    });
  });

  describe("PUT /api/settings", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { theme: "dark" },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("updates settings successfully", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      const updatedSettings = { ...mockSettings, theme: "dark" };
      mockPrisma.userSettings.upsert.mockResolvedValue(updatedSettings);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { theme: "dark" },
      });

      const response = await PUT(request);
      const { status, data } =
        await parseResponse<typeof mockSettings>(response);

      expect(status).toBe(200);
      expect(data.theme).toBe("dark");
    });

    it("validates theme value", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { theme: "invalid-theme" },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid theme");
    });

    it("validates defaultTaskPoints is positive", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { defaultTaskPoints: -5 },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("defaultTaskPoints");
    });

    it("validates defaultZoomLevel range", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { defaultZoomLevel: 5.0 },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("defaultZoomLevel");
    });

    it("validates timeFormat value", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { timeFormat: "invalid" },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid timeFormat");
    });

    it("validates dateFormat value", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { dateFormat: "invalid" },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toContain("Invalid dateFormat");
    });

    it("allows partial updates", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      const updatedSettings = { ...mockSettings, rewardSystemEnabled: true };
      mockPrisma.userSettings.upsert.mockResolvedValue(updatedSettings);

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { rewardSystemEnabled: true },
      });

      const response = await PUT(request);
      const { status, data } =
        await parseResponse<typeof mockSettings>(response);

      expect(status).toBe(200);
      expect(data.rewardSystemEnabled).toBe(true);
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.userSettings.upsert.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/settings", {
        method: "PUT",
        body: { theme: "dark" },
      });

      const response = await PUT(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to update settings");
    });
  });
});
