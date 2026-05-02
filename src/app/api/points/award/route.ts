/**
 * POST /api/points/award - awards points to a profile.
 *
 * Body:
 *   {
 *     profileId: string;
 *     points: number;            // positive integer
 *     reason: PointAwardReason;  // e.g. "task_completed"
 *     taskId?: string;
 *     taskTitle?: string;
 *   }
 *
 * Response:
 *   { success: true, newTotal: number, alreadyAwarded: boolean }
 *
 * Reward enablement is checked at the account level
 * (`UserSettings.rewardSystemEnabled`). Points themselves are stored
 * per profile. The `alreadyAwarded` flag surfaces idempotency hits
 * driven by the `(profileId, taskId, reason)` unique index — a
 * task can only credit a profile once.
 */
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  type PointAwardReason,
  recordPointAward,
} from "@/lib/services/reward-points";
import { NextRequest, NextResponse } from "next/server";

const VALID_REASONS: ReadonlySet<PointAwardReason> = new Set([
  "task_completed",
  "manual",
  "bonus",
  "streak",
  "goal",
]);

interface AwardRequestBody {
  profileId?: string;
  points?: number;
  reason?: string;
  taskId?: string;
  taskTitle?: string;
}

function isValidReason(value: string): value is PointAwardReason {
  return VALID_REASONS.has(value as PointAwardReason);
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AwardRequestBody;
    const { profileId, points, reason, taskId, taskTitle } = body;

    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required" },
        { status: 400 }
      );
    }

    if (
      typeof points !== "number" ||
      !Number.isInteger(points) ||
      points <= 0
    ) {
      return NextResponse.json(
        { error: "Invalid points value" },
        { status: 400 }
      );
    }

    if (typeof reason !== "string" || !isValidReason(reason)) {
      return NextResponse.json({ error: "Invalid reason" }, { status: 400 });
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
      return NextResponse.json(
        { error: "Reward system not enabled" },
        { status: 403 }
      );
    }

    const result = await recordPointAward({
      profileId,
      points,
      reason,
      taskId,
      taskTitle,
    });

    logger.event("PointsAwarded", {
      userId: session.user.id,
      profileId,
      points,
      reason,
      newTotal: result.totalPoints,
      alreadyAwarded: result.alreadyAwarded,
      ...(taskId ? { taskId } : {}),
    });

    return NextResponse.json({
      success: true,
      newTotal: result.totalPoints,
      alreadyAwarded: result.alreadyAwarded,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/points/award",
      method: "POST",
    });

    return NextResponse.json(
      { error: "Failed to award points" },
      { status: 500 }
    );
  }
}
