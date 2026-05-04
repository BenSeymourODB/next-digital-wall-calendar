/**
 * Typed thin wrapper over the Google Tasks REST API
 * (https://tasks.googleapis.com/tasks/v1).
 *
 * The wrapper owns:
 *   - URL construction + query-string encoding
 *   - Bearer-token attachment
 *   - Transient-failure retry via {@link fetchWithRetry}
 *   - Response parsing into the canonical {@link tasks-types} shapes
 *   - Non-OK responses raised as {@link GoogleTasksApiError}
 *
 * It deliberately stays caller-agnostic: it accepts an `accessToken` (which
 * route handlers fetch via `getAccessToken()`) and never touches NextAuth or
 * Prisma directly. Higher-level concerns (auth checks, request logging, error
 * shaping for clients) belong in the route handlers that call these helpers.
 */
import { fetchWithRetry } from "@/lib/http/retry";
import {
  type CreateTaskInput,
  type GoogleTask,
  type GoogleTaskCollection,
  type GoogleTaskList,
  GoogleTasksApiError,
  type ListTasksOptions,
  type ListTasksResult,
  type PatchTaskInput,
} from "./tasks-types";

export const GOOGLE_TASKS_API_BASE = "https://tasks.googleapis.com/tasks/v1";

interface CallOptions {
  /** Forwarded to `fetchWithRetry` (and ultimately the `fetch` call). */
  signal?: AbortSignal;
}

interface RequestInitWithBody extends RequestInit {
  bodyJson?: unknown;
}

async function tasksRequest<T>(
  accessToken: string,
  url: URL,
  init: RequestInitWithBody = {}
): Promise<T> {
  const { bodyJson, headers, ...rest } = init;

  const response = await fetchWithRetry(url.toString(), {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...headers,
    },
    body: bodyJson === undefined ? rest.body : JSON.stringify(bodyJson),
  });

  if (response.status === 204) {
    return undefined as T;
  }

  // Google Tasks responses are always JSON for both success and error bodies.
  // Some error responses (or aborted requests) may have empty bodies, so fall
  // back to `null` rather than letting `JSON.parse` throw.
  const parsed = await response.json().catch(() => null as unknown);

  if (!response.ok) {
    const apiMessage =
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (parsed as { error?: { message?: string } }).error?.message ===
        "string"
        ? (parsed as { error: { message: string } }).error.message
        : null;
    throw new GoogleTasksApiError(
      response.status,
      apiMessage ?? `Google Tasks API error: ${response.status}`,
      parsed
    );
  }

  return (parsed ?? (undefined as unknown)) as T;
}

function buildUrl(path: string): URL {
  return new URL(`${GOOGLE_TASKS_API_BASE}${path}`);
}

/** GET /users/@me/lists — return all task lists the user owns. */
export async function listTaskLists(
  accessToken: string,
  options: CallOptions = {}
): Promise<GoogleTaskList[]> {
  const url = buildUrl("/users/@me/lists");
  const data = await tasksRequest<GoogleTaskCollection<GoogleTaskList>>(
    accessToken,
    url,
    { method: "GET", signal: options.signal }
  );
  return data?.items ?? [];
}

/**
 * GET /lists/{listId}/tasks — return tasks in a list.
 *
 * Defaults match the most common UI use case: hide completed/deleted/hidden,
 * cap at 100 items. Caller can override any of these via {@link ListTasksOptions}.
 */
export async function listTasks(
  accessToken: string,
  listId: string,
  opts: ListTasksOptions = {},
  callOptions: CallOptions = {}
): Promise<ListTasksResult> {
  const url = buildUrl(`/lists/${encodeURIComponent(listId)}/tasks`);
  appendListTasksParams(url, opts);

  const data = await tasksRequest<GoogleTaskCollection<GoogleTask>>(
    accessToken,
    url,
    { method: "GET", signal: callOptions.signal }
  );

  return {
    tasks: data?.items ?? [],
    nextPageToken: data?.nextPageToken,
  };
}

function appendListTasksParams(url: URL, opts: ListTasksOptions): void {
  const showCompleted = opts.showCompleted ?? false;
  const showDeleted = opts.showDeleted ?? false;
  const showHidden = opts.showHidden ?? false;
  const maxResults = opts.maxResults ?? 100;

  url.searchParams.set("showCompleted", String(showCompleted));
  url.searchParams.set("showDeleted", String(showDeleted));
  url.searchParams.set("showHidden", String(showHidden));
  url.searchParams.set("maxResults", String(maxResults));

  if (opts.pageToken) url.searchParams.set("pageToken", opts.pageToken);
  if (opts.dueMin) url.searchParams.set("dueMin", opts.dueMin);
  if (opts.dueMax) url.searchParams.set("dueMax", opts.dueMax);
  if (opts.completedMin)
    url.searchParams.set("completedMin", opts.completedMin);
  if (opts.completedMax)
    url.searchParams.set("completedMax", opts.completedMax);
  if (opts.updatedMin) url.searchParams.set("updatedMin", opts.updatedMin);
}

/** POST /lists/{listId}/tasks — create a new task. */
export async function createTask(
  accessToken: string,
  listId: string,
  task: CreateTaskInput,
  options: CallOptions = {}
): Promise<GoogleTask> {
  const url = buildUrl(`/lists/${encodeURIComponent(listId)}/tasks`);
  return await tasksRequest<GoogleTask>(accessToken, url, {
    method: "POST",
    bodyJson: task,
    signal: options.signal,
  });
}

/** PATCH /lists/{listId}/tasks/{taskId} — partial update of a task. */
export async function patchTask(
  accessToken: string,
  listId: string,
  taskId: string,
  updates: PatchTaskInput,
  options: CallOptions = {}
): Promise<GoogleTask> {
  const url = buildUrl(
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`
  );
  return await tasksRequest<GoogleTask>(accessToken, url, {
    method: "PATCH",
    bodyJson: updates,
    signal: options.signal,
  });
}

/** DELETE /lists/{listId}/tasks/{taskId} — permanently delete a task. */
export async function deleteTask(
  accessToken: string,
  listId: string,
  taskId: string,
  options: CallOptions = {}
): Promise<void> {
  const url = buildUrl(
    `/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`
  );
  await tasksRequest<void>(accessToken, url, {
    method: "DELETE",
    signal: options.signal,
  });
}

export { GoogleTasksApiError };
