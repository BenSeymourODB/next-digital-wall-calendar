/**
 * API endpoint for updating a Google Task
 * Uses server-side authentication with NextAuth.js
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";

const VALID_STATUSES = ["needsAction", "completed"] as const;
type TaskStatus = (typeof VALID_STATUSES)[number];

interface TaskUpdateBody {
  status?: TaskStatus;
  title?: string;
  notes?: string;
  due?: string;
}

/**
 * PATCH /api/tasks/[taskId] - Update a task
 * Query params:
 * - listId: Task list ID (required)
 * Body:
 * - status: "needsAction" | "completed"
 * - title?: string
 * - notes?: string
 * - due?: string (ISO 8601 date)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ taskId: string }> }
) {
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

    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");

    if (!listId) {
      return NextResponse.json(
        { error: "listId query parameter is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as TaskUpdateBody;

    // Validate status if provided
    if (body.status && !VALID_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'needsAction' or 'completed'" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const response = await fetch(
      `${GOOGLE_TASKS_API}/lists/${encodeURIComponent(listId)}/tasks/${encodeURIComponent(taskId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(new Error("Failed to update task"), {
        status: response.status,
        errorData,
        taskId,
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
        { error: "Failed to update task" },
        { status: response.status }
      );
    }

    const updatedTask = await response.json();

    logger.event("TaskUpdated", {
      taskId,
      listId,
      updates: Object.keys(body).join(","),
      userId: session.user.id,
    });

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/tasks/[taskId]",
      errorType: "update_task",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
