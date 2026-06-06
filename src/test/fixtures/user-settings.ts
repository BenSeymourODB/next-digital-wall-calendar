/**
 * Shared `UserSettings` test fixture.
 *
 * Before this helper, every settings test inlined the full settings shape
 * (`mockSettings`, `baseInitialSettings`, `defaultValues`, …). Adding a single
 * column to `UserSettings` meant editing each of those objects by hand, which
 * (a) produced an append-style merge conflict in every concurrent PR that
 * added a setting, and (b) let a newly-required field silently break an
 * unrelated test in a different PR (e.g. #338 vs #288 on PR #354).
 *
 * `makeUserSettings(overrides)` mirrors the existing `createMockEvent` pattern
 * in `calendar-event.ts`: one source of truth for defaults, callers override
 * only the fields under test. Adding a column to `schema.prisma` now requires
 * a single edit here — the `MockUserSettings` type is derived from the Prisma
 * row, so the factory body fails to compile until the new field's default is
 * supplied, and every consuming test inherits it for free.
 */
import type { UserSettings } from "@/generated/prisma/client";
import type { CalendarTransitionSpeed } from "@/lib/calendar/transition-speed";
import type { TWeekStartDay } from "@/types/calendar";

/**
 * The Prisma `UserSettings` row, but with the two columns that have a narrower
 * application-level contract retyped to their unions. This keeps the factory's
 * return value assignable to the narrower component prop types
 * (`UserSettingsData`, `DisplayValues`) without an `as` cast, while staying
 * structurally tied to the schema for every other field.
 */
export type MockUserSettings = Omit<
  UserSettings,
  "weekStartDay" | "calendarTransitionSpeed"
> & {
  weekStartDay: TWeekStartDay;
  calendarTransitionSpeed: CalendarTransitionSpeed;
};

/**
 * Build a `UserSettings` row for tests. Defaults mirror the `@default(...)`
 * values in `schema.prisma`; pass `overrides` for the fields under test.
 */
export function makeUserSettings(
  overrides: Partial<MockUserSettings> = {}
): MockUserSettings {
  return {
    id: "settings-1",
    userId: "test-user-123",
    defaultTaskPoints: 10,
    rewardSystemEnabled: false,
    theme: "light",
    defaultZoomLevel: 1.0,
    timeFormat: "12h",
    dateFormat: "MM/DD/YYYY",
    weekStartDay: 0,
    showPointsOnCompletion: true,
    schedulerIntervalSeconds: 10,
    schedulerPauseOnInteractionSeconds: 30,
    calendarRefreshIntervalMinutes: 15,
    calendarFetchMonthsAhead: 6,
    calendarFetchMonthsBehind: 1,
    calendarMaxEventsPerDay: 3,
    calendarWorkingHoursStart: 7,
    calendarTransitionSpeed: "normal",
    ...overrides,
  };
}
