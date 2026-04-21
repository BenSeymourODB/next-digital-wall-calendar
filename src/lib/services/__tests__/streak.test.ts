/**
 * Unit tests for the streak service.
 *
 * Tests the streak-update logic in isolation with only two mocks
 * (prisma + streak-helpers). No auth, no NextRequest, no fetch.
 */
import { prisma } from "@/lib/db";
import { calculateNewStreak } from "@/lib/streak-helpers";
import { mockTransaction } from "@/lib/test-utils/prisma-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateProfileStreak } from "../streak";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/streak-helpers", () => ({
  calculateNewStreak: vi.fn(),
}));

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
};

const mockCalculateNewStreak = vi.mocked(calculateNewStreak);

describe("updateProfileStreak", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("increments streak for a profile that already has reward points", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 3,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });
    mockCalculateNewStreak.mockReturnValue(4);

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 4, longest: 5 });
    expect(update).toHaveBeenCalledWith(
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
    const findUnique = vi.fn().mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 5,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });
    mockCalculateNewStreak.mockReturnValue(6);

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 6, longest: 6 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ longestStreak: 6 }),
      })
    );
  });

  it("preserves the previous longestStreak when the new streak is lower", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 1,
      longestStreak: 10,
      lastActivityDate: new Date("2024-06-01"),
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });
    mockCalculateNewStreak.mockReturnValue(1);

    const result = await updateProfileStreak("profile-1");

    expect(result).toEqual({ current: 1, longest: 10 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ longestStreak: 10 }),
      })
    );
  });

  it("passes the stored currentStreak and lastActivityDate into calculateNewStreak", async () => {
    const lastActivity = new Date("2024-06-14");
    const findUnique = vi.fn().mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 7,
      longestStreak: 10,
      lastActivityDate: lastActivity,
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });
    mockCalculateNewStreak.mockReturnValue(8);

    await updateProfileStreak("profile-1");

    expect(mockCalculateNewStreak).toHaveBeenCalledWith(7, lastActivity);
  });

  it("stamps lastActivityDate with the current time on update", async () => {
    const before = Date.now();
    const findUnique = vi.fn().mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 3,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });
    mockCalculateNewStreak.mockReturnValue(4);

    await updateProfileStreak("profile-1");
    const after = Date.now();

    const call = update.mock.calls[0][0];
    const stamped = (call.data.lastActivityDate as Date).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
  });

  it("creates a new reward-points record when the profile has none", async () => {
    const before = Date.now();
    const findUnique = vi.fn().mockResolvedValue(null);
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });

    const result = await updateProfileStreak("profile-1");
    const after = Date.now();

    expect(result).toEqual({ current: 1, longest: 1 });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          profileId: "profile-1",
          totalPoints: 0,
          currentStreak: 1,
          longestStreak: 1,
        }),
      })
    );
    const stamped = (
      create.mock.calls[0][0].data.lastActivityDate as Date
    ).getTime();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(stamped).toBeLessThanOrEqual(after);
    expect(update).not.toHaveBeenCalled();
    expect(mockCalculateNewStreak).not.toHaveBeenCalled();
  });

  it("runs the read-compute-write cycle inside a single $transaction", async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "rp-1",
      profileId: "profile-1",
      totalPoints: 100,
      currentStreak: 3,
      longestStreak: 5,
      lastActivityDate: new Date("2024-06-14"),
    });
    const update = vi.fn().mockResolvedValue({});
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });
    mockCalculateNewStreak.mockReturnValue(4);

    await updateProfileStreak("profile-1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(findUnique).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it("propagates errors thrown by prisma inside the transaction", async () => {
    const findUnique = vi.fn().mockRejectedValue(new Error("db down"));
    const update = vi.fn();
    const create = vi.fn();
    mockTransaction(mockPrisma, {
      profileRewardPoints: { findUnique, update, create },
    });

    await expect(updateProfileStreak("profile-1")).rejects.toThrow("db down");
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
});
