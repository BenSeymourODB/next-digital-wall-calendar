/**
 * Unit tests for the typed Google Tasks API wrapper.
 *
 * These tests focus on URL/query construction, response parsing into the
 * canonical types, and the error envelope. The retry behaviour itself is
 * already covered by `src/lib/http/__tests__/retry.test.ts`, so we stub
 * `fetchWithRetry` to a no-retry pass-through and exercise the wrapper in
 * isolation.
 */
import { fetchWithRetry } from "@/lib/http/retry";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GOOGLE_TASKS_API_BASE,
  createTask,
  deleteTask,
  listTaskLists,
  listTasks,
  patchTask,
} from "../tasks-api";
import { GoogleTasksApiError } from "../tasks-types";

vi.mock("@/lib/http/retry", () => ({
  fetchWithRetry: vi.fn(),
}));

const ACCESS_TOKEN = "test-access-token";

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

function lastFetchCall() {
  const calls = vi.mocked(fetchWithRetry).mock.calls;
  return calls[calls.length - 1];
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("listTaskLists", () => {
  it("returns parsed items array on success", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse({
        items: [
          { id: "list-1", title: "Work" },
          { id: "list-2", title: "Personal" },
        ],
      })
    );

    const lists = await listTaskLists(ACCESS_TOKEN);

    expect(lists).toEqual([
      { id: "list-1", title: "Work" },
      { id: "list-2", title: "Personal" },
    ]);
  });

  it("returns empty array when API returns no items", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(jsonResponse({}));

    const lists = await listTaskLists(ACCESS_TOKEN);

    expect(lists).toEqual([]);
  });

  it("calls the canonical lists endpoint with bearer auth", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(jsonResponse({ items: [] }));

    await listTaskLists(ACCESS_TOKEN);

    const [url, init] = lastFetchCall();
    expect(url).toBe(`${GOOGLE_TASKS_API_BASE}/users/@me/lists`);
    expect(init?.method).toBe("GET");
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
  });

  it("throws GoogleTasksApiError with parsed message on non-OK response", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse(
        { error: { code: 403, message: "Insufficient Permission" } },
        { status: 403 }
      )
    );

    await expect(listTaskLists(ACCESS_TOKEN)).rejects.toMatchObject({
      name: "GoogleTasksApiError",
      status: 403,
      message: "Insufficient Permission",
    });
  });

  it("falls back to a default error message when body has none", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      new Response(null, { status: 500 })
    );

    await expect(listTaskLists(ACCESS_TOKEN)).rejects.toMatchObject({
      name: "GoogleTasksApiError",
      status: 500,
      message: "Google Tasks API error: 500",
    });
  });
});

describe("listTasks", () => {
  it("returns tasks and nextPageToken on success", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse({
        items: [
          {
            id: "task-1",
            title: "Buy milk",
            status: "needsAction",
          },
        ],
        nextPageToken: "next-page",
      })
    );

    const result = await listTasks(ACCESS_TOKEN, "list-1");

    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0]).toEqual({
      id: "task-1",
      title: "Buy milk",
      status: "needsAction",
    });
    expect(result.nextPageToken).toBe("next-page");
  });

  it("encodes the listId path component", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(jsonResponse({ items: [] }));

    await listTasks(ACCESS_TOKEN, "list/with spaces");

    const [url] = lastFetchCall();
    const urlString = url as string;
    expect(urlString).toContain("/lists/list%2Fwith%20spaces/tasks");
  });

  it("applies safe defaults for showCompleted/showDeleted/showHidden/maxResults", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(jsonResponse({ items: [] }));

    await listTasks(ACCESS_TOKEN, "list-1");

    const [url] = lastFetchCall();
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get("showCompleted")).toBe("false");
    expect(parsed.searchParams.get("showDeleted")).toBe("false");
    expect(parsed.searchParams.get("showHidden")).toBe("false");
    expect(parsed.searchParams.get("maxResults")).toBe("100");
  });

  it("propagates explicit query options including pagination + due window", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(jsonResponse({ items: [] }));

    await listTasks(ACCESS_TOKEN, "list-1", {
      showCompleted: true,
      maxResults: 25,
      pageToken: "page-2",
      dueMin: "2026-05-01T00:00:00.000Z",
      dueMax: "2026-05-08T00:00:00.000Z",
      updatedMin: "2026-04-29T00:00:00.000Z",
    });

    const [url] = lastFetchCall();
    const parsed = new URL(url as string);
    expect(parsed.searchParams.get("showCompleted")).toBe("true");
    expect(parsed.searchParams.get("maxResults")).toBe("25");
    expect(parsed.searchParams.get("pageToken")).toBe("page-2");
    expect(parsed.searchParams.get("dueMin")).toBe("2026-05-01T00:00:00.000Z");
    expect(parsed.searchParams.get("dueMax")).toBe("2026-05-08T00:00:00.000Z");
    expect(parsed.searchParams.get("updatedMin")).toBe(
      "2026-04-29T00:00:00.000Z"
    );
  });

  it("returns empty tasks array when items field is missing", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(jsonResponse({}));

    const result = await listTasks(ACCESS_TOKEN, "list-1");
    expect(result.tasks).toEqual([]);
    expect(result.nextPageToken).toBeUndefined();
  });
});

