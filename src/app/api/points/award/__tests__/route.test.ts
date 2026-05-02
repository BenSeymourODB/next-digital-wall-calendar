/**
 * Integration tests for POST /api/points/award
 *
 * Validates the request, checks rewards are enabled at the account
 * level, then delegates the actual write to `recordPointAward`.
 */
import { getSession } from "@/lib/auth";
import { mockSession } from "@/lib/auth/__tests__/fixtures";
import { prisma } from "@/lib/db";
import { recordPointAward } from "@/lib/services/reward-points";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  mockStandardProfile,
  mockUserId,
} from "../../../profiles/__tests__/fixtures";
import { POST } from "../route";

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
  },
}));

vi.mock("@/lib/services/reward-points", () => ({
  recordPointAward: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
  userSettings: { findUnique: ReturnType<typeof vi.fn> };
  profile: { findFirst: ReturnType<typeof vi.fn> };
};

const mockRecordPointAward = vi.mocked(recordPointAward);

interface AwardResponse {
  success: boolean;
  newTotal: number;
  alreadyAwarded: boolean;
}

describe("POST /api/points/award", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no session", async () => {
    vi.mocked(getSession).mockResolvedValue(null);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(401);
    expect(data.error).toBe("Unauthorized");
  });

  it("returns 400 when profileId is missing", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: { points: 10, reason: "task_completed" },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toBe("profileId is required");
  });

  it("returns 400 when points is missing or non-positive", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 0,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toBe("Invalid points value");
  });

  it("returns 400 when points is not an integer", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 5.5,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toBe("Invalid points value");
  });

  it("returns 400 when reason is unrecognised", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "hacking_the_planet",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(400);
    expect(data.error).toBe("Invalid reason");
  });

  it("returns 404 when the profile does not belong to the user", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue(null);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: "someone-elses-profile",
        points: 10,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(404);
    expect(data.error).toBe("Profile not found");
    expect(mockPrisma.profile.findFirst).toHaveBeenCalledWith({
      where: {
        id: "someone-elses-profile",
        userId: mockUserId,
        isActive: true,
      },
      select: { id: true },
    });
  });

  it("returns 403 when rewards are disabled at the account level", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: false,
    });

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(403);
    expect(data.error).toBe("Reward system not enabled");
    expect(mockRecordPointAward).not.toHaveBeenCalled();
  });

  it("returns 403 when no UserSettings row exists", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue(null);

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(403);
  });

  it("delegates to recordPointAward and returns the new total", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: true,
    });
    mockRecordPointAward.mockResolvedValue({
      totalPoints: 60,
      alreadyAwarded: false,
    });

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "task_completed",
        taskId: "task-abc",
        taskTitle: "Buy milk",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<AwardResponse>(response);

    expect(status).toBe(200);
    expect(data).toEqual({
      success: true,
      newTotal: 60,
      alreadyAwarded: false,
    });
    expect(mockRecordPointAward).toHaveBeenCalledWith({
      profileId: mockStandardProfile.id,
      points: 10,
      reason: "task_completed",
      taskId: "task-abc",
      taskTitle: "Buy milk",
    });
  });

  it("surfaces alreadyAwarded duplicates without erroring", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: true,
    });
    mockRecordPointAward.mockResolvedValue({
      totalPoints: 75,
      alreadyAwarded: true,
    });

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "task_completed",
        taskId: "task-abc",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<AwardResponse>(response);

    expect(status).toBe(200);
    expect(data).toEqual({
      success: true,
      newTotal: 75,
      alreadyAwarded: true,
    });
  });

  it("returns 500 when the service throws an unexpected error", async () => {
    vi.mocked(getSession).mockResolvedValue(mockSession);
    mockPrisma.profile.findFirst.mockResolvedValue({
      id: mockStandardProfile.id,
    });
    mockPrisma.userSettings.findUnique.mockResolvedValue({
      rewardSystemEnabled: true,
    });
    mockRecordPointAward.mockRejectedValue(new Error("connection lost"));

    const request = createMockRequest("/api/points/award", {
      method: "POST",
      body: {
        profileId: mockStandardProfile.id,
        points: 10,
        reason: "task_completed",
      },
    });
    const response = await POST(request);
    const { status, data } = await parseResponse<ApiErrorResponse>(response);

    expect(status).toBe(500);
    expect(data.error).toBe("Failed to award points");
  });
});
