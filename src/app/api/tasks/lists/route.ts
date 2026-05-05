/**
 * API endpoint for Google Task Lists
 * Uses server-side authentication with NextAuth.js
 */
import {
  AuthError,
  getSession,
  requireGoogleTasksAccessToken,
} from "@/lib/auth";
import { listTaskLists } from "@/lib/google/tasks-api";
import { GoogleTasksApiError } from "@/lib/google/tasks-types";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

/**
 * GET /api/tasks/lists - List all task lists for the authenticated user
 */
export async function GET() {
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

    // Combined scope check + token decryption in a single DB call (#260).
    // Short-circuits users missing the Tasks scope (#237) without burning a
    // separate prisma.account.findMany.
    const accessToken = await requireGoogleTasksAccessToken(session.user.id);
    const lists = await listTaskLists(accessToken);

    logger.event("TaskListsFetched", {
      listCount: lists.length,
      userId: session.user.id,
    });

    return NextResponse.json({ lists });
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
        endpoint: "/api/tasks/lists",
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
        { error: "Failed to fetch task lists" },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/tasks/lists",
      errorType: "fetch_task_lists",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
