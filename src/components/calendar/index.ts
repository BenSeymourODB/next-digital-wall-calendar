/**
 * Calendar components barrel exports
 *
 * Re-exports the public component surface and the few helpers / constants
 * that other directories already import directly. The `analog-clock`
 * sub-barrel is re-exported wholesale so a consumer importing from
 * `@/components/calendar` reaches both `AnalogClockView` (the wired-up
 * page-level component) and the underlying `AnalogClock` / `ClockFace`
 * primitives.
 */

export { AccountManager } from "./AccountManager";
export { AddEventButton } from "./AddEventButton";

export {
  AgendaCalendar,
  UNCATEGORISED_LABEL,
  groupEventsByCategory,
  groupEventsByColor,
  sortCategoryEntries,
  sortEventsByStartTime,
} from "./AgendaCalendar";

export { AgendaList } from "./AgendaList";
export type { AgendaListProps } from "./AgendaList";

export { AnalogClockView } from "./AnalogClockView";

export { AnimatedSwap } from "./animated-swap";
export type { AnimatedSwapDirection, AnimatedSwapType } from "./animated-swap";

export { filterEventsBySearch } from "./agenda-helpers";

export { CalendarFilterPanel } from "./CalendarFilterPanel";
export { CalendarSettingsPanel } from "./CalendarSettingsPanel";

export { DayCalendar } from "./DayCalendar";

export {
  DayOverflowPopover,
  EVENT_COLOR_CLASSES,
  MAX_INLINE_EVENTS,
} from "./DayOverflowPopover";

export {
  EventCreateDialog,
  resolveInitialCalendarId,
} from "./EventCreateDialog";
export type { EventCreateInput } from "./EventCreateDialog";

export { EventDetailModal } from "./EventDetailModal";
export type { EventEditPatch } from "./EventDetailModal";

export { MiniCalendarSidebar } from "./MiniCalendarSidebar";
export { SimpleCalendar } from "./SimpleCalendar";
export { ViewSwitcher } from "./ViewSwitcher";
export { WeekCalendar } from "./WeekCalendar";

export { YearCalendar, bucketEventColorsByDayKey } from "./YearCalendar";

export * from "./analog-clock";
