/**
 * Integration tests for /api/profiles/[id]/remove-pin route
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
// Import route handlers after mocks are set up
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

describe("/api/profiles/[id]/remove-pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/profiles/[id]/remove-pin", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/remove-pin", {
        method: "POST",
        body: { currentPin: "1234" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 when currentPin is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/remove-pin", {
        method: "POST",
        body: {},
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Current PIN required");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        "/api/profiles/nonexistent/remove-pin",
        {
          method: "POST",
          body: { currentPin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("returns 403 when profile is admin type", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/remove-pin`,
        {
          method: "POST",
          body: { currentPin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Admin profiles cannot remove PIN");
    });

    it("returns 400 when profile has no PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: false,
        pinHash: null,
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/remove-pin`,
        {
          method: "POST",
          body: { currentPin: "1234" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Profile does not have a PIN");
    });

    it("returns 401 when currentPin is incorrect", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/remove-pin`,
        {
          method: "POST",
          body: { currentPin: "0000" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Current PIN is incorrect");
    });

    it("removes PIN successfully for standard profile", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
        failedPinAttempts: 3,
        pinLockedUntil: new Date(Date.now() + 60000),
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: false,
        pinHash: null,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/remove-pin`,
        {
          method: "POST",
          body: { currentPin: "1234" },
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
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "1234",
        "$2b$10$existingHash"
      );
      expect(mockPrisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockStandardProfile.id },
          data: expect.objectContaining({
            pinHash: null,
            pinEnabled: false,
            failedPinAttempts: 0,
            pinLockedUntil: null,
          }),
        })
      );
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/profiles/profile-1/remove-pin", {
        method: "POST",
        body: { currentPin: "1234" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to remove PIN");
    });
  });
});
