/**
 * Integration tests for /api/profiles/[id]/verify-pin route
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import bcrypt from "bcrypt";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAdminProfile,
  mockStandardProfile,
} from "../../../__tests__/fixtures";
// Import route handlers and db after mocks are set up
import { POST } from "../route";

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

// Mock bcrypt
vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
  },
}));

// Mock Prisma client - must be inline within the factory
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// Helper to create params promise (Next.js 16 style)
function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

describe("/api/profiles/[id]/verify-pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/profiles/[id]/verify-pin", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/verify-pin", {
        method: "POST",
        body: { pin: "1234" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 when PIN is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/verify-pin", {
        method: "POST",
        body: {},
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("PIN required");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        "/api/profiles/nonexistent/verify-pin",
        {
          method: "POST",
          body: { pin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("returns success for profile without PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: false,
        pinHash: null,
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/verify-pin`,
        {
          method: "POST",
          body: { pin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<{ success: boolean }>(
        response
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("returns 429 when profile is locked", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      const futureDate = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes in future
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
        pinLockedUntil: futureDate,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/verify-pin`,
        {
          method: "POST",
          body: { pin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<
        ApiErrorResponse & { lockedFor: number }
      >(response);

      expect(status).toBe(429);
      expect(data.error).toBe("Profile locked due to too many failed attempts");
      expect(data.lockedFor).toBeGreaterThan(0);
    });

    it("verifies PIN successfully", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
        failedPinAttempts: 2,
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockAdminProfile,
        failedPinAttempts: 0,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/verify-pin`,
        {
          method: "POST",
          body: { pin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<{ success: boolean }>(
        response
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            failedPinAttempts: 0,
            pinLockedUntil: null,
          },
        })
      );
    });

    it("increments failed attempts on incorrect PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
        failedPinAttempts: 2,
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockAdminProfile,
        failedPinAttempts: 3,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/verify-pin`,
        {
          method: "POST",
          body: { pin: "0000" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<
        ApiErrorResponse & { attemptsRemaining: number; locked: boolean }
      >(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Incorrect PIN");
      expect(data.attemptsRemaining).toBe(2);
      expect(data.locked).toBe(false);
    });

    it("locks profile after 5 failed attempts", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
        failedPinAttempts: 4, // This will be the 5th attempt
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockAdminProfile,
        failedPinAttempts: 5,
        pinLockedUntil: new Date(Date.now() + 5 * 60 * 1000),
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/verify-pin`,
        {
          method: "POST",
          body: { pin: "0000" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<
        ApiErrorResponse & { attemptsRemaining: number; locked: boolean }
      >(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Incorrect PIN");
      expect(data.attemptsRemaining).toBe(0);
      expect(data.locked).toBe(true);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            failedPinAttempts: 5,
            pinLockedUntil: expect.any(Date),
          }),
        })
      );
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/profiles/profile-1/verify-pin", {
        method: "POST",
        body: { pin: "1234" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to verify PIN");
    });
  });
});
