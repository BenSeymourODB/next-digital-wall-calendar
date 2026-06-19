/**
 * GET /api/points - returns the current point total for a profile.
 *
 * Query params:
 *   profileId (required) — the profile to fetch points for.
 *
 * Response:
 *   {
 *     totalPoints: number,
 *     enabled: boolean,
 *     defaultTaskPoints: number,         // points-per-task setting
 *     showPointsOnCompletion: boolean,   // whether to show the +N animation
 *   }
 *
 * `enabled` reflects the account-level `UserSettings.rewardSystemEnabled`
 * flag. When rewards are disabled the response reports `totalPoints: 0`
 * (so disabled users do not see stale point totals leaking through) and
 * still surfaces the configured `defaultTaskPoints` /
 * `showPointsOnCompletion` so the client can render preview UI.
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileId = request.nextUrl.searchParams.get("profileId");

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
        userId: session.user.id,
        isActive: true,
      },
      select: { id: true },
    });

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const settings = await prisma.userSettings.findUnique({
      where: { userId: session.user.id },
      select: {
        rewardSystemEnabled: true,
        defaultTaskPoints: true,
        showPointsOnCompletion: true,
      },
    });

    // Mirror the Prisma defaults from `UserSettings` so the response
    // shape is stable even when no settings row exists yet.
    const defaultTaskPoints = settings?.defaultTaskPoints ?? 10;
    const showPointsOnCompletion = settings?.showPointsOnCompletion ?? true;

    if (!settings?.rewardSystemEnabled) {
      return NextResponse.json({
        totalPoints: 0,
        enabled: false,
        defaultTaskPoints,
        showPointsOnCompletion,
      });
    }

    const rewardPoints = await prisma.profileRewardPoints.findUnique({
      where: { profileId },
      select: { totalPoints: true },
    });

    return NextResponse.json({
      totalPoints: rewardPoints?.totalPoints ?? 0,
      enabled: true,
      defaultTaskPoints,
      showPointsOnCompletion,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/points",
      method: "GET",
    });

    return NextResponse.json(
      { error: "Failed to fetch points" },
      { status: 500 }
    );
  }
}
