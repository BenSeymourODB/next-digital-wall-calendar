/**
 * API endpoint for updating a Google Task
 * Uses server-side authentication with NextAuth.js
 */
import {
  AuthError,
  assertGoogleTasksScope,
  getAccessToken,
  getSession,
} from "@/lib/auth";
import { patchTask } from "@/lib/google/tasks-api";
import {
  GoogleTasksApiError,
  type PatchTaskInput,
  TASK_STATUSES,
} from "@/lib/google/tasks-types";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

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

    // Short-circuit users whose stored grant is missing the Tasks scope so we
    // never burn an upstream call we already know will 403 (#237).
    await assertGoogleTasksScope();

    const { taskId } = await params;
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get("listId");

    if (!listId) {
      return NextResponse.json(
        { error: "listId query parameter is required" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as PatchTaskInput;

    if (body.status && !TASK_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be 'needsAction' or 'completed'" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const updatedTask = await patchTask(accessToken, listId, taskId, body);

    logger.event("TaskUpdated", {
      taskId,
      listId,
      updates: Object.keys(body).join(","),
      userId: session.user.id,
    });

    return NextResponse.json({ task: updatedTask });
  } catch (error) {
    if (error instanceof AuthError) {
      const requiresReauth = error.status === 401 || error.status === 403;
      return NextResponse.json(
        { error: error.message, requiresReauth },
        { status: error.status }
      );
    }

    if (error instanceof GoogleTasksApiError) {
      logger.error(error, {
        endpoint: "/api/tasks/[taskId]",
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
        { error: "Failed to update task" },
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
