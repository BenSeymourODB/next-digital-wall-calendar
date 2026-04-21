/**
 * Tests for task completion API route
 * POST - Complete a task and update profile streak
 *
 * The streak database flow lives in `@/lib/services/streak` and is
 * covered by its own unit tests. This suite mocks the service and
 * focuses on the handler's concerns: auth, validation, the Google
 * Tasks call, and response shaping.
 */
import { updateProfileStreak } from "@/lib/services/streak";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

const mockGetSession = vi.fn();
const mockGetAccessToken = vi.fn();

vi.mock("@/lib/auth/helpers", () => ({
  getSession: () => mockGetSession(),
  getAccessToken: () => mockGetAccessToken(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/lib/services/streak", () => ({
  updateProfileStreak: vi.fn(),
}));

const mockUpdateProfileStreak = vi.mocked(updateProfileStreak);

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
    mockUpdateProfileStreak.mockResolvedValue({ current: 4, longest: 5 });
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
      expect(mockUpdateProfileStreak).not.toHaveBeenCalled();
    });
  });

  describe("streak updates", () => {
    it("delegates the streak update to the streak service with the request profileId", async () => {
      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      expect(mockUpdateProfileStreak).toHaveBeenCalledWith("profile-1");
    });

    it("returns the streak values produced by the service", async () => {
      mockUpdateProfileStreak.mockResolvedValue({ current: 6, longest: 6 });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      const data = await response.json();
      expect(data.streak).toEqual({ current: 6, longest: 6 });
    });
  });

  describe("response", () => {
    it("returns task and streak data", async () => {
      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.task).toEqual({
        id: "task-123",
        title: "Test Task",
        status: "completed",
      });
      expect(data.streak).toEqual({ current: 4, longest: 5 });
    });
  });
});
