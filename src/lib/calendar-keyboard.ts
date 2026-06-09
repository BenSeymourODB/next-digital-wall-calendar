import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  type Day,
  addDays,
  addMonths,
  addYears,
  endOfWeek,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
} from "date-fns";

/**
 * Keyboard-driven navigation actions for the month grid.
 *
 * Matches the WAI-ARIA grid pattern for date pickers:
 * https://www.w3.org/WAI/ARIA/apg/patterns/grid/#keyboardinteraction
 */
export type CalendarKeyboardAction =
  | { type: "PREVIOUS_DAY" }
  | { type: "NEXT_DAY" }
  | { type: "PREVIOUS_WEEK" }
  | { type: "NEXT_WEEK" }
  | { type: "WEEK_START" }
  | { type: "WEEK_END" }
  | { type: "PREVIOUS_MONTH" }
  | { type: "NEXT_MONTH" }
  | { type: "PREVIOUS_YEAR" }
  | { type: "NEXT_YEAR" };

type AnyKeyboardEvent = KeyboardEvent | ReactKeyboardEvent;

export function keyboardEventToAction(
  event: AnyKeyboardEvent
): CalendarKeyboardAction | null {
  switch (event.key) {
    case "ArrowLeft":
      return { type: "PREVIOUS_DAY" };
    case "ArrowRight":
      return { type: "NEXT_DAY" };
    case "ArrowUp":
      return { type: "PREVIOUS_WEEK" };
    case "ArrowDown":
      return { type: "NEXT_WEEK" };
    case "Home":
      return { type: "WEEK_START" };
    case "End":
      return { type: "WEEK_END" };
    case "PageUp":
      return event.shiftKey
        ? { type: "PREVIOUS_YEAR" }
        : { type: "PREVIOUS_MONTH" };
    case "PageDown":
      return event.shiftKey ? { type: "NEXT_YEAR" } : { type: "NEXT_MONTH" };
    default:
      return null;
  }
}

/**
 * Apply a keyboard action to the currently-focused date.
 *
 * `weekStartsOn` controls the `WEEK_START`/`WEEK_END` actions only;
 * other actions are independent of the week boundary.
 */
export function applyCalendarKeyboardAction(
  date: Date,
  action: CalendarKeyboardAction,
  weekStartsOn: Day
): Date {
  switch (action.type) {
    case "PREVIOUS_DAY":
      return subDays(date, 1);
    case "NEXT_DAY":
      return addDays(date, 1);
    case "PREVIOUS_WEEK":
      return subDays(date, 7);
    case "NEXT_WEEK":
      return addDays(date, 7);
    case "WEEK_START":
      return startOfWeek(date, { weekStartsOn });
    case "WEEK_END":
      return endOfWeek(date, { weekStartsOn });
    case "PREVIOUS_MONTH":
      return subMonths(date, 1);
    case "NEXT_MONTH":
      return addMonths(date, 1);
    case "PREVIOUS_YEAR":
      return subYears(date, 1);
    case "NEXT_YEAR":
      return addYears(date, 1);
  }
}
