/**
 * Streak service.
 *
 * Encapsulates the "update profile streak" database flow so business
 * logic lives in one testable unit and route handlers only deal with
 * auth, validation, and response shaping.
 */
import { prisma } from "@/lib/db";
import { calculateNewStreak } from "@/lib/streak-helpers";

export interface StreakResult {
  current: number;
  longest: number;
}

/**
 * Update the streak for a profile after a task completion.
 *
 * The read-compute-write cycle runs inside a single Prisma
 * `$transaction` so concurrent completions for the same profile
 * cannot read the same `currentStreak` and stomp on each other's
 * update (classic TOCTOU on `findUnique` + `update`).
 *
 * @param profileId The profile being credited.
 * @returns         The profile's new `current` and `longest` streaks.
 */
export async function updateProfileStreak(
  profileId: string
): Promise<StreakResult> {
  return prisma.$transaction(async (tx) => {
    const rewardPoints = await tx.profileRewardPoints.findUnique({
      where: { profileId },
    });

    if (rewardPoints) {
      const current = calculateNewStreak(
        rewardPoints.currentStreak,
        rewardPoints.lastActivityDate
      );
      const longest = Math.max(current, rewardPoints.longestStreak);

      await tx.profileRewardPoints.update({
        where: { profileId },
        data: {
          currentStreak: current,
          longestStreak: longest,
          lastActivityDate: new Date(),
        },
      });

      return { current, longest };
    }

    await tx.profileRewardPoints.create({
      data: {
        profileId,
        totalPoints: 0,
        currentStreak: 1,
        longestStreak: 1,
        lastActivityDate: new Date(),
      },
    });

    return { current: 1, longest: 1 };
  });
}
