/**
 * Typed shapes for Google Tasks API v1 responses and request payloads.
 *
 * Universal module: no browser globals, no server-only deps. Safe to import
 * from both route handlers and shared lib code.
 *
 * Schema mirrored from https://developers.google.com/tasks/reference/rest/v1.
 */

/** Status values returned by Google Tasks API. */
export const TASK_STATUSES = ["needsAction", "completed"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Raw task list resource as returned by Google Tasks API. */
export interface GoogleTaskList {
  kind?: "tasks#taskList";
  id: string;
  etag?: string;
  title: string;
  updated?: string;
  selfLink?: string;
}

/** Embedded link on a task (Google docs, etc.). */
export interface GoogleTaskLink {
  type: string;
  description: string;
  link: string;
}

/** Raw task resource as returned by Google Tasks API. */
export interface GoogleTask {
  kind?: "tasks#task";
  id: string;
  etag?: string;
  title: string;
  updated?: string;
  selfLink?: string;
  parent?: string;
  position?: string;
  notes?: string;
  status: TaskStatus;
  due?: string;
  completed?: string;
  deleted?: boolean;
  hidden?: boolean;
  links?: GoogleTaskLink[];
}

/** Wire-format collection envelope returned by list endpoints. */
export interface GoogleTaskCollection<T> {
  kind?: string;
  etag?: string;
  nextPageToken?: string;
  items?: T[];
}

/** Options accepted by `listTasks`. Mirrors the relevant query params. */
export interface ListTasksOptions {
  showCompleted?: boolean;
  showDeleted?: boolean;
  showHidden?: boolean;
  maxResults?: number;
  pageToken?: string;
  dueMin?: string;
  dueMax?: string;
  completedMin?: string;
  completedMax?: string;
  updatedMin?: string;
}

/** Result envelope returned by `listTasks`. */
export interface ListTasksResult {
  tasks: GoogleTask[];
  nextPageToken?: string;
}

/** Payload accepted by `createTask`. */
export interface CreateTaskInput {
  title: string;
  notes?: string;
  due?: string;
  status?: TaskStatus;
  parent?: string;
  previous?: string;
}

/** Payload accepted by `patchTask`. Any subset of the writable task fields. */
export type PatchTaskInput = Partial<
  Pick<GoogleTask, "title" | "notes" | "due" | "status" | "completed">
>;

/**
 * Error thrown when a Google Tasks API call returns a non-OK response. Mirrors
 * the auth error shape used elsewhere so route handlers can switch on `status`.
 */
export class GoogleTasksApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "GoogleTasksApiError";
    this.status = status;
    this.body = body;
  }
}
