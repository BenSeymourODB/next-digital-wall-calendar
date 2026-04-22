/**
 * Integration tests for /api/tasks route
 */
// Import after mocks
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
import { GET, POST } from "../route";

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

// Replace the real `sleep` inside fetchWithRetry with a no-op so transient-
// status tests (5xx, 429) don't wait for real backoff delays. All other
// retry behaviour stays untouched.
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

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("/api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/tasks", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Session expired. Please sign in again.");
      expect(data.requiresReauth).toBe(true);
    });

    it("returns 400 when listId is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/tasks");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("listId is required");
    });

    it("returns tasks on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const mockTasks = [
        { id: "task-1", title: "Task 1" },
        { id: "task-2", title: "Task 2" },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: mockTasks }),
      });

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        tasks: typeof mockTasks;
        nextPageToken?: string;
      }>(response);

      expect(status).toBe(200);
      expect(data.tasks).toEqual(mockTasks);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("tasks.googleapis.com"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Bearer ${mockGoogleAccount.access_token}`,
          }),
        })
      );
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

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
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

      const request = createMockRequest("/api/tasks?listId=nonexistent");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(404);
      expect(data.error).toBe("Failed to fetch tasks");
    });

    it("passes query parameters correctly", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ items: [] }),
      });

      const request = createMockRequest(
        "/api/tasks?listId=list-123&showCompleted=true&maxResults=50"
      );
      await GET(request);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/maxResults=50/),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/showCompleted=true/),
        expect.any(Object)
      );
    });

    it("returns 500 on unexpected error", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockRejectedValue(new Error("Unexpected"));

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(500);
      expect(data.error).toBe("An unexpected error occurred");
    });

    it("retries a transient 503 and returns the eventual 200 (issue #68)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      // First two calls fail with 503; the third succeeds. The route should
      // surface the final success, not the transient failures.
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: () => Promise.resolve({ error: "Service Unavailable" }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: () => Promise.resolve({ error: "Service Unavailable" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [{ id: "t1", title: "T1" }] }),
        });

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status, data } = await parseResponse<{
        tasks: { id: string; title: string }[];
      }>(response);

      expect(status).toBe(200);
      expect(data.tasks).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("retries a 429 honouring Retry-After and returns the eventual 200 (issue #68)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Headers({ "Retry-After": "1" }),
          json: () => Promise.resolve({ error: "rate limited" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ items: [] }),
        });

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status } = await parseResponse<{ tasks: unknown[] }>(response);

      expect(status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("does NOT retry a 401 from the upstream API (non-transient, issue #68)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: () => Promise.resolve({ error: "Unauthorized" }),
      });

      const request = createMockRequest("/api/tasks?listId=list-123");
      const response = await GET(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.requiresReauth).toBe(true);
      // 401 is not transient — the route must not retry.
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("POST /api/tasks", () => {
    it("returns 401 when no session", async () => {
      vi.mocked(getSession).mockResolvedValue(null);

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: { listId: "list-123", title: "New Task" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("returns 401 with requiresReauth when RefreshTokenError", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSessionWithError);

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: { listId: "list-123", title: "New Task" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.requiresReauth).toBe(true);
    });

    it("returns 400 when listId is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: { title: "New Task" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("listId and title are required");
    });

    it("returns 400 when title is missing", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: { listId: "list-123" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(400);
      expect(data.error).toBe("listId and title are required");
    });

    it("creates task and returns 201 on success", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const createdTask = {
        id: "new-task-123",
        title: "New Task",
        notes: "Task notes",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(createdTask),
      });

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: {
          listId: "list-123",
          title: "New Task",
          notes: "Task notes",
        },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{
        task: typeof createdTask;
      }>(response);

      expect(status).toBe(201);
      expect(data.task).toEqual(createdTask);
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

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: { listId: "list-123", title: "New Task" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<ApiErrorResponse>(response);

      expect(status).toBe(401);
      expect(data.requiresReauth).toBe(true);
    });

    it("retries a transient 503 on create and returns the eventual 201 (issue #68)", async () => {
      vi.mocked(getSession).mockResolvedValue(mockSession);
      vi.mocked(getAccessToken).mockResolvedValue(
        mockGoogleAccount.access_token!
      );

      const createdTask = { id: "t1", title: "New Task" };
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          headers: new Headers(),
          json: () => Promise.resolve({ error: "Service Unavailable" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(createdTask),
        });

      const request = createMockRequest("/api/tasks", {
        method: "POST",
        body: { listId: "list-123", title: "New Task" },
      });
      const response = await POST(request);
      const { status, data } = await parseResponse<{
        task: typeof createdTask;
      }>(response);

      expect(status).toBe(201);
      expect(data.task).toEqual(createdTask);
      // Both attempts carry the same JSON body string (safe to re-send).
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const [[, firstInit], [, secondInit]] = mockFetch.mock.calls;
      expect(firstInit?.body).toBe(secondInit?.body);
      expect(firstInit?.method).toBe("POST");
    });
  });
});
