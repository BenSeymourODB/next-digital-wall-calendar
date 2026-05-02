/**
 * Task Complete API
 * Marks a task as completed and updates the profile's streak
 *
 * POST - Complete a task and update streak
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { patchTask } from "@/lib/google/tasks-api";
import { GoogleTasksApiError } from "@/lib/google/tasks-types";
import { logger } from "@/lib/logger";
import { updateProfileStreak } from "@/lib/services/streak";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

interface RequestBody {
  listId?: string;
  profileId?: string;
}

/**
 * POST /api/tasks/[taskId]/complete
 * Marks a task as completed and updates the profile's streak
 *
 * Body:
 * - listId: Google Tasks list ID (required)
 * - profileId: Profile ID to credit streak (required)
 *
 * Returns:
 * - task: The updated task from Google Tasks API
 * - streak: Updated streak info { current, longest }
 */
export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
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

    let body: RequestBody = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is fine
    }

    const { listId, profileId } = body;

    if (!listId) {
      return NextResponse.json(
        { error: "listId is required" },
        { status: 400 }
      );
    }

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();
    const task = await patchTask(accessToken, listId, taskId, {
      status: "completed",
    });

    const streak = await updateProfileStreak(profileId);

    return NextResponse.json({ task, streak });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    if (error instanceof GoogleTasksApiError) {
      logger.error(error, {
        endpoint: "/api/tasks/[taskId]/complete",
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
        { error: "Failed to complete task" },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/tasks/[taskId]/complete",
      errorType: "complete_task",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
