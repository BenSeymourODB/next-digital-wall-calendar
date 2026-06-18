import type { CalendarTransitionSpeed } from "@/lib/calendar/transition-speed";
import type { TDateFormat } from "@/lib/format-date";
import type { TWeekStartDay } from "@/types/calendar";

/**
 * Shape of the `UserSettings` row as the settings form consumes it.
 *
 * Mirrors the columns on the Prisma `UserSettings` model that the settings
 * UI can mutate, with the narrow-union columns retyped to their
 * application-level unions (`dateFormat`, `weekStartDay`, and
 * `calendarTransitionSpeed`).
 *
 * Lives in `src/types/` because more than one module needs the shape:
 * the form renders it, and `src/lib/user-settings-bus.ts` derives the
 * bus payload from it so the bus can never silently drift from the form
 * (#419). Subscribers continue to validate individual keys at the
 * consumer boundary (`pickCalendarFields` in `useUserSettings`).
 */
export interface UserSettingsData {
  theme: string;
  timeFormat: string;
  dateFormat: TDateFormat;
  defaultZoomLevel: number;
  weekStartDay: TWeekStartDay;
  rewardSystemEnabled: boolean;
  defaultTaskPoints: number;
  showPointsOnCompletion: boolean;
  schedulerIntervalSeconds: number;
  schedulerPauseOnInteractionSeconds: number;
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
  calendarWorkingHoursStart: number;
  calendarTransitionSpeed: CalendarTransitionSpeed;
}