describe("createTask", () => {
  it("POSTs the task body and returns the created task", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse(
        {
          id: "task-new",
          title: "Walk the dog",
          status: "needsAction",
        },
        { status: 200 }
      )
    );

    const created = await createTask(ACCESS_TOKEN, "list-1", {
      title: "Walk the dog",
      notes: "Before dinner",
      due: "2026-05-03T00:00:00.000Z",
    });

    expect(created).toEqual({
      id: "task-new",
      title: "Walk the dog",
      status: "needsAction",
    });

    const [url, init] = lastFetchCall();
    expect(url).toBe(`${GOOGLE_TASKS_API_BASE}/lists/list-1/tasks`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({
        title: "Walk the dog",
        notes: "Before dinner",
        due: "2026-05-03T00:00:00.000Z",
      })
    );
  });

  it("raises GoogleTasksApiError on validation failures", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse(
        { error: { code: 400, message: "Invalid value at 'task.due'" } },
        { status: 400 }
      )
    );

    await expect(
      createTask(ACCESS_TOKEN, "list-1", { title: "Bad due", due: "nope" })
    ).rejects.toBeInstanceOf(GoogleTasksApiError);
  });
});

describe("patchTask", () => {
  it("PATCHes the partial body and encodes both path components", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse({
        id: "task-1",
        title: "Buy milk",
        status: "completed",
      })
    );

    const updated = await patchTask(ACCESS_TOKEN, "list/1", "task/1", {
      status: "completed",
    });

    expect(updated.status).toBe("completed");
    const [url, init] = lastFetchCall();
    expect(url).toBe(`${GOOGLE_TASKS_API_BASE}/lists/list%2F1/tasks/task%2F1`);
    expect(init?.method).toBe("PATCH");
    expect(init?.body).toBe(JSON.stringify({ status: "completed" }));
  });
});

describe("deleteTask", () => {
  it("issues DELETE and resolves on 204", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(noContentResponse());

    await expect(
      deleteTask(ACCESS_TOKEN, "list-1", "task-1")
    ).resolves.toBeUndefined();

    const [url, init] = lastFetchCall();
    expect(url).toBe(`${GOOGLE_TASKS_API_BASE}/lists/list-1/tasks/task-1`);
    expect(init?.method).toBe("DELETE");
  });

  it("surfaces 404 as GoogleTasksApiError with the API message", async () => {
    vi.mocked(fetchWithRetry).mockResolvedValue(
      jsonResponse(
        { error: { code: 404, message: "Not Found" } },
        { status: 404 }
      )
    );

    await expect(
      deleteTask(ACCESS_TOKEN, "list-1", "missing")
    ).rejects.toMatchObject({
      name: "GoogleTasksApiError",
      status: 404,
      message: "Not Found",
    });
  });
});
