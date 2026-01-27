/**
 * Tests for task assignments API route
 * GET - Get profiles assigned to a task
 * PUT - Set/update profiles assigned to a task
 * DELETE - Remove all assignments for a task
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PUT } from "../route";

// Mock getSession from auth helpers
const mockGetSession = vi.fn();

vi.mock("@/lib/auth/helpers", () => ({
  getSession: () => mockGetSession(),
}));

// Mock Prisma
const mockFindMany = vi.fn();
const mockDeleteMany = vi.fn();
const mockCreateMany = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    taskAssignment: {
      findMany: () => mockFindMany(),
      deleteMany: (args: unknown) => mockDeleteMany(args),
      createMany: (args: unknown) => mockCreateMany(args),
    },
  },
}));

function createRequest(
  method: string,
  body?: unknown,
  searchParams?: Record<string, string>
): NextRequest {
  const url = new URL("http://localhost:3000/api/tasks/task-123/assignments");
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      url.searchParams.set(key, value);
    });
  }

  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

describe("Task Assignments API", () => {
  const mockSession = {
    user: { id: "user-123", email: "test@example.com" },
    accessToken: "mock-access-token",
  };

  const mockAssignments = [
    {
      id: "assign-1",
      taskId: "task-123",
      profileId: "profile-1",
      profile: {
        id: "profile-1",
        name: "Dad",
        color: "#3b82f6",
        avatar: { type: "initials", value: "D" },
      },
    },
    {
      id: "assign-2",
      taskId: "task-123",
      profileId: "profile-2",
      profile: {
        id: "profile-2",
        name: "Mom",
        color: "#ef4444",
        avatar: { type: "initials", value: "M" },
      },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
  });

  describe("GET /api/tasks/[taskId]/assignments", () => {
    it("returns 401 when no session", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe("Unauthorized");
    });

    it("returns assignments for a task", async () => {
      mockFindMany.mockResolvedValue(mockAssignments);

      const request = createRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assignments).toHaveLength(2);
      expect(data.assignments[0].profileId).toBe("profile-1");
      expect(data.assignments[0].profile.name).toBe("Dad");
    });

    it("returns empty array when no assignments", async () => {
      mockFindMany.mockResolvedValue([]);

      const request = createRequest("GET");
      const response = await GET(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.assignments).toEqual([]);
    });
  });

  describe("PUT /api/tasks/[taskId]/assignments", () => {
    it("returns 401 when no session", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest("PUT", {
        profileIds: ["profile-1"],
      });
      const response = await PUT(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 400 when profileIds is missing", async () => {
      const request = createRequest("PUT", {});
      const response = await PUT(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("profileIds array is required");
    });

    it("returns 400 when profileIds is not an array", async () => {
      const request = createRequest("PUT", {
        profileIds: "not-an-array",
      });
      const response = await PUT(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("profileIds array is required");
    });

    it("deletes existing assignments and creates new ones", async () => {
      mockDeleteMany.mockResolvedValue({ count: 2 });
      mockCreateMany.mockResolvedValue({ count: 1 });
      mockFindMany.mockResolvedValue([
        {
          id: "assign-3",
          taskId: "task-123",
          profileId: "profile-3",
          profile: {
            id: "profile-3",
            name: "Kid",
            color: "#22c55e",
            avatar: { type: "initials", value: "K" },
          },
        },
      ]);

      const request = createRequest("PUT", {
        profileIds: ["profile-3"],
      });
      const response = await PUT(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { taskId: "task-123" },
      });
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [{ taskId: "task-123", profileId: "profile-3" }],
      });
    });

    it("clears all assignments when empty array provided", async () => {
      mockDeleteMany.mockResolvedValue({ count: 2 });
      mockFindMany.mockResolvedValue([]);

      const request = createRequest("PUT", {
        profileIds: [],
      });
      const response = await PUT(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { taskId: "task-123" },
      });
      expect(mockCreateMany).not.toHaveBeenCalled();
    });

    it("assigns task to multiple profiles", async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 });
      mockCreateMany.mockResolvedValue({ count: 2 });
      mockFindMany.mockResolvedValue(mockAssignments);

      const request = createRequest("PUT", {
        profileIds: ["profile-1", "profile-2"],
      });
      const response = await PUT(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockCreateMany).toHaveBeenCalledWith({
        data: [
          { taskId: "task-123", profileId: "profile-1" },
          { taskId: "task-123", profileId: "profile-2" },
        ],
      });
      const data = await response.json();
      expect(data.assignments).toHaveLength(2);
    });
  });

  describe("DELETE /api/tasks/[taskId]/assignments", () => {
    it("returns 401 when no session", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(401);
    });

    it("deletes all assignments for a task", async () => {
      mockDeleteMany.mockResolvedValue({ count: 2 });

      const request = createRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockDeleteMany).toHaveBeenCalledWith({
        where: { taskId: "task-123" },
      });
      const data = await response.json();
      expect(data.deleted).toBe(2);
    });

    it("returns success even when no assignments exist", async () => {
      mockDeleteMany.mockResolvedValue({ count: 0 });

      const request = createRequest("DELETE");
      const response = await DELETE(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.deleted).toBe(0);
    });
  });
});
