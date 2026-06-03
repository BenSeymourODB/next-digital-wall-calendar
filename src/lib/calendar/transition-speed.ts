/**
 * Calendar view-transition speed setting.
 *
 * Backed by the `UserSettings.calendarTransitionSpeed` column. Consumed by
 * the `AnimatedSwap` callsites in the calendar surface (page-level fade and
 * intra-view slides) so users with motion sensitivity (or a preference for
 * snappier UI) can dial transitions back without touching system settings.
 *
 * `prefers-reduced-motion: reduce` continues to short-circuit animations
 * inside `AnimatedSwap` itself; this setting is layered on top of that.
 */

export const CALENDAR_TRANSITION_SPEEDS = [
  "off",
  "fast",
  "normal",
  "slow",
] as const;

export type CalendarTransitionSpeed =
  (typeof CALENDAR_TRANSITION_SPEEDS)[number];

export const DEFAULT_CALENDAR_TRANSITION_SPEED: CalendarTransitionSpeed =
  "normal";

// `normal` mirrors the previously hard-coded SimpleCalendar slide duration
// (300ms) so existing users see no behavioural change after the migration's
// default lands. `fast` halves it for a snappier feel; `slow` doubles it for
// users who want a more deliberate sweep on the wall display.
export const TRANSITION_SPEED_TO_MS: Record<CalendarTransitionSpeed, number> = {
  off: 0,
  fast: 150,
  normal: 300,
  slow: 600,
};

export function isCalendarTransitionSpeed(
  value: unknown
): value is CalendarTransitionSpeed {
  return (
    typeof value === "string" &&
    (CALENDAR_TRANSITION_SPEEDS as readonly string[]).includes(value)
  );
}

/**
 * Resolve a duration in milliseconds from a (possibly unknown) speed value.
 * Unknown / undefined inputs fall back to the default speed so SSR paths
 * and stale persisted values stay safe.
 */
export function resolveTransitionDurationMs(speed: unknown): number {
  if (isCalendarTransitionSpeed(speed)) {
    return TRANSITION_SPEED_TO_MS[speed];
  }
  return TRANSITION_SPEED_TO_MS[DEFAULT_CALENDAR_TRANSITION_SPEED];
}
