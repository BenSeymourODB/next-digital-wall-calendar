/**
 * Time Utilities for Screen Rotation Scheduler
 *
 * Provides time matching, day checking, and time formatting functions
 * used by the scheduler to determine when to navigate.
 */

/** Seconds in a minute / minutes in an hour — used for HH:MM <-> total math. */
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
/** Minutes in a full day (24 * 60), used to wrap clock-time differences. */
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;

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
    currentTime.getHours() * MINUTES_PER_HOUR + currentTime.getMinutes();
  const scheduledTotalMinutes =
    scheduledHour * MINUTES_PER_HOUR + scheduledMinute;

  const diff = Math.abs(currentTotalMinutes - scheduledTotalMinutes);
  const wrappedDiff = Math.min(diff, MINUTES_PER_DAY - diff);

  return wrappedDiff <= 1;
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
  if (seconds < SECONDS_PER_MINUTE) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const remainingSeconds = seconds % SECONDS_PER_MINUTE;

  return `${minutes}m ${remainingSeconds}s`;
}
