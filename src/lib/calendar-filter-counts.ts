/**
 * Hidden-event counts for each filter dimension (issue #208 Phase 3).
 *
 * "Hidden by dimension D" means: events that pass every dimension *except*
 * D's filter, but fail D's. When a dimension has no active filter, every
 * event passes it, so its hidden count is necessarily 0 — callers can
 * use `count > 0` as the render condition for a chip.
 */
import type { IEvent, TEventColor } from "@/types/calendar";

export interface FilterDimensions {
  selectedColors: TEventColor[];
  selectedUserId: string;
  selectedCalendarIds: string[];
}

export interface HiddenEventCounts {
  color: number;
  user: number;
  calendar: number;
}

export const ZERO_HIDDEN_COUNTS: HiddenEventCounts = {
  color: 0,
  user: 0,
  calendar: 0,
};

function passesColor(event: IEvent, selected: TEventColor[]): boolean {
  return selected.length === 0 || selected.includes(event.color);
}

function passesUser(event: IEvent, selected: string): boolean {
  return selected === "all" || event.user.id === selected;
}

function passesCalendar(event: IEvent, selected: string[]): boolean {
  return selected.length === 0 || selected.includes(event.calendarId);
}

export function computeHiddenEventCounts(
  events: IEvent[],
  filters: FilterDimensions
): HiddenEventCounts {
  const { selectedColors, selectedUserId, selectedCalendarIds } = filters;

  let color = 0;
  let user = 0;
  let calendar = 0;

  for (const event of events) {
    const pColor = passesColor(event, selectedColors);
    const pUser = passesUser(event, selectedUserId);
    const pCal = passesCalendar(event, selectedCalendarIds);

    if (!pColor && pUser && pCal) color++;
    if (!pUser && pColor && pCal) user++;
    if (!pCal && pColor && pUser) calendar++;
  }

  return { color, user, calendar };
}
