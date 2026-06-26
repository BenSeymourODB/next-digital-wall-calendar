/**
 * Provider components barrel exports
 *
 * `MockCalendarProvider` is intentionally re-exported alongside the
 * production providers — it is consumed by `/test/calendar` fixtures
 * and by the `e2e/` Playwright specs in addition to unit tests, so it
 * is part of the public surface of this directory.
 */
export { AppInsightsProvider } from "./AppInsightsProvider";

export {
  CalendarContext,
  CalendarProvider,
  useCalendar,
} from "./CalendarProvider";
export type {
  CreateEventInput,
  EditEventInput,
  ICalendarContext,
} from "./CalendarProvider";

export { ErrorBoundary, useErrorHandler } from "./ErrorBoundary";

export { MockCalendarProvider } from "./MockCalendarProvider";

export { SessionProvider } from "./SessionProvider";

export {
  TASKS_ACTIVE_CONFIG_LS_KEY,
  TASKS_VIEW_MODE_LS_KEY,
  TasksProvider,
  useTasksContext,
} from "./TasksProvider";
export type {
  ITasksContext,
  TasksProviderProps,
  TasksViewMode,
} from "./TasksProvider";

export { ThemeProvider } from "./ThemeProvider";
