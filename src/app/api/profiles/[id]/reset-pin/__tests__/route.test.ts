/**
 * Integration tests for /api/profiles/[id]/reset-pin route
 * Admin-only endpoint to reset another profile's PIN
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
  createMockProfile,
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

// Create a second admin for testing
const mockSecondAdmin = createMockProfile({
  id: "profile-admin-2",
  name: "Second Admin",
  type: "admin",
  ageGroup: "adult",
  pinHash: "$2b$10$secondAdminHash",
  pinEnabled: true,
});

describe("/api/profiles/[id]/reset-pin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/profiles/[id]/reset-pin", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 when adminProfileId is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminPin: "1234",
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe(
        "Admin profile ID, admin PIN, and new PIN required"
      );
    });

    it("returns 400 when adminPin is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe(
        "Admin profile ID, admin PIN, and new PIN required"
      );
    });

    it("returns 400 when newPin is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe(
        "Admin profile ID, admin PIN, and new PIN required"
      );
    });

    it("returns 400 when newPin is invalid format (too short)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "123", // Too short
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("New PIN must be 4-6 digits");
    });

    it("returns 400 when newPin is invalid format (too long)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "1234567", // Too long
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("New PIN must be 4-6 digits");
    });

    it("returns 400 when newPin contains non-digits", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "12ab",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("New PIN must be 4-6 digits");
    });

    it("returns 404 when admin profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: "nonexistent-admin",
          adminPin: "1234",
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Admin profile not found");
    });

    it("returns 403 when adminProfileId is not admin type", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockStandardProfile,
        pinEnabled: true,
        pinHash: "$2b$10$standardHash",
      });

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockStandardProfile.id,
          adminPin: "1234",
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Only admin profiles can reset PINs");
    });

    it("returns 401 when admin PIN is incorrect", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$adminHash",
      });
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockAdminProfile.id,
            adminPin: "0000",
            newPin: "5678",
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Admin PIN is incorrect");
    });

    it("returns 404 when target profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockAdminProfile,
          pinEnabled: true,
          pinHash: "$2b$10$adminHash",
        })
        .mockResolvedValueOnce(null); // Target profile not found
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const request = createMockRequest("/api/profiles/nonexistent/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Target profile not found");
    });

    it("returns 403 when trying to reset another admin's PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockAdminProfile,
          pinEnabled: true,
          pinHash: "$2b$10$adminHash",
        })
        .mockResolvedValueOnce(mockSecondAdmin); // Target is another admin
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const request = createMockRequest(
        `/api/profiles/${mockSecondAdmin.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockAdminProfile.id,
            adminPin: "1234",
            newPin: "5678",
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockSecondAdmin.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Cannot reset another admin's PIN");
    });

    it("resets PIN successfully for standard profile", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockAdminProfile,
          pinEnabled: true,
          pinHash: "$2b$10$adminHash",
        })
        .mockResolvedValueOnce({
          ...mockStandardProfile,
          pinEnabled: true,
          pinHash: "$2b$10$oldHash",
          failedPinAttempts: 3,
          pinLockedUntil: new Date(Date.now() + 60000),
        });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$newHashedPin" as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockStandardProfile,
        pinHash: "$2b$10$newHashedPin",
        pinEnabled: true,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockAdminProfile.id,
            adminPin: "1234",
            newPin: "5678",
          },
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
      expect(bcrypt.compare).toHaveBeenCalledWith("1234", "$2b$10$adminHash");
      expect(bcrypt.hash).toHaveBeenCalledWith("5678", 10);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockStandardProfile.id },
          data: expect.objectContaining({
            pinHash: "$2b$10$newHashedPin",
            pinEnabled: true,
            failedPinAttempts: 0,
            pinLockedUntil: null,
          }),
        })
      );
    });

    it("allows admin to reset own PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockAdminProfile,
          pinEnabled: true,
          pinHash: "$2b$10$adminHash",
        })
        .mockResolvedValueOnce({
          ...mockAdminProfile,
          pinEnabled: true,
          pinHash: "$2b$10$adminHash",
        });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$newHashedPin" as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockAdminProfile,
        pinHash: "$2b$10$newHashedPin",
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockAdminProfile.id,
            adminPin: "1234",
            newPin: "9999",
          },
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
    });

    it("returns 500 on database error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockRejectedValue(
        new Error("Database error")
      );

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "5678",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("Failed to reset PIN");
    });
  });

  describe("multiple admin support", () => {
    it("allows second admin to reset standard profile PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockSecondAdmin,
          pinEnabled: true,
          pinHash: "$2b$10$secondAdminHash",
        })
        .mockResolvedValueOnce({
          ...mockStandardProfile,
          pinEnabled: true,
          pinHash: "$2b$10$oldHash",
        });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$newHashedPin" as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockStandardProfile,
        pinHash: "$2b$10$newHashedPin",
        pinEnabled: true,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockSecondAdmin.id,
            adminPin: "4321",
            newPin: "9876",
          },
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

    it("allows second admin to reset own PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockSecondAdmin,
          pinEnabled: true,
          pinHash: "$2b$10$secondAdminHash",
        })
        .mockResolvedValueOnce({
          ...mockSecondAdmin,
          pinEnabled: true,
          pinHash: "$2b$10$secondAdminHash",
        });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);
      vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$newHashedPin" as never);
      mockPrisma.profile.update.mockResolvedValue({
        ...mockSecondAdmin,
        pinHash: "$2b$10$newHashedPin",
      });

      const request = createMockRequest(
        `/api/profiles/${mockSecondAdmin.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockSecondAdmin.id,
            adminPin: "4321",
            newPin: "8765",
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockSecondAdmin.id),
      });
      const { status, data } = await parseResponse<{ success: boolean }>(
        response
      );

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("prevents second admin from resetting first admin PIN", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst
        .mockResolvedValueOnce({
          ...mockSecondAdmin,
          pinEnabled: true,
          pinHash: "$2b$10$secondAdminHash",
        })
        .mockResolvedValueOnce({
          ...mockAdminProfile,
          pinEnabled: true,
          pinHash: "$2b$10$adminHash",
        });
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/reset-pin`,
        {
          method: "POST",
          body: {
            adminProfileId: mockSecondAdmin.id,
            adminPin: "4321",
            newPin: "5678",
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Cannot reset another admin's PIN");
    });
  });
});
