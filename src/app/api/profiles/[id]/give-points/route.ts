/**
 * API route for awarding bonus points to a profile
 * POST /api/profiles/[id]/give-points - Admin awards points to a profile
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

/**
 * Route parameters
 */
interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Request body for giving points
 */
interface GivePointsRequest {
  points: number;
  awardedByProfileId: string;
  note?: string;
}

/**
 * POST /api/profiles/[id]/give-points - Award bonus points to a profile
 *
 * Admin-only endpoint. Requires:
 * - Valid session
 * - Admin profile (awardedByProfileId must be admin type)
 * - Target profile must exist and belong to same user
 *
 * Creates:
 * - Updates ProfileRewardPoints (or creates if doesn't exist)
 * - Creates PointTransaction record
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = (await request.json()) as GivePointsRequest;
    const { points, awardedByProfileId, note } = body;

    // Validate points
    if (!points || points <= 0) {
      return NextResponse.json(
        { error: "Invalid points value" },
        { status: 400 }
      );
    }

    // Validate awardedByProfileId
    if (!awardedByProfileId) {
      return NextResponse.json(
        { error: "Admin profile ID required" },
        { status: 400 }
      );
    }

    // Verify the awarding profile is an admin
    const awardingProfile = await prisma.profile.findFirst({
      where: {
        id: awardedByProfileId,
        userId: session.user.id,
        type: "admin",
      },
    });

    if (!awardingProfile) {
      // Check if profile exists but is not admin
      const profileExists = await prisma.profile.findFirst({
        where: {
          id: awardedByProfileId,
          userId: session.user.id,
        },
      });

      if (profileExists) {
        return NextResponse.json(
          { error: "Unauthorized - admin access required" },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Admin profile not found" },
        { status: 404 }
      );
    }

    // Verify target profile exists
    const targetProfile = await prisma.profile.findFirst({
      where: {
        id,
        userId: session.user.id,
        isActive: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Award points in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Upsert reward points (create if doesn't exist, update if exists)
      const rewardPoints = await tx.profileRewardPoints.upsert({
        where: { profileId: id },
        update: {
          totalPoints: {
            increment: points,
          },
        },
        create: {
          profileId: id,
          totalPoints: points,
        },
      });

      // Create transaction record
      await tx.pointTransaction.create({
        data: {
          profileId: id,
          points,
          reason: "manual",
          awardedBy: awardedByProfileId,
          note,
        },
      });

      return rewardPoints;
    });

    logger.event("BonusPointsAwarded", {
      profileId: id,
      awardedBy: awardedByProfileId,
      points,
      newTotal: result.totalPoints,
    });

    return NextResponse.json({
      success: true,
      newTotal: result.totalPoints,
    });
  } catch (error) {
    const { id } = await params;
    logger.error(error as Error, {
      endpoint: `/api/profiles/${id}/give-points`,
      method: "POST",
    });

    return NextResponse.json(
      { error: "Failed to award points" },
      { status: 500 }
    );
  }
}
