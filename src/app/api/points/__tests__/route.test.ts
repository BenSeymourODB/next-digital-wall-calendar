/**
 * Integration tests for GET /api/points
 *
 * Returns the current profile's `totalPoints` together with the
 * account-level `enabled` flag from `UserSettings`. When rewards are
 * disabled the route always reports zero so disabled users never see
 * stale point totals leaking through.
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
  mockStandardProfile,
  mockUserId,
} from "../../profiles/__tests__/fixtures";
import { GET } from "../route";

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

vi.mock("@/lib/db", () => ({
  prisma: {
    userSettings: {
      findUnique: vi.fn(),
    },
    profile: {
      findFirst: vi.fn(),
    },
    profileRewardPoints: {
      findUnique: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  userSettings: { findUnique: ReturnType<typeof vi.fn> };
  profile: { findFirst: ReturnType<typeof vi.fn> };
  profileRewardPoints: { findUnique: ReturnType<typeof vi.fn> };
};

interface PointsResponse {
  totalPoints: number;
  enabled: boolean;
}

describe("GET /api/points", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = createMockRequest(
      `/api/points?profileId=${mockStandardProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when profileId query param is missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/points");
    const response = await GET(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toBe("profileId is required");
  });

  it("returns 404 when the profile does not belong to the user", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue(null);

    const request = createMockRequest(
      `/api/points?profileId=${mockStandardProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(404);
    expect(data.error).toBe("Profile not found");
    expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockStandardProfile.id,
        userId: mockUserId,
        isActive: true,
      },
      select: { id: true },
    });
  });

  it("returns zero points and enabled=false when rewards are disabled", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: false,
    });

    const request = createMockRequest(
      `/api/points?profileId=${mockStandardProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<PointsResponse>(response);

    expect(status).toBe(200);
    expect(data).toEqual({ totalPoints: 0, enabled: false });
    expect(mockPrisma.profileRewardPoints.findUnique).not.toHaveBeenCalled();
  });

  it("returns zero points and enabled=false when no UserSettings row exists", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);

    const request = createMockRequest(
      `/api/points?profileId=${mockStandardProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<PointsResponse>(response);

    expect(status).toBe(200);
    expect(data).toEqual({ totalPoints: 0, enabled: false });
  });

  it("returns the profile's total points when rewards are enabled", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: true,
    });
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      totalPoints: 1250,
    });

    const request = createMockRequest(
      `/api/points?profileId=${mockStandardProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<PointsResponse>(response);

    expect(status).toBe(200);
    expect(data).toEqual({ totalPoints: 1250, enabled: true });
    expect(mockPrisma.profileRewardPoints.findUnique).toHaveBeenCalledWith({
      where: { profileId: mockStandardProfile.id },
      select: { totalPoints: true },
    });
  });

  it("returns zero points when rewards are enabled but no reward-points row exists", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockAdminProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: true,
    });
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue(null);

    const request = createMockRequest(
      `/api/points?profileId=${mockAdminProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<PointsResponse>(response);

    expect(status).toBe(200);
    expect(data).toEqual({ totalPoints: 0, enabled: true });
  });

  it("returns 500 on unexpected errors", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockRejectedValue(new Error("db down"));

    const request = createMockRequest(
      `/api/points?profileId=${mockStandardProfile.id}`
    );
    const response = await GET(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Failed to fetch points");
  });
});
