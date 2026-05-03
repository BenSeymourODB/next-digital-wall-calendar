/**
 * Tests for task completion API route
 * POST - Complete a task and update profile streak
 *
 * The streak database flow lives in `@/lib/services/streak` and is
 * covered by its own unit tests. This suite mocks the service and
 * focuses on the handler's concerns: auth, validation, the Google
 * Tasks call, and response shaping.
 */
import {
  AuthError,
  assertGoogleTasksScope,
  getAccessToken,
  getSession,
} from "@/lib/auth";
import {
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import { updateProfileStreak } from "@/lib/services/streak";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "../route";

vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getAccessToken: vi.fn(),
  assertGoogleTasksScope: vi.fn(),
  AuthError: class AuthError extends Error {
    status: number;
    constructor(message: string, status: number = 401) {
      super(message);
      this.name = "AuthError";
      this.status = status;
    }
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

// Replace the real `sleep` inside fetchWithRetry with a no-op so transient-
// status tests (5xx, 429) don't wait for real backoff delays.
vi.mock("@/lib/http/retry", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/http/retry")>(
      "@/lib/http/retry"
    );
  return {
    ...actual,
    fetchWithRetry: (
      input: Parameters<typeof actual.fetchWithRetry>[0],
      init?: Parameters<typeof actual.fetchWithRetry>[1],
      options: Parameters<typeof actual.fetchWithRetry>[2] = {}
    ) =>
      actual.fetchWithRetry(input, init, {
        ...options,
        sleep: () => Promise.resolve(),
      }),
  };
});

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
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getSession).mockResolvedValue(mockSession);
    vi.mocked(getAccessToken).mockResolvedValue("mock-access-token");
    vi.mocked(assertGoogleTasksScope).mockResolvedValue(undefined);
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
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });

      expect(response.status).toBe(401);
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Session expired. Please sign in again.");
      expect(data.requiresReauth).toBe(true);
    });

    it("returns 403 with requiresReauth when stored grant is missing the Tasks scope (#237)", async () => {
      vi.mocked(assertGoogleTasksScope).mockRejectedValue(
        new AuthError(
          "Re-authentication required: Google Tasks scope missing.",
          403
        )
      );

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.requiresReauth).toBe(true);
      expect(data.error).toMatch(/Google Tasks/);
      expect(mockFetch).not.toHaveBeenCalled();
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

    it("returns 401 with requiresReauth when Google API returns 403", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers(),
        json: () =>
          Promise.resolve({ error: { message: "Insufficient Permission" } }),
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.requiresReauth).toBe(true);
      expect(data.error).toBe(
        "Missing Google Tasks scope. Please sign in again to grant access."
      );
      expect(mockUpdateProfileStreak).not.toHaveBeenCalled();
    });

    it("returns generic error when Google API returns non-auth failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: "Not found" } }),
      });

      const request = createRequest({
        listId: "list-1",
        profileId: "profile-1",
      });
      const response = await POST(request, {
        params: Promise.resolve({ taskId: "task-123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Failed to complete task");
      expect(mockUpdateProfileStreak).not.toHaveBeenCalled();
    });

    it("returns 500 when Google API fails with a server error", async () => {
      // 500 is transient — fetchWithRetry retries (sleep is mocked to no-op).
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: () => Promise.resolve({ error: { message: "Server error" } }),
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
