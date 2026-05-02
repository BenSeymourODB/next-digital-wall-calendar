/**
 * Unit tests for the task-assignments service.
 *
 * Verifies the batch lookup that powers the per-profile task filter:
 * many Google task IDs in, a Map keyed by task ID with the profiles
 * assigned to each task out.
 */
import { prisma } from "@/lib/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getTaskAssignmentsByTaskIds } from "../task-assignments";

vi.mock("@/lib/db", () => ({
  prisma: {
    taskAssignment: {
      findMany: vi.fn(),
    },
  },
}));

const mockPrisma = prisma as unknown as {
  taskAssignment: {
    findMany: ReturnType<typeof vi.fn>;
  };
};

const dadProfile = {
  id: "profile-dad",
  name: "Dad",
  color: "#3b82f6",
  avatar: { type: "initials", value: "D" },
};

const momProfile = {
  id: "profile-mom",
  name: "Mom",
  color: "#ef4444",
  avatar: { type: "initials", value: "M" },
};

describe("getTaskAssignmentsByTaskIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const USER_ID = "user-123";

  it("returns an empty map when no task IDs are given", async () => {
    const result = await getTaskAssignmentsByTaskIds([], USER_ID);

    expect(result.size).toBe(0);
    expect(mockPrisma.taskAssignment.findMany).not.toHaveBeenCalled();
  });

  it("scopes the query to the caller's profiles to prevent cross-tenant reads", async () => {
    mockPrisma.taskAssignment.findMany.mockResolvedValue([]);

    await getTaskAssignmentsByTaskIds(["task-1", "task-2"], USER_ID);

    expect(mockPrisma.taskAssignment.findMany).toHaveBeenCalledWith({
      where: {
        taskId: { in: ["task-1", "task-2"] },
        profile: { userId: USER_ID },
      },
      include: {
        profile: {
          select: {
            id: true,
            name: true,
            color: true,
            avatar: true,
          },
        },
      },
    });
  });

  it("propagates Prisma errors so the route can surface a 500", async () => {
    mockPrisma.taskAssignment.findMany.mockRejectedValue(
      new Error("connection refused")
    );

    await expect(
      getTaskAssignmentsByTaskIds(["task-1"], USER_ID)
    ).rejects.toThrow("connection refused");
  });

  it("groups assignments by task ID with profile summaries", async () => {
    mockPrisma.taskAssignment.findMany.mockResolvedValue([
      {
        id: "a-1",
        taskId: "task-1",
        profileId: dadProfile.id,
        profile: dadProfile,
      },
      {
        id: "a-2",
        taskId: "task-1",
        profileId: momProfile.id,
        profile: momProfile,
      },
      {
        id: "a-3",
        taskId: "task-2",
        profileId: dadProfile.id,
        profile: dadProfile,
      },
    ]);

    const result = await getTaskAssignmentsByTaskIds(
      ["task-1", "task-2", "task-3"],
      USER_ID
    );

    expect(result.get("task-1")).toEqual([
      { profileId: dadProfile.id, profile: dadProfile },
      { profileId: momProfile.id, profile: momProfile },
    ]);
    expect(result.get("task-2")).toEqual([
      { profileId: dadProfile.id, profile: dadProfile },
    ]);
    expect(result.has("task-3")).toBe(false);
  });

  it("dedupes input task IDs before querying", async () => {
    mockPrisma.taskAssignment.findMany.mockResolvedValue([]);

    await getTaskAssignmentsByTaskIds(["task-1", "task-1", "task-2"], USER_ID);

    expect(mockPrisma.taskAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          taskId: { in: ["task-1", "task-2"] },
          profile: { userId: USER_ID },
        },
      })
    );
  });
});
