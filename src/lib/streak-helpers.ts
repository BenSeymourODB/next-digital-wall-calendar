/**
 * Streak Tracking Helper Functions
 *
 * Utilities for calculating and maintaining task completion streaks.
 * A streak represents consecutive days of completing at least one task.
 */

/**
 * Gets the start of the current day (midnight) in UTC
 */
function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

/**
 * Gets the start of yesterday in UTC
 */
function getStartOfYesterday(): Date {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  yesterday.setUTCHours(0, 0, 0, 0);
  return yesterday;
}

/**
 * Gets the end of today (23:59:59.999) in UTC
 */
function getEndOfToday(): Date {
  const end = new Date();
  end.setUTCHours(23, 59, 59, 999);
  return end;
}

/**
 * Checks if a date is today or yesterday (consecutive day for streak purposes)
 *
 * @param lastActivityDate - The date of the last activity
 * @returns true if the date is today or yesterday
 */
export function isConsecutiveDay(lastActivityDate: Date): boolean {
  const lastActivity = new Date(lastActivityDate);
  const yesterday = getStartOfYesterday();
  const endOfToday = getEndOfToday();

  return lastActivity >= yesterday && lastActivity <= endOfToday;
}

/**
 * Checks if the streak should be incremented based on last activity date.
 * Returns true only if:
 * - Last activity was yesterday (not today - we already counted today)
 *
 * @param lastActivityDate - The date of the last activity
 * @returns true if streak should be incremented
 */
export function shouldIncrementStreak(lastActivityDate: Date): boolean {
  const lastActivity = new Date(lastActivityDate);
  const startOfToday = getStartOfDay(new Date());
  const yesterday = getStartOfYesterday();

  // Last activity was yesterday, and not yet today
  return lastActivity >= yesterday && lastActivity < startOfToday;
}

/**
 * Calculates the new streak value after a task completion.
 *
 * Rules:
 * - First completion ever: streak = 1
 * - Already completed today: streak unchanged
 * - Last completion was yesterday: streak + 1
 * - Last completion was more than 1 day ago: streak = 1 (reset)
 *
 * @param currentStreak - The current streak value
 * @param lastActivityDate - The date of the last task completion (null if never)
 * @returns The new streak value
 */
export function calculateNewStreak(
  currentStreak: number,
  lastActivityDate: Date | null
): number {
  // First ever completion
  if (lastActivityDate === null) {
    return 1;
  }

  const lastActivity = new Date(lastActivityDate);
  const startOfToday = getStartOfDay(new Date());
  const yesterday = getStartOfYesterday();

  // Already completed a task today - no change
  if (lastActivity >= startOfToday) {
    return currentStreak;
  }

  // Last completion was yesterday - increment streak
  if (lastActivity >= yesterday && lastActivity < startOfToday) {
    return currentStreak + 1;
  }

  // Streak is broken - reset to 1
  return 1;
}
