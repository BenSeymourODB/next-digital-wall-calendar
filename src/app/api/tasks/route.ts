/**
 * API endpoint for Google Tasks
 * Uses server-side authentication with NextAuth.js
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";

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
    const maxResults = searchParams.get("maxResults") || "100";

    const accessToken = await getAccessToken();

    const apiUrl = new URL(
      `${GOOGLE_TASKS_API}/lists/${encodeURIComponent(listId)}/tasks`
    );
    apiUrl.searchParams.set("maxResults", maxResults);
    apiUrl.searchParams.set("showCompleted", String(showCompleted));

    const response = await fetch(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(new Error("Google Tasks API error"), {
        status: response.status,
        errorData,
        listId,
        userId: session.user.id,
      });

      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "Google authentication failed. Please sign in again.",
            requiresReauth: true,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch tasks" },
        { status: response.status }
      );
    }

    const data = await response.json();

    logger.log("Tasks fetched", {
      listId,
      taskCount: data.items?.length || 0,
      userId: session.user.id,
    });

    return NextResponse.json({
      tasks: data.items || [],
      nextPageToken: data.nextPageToken,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/tasks",
      errorType: "fetch_tasks",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
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

    const body = await request.json();
    const { listId, title, notes, due } = body;

    if (!listId || !title) {
      return NextResponse.json(
        { error: "listId and title are required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      `${GOOGLE_TASKS_API}/lists/${encodeURIComponent(listId)}/tasks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          notes,
          due,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(new Error("Failed to create task"), {
        status: response.status,
        errorData,
        listId,
        userId: session.user.id,
      });

      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "Google authentication failed. Please sign in again.",
            requiresReauth: true,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to create task" },
        { status: response.status }
      );
    }

    const task = await response.json();

    logger.event("TaskCreated", {
      listId,
      taskId: task.id,
      userId: session.user.id,
    });

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/tasks",
      errorType: "create_task",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
