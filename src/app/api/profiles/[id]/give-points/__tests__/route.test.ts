/**
 * Integration tests for /api/profiles/[id]/give-points routes
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

// Mock Prisma client
vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findFirst: vi.fn(),
    },
    profileRewardPoints: {
      upsert: vi.fn(),
    },
    pointTransaction: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
  };
  profileRewardPoints: {
    upsert: ReturnType<typeof vi.fn>;
  };
  pointTransaction: {
    create: ReturnType<typeof vi.fn>;
  };
  $transaction: ReturnType<typeof vi.fn>;
};

// Helper to create params promise (Next.js 16 style)
function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

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

      // Mock transaction
      const newTotal = mockProfileRewardPoints.totalPoints + 50;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          profileRewardPoints: {
            upsert: vi.fn().mockResolvedValue({
              ...mockProfileRewardPoints,
              profileId: mockStandardProfile.id,
              totalPoints: newTotal,
            }),
          },
          pointTransaction: {
            create: vi.fn().mockResolvedValue({
              id: "transaction-1",
              profileId: mockStandardProfile.id,
              points: 50,
              reason: "manual",
            }),
          },
        };
        return callback(tx);
      });

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
    });

    it("awards points to profile without existing reward points record", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // First call for awarding profile - return admin
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      // Second call for target profile - return standard profile
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);

      // Mock transaction - upsert will create new record
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          profileRewardPoints: {
            upsert: vi.fn().mockResolvedValue({
              id: "new-reward-points",
              profileId: mockStandardProfile.id,
              totalPoints: 25,
            }),
          },
          pointTransaction: {
            create: vi.fn().mockResolvedValue({
              id: "transaction-1",
              profileId: mockStandardProfile.id,
              points: 25,
              reason: "manual",
            }),
          },
        };
        return callback(tx);
      });

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
    });

    it("allows admin to award points to themselves", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      // Both calls return admin profile
      mockPrisma.profile.findFirst.mockResolvedValue(mockAdminProfile);

      // Mock transaction
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          profileRewardPoints: {
            upsert: vi.fn().mockResolvedValue({
              ...mockProfileRewardPoints,
              totalPoints: mockProfileRewardPoints.totalPoints + 10,
            }),
          },
          pointTransaction: {
            create: vi.fn().mockResolvedValue({
              id: "transaction-1",
              profileId: mockAdminProfile.id,
              points: 10,
              reason: "manual",
            }),
          },
        };
        return callback(tx);
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
    });

    it("verifies awarding profile query filters by userId and admin type", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          profileRewardPoints: {
            upsert: vi.fn().mockResolvedValue({ totalPoints: 10 }),
          },
          pointTransaction: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        return callback(tx);
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: { points: 10, awardedByProfileId: mockAdminProfile.id },
        }
      );
      await POST(request, {
        params: createParams(mockStandardProfile.id),
      });

      // First findFirst call should check for admin profile
      expect(mockPrisma.profile.findFirst).toHaveBeenNthCalledWith(1, {
        where: {
          id: mockAdminProfile.id,
          userId: mockUserId,
          type: "admin",
        },
      });

      // Second findFirst call should check for target profile
      expect(mockPrisma.profile.findFirst).toHaveBeenNthCalledWith(2, {
        where: {
          id: mockStandardProfile.id,
          userId: mockUserId,
          isActive: true,
        },
      });
    });

    it("creates point transaction with correct data", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockAdminProfile);
      mockPrisma.profile.findFirst.mockResolvedValueOnce(mockStandardProfile);

      const mockTx = {
        profileRewardPoints: {
          upsert: vi.fn().mockResolvedValue({ totalPoints: 100 }),
        },
        pointTransaction: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback(mockTx);
      });

      const request = createMockRequest(
        `/api/profiles/${mockStandardProfile.id}/give-points`,
        {
          method: "POST",
          body: {
            points: 75,
            awardedByProfileId: mockAdminProfile.id,
            note: "Bonus for helping",
          },
        }
      );
      await POST(request, {
        params: createParams(mockStandardProfile.id),
      });

      expect(mockTx.pointTransaction.create).toHaveBeenCalledWith({
        data: {
          profileId: mockStandardProfile.id,
          points: 75,
          reason: "manual",
          awardedBy: mockAdminProfile.id,
          note: "Bonus for helping",
        },
      });
    });
  });
});
