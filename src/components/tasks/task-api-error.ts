/**
 * Shared error type for the `/api/tasks*` routes.
 *
 * Every tasks route (GET / POST /api/tasks, /api/tasks/lists, PATCH
 * /api/tasks/[taskId], etc.) returns a structured `{ error, requiresReauth }`
 * body on 401/403 — see `src/lib/auth/helpers.ts` and the route handlers.
 * Hooks that fetch from those routes should reject with `TaskApiError` so
 * UIs can render a "Sign in again" CTA without re-parsing the message.
 */

export class TaskApiError extends Error {
  readonly status: number;
  readonly requiresReauth: boolean;

  constructor(message: string, status: number, requiresReauth = false) {
    super(message);
    this.name = "TaskApiError";
    this.status = status;
    this.requiresReauth = requiresReauth;
  }
}

interface TaskApiErrorBody {
  error?: string;
  requiresReauth?: boolean;
}

/**
 * Read a non-OK fetch `Response` and return a `TaskApiError` populated
 * from its JSON body. Falls back to `fallbackMessage` when the body is
 * empty or unparseable so the caller never throws a bare network error
 * from inside the parser.
 */
export async function parseTaskApiError(
  response: Response,
  fallbackMessage: string
): Promise<TaskApiError> {
  const payload = (await response.json().catch(() => ({}))) as TaskApiErrorBody;
  return new TaskApiError(
    payload.error ?? fallbackMessage,
    response.status,
    payload.requiresReauth === true
  );
}
