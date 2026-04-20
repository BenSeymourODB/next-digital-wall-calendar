/**
 * Unit tests for the streak service.
 *
 * Tests the streak-update logic in isolation with only two mocks
 * (prisma + streak-helpers). No auth, no NextRequest, no fetch.
 */
import { prisma } from "@/lib/db";
import { calculateNewStreak } from "@/lib/streak-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfileStreak } from "../streak";

vi.mock("@/lib/db", () => ({
  prisma: {
    profileRewardPoints: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/streak-helpers", () => ({
  calculateNewStreak: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
  profileRewardPoints: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

const mockCalculateNewStreak = vi.mocked(calculateNewStreak);

describe("updateProfileStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments streak for a profile that already has reward points", async () => {
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 3,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    mockCalculateNewStreak.mockReturnValue(4);
    mockPrisma.profileRewardPoints.update.mockResolvedValue({});

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 4, longest: 5 });
    expect(mockPrisma.profileRewardPoints.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { profileId: "profile-1" },
        data: expect.objectContaining({
          currentStreak: 4,
          longestStreak: 5,
        }),
      })
    );
  });

  it("promotes longestStreak when the new streak exceeds the previous record", async () => {
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 5,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    mockCalculateNewStreak.mockReturnValue(6);
    mockPrisma.profileRewardPoints.update.mockResolvedValue({});

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 6, longest: 6 });
    expect(mockPrisma.profileRewardPoints.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ longestStreak: 6 }),
      })
    );
  });

  it("preserves the previous longestStreak when the new streak is lower", async () => {
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 1,
      longestStreak: 10,
      lastActivityDate: new Date("2024-06-01"),
    });
    mockCalculateNewStreak.mockReturnValue(1);
    mockPrisma.profileRewardPoints.update.mockResolvedValue({});

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 1, longest: 10 });
    expect(mockPrisma.profileRewardPoints.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ longestStreak: 10 }),
      })
    );
  });

  it("passes the stored currentStreak and lastActivityDate into calculateNewStreak", async () => {
    const lastActivity = new Date("2024-06-14");
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 7,
      longestStreak: 10,
      lastActivityDate: lastActivity,
    });
    mockCalculateNewStreak.mockReturnValue(8);
    mockPrisma.profileRewardPoints.update.mockResolvedValue({});

    await updateProfileStreak("profile-1");

    expect(mockCalculateNewStreak).toHaveBeenCalledWith(7, lastActivity);
  });

  it("stamps lastActivityDate with the current time on update", async () => {
    const before = Date.now();
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 3,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    mockCalculateNewStreak.mockReturnValue(4);
    mockPrisma.profileRewardPoints.update.mockResolvedValue({});

    await updateProfileStreak("profile-1");
    const after = Date.now();

    const call = mockPrisma.profileRewardPoints.update.mock.calls[0][0];
    const stamped = (call.data.lastActivityDate as Date).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  it("creates a new reward-points record when the profile has none", async () => {
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue(null);
    mockPrisma.profileRewardPoints.create.mockResolvedValue({});

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 1, longest: 1 });
    expect(mockPrisma.profileRewardPoints.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: "profile-1",
          totalPoints: 0,
          currentStreak: 1,
          longestStreak: 1,
        }),
      })
    );
    expect(mockPrisma.profileRewardPoints.update).not.toHaveBeenCalled();
    expect(mockCalculateNewStreak).not.toHaveBeenCalled();
  });

  it("does not call update when creating a new record", async () => {
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue(null);
    mockPrisma.profileRewardPoints.create.mockResolvedValue({});

    await updateProfileStreak("profile-1");

    expect(mockPrisma.profileRewardPoints.update).not.toHaveBeenCalled();
  });
});
