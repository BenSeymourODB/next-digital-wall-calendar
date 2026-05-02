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

  it("returns an empty map when no task IDs are given", async () => {
    const result = await getTaskAssignmentsByTaskIds([]);

    expect(result.size).toBe(0);
    expect(mockPrisma.taskAssignment.findMany).not.toHaveBeenCalled();
  });

  it("queries TaskAssignment for the supplied task IDs", async () => {
    mockPrisma.taskAssignment.findMany.mockResolvedValue([]);

    await getTaskAssignmentsByTaskIds(["task-1", "task-2"]);

    expect(mockPrisma.taskAssignment.findMany).toHaveBeenCalledWith({
      where: { taskId: { in: ["task-1", "task-2"] } },
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

    const result = await getTaskAssignmentsByTaskIds([
      "task-1",
      "task-2",
      "task-3",
    ]);

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

    await getTaskAssignmentsByTaskIds(["task-1", "task-1", "task-2"]);

    expect(mockPrisma.taskAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { taskId: { in: ["task-1", "task-2"] } },
      })
    );
  });
});
