/**
 * GET /api/points - returns the current point total for a profile.
 *
 * Query params:
 *   profileId (required) — the profile to fetch points for.
 *
 * Response:
 *   { totalPoints: number, enabled: boolean }
 *
 * `enabled` reflects the account-level `UserSettings.rewardSystemEnabled`
 * flag. When rewards are disabled the response always reports
 * `totalPoints: 0` so disabled users do not see stale point totals.
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
      select: { rewardSystemEnabled: true },
    });

    if (!settings?.rewardSystemEnabled) {
      return NextResponse.json({ totalPoints: 0, enabled: false });
    }

    const rewardPoints = await prisma.profileRewardPoints.findUnique({
      where: { profileId },
      select: { totalPoints: true },
    });

    return NextResponse.json({
      totalPoints: rewardPoints?.totalPoints ?? 0,
      enabled: true,
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
