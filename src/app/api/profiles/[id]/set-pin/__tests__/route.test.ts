/**
 * Integration tests for /api/profiles/[id]/set-pin route
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
    hash: vi.fn(),
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

describe("/api/profiles/[id]/set-pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/profiles/[id]/set-pin", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/set-pin", {
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

      const request = createMockRequest("/api/profiles/profile-1/set-pin", {
        method: "POST",
        body: {},
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("PIN must be 4-6 digits");
    });

    it("returns 400 when PIN is too short", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/set-pin", {
        method: "POST",
        body: { pin: "123" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("PIN must be 4-6 digits");
    });

    it("returns 400 when PIN is too long", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/set-pin", {
        method: "POST",
        body: { pin: "1234567" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("PIN must be 4-6 digits");
    });

    it("returns 400 when PIN contains non-digits", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/set-pin", {
        method: "POST",
        body: { pin: "12ab" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("PIN must be 4-6 digits");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/nonexistent/set-pin", {
        method: "POST",
        body: { pin: "1234" },
      });
      const response = await POST(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("sets PIN for profile without existing PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: false,
        pinHash: null,
      });
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$hashedPin" as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: true,
        pinHash: "$2b$10$hashedPin",
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/set-pin`,
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
      expect(bcrypt.hash).toHaveBeenCalledWith("1234", 10);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockStandardProfile.id },
          data: expect.objectContaining({
            pinHash: "$2b$10$hashedPin",
            pinEnabled: true,
            failedPinAttempts: 0,
            pinLockedUntil: null,
          }),
        })
      );
    });

    it("requires current PIN when changing existing PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/set-pin`,
        {
          method: "POST",
          body: { pin: "5678" }, // No currentPin provided
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Current PIN required");
    });

    it("returns 401 when current PIN is incorrect", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/set-pin`,
        {
          method: "POST",
          body: { pin: "5678", currentPin: "0000" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Current PIN is incorrect");
    });

    it("changes PIN when current PIN is correct", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$existingHash",
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$newHashedPin" as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockAdminProfile,
        pinHash: "$2b$10$newHashedPin",
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/set-pin`,
        {
          method: "POST",
          body: { pin: "5678", currentPin: "1234" },
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
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "1234",
        "$2b$10$existingHash"
      );
      expect(bcrypt.hash).toHaveBeenCalledWith("5678", 10);
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/profiles/profile-1/set-pin", {
        method: "POST",
        body: { pin: "1234" },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to set PIN");
    });
  });
});
