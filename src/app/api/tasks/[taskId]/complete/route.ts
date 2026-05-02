/**
 * Task Complete API
 * Marks a task as completed and updates the profile's streak
 *
 * POST - Complete a task and update streak
 */
import { getAccessToken, getSession } from "@/lib/auth/helpers";
import { patchTask } from "@/lib/google/tasks-api";
import { GoogleTasksApiError } from "@/lib/google/tasks-types";
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
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json(
      { error: "Unauthorized - No access token" },
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
    return NextResponse.json({ error: "listId is required" }, { status: 400 });
  }

  if (!profileId) {
    return NextResponse.json(
      { error: "profileId is required" },
      { status: 400 }
    );
  }

  let task;
  try {
    task = await patchTask(accessToken, listId, taskId, {
      status: "completed",
    });
  } catch (error) {
    if (error instanceof GoogleTasksApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }

  const streak = await updateProfileStreak(profileId);

  return NextResponse.json({ task, streak });
}
