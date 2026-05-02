/**
 * Reward-points service.
 *
 * Encapsulates the "award points" transaction so business logic lives in
 * one testable unit and route handlers only deal with auth, validation,
 * and response shaping.
 */
import { prisma } from "@/lib/db";

export interface AwardPointsResult {
  totalPoints: number;
}

/**
 * Reasons we recognise for a point award. Mirrors the free-text values
 * stored on `PointTransaction.reason`.
 */
export type PointAwardReason =
  | "task_completed"
  | "manual"
  | "bonus"
  | "streak"
  | "goal";

export interface PointAwardInput {
  profileId: string;
  points: number;
  reason: PointAwardReason;
  taskId?: string;
  taskTitle?: string;
  awardedBy?: string;
  note?: string;
}

export interface PointAwardResult {
  totalPoints: number;
  alreadyAwarded: boolean;
}

/**
 * Award points to a profile (manual admin path).
 *
 * Thin wrapper around {@link recordPointAward} kept for the existing
 * admin "give points" route signature. New callers should prefer
 * `recordPointAward` directly.
 */
export async function awardPoints(
  profileId: string,
  points: number,
  awardedBy: string,
  note?: string
): Promise<AwardPointsResult> {
  const result = await recordPointAward({
    profileId,
    points,
    reason: "manual",
    awardedBy,
    note,
  });
  return { totalPoints: result.totalPoints };
}

/**
 * Generalised point-award entry-point that handles both manual admin
 * awards and automated rewards (task completion, streaks, etc).
 *
 * Upserts `ProfileRewardPoints` and inserts a matching
 * `PointTransaction` inside a single Prisma `$transaction`.
 *
 * For `task_completed` awards a unique `(profileId, taskId, reason)`
 * index in the database makes the operation idempotent: completing the
 * same task twice will not double-credit the profile. When that index
 * fires we surface the no-op via `alreadyAwarded: true` and return the
 * profile's current total so callers can stay in sync without an extra
 * round trip.
 */
export async function recordPointAward(
  input: PointAwardInput
): Promise<PointAwardResult> {
  try {
    const rewardPoints = await prisma.$transaction(async (tx) => {
      const updated = await tx.profileRewardPoints.upsert({
        where: { profileId: input.profileId },
        update: {
          totalPoints: {
            increment: input.points,
          },
        },
        create: {
          profileId: input.profileId,
          totalPoints: input.points,
        },
      });

      await tx.pointTransaction.create({
        data: {
          profileId: input.profileId,
          points: input.points,
          reason: input.reason,
          taskId: input.taskId,
          taskTitle: input.taskTitle,
          awardedBy: input.awardedBy,
          note: input.note,
        },
      });

      return updated;
    });

    return { totalPoints: rewardPoints.totalPoints, alreadyAwarded: false };
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const existing = await prisma.profileRewardPoints.findUnique({
        where: { profileId: input.profileId },
        select: { totalPoints: true },
      });
      return {
        totalPoints: existing?.totalPoints ?? 0,
        alreadyAwarded: true,
      };
    }
    throw error;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
