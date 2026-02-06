/**
 * Time Utilities for Screen Rotation Scheduler
 *
 * Provides time matching, day checking, and time formatting functions
 * used by the scheduler to determine when to navigate.
 */

/**
 * Check if the current time matches a scheduled time within a tolerance of +/- 1 minute.
 *
 * @param currentTime - The current Date object
 * @param scheduledTime - The scheduled time in "HH:MM" format
 * @returns true if the current time is within 1 minute of the scheduled time
 */
export function isTimeMatch(currentTime: Date, scheduledTime: string): boolean {
  const [scheduledHour, scheduledMinute] = scheduledTime.split(":").map(Number);

  const currentTotalMinutes =
    currentTime.getHours() * 60 + currentTime.getMinutes();
  const scheduledTotalMinutes = scheduledHour * 60 + scheduledMinute;

  const diff = Math.abs(currentTotalMinutes - scheduledTotalMinutes);

  return diff <= 1;
}

/**
 * Check if the current day of the week is in the active days list.
 *
 * @param days - Array of active day numbers (0=Sun, 6=Sat), or undefined/empty for every day
 * @param currentDay - The current day of the week (0=Sun, 6=Sat)
 * @returns true if the current day is active
 */
export function isActiveDay(
  days: number[] | undefined,
  currentDay: number
): boolean {
  if (!days || days.length === 0) {
    return true;
  }
  return days.includes(currentDay);
}

/**
 * Format a number of seconds into a human-readable remaining time string.
 *
 * @param seconds - Total seconds remaining
 * @returns Formatted string like "45s", "1m 30s", "61m 1s"
 */
export function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}m ${remainingSeconds}s`;
}
