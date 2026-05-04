/**
 * Midnight rollover integration tests.
 *
 * Wall-display correctness: when a user leaves the calendar open across
 * midnight, every today-aware affordance must update without requiring
 * a manual refresh. These tests render each consumer of the shared
 * `useDateNow` hook with `vi.useFakeTimers()`, advance the wall clock
 * past local midnight, and assert the today-highlight / button enabled
 * state moves to the new day.
 */
import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { __resetUseDateNowForTests } from "@/lib/hooks/use-date-now";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { act, render, screen } from "@testing-library/react";
import { addDays, format, startOfDay } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalogClockView } from "../AnalogClockView";
import { DayCalendar } from "../DayCalendar";
import { MiniCalendarSidebar } from "../MiniCalendarSidebar";
import { SimpleCalendar } from "../SimpleCalendar";
import { WeekCalendar } from "../WeekCalendar";
import { YearCalendar } from "../YearCalendar";

function makeContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "day" as TCalendarView,
    setView: vi.fn(),
    agendaMode: false,
    setAgendaMode: vi.fn(),
    agendaModeGroupBy: "date",
    setAgendaModeGroupBy: vi.fn(),
    use24HourFormat: true,
    toggleTimeFormat: vi.fn(),
    setSelectedDate: vi.fn(),
    selectedUserId: "all",
    setSelectedUserId: vi.fn(),
    badgeVariant: "colored",
    setBadgeVariant: vi.fn(),
    selectedColors: [] as TEventColor[],
    filterEventsBySelectedColors: vi.fn(),
    filterEventsBySelectedUser: vi.fn(),
    users: [] as IUser[],
    events: [] as IEvent[],
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    createEvent: vi.fn(),
    deleteEvent: vi.fn(),
    clearFilter: vi.fn(),
    refreshEvents: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
    maxEventsPerDay: 3,
    weekStartDay: 0,
    setWeekStartDay: vi.fn(),
    ...overrides,
  };
}

function renderWithContext(
  ui: React.ReactNode,
  ctx: Partial<ICalendarContext> = {}
) {
  return render(
    <CalendarContext.Provider value={makeContext(ctx)}>
      {ui}
    </CalendarContext.Provider>
  );
}

const BEFORE_MIDNIGHT = new Date(2026, 4, 2, 23, 50, 0); // May 2 23:50
const NEXT_DAY = startOfDay(addDays(BEFORE_MIDNIGHT, 1)); // May 3 00:00
const ADVANCE_PAST_MIDNIGHT_MS = 11 * 60 * 1000;

describe("midnight rollover wiring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(BEFORE_MIDNIGHT);
    __resetUseDateNowForTests();
  });

  afterEach(() => {
    __resetUseDateNowForTests();
    vi.useRealTimers();
  });

  it("DayCalendar: Today button disables for the new day after midnight", () => {
    renderWithContext(<DayCalendar />, { selectedDate: NEXT_DAY });

    expect(screen.getByTestId("day-calendar-today-btn")).not.toBeDisabled();

    act(() => {
      vi.setSystemTime(NEXT_DAY);
      vi.advanceTimersByTime(ADVANCE_PAST_MIDNIGHT_MS);
    });

    expect(screen.getByTestId("day-calendar-today-btn")).toBeDisabled();
  });

  it("WeekCalendar: today-cell flag follows the wall-clock day", () => {
    // Selected date is on the wall-clock 'next day' so the cell flips on
    // tick. We rely on data-testid for today-cell which is unique when
    // present.
    renderWithContext(<WeekCalendar />, { selectedDate: NEXT_DAY });
    expect(
      document.querySelector('[data-testid="week-calendar-today-cell"]')
    ).toBeNull();

    act(() => {
      vi.setSystemTime(NEXT_DAY);
      vi.advanceTimersByTime(ADVANCE_PAST_MIDNIGHT_MS);
    });

    expect(
      document.querySelector('[data-testid="week-calendar-today-cell"]')
    ).not.toBeNull();
  });

  it("YearCalendar: data-today flips to the new day after midnight", () => {
    renderWithContext(<YearCalendar />, { selectedDate: NEXT_DAY });

    const beforeKey = format(BEFORE_MIDNIGHT, "yyyy-MM-dd");
    const afterKey = format(NEXT_DAY, "yyyy-MM-dd");
    expect(
      screen.getByTestId(`year-calendar-day-${beforeKey}`)
    ).toHaveAttribute("data-today", "true");
    expect(screen.getByTestId(`year-calendar-day-${afterKey}`)).toHaveAttribute(
      "data-today",
      "false"
    );

    act(() => {
      vi.setSystemTime(NEXT_DAY);
      vi.advanceTimersByTime(ADVANCE_PAST_MIDNIGHT_MS);
    });

    expect(
      screen.getByTestId(`year-calendar-day-${beforeKey}`)
    ).toHaveAttribute("data-today", "false");
    expect(screen.getByTestId(`year-calendar-day-${afterKey}`)).toHaveAttribute(
      "data-today",
      "true"
    );
  });

  it("MiniCalendarSidebar: data-today flips to the new day after midnight", () => {
    renderWithContext(<MiniCalendarSidebar />, { selectedDate: NEXT_DAY });

    // Exact-match on the rendered day-of-month so a fixture change to
    // overlapping numerals (e.g. 1 vs 21) cannot mask a wiring break.
    const todayBefore = document.querySelector('[data-today="true"]');
    expect(todayBefore?.textContent?.trim()).toBe(
      String(BEFORE_MIDNIGHT.getDate())
    );

    act(() => {
      vi.setSystemTime(NEXT_DAY);
      vi.advanceTimersByTime(ADVANCE_PAST_MIDNIGHT_MS);
    });

    const todayAfter = document.querySelector('[data-today="true"]');
    expect(todayAfter?.textContent?.trim()).toBe(String(NEXT_DAY.getDate()));
  });

  it("SimpleCalendar: today-cell aria-current follows the wall-clock day", () => {
    renderWithContext(<SimpleCalendar />, { selectedDate: NEXT_DAY });

    const beforeCell = document.querySelector(
      `[data-date="${format(BEFORE_MIDNIGHT, "yyyy-MM-dd")}"]`
    );
    expect(beforeCell?.getAttribute("aria-current")).toBe("date");

    act(() => {
      vi.setSystemTime(NEXT_DAY);
      vi.advanceTimersByTime(ADVANCE_PAST_MIDNIGHT_MS);
    });

    const afterCell = document.querySelector(
      `[data-date="${format(NEXT_DAY, "yyyy-MM-dd")}"]`
    );
    expect(afterCell?.getAttribute("aria-current")).toBe("date");
    // The previous day no longer carries the today marker.
    const previousCell = document.querySelector(
      `[data-date="${format(BEFORE_MIDNIGHT, "yyyy-MM-dd")}"]`
    );
    expect(previousCell?.getAttribute("aria-current")).not.toBe("date");
  });

  it("AnalogClockView: heading flips to the new day's label after midnight", () => {
    renderWithContext(<AnalogClockView />);

    const aside = screen.getByTestId("analog-clock-all-day-aside");
    expect(aside.textContent).toContain(format(BEFORE_MIDNIGHT, "EEE, MMM d"));

    act(() => {
      vi.setSystemTime(NEXT_DAY);
      vi.advanceTimersByTime(ADVANCE_PAST_MIDNIGHT_MS);
    });

    expect(aside.textContent).toContain(format(NEXT_DAY, "EEE, MMM d"));
  });
});
