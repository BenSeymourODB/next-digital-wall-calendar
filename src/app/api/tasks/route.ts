/**
 * API endpoint for Google Tasks
 * Uses server-side authentication with NextAuth.js
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { createTask, listTasks } from "@/lib/google/tasks-api";
import { GoogleTasksApiError } from "@/lib/google/tasks-types";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

interface CreateTaskBody {
  listId?: string;
  title?: string;
  notes?: string;
  due?: string;
}

/**
 * GET /api/tasks - List tasks from a task list
 * Query params:
 * - listId: Task list ID (required)
 * - showCompleted: Include completed tasks (default: false)
 * - maxResults: Maximum number of tasks (default: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.error === "RefreshTokenError") {
      return NextResponse.json(
        {
          error: "Session expired. Please sign in again.",
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");

    if (!listId) {
      return NextResponse.json(
        { error: "listId is required" },
        { status: 400 }
      );
    }

    const showCompleted = searchParams.get("showCompleted") === "true";
    const maxResultsParam = searchParams.get("maxResults");
    let maxResults: number | undefined;
    if (maxResultsParam !== null) {
      const parsed = Number(maxResultsParam);
      if (!Number.isFinite(parsed) || parsed < 1) {
        return NextResponse.json(
          { error: "maxResults must be a positive integer" },
          { status: 400 }
        );
      }
      maxResults = Math.trunc(parsed);
    }

    const accessToken = await getAccessToken();

    const { tasks, nextPageToken } = await listTasks(accessToken, listId, {
      showCompleted,
      ...(maxResults !== undefined && { maxResults }),
    });

    logger.event("TasksFetched", {
      listId,
      taskCount: tasks.length,
      userId: session.user.id,
    });

    return NextResponse.json({ tasks, nextPageToken });
  } catch (error) {
    return handleTasksApiError(error, "fetch_tasks");
  }
}

/**
 * POST /api/tasks - Create a new task
 * Body: { listId, title, notes?, due? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.error === "RefreshTokenError") {
      return NextResponse.json(
        {
          error: "Session expired. Please sign in again.",
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    const body = (await request.json()) as CreateTaskBody;
    const { listId, title, notes, due } = body;

    if (!listId || !title) {
      return NextResponse.json(
        { error: "listId and title are required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const task = await createTask(accessToken, listId, { title, notes, due });

    logger.event("TaskCreated", {
      listId,
      taskId: task.id,
      userId: session.user.id,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    return handleTasksApiError(error, "create_task");
  }
}

function handleTasksApiError(
  error: unknown,
  errorType: "fetch_tasks" | "create_task"
): NextResponse {
  if (error instanceof AuthError) {
    return NextResponse.json(
      { error: error.message, requiresReauth: error.status === 401 },
      { status: error.status }
    );
  }

  if (error instanceof GoogleTasksApiError) {
    logger.error(error, {
      endpoint: "/api/tasks",
      errorType,
      status: error.status,
    });

    if (error.status === 401 || error.status === 403) {
      return NextResponse.json(
        {
          error:
            error.status === 403
              ? "Missing Google Tasks scope. Please sign in again to grant access."
              : "Google authentication failed. Please sign in again.",
          requiresReauth: true,
        },
        { status: error.status }
      );
    }

    return NextResponse.json(
      {
        error:
          errorType === "create_task"
            ? "Failed to create task"
            : "Failed to fetch tasks",
      },
      { status: error.status }
    );
  }

  logger.error(error as Error, { endpoint: "/api/tasks", errorType });

  return NextResponse.json(
    { error: "An unexpected error occurred" },
    { status: 500 }
  );
}
