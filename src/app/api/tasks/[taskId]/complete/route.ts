/**
 * Task Complete API
 * Marks a task as completed and updates the profile's streak
 *
 * POST - Complete a task and update streak
 */
import { getAccessToken, getSession } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db";
import { calculateNewStreak } from "@/lib/streak-helpers";
import { NextRequest, NextResponse } from "next/server";

interface RouteContext {
  params: Promise<{ taskId: string }>;
}

interface GoogleTask {
  id: string;
  title: string;
  status: "needsAction" | "completed";
  updated?: string;
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

  // Mark task as completed in Google Tasks API
  const googleResponse = await fetch(
    `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks/${taskId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "completed" }),
    }
  );

  if (!googleResponse.ok) {
    const error = await googleResponse.json();
    return NextResponse.json(
      { error: error.error?.message || "Failed to complete task" },
      { status: googleResponse.status }
    );
  }

  const task = (await googleResponse.json()) as GoogleTask;

  // Update streak for the profile
  const rewardPoints = await prisma.profileRewardPoints.findUnique({
    where: { profileId },
  });

  let newStreak: number;
  let newLongestStreak: number;

  if (rewardPoints) {
    newStreak = calculateNewStreak(
      rewardPoints.currentStreak,
      rewardPoints.lastActivityDate
    );
    newLongestStreak = Math.max(newStreak, rewardPoints.longestStreak);

    await prisma.profileRewardPoints.update({
      where: { profileId },
      data: {
        currentStreak: newStreak,
        longestStreak: newLongestStreak,
        lastActivityDate: new Date(),
      },
    });
  } else {
    // Create reward points record if it doesn't exist
    newStreak = 1;
    newLongestStreak = 1;

    await prisma.profileRewardPoints.create({
      data: {
        profileId,
        totalPoints: 0,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
      },
    });
  }

  return NextResponse.json({
    task,
    streak: {
      current: newStreak,
      longest: newLongestStreak,
    },
  });
}
