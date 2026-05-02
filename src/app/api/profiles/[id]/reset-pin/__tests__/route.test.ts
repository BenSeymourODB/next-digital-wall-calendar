/**
 * Integration tests for /api/profiles/[id]/reset-pin route.
 *
 * The admin lookup + PIN check is owned by the admin-verification
 * service (tested in src/lib/services/__tests__/admin-verification.test.ts);
 * here we mock that service and verify the route's auth, request
 * parsing, target-profile checks, and update flow.
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import { verifyAdminWithPin } from "@/lib/services/admin-verification";
import {
  type ApiErrorResponse,
  createMockRequest,
  createParams,
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

vi.mock("@/lib/services/admin-verification", () => ({
  verifyAdminWithPin: vi.fn(),
}));

// Mock bcrypt - only `hash` is called by the route directly now;
// `compare` lives behind the verifyAdminWithPin service.
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

// `vi.mocked(verifyAdminWithPin)` would force callers to type fixtures
// as the full Prisma Profile (avatar: JsonValue), but the local fixtures
// use `avatar: unknown` to stay decoupled from generated types. Cast the
// mock to a permissive vi.fn to match the rest of this file's pattern.
const mockVerifyAdminWithPin = verifyAdminWithPin as unknown as ReturnType<
  typeof vi.fn
>;

/**
 * Helper to set up mocks for a successful PIN reset scenario.
 * Configures: admin verification, target profile lookup, bcrypt.hash,
 * and profile update.
 */
function setupSuccessfulReset(
  admin: typeof mockAdminProfile = mockAdminProfile,
  target: typeof mockStandardProfile = mockStandardProfile
) {
  vi.mocked(getSession).mockResolvedValue(mockSession);
  mockVerifyAdminWithPin.mockResolvedValue({
    success: true,
    adminProfile: admin,
  });
  mockPrisma.profile.findFirst.mockResolvedValue({
    ...target,
    pinEnabled: true,
    pinHash: "$2b$10$oldHash",
  });
  vi.mocked(bcrypt.hash).mockResolvedValue("$2b$10$newHashedPin" as never);
  mockPrisma.profile.update.mockResolvedValue({
    ...target,
    pinHash: "$2b$10$newHashedPin",
    pinEnabled: true,
    failedPinAttempts: 0,
    pinLockedUntil: null,
  });
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
      expect(mockVerifyAdminWithPin).not.toHaveBeenCalled();
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

    it("returns 400 and forwards the validator error when newPin is malformed", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/profiles/profile-1/reset-pin", {
        method: "POST",
        body: {
          adminProfileId: mockAdminProfile.id,
          adminPin: "1234",
          newPin: "abc",
        },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("New PIN must be 4-6 digits");
    });

    it("forwards the verifyAdminWithPin failure response (status + error)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockVerifyAdminWithPin.mockResolvedValue({
        success: false,
        error: "Admin PIN is incorrect",
        status: 401,
      });

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
      expect(mockVerifyAdminWithPin).toHaveBeenCalledWith(
        mockSession.user.id,
        mockAdminProfile.id,
        "0000"
      );
      // Route should short-circuit before any target lookup or update.
      expect(mockPrisma.profile.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.profile.update).not.toHaveBeenCalled();
    });

    it("forwards a 404 from verifyAdminWithPin when admin not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockVerifyAdminWithPin.mockResolvedValue({
        success: false,
        error: "Admin profile not found",
        status: 404,
      });

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

    it("forwards a 403 from verifyAdminWithPin when caller is not admin", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockVerifyAdminWithPin.mockResolvedValue({
        success: false,
        error: "This action requires an admin profile",
        status: 403,
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
      expect(data.error).toBe("This action requires an admin profile");
    });

    it("returns 404 when target profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockVerifyAdminWithPin.mockResolvedValue({
        success: true,
        adminProfile: mockAdminProfile,
      });
      mockPrisma.profile.findFirst.mockResolvedValue(null);

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
      mockVerifyAdminWithPin.mockResolvedValue({
        success: true,
        adminProfile: mockAdminProfile,
      });
      mockPrisma.profile.findFirst.mockResolvedValue(mockSecondAdmin);

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
      setupSuccessfulReset();

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
      // Lock in the contract: route delegates admin verification to the service.
      expect(mockVerifyAdminWithPin).toHaveBeenCalledWith(
        mockSession.user.id,
        mockAdminProfile.id,
        "1234"
      );
      expect(bcrypt.hash).toHaveBeenCalledWith("5678", 10);
      expect(mockPrisma.profile.update).toHaveBeenCalledWith({
        where: { id: mockStandardProfile.id },
        data: {
          pinHash: "$2b$10$newHashedPin",
          pinEnabled: true,
          failedPinAttempts: 0,
          pinLockedUntil: null,
        },
      });
    });

    it("allows admin to reset own PIN", async () => {
      setupSuccessfulReset(mockAdminProfile, mockAdminProfile);

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
      mockVerifyAdminWithPin.mockResolvedValue({
        success: true,
        adminProfile: mockAdminProfile,
      });
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
      setupSuccessfulReset(mockSecondAdmin, mockStandardProfile);

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
      expect(mockVerifyAdminWithPin).toHaveBeenCalledWith(
        mockSession.user.id,
        mockSecondAdmin.id,
        "4321"
      );
    });

    it("allows second admin to reset own PIN", async () => {
      setupSuccessfulReset(mockSecondAdmin, mockSecondAdmin);

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
      mockVerifyAdminWithPin.mockResolvedValue({
        success: true,
        adminProfile: mockSecondAdmin,
      });
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        pinEnabled: true,
        pinHash: "$2b$10$adminHash",
      });

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
