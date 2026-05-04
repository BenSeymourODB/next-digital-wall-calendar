/**
 * Unit tests for the reward-points service.
 *
 * Tests the transaction logic in isolation with a single mock (prisma).
 * No auth, no NextRequest, no fetch.
 */
import { prisma } from "@/lib/db";
import { mockTransaction } from "@/lib/test-utils/prisma-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { awardPoints, recordPointAward } from "../reward-points";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    profileRewardPoints: {
      findUnique: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  profileRewardPoints: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

function makeUniqueConstraintError() {
  const error = new Error(
    "Unique constraint failed on the fields: (`profileId`,`taskId`,`reason`)"
  ) as Error & { code: string };
  error.code = "P2002";
  return error;
}

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

    // note is undefined (not omitted) - Prisma treats both the same and
    // this matches the service's pass-through semantics.
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

describe("recordPointAward", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("records a task_completed award with taskId and taskTitle", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 60 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    const result = await recordPointAward({
      profileId: "profile-1",
      points: 10,
      reason: "task_completed",
      taskId: "task-abc",
      taskTitle: "Buy milk",
    });

    expect(result).toEqual({ totalPoints: 60, alreadyAwarded: false });
    expect(upsert).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      update: { totalPoints: { increment: 10 } },
      create: { profileId: "profile-1", totalPoints: 10 },
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        points: 10,
        reason: "task_completed",
        taskId: "task-abc",
        taskTitle: "Buy milk",
        awardedBy: undefined,
        note: undefined,
      },
    });
  });

  it("records a manual award with awardedBy and note", async () => {
    const upsert = vi.fn().mockResolvedValue({ totalPoints: 20 });
    const create = vi.fn().mockResolvedValue({});
    mockTransaction(mockPrisma, {
      profileRewardPoints: { upsert },
      pointTransaction: { create },
    });

    const result = await recordPointAward({
      profileId: "profile-1",
      points: 20,
      reason: "manual",
      awardedBy: "admin-1",
      note: "Great job!",
    });

    expect(result).toEqual({ totalPoints: 20, alreadyAwarded: false });
    expect(create).toHaveBeenCalledWith({
      data: {
        profileId: "profile-1",
        points: 20,
        reason: "manual",
        taskId: undefined,
        taskTitle: undefined,
        awardedBy: "admin-1",
        note: "Great job!",
      },
    });
  });

  it("returns alreadyAwarded with current total when the unique index rejects a duplicate task award", async () => {
    mockPrisma.$transaction.mockRejectedValue(makeUniqueConstraintError());
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue({
      totalPoints: 75,
    });

    const result = await recordPointAward({
      profileId: "profile-1",
      points: 10,
      reason: "task_completed",
      taskId: "task-abc",
      taskTitle: "Buy milk",
    });

    expect(result).toEqual({ totalPoints: 75, alreadyAwarded: true });
    expect(mockPrisma.profileRewardPoints.findUnique).toHaveBeenCalledWith({
      where: { profileId: "profile-1" },
      select: { totalPoints: true },
    });
  });

  it("returns zero total when duplicate is caught and no reward-points row exists", async () => {
    mockPrisma.$transaction.mockRejectedValue(makeUniqueConstraintError());
    mockPrisma.profileRewardPoints.findUnique.mockResolvedValue(null);

    const result = await recordPointAward({
      profileId: "profile-1",
      points: 10,
      reason: "task_completed",
      taskId: "task-abc",
    });

    expect(result).toEqual({ totalPoints: 0, alreadyAwarded: true });
  });

  it("propagates non-P2002 errors", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("connection lost"));

    await expect(
      recordPointAward({
        profileId: "profile-1",
        points: 10,
        reason: "task_completed",
        taskId: "task-abc",
      })
    ).rejects.toThrow("connection lost");
  });
});
