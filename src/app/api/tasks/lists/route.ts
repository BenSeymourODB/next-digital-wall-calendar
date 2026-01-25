/**
 * API endpoint for Google Task Lists
 * Uses server-side authentication with NextAuth.js
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

const GOOGLE_TASKS_API = "https://tasks.googleapis.com/tasks/v1";

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

    const accessToken = await getAccessToken();

    const response = await fetch(`${GOOGLE_TASKS_API}/users/@me/lists`, {
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
        { error: "Failed to fetch task lists" },
        { status: response.status }
      );
    }

    const data = await response.json();

    logger.log("Task lists fetched", {
      listCount: data.items?.length || 0,
      userId: session.user.id,
    });

    return NextResponse.json({
      lists: data.items || [],
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
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
