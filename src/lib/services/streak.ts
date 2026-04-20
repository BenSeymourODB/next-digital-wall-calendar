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
 * Reads the profile's `ProfileRewardPoints` row, computes the new
 * streak via `calculateNewStreak`, and either updates the existing row
 * or creates a fresh one if the profile has not earned points before.
 *
 * @param profileId The profile being credited.
 * @returns         The profile's new `current` and `longest` streaks.
 */
export async function updateProfileStreak(
  profileId: string
): Promise<StreakResult> {
  const rewardPoints = await prisma.profileRewardPoints.findUnique({
    where: { profileId },
  });

  if (rewardPoints) {
    const current = calculateNewStreak(
      rewardPoints.currentStreak,
      rewardPoints.lastActivityDate
    );
    const longest = Math.max(current, rewardPoints.longestStreak);

    await prisma.profileRewardPoints.update({
      where: { profileId },
      data: {
        currentStreak: current,
        longestStreak: longest,
        lastActivityDate: new Date(),
      },
    });

    return { current, longest };
  }

  await prisma.profileRewardPoints.create({
    data: {
      profileId,
      totalPoints: 0,
      currentStreak: 1,
      longestStreak: 1,
      lastActivityDate: new Date(),
    },
  });

  return { current: 1, longest: 1 };
}
