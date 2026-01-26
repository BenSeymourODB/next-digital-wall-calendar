/**
 * Integration tests for /api/profiles/[id]/stats routes
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
  mockUserId,
} from "../../../__tests__/fixtures";
import { GET } from "../route";

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
  },
}));

// Cast prisma to get typed mocks
const mockPrisma = prisma as unknown as {
  profile: {
    findFirst: ReturnType<typeof vi.fn>;
  };
};

// Helper to create params promise (Next.js 16 style)
function createParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

// Profile stats response type
interface ProfileStats {
  profileId: string;
  totalPoints: number;
  currentStreak: number;
  tasksToday: number;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  rank: number;
}

describe("/api/profiles/[id]/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/profiles/[id]/stats", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/profile-1/stats");
      const response = await GET(request, {
        params: createParams("profile-1"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 404 when profile not found", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null);

      const request = createMockRequest("/api/profiles/nonexistent/stats");
      const response = await GET(request, {
        params: createParams("nonexistent"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("returns 404 when profile belongs to different user", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue(null); // Query includes userId filter

      const request = createMockRequest(
        "/api/profiles/other-user-profile/stats"
      );
      const response = await GET(request, {
        params: createParams("other-user-profile"),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Profile not found");
    });

    it("returns profile stats successfully", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        rewardPoints: mockProfileRewardPoints,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/stats`
      );
      const response = await GET(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ProfileStats>(response);

      expect(status).toBe(200);
      expect(data.profileId).toBe(mockAdminProfile.id);
      expect(data.totalPoints).toBe(mockProfileRewardPoints.totalPoints);
      expect(data.currentStreak).toBe(mockProfileRewardPoints.currentStreak);
    });

    it("returns zero stats when no reward points record", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        rewardPoints: null,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/stats`
      );
      const response = await GET(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ProfileStats>(response);

      expect(status).toBe(200);
      expect(data.totalPoints).toBe(0);
      expect(data.currentStreak).toBe(0);
    });

    it("returns placeholder task stats (to be implemented with Google Tasks)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        rewardPoints: mockProfileRewardPoints,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/stats`
      );
      const response = await GET(request, {
        params: createParams(mockAdminProfile.id),
      });
      const { status, data } = await parseResponse<ProfileStats>(response);

      expect(status).toBe(200);
      // Placeholder values until Google Tasks integration
      expect(data.tasksTotal).toBe(0);
      expect(data.tasksToday).toBe(0);
      expect(data.tasksCompleted).toBe(0);
      expect(data.completionRate).toBe(0);
      expect(data.rank).toBe(1);
    });

    it("verifies query filters by userId and isActive", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      mockPrisma.profile.findFirst.mockResolvedValue({
        ...mockAdminProfile,
        rewardPoints: mockProfileRewardPoints,
      });

      const request = createMockRequest(
        `/api/profiles/${mockAdminProfile.id}/stats`
      );
      await GET(request, {
        params: createParams(mockAdminProfile.id),
      });

      expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockAdminProfile.id,
          userId: mockUserId,
          isActive: true,
        },
        include: {
          rewardPoints: true,
        },
      });
    });
  });
});
