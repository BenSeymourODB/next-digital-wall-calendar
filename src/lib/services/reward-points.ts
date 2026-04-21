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
 * Award points to a profile.
 *
 * Upserts the profile's `ProfileRewardPoints` row (creating it if it
 * doesn't yet exist) and records a matching `PointTransaction`. Both
 * writes run inside a single Prisma `$transaction` so the totals and
 * audit trail stay consistent.
 *
 * @param profileId         Recipient profile.
 * @param points            Positive integer to add.
 * @param awardedBy         Awarding admin profile id.
 * @param note              Optional free-text note on the transaction.
 * @returns                 The recipient's new `totalPoints`.
 */
export async function awardPoints(
  profileId: string,
  points: number,
  awardedBy: string,
  note?: string
): Promise<AwardPointsResult> {
  return prisma.$transaction(async (tx) => {
    const rewardPoints = await tx.profileRewardPoints.upsert({
      where: { profileId },
      update: {
        totalPoints: {
          increment: points,
        },
      },
      create: {
        profileId,
        totalPoints: points,
      },
    });

    await tx.pointTransaction.create({
      data: {
        profileId,
        points,
        reason: "manual",
        awardedBy,
        note,
      },
    });

    return { totalPoints: rewardPoints.totalPoints };
  });
}
