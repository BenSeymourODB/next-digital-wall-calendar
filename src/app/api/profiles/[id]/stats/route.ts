/**
 * API route for profile statistics
 * GET /api/profiles/[id]/stats - Get statistics for a specific profile
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * Profile stats response
 */
interface ProfileStats {
  profileId: string;
  totalPoints: number;
  currentStreak: number;
  tasksToday: number;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number;
  rank: number;
}

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/profiles/[id]/stats - Get profile statistics
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const profile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
      },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Calculate rank among all family profiles
    const allProfiles = await prisma.profile.findMany({
      where: {
        userId: session.user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
      },
    });

    // Sort profiles by total points (descending) to calculate rank
    const profilePoints = profile.rewardPoints?.totalPoints ?? 0;
    const sortedPoints = allProfiles
      .map((p) => p.rewardPoints?.totalPoints ?? 0)
      .sort((a, b) => b - a);

    // Find rank (1-based, handles ties by giving same rank)
    const rank =
      sortedPoints.findIndex((points) => points <= profilePoints) + 1;

    // Build stats response
    // Note: tasksToday, tasksCompleted, tasksTotal, completionRate
    // are placeholders until Google Tasks integration is implemented
    const stats: ProfileStats = {
      profileId: profile.id,
      totalPoints: profilePoints,
      currentStreak: profile.rewardPoints?.currentStreak ?? 0,
      tasksToday: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      completionRate: 0,
      rank,
    };

    return NextResponse.json(stats);
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}/stats`,
      method: "GET",
    });

    return NextResponse.json(
      { error: "Failed to fetch profile stats" },
      { status: 500 }
    );
  }
}
