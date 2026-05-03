import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  addDays,
  addMonths,
  addYears,
  endOfWeek,
  startOfWeek,
  subDays,
  subMonths,
  subYears,
} from "date-fns";
import { WEEK_STARTS_ON } from "./calendar-helpers";

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

export function applyCalendarKeyboardAction(
  date: Date,
  action: CalendarKeyboardAction
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
      return startOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
    case "WEEK_END":
      return endOfWeek(date, { weekStartsOn: WEEK_STARTS_ON });
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
