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

    // Build stats response
    // Note: tasksToday, tasksCompleted, tasksTotal, completionRate, and rank
    // are placeholders until Google Tasks integration is implemented
    const stats: ProfileStats = {
      profileId: profile.id,
      totalPoints: profile.rewardPoints?.totalPoints ?? 0,
      currentStreak: profile.rewardPoints?.currentStreak ?? 0,
      tasksToday: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      completionRate: 0,
      rank: 1,
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
