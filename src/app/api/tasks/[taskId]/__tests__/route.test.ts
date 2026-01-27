/**
 * Integration tests for /api/tasks/[taskId] route
 */
import { getAccessToken, getSession } from "@/lib/auth";
import {
  mockGoogleAccount,
  mockSession,
  mockSessionWithError,
} from "@/lib/auth/__tests__/fixtures";
import {
  type ApiErrorResponse,
  createMockRequest,
  parseResponse,
} from "@/lib/test-utils/api-test-helpers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "../route";

// Mock modules BEFORE imports
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(),
  getAccessToken: vi.fn(),
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

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("/api/tasks/[taskId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("PATCH /api/tasks/[taskId]", () => {
    const taskId = "task-123";
    const listId = "list-456";

    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "completed" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "completed" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Session expired. Please sign in again.");
      expect(data.requiresReauth).toBe(true);
    });

    it("returns 400 when listId is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest(`/api/tasks/${taskId}`, {
        method: "PATCH",
        body: { status: "completed" },
      });
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("listId query parameter is required");
    });

    it("returns 400 when status is invalid", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "invalid-status" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe(
        "Invalid status. Must be 'needsAction' or 'completed'"
      );
    });

    it("updates task and returns 200 on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const updatedTask = {
        id: taskId,
        title: "Test Task",
        status: "completed",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedTask),
      });

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "completed" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<{
        task: typeof updatedTask;
      }>(response);

      expect(status).toBe(200);
      expect(data.task).toEqual(updatedTask);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`tasks.googleapis.com`),
        expect.objectContaining({
          method: "PATCH",
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockGoogleAccount.access_token}`,
          }),
        })
      );
    });

    it("passes task updates to Google API correctly", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: taskId }),
      });

      const updates = {
        status: "completed",
        title: "Updated Title",
        notes: "Updated notes",
      };

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: updates,
        }
      );
      await PATCH(request, { params: Promise.resolve({ taskId }) });

      // Check that fetch was called with correct body
      const fetchCall = mockFetch.mock.calls[0];
      const fetchBody = JSON.parse(fetchCall[1].body as string);
      expect(fetchBody).toEqual(updates);
    });

    it("returns 401 with requiresReauth when Google API returns 401", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "completed" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.requiresReauth).toBe(true);
    });

    it("returns error status from Google API for other errors", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "Not found" }),
      });

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "completed" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Failed to update task");
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockRejectedValue(new Error("Unexpected"));

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "completed" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });

    it("accepts needsAction status to mark task incomplete", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const updatedTask = {
        id: taskId,
        title: "Test Task",
        status: "needsAction",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(updatedTask),
      });

      const request = createMockRequest(
        `/api/tasks/${taskId}?listId=${listId}`,
        {
          method: "PATCH",
          body: { status: "needsAction" },
        }
      );
      const response = await PATCH(request, {
        params: Promise.resolve({ taskId }),
      });
      const { status, data } = await parseResponse<{
        task: typeof updatedTask;
      }>(response);

      expect(status).toBe(200);
      expect(data.task.status).toBe("needsAction");
    });
  });
});
