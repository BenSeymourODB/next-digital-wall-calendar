/**
 * Integration tests for /api/profiles/[id]/give-points routes
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import { awardPoints } from "@/lib/services/reward-points";
import {
  type ApiErrorResponse,
  createMockRequest,
  createParams,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockAdminProfile,
  mockProfileRewardPoints,
  mockStandardProfile,
  mockUserId,
} from "../../../__tests__/fixtures";
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

// Prisma is mocked only for the `profile.findFirst` lookups the route does
// itself (admin verification + target profile check). The `$transaction` +
// reward-points + point-transaction writes live inside `awardPoints`, which
// we mock directly below.
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/services/reward-points", () => ({
  awardPoints: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

const mockAwardPoints = vi.mocked(awardPoints);

// Give points response type
interface GivePointsResponse {
  success: boolean;
  newTotal: number;
}

describe("/api/profiles/[id]/give-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /api/profiles/[id]/give-points", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/give-points", {
        method: "POST",
        body: { points: 10, awardedByProfileId: mockAdminProfile.id },
      });
      const response = await POST(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 400 when points is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: { awardedByProfileId: mockAdminProfile.id },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Invalid points value");
    });

    it("returns 400 when points is zero or negative", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: { points: 0, awardedByProfileId: mockAdminProfile.id },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Invalid points value");
    });

    it("returns 400 when awardedByProfileId is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: { points: 10 },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("Admin profile ID required");
    });

    it("returns 404 when awarding profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: { points: 10, awardedByProfileId: "nonexistent" },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Admin profile not found");
    });

    it("returns 403 when awarding profile is not admin", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // First call for admin profile (with type: "admin" filter) - returns null
      mockPrisma.profile.findFirst.mockResolvedValueOnce(null);
      // Second call to check if profile exists (without type filter) - returns standard profile
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: { points: 10, awardedByProfileId: mockStandardProfile.id },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(403);
      expect(data.error).toBe("Unauthorized - admin access required");
    });

    it("returns 404 when target profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // First call for awarding profile - return admin
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      // Second call for target profile - return null
      mockPrisma.profile.findFirst.mockResolvedValueOnce(null);

      const request = createMockRequest(
        `/api/profiles/nonexistent/give-points`,
        {
          method: "POST",
          body: { points: 10, awardedByProfileId: mockAdminProfile.id },
        }
      );
      const response = await POST(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("awards points successfully", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // First call for awarding profile - return admin
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      // Second call for target profile - return standard profile
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);

      const newTotal = mockProfileRewardPoints.totalPoints + 50;
      mockAwardPoints.mockResolvedValue({ totalPoints: newTotal });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: {
            points: 50,
            awardedByProfileId: mockAdminProfile.id,
            note: "Great job!",
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } =
        await parseResponse<GivePointsResponse>(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTotal).toBe(newTotal);
      expect(mockAwardPoints).toHaveBeenCalledWith(
        mockStandardProfile.id,
        50,
        mockAdminProfile.id,
        "Great job!"
      );
    });

    it("awards points to profile without existing reward points record", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // First call for awarding profile - return admin
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      // Second call for target profile - return standard profile
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);

      mockAwardPoints.mockResolvedValue({ totalPoints: 25 });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: {
            points: 25,
            awardedByProfileId: mockAdminProfile.id,
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } =
        await parseResponse<GivePointsResponse>(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newTotal).toBe(25);
      expect(mockAwardPoints).toHaveBeenCalledWith(
        mockStandardProfile.id,
        25,
        mockAdminProfile.id,
        undefined
      );
    });

    it("allows admin to award points to themselves", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // Both calls return admin profile
      mockPrisma.profile.findFirst.mockResolvedValue(mockAdminProfile);

      mockAwardPoints.mockResolvedValue({
        totalPoints: mockProfileRewardPoints.totalPoints + 10,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/give-points`,
        {
          method: "POST",
          body: {
            points: 10,
            awardedByProfileId: mockAdminProfile.id,
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } =
        await parseResponse<GivePointsResponse>(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockAwardPoints).toHaveBeenCalledWith(
        mockAdminProfile.id,
        10,
        mockAdminProfile.id,
        undefined
      );
    });
  });

  describe("multiple admin support", () => {
    const mockSecondAdmin = {
      id: "profile-admin-2",
      userId: mockUserId,
      name: "Second Admin",
      type: "admin" as const,
      ageGroup: "adult" as const,
      color: "#ef4444",
      avatar: { type: "initials", value: "SA", backgroundColor: "#ef4444" },
      pinHash: "$2b$10$mockHashedPin2",
      pinEnabled: true,
      failedPinAttempts: 0,
      pinLockedUntil: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("allows second admin to award points", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // Second admin awarding points
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockSecondAdmin);
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);

      mockAwardPoints.mockResolvedValue({ totalPoints: 50 });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: {
            points: 50,
            awardedByProfileId: mockSecondAdmin.id,
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockStandardProfile.id),
      });
      const { status, data } =
        await parseResponse<GivePointsResponse>(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("allows one admin to award points to another admin", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // First admin awarding to second admin
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockSecondAdmin);

      mockAwardPoints.mockResolvedValue({ totalPoints: 100 });

      const request = createMockRequest(
        `/api/profiles/${mockSecondAdmin.id}/give-points`,
        {
          method: "POST",
          body: {
            points: 100,
            awardedByProfileId: mockAdminProfile.id,
          },
        }
      );
      const response = await POST(request, {
        params: createParams(mockSecondAdmin.id),
      });
      const { status, data } =
        await parseResponse<GivePointsResponse>(response);

      expect(status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
