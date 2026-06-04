/**
 * Shared `ICalendarContext` test fixture.
 *
 * Thirteen-plus test files each hand-rolled a full `ICalendarContext` literal
 * to feed `CalendarContext.Provider`. The shapes were identical except for the
 * `view` field, so every time a method was added to the context interface
 * (e.g. `getAccessRole` for #266) the new field had to be appended to every one
 * of those literals — a single one-line API change fanning out into a dozen
 * test diffs and a merge conflict in every concurrent PR that touched a
 * calendar test. Issue #371 tracks collapsing this kind of duplication to a
 * single factory.
 *
 * `makeCalendarContext` is that single source of truth: add a context method
 * here once and every test picks up a sensible default automatically. Tests
 * pass only the fields they care about via `overrides` (the per-file wrappers
 * default `view` to the surface under test).
 */
import type { ICalendarContext } from "@/components/providers/CalendarProvider";
import type { IUser, TCalendarView, TEventColor } from "@/types/calendar";
import { vi } from "vitest";

/**
 * Build a complete `ICalendarContext` for tests. All callbacks default to
 * `vi.fn()` so callers can assert on them via the returned value; `createEvent`
 * resolves to its input and `deleteEvent` resolves to `undefined`, matching the
 * provider's optimistic-update contract. Pass `overrides` for any field the
 * test needs to pin (commonly `view`, `events`, `users`, or a specific mock).
 */
export function makeCalendarContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "month" as TCalendarView,
    setView: vi.fn(),
    agendaMode: false,
    setAgendaMode: vi.fn(),
    agendaModeGroupBy: "date",
    setAgendaModeGroupBy: vi.fn(),
    use24HourFormat: true,
    toggleTimeFormat: vi.fn(),
    weekStartDay: 0,
    setWeekStartDay: vi.fn(),
    setSelectedDate: vi.fn(),
    selectedUserId: "all",
    setSelectedUserId: vi.fn(),
    badgeVariant: "colored",
    setBadgeVariant: vi.fn(),
    selectedColors: [] as TEventColor[],
    filterEventsBySelectedColors: vi.fn(),
    filterEventsBySelectedUser: vi.fn(),
    users: [] as IUser[],
    events: [],
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    createEvent: vi.fn().mockImplementation((event) => Promise.resolve(event)),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    clearFilter: vi.fn(),
    refreshEvents: vi.fn(),
    loadEventsForYear: vi.fn(),
    getAccessRole: () => undefined,
    isLoading: false,
    isAuthenticated: true,
    maxEventsPerDay: 3,
    ...overrides,
  };
}
