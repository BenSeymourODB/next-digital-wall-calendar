/**
 * Tests for task completion API route
 * POST - Complete a task and update profile streak
 */
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

// Mock getSession and getAccessToken
const mockGetSession = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock("@/lib/auth/helpers", () => ({
  getSession: () => mockGetSession(),
  getAccessToken: () => mockGetAccessToken(),
}));

// Mock fetch for Google Tasks API
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Prisma
const mockFindUnique = vi.fn();
const mockUpdate = vi.fn();
const mockCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    profileRewardPoints: {
      findUnique: () => mockFindUnique(),
      update: (args: unknown) => mockUpdate(args),
      create: (args: unknown) => mockCreate(args),
    },
  },
}));

// Mock streak helpers
vi.mock("@/lib/streak-helpers", () => ({
  calculateNewStreak: vi.fn((current, last) => {
    if (last === null) return 1;
    return current + 1;
  }),
}));

function createRequest(body?: unknown): NextRequest {
  const url = new URL("http://localhost:3000/api/tasks/task-123/complete");

  return new NextRequest(url, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : undefined,
  });
}

describe("Task Complete API", () => {
  const mockSession = {
    user: { id: "user-123", email: "test@example.com" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(mockSession);
    mockGetAccessToken.mockResolvedValue("mock-access-token");
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "task-123",
          title: "Test Task",
          status: "completed",
        }),
    });
  });

  describe("authentication", () => {
    it("returns 401 when no session", async () => {
      mockGetSession.mockResolvedValue(null);

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 when no access token", async () => {
      mockGetAccessToken.mockResolvedValue(null);

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(401);
    });
  });

  describe("validation", () => {
    it("returns 400 when listId is missing", async () => {
      const request = createRequest({ profileId: "profile-1" });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("listId is required");
    });

    it("returns 400 when profileId is missing", async () => {
      const request = createRequest({ listId: "list-1" });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBe("profileId is required");
    });
  });

  describe("task completion", () => {
    it("marks task as completed via Google Tasks API", async () => {
      mockFindUnique.mockResolvedValue({
        id: "rp-1",
        profileId: "profile-1",
        totalPoints: 100,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: new Date("2024-06-14"),
      });
      mockUpdate.mockResolvedValue({
        currentStreak: 4,
        longestStreak: 5,
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://tasks.googleapis.com/tasks/v1/lists/list-1/tasks/task-123",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "completed" }),
        })
      );
    });

    it("returns error when Google API fails", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Server error" }),
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(500);
    });
  });

  describe("streak updates", () => {
    it("updates streak when task is completed for profile", async () => {
      mockFindUnique.mockResolvedValue({
        id: "rp-1",
        profileId: "profile-1",
        totalPoints: 100,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: new Date("2024-06-14"),
      });
      mockUpdate.mockResolvedValue({
        currentStreak: 4,
        longestStreak: 5,
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
      const data = await response.json();
      expect(data.streak).toBeDefined();
    });

    it("updates longestStreak when current exceeds it", async () => {
      mockFindUnique.mockResolvedValue({
        id: "rp-1",
        profileId: "profile-1",
        totalPoints: 100,
        currentStreak: 5,
        longestStreak: 5,
        lastActivityDate: new Date("2024-06-14"),
      });
      mockUpdate.mockResolvedValue({
        currentStreak: 6,
        longestStreak: 6,
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            longestStreak: expect.any(Number),
          }),
        })
      );
    });

    it("creates reward points record if not exists", async () => {
      mockFindUnique.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "rp-1",
        profileId: "profile-1",
        totalPoints: 0,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockCreate).toHaveBeenCalled();
    });
  });

  describe("response", () => {
    it("returns task and streak data", async () => {
      mockFindUnique.mockResolvedValue({
        id: "rp-1",
        profileId: "profile-1",
        totalPoints: 100,
        currentStreak: 3,
        longestStreak: 5,
        lastActivityDate: new Date("2024-06-14"),
      });
      mockUpdate.mockResolvedValue({
        currentStreak: 4,
        longestStreak: 5,
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.task).toBeDefined();
      expect(data.task.status).toBe("completed");
      expect(data.streak).toBeDefined();
      expect(data.streak.current).toBeDefined();
      expect(data.streak.longest).toBeDefined();
    });
  });
});
