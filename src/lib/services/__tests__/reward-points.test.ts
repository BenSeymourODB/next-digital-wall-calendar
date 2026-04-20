/**
 * Unit tests for the reward-points service.
 *
 * Tests the transaction logic in isolation with a single mock (prisma).
 * No auth, no NextRequest, no fetch.
 */
import { prisma } from "@/lib/db";
import { mockTransaction } from "@/lib/test-utils/prisma-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardPoints } from "../reward-points";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
};

describe("awardPoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates reward points for profile with no existing record", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 50 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    const result = await awardPoints("profile-1", 50, "admin-1");

    expect(result).toEqual({ totalPoints: 50 });
    expect(upsert).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      update: { totalPoints: { increment: 50 } },
      create: { profileId: "profile-1", totalPoints: 50 },
    });
  });

  it("increments existing reward points", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 150 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    const result = await awardPoints("profile-1", 25, "admin-1");

    expect(result.totalPoints).toBe(150);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { totalPoints: { increment: 25 } },
      })
    );
  });

  it("records a point transaction with the awarding admin and no note by default", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 10 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    await awardPoints("profile-1", 10, "admin-1");

    expect(create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        points: 10,
        reason: "manual",
        awardedBy: "admin-1",
        note: undefined,
      },
    });
  });

  it("includes the note on the point transaction when provided", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 30 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    await awardPoints("profile-1", 30, "admin-1", "Great job!");

    expect(create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        points: 30,
        reason: "manual",
        awardedBy: "admin-1",
        note: "Great job!",
      },
    });
  });

  it("runs both writes inside a single $transaction", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 5 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    await awardPoints("profile-1", 5, "admin-1");

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("propagates errors from the transaction", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("db down"));

    await expect(awardPoints("profile-1", 10, "admin-1")).rejects.toThrow(
      "db down"
    );
  });
});
