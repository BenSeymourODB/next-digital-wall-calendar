import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { WEEK_STARTS_ON, getShortWeekdayLabels } from "@/lib/calendar-helpers";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  addDays,
  endOfWeek,
  format,
  isSameWeek,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { WeekCalendar } from "../WeekCalendar";

/**
 * Tests for WeekCalendar component.
 *
 * Covers:
 * - Header: week range and event count
 * - Today button (enabled outside current week)
 * - Prev/next navigation
 * - 7-day grid with weekday headers and day numbers
 * - Event rendering per day, including all-day and "+X more" overflow
 * - Loading state
 */

function createMockEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "test-event-1",
    title: "Test Event",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: {
      id: "user-1",
      name: "Test User",
      picturePath: null,
    },
    ...overrides,
  };
}

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "week" as TCalendarView,
    setView: vi.fn(),
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
    events: [],
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
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

function renderWithContext(overrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(overrides);
  return {
    ...render(
      <CalendarContext.Provider value={contextValue}>
        <WeekCalendar />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

/**
 * Date at midday inside the currently-selected date's week.
 * Using midday avoids DST/timezone edge cases for the Monday/Sunday boundaries.
 */
function midday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe("WeekCalendar", () => {
  describe("Header", () => {
    it("renders a week range spanning the selected week", () => {
      const selectedDate = new Date(2026, 3, 15); // Wed Apr 15 2026
      renderWithContext({ selectedDate });

      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const weekEnd = endOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      const expected = `${format(weekStart, "MMM d, yyyy")} – ${format(weekEnd, "MMM d, yyyy")}`;
      expect(screen.getByTestId("week-calendar-range")).toHaveTextContent(
        expected
      );
    });

    it("shows event count across the week", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      const events = [
        createMockEvent({
          id: "e1",
          startDate: midday(addDays(weekStart, 0)).toISOString(),
          endDate: midday(addDays(weekStart, 0)).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          startDate: midday(addDays(weekStart, 3)).toISOString(),
          endDate: midday(addDays(weekStart, 3)).toISOString(),
        }),
        createMockEvent({
          id: "outside",
          // Event well outside the week should not count
          startDate: midday(subWeeks(weekStart, 4)).toISOString(),
          endDate: midday(subWeeks(weekStart, 4)).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate, events });

      expect(screen.getByTestId("week-calendar-event-count")).toHaveTextContent(
        "2 events"
      );
    });

    it("uses singular 'event' label for a single event", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "solo",
            startDate: midday(addDays(weekStart, 2)).toISOString(),
            endDate: midday(addDays(weekStart, 2)).toISOString(),
          }),
        ],
      });

      expect(screen.getByTestId("week-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });
  });

  describe("Today button", () => {
    it("is disabled when viewing the current week", () => {
      renderWithContext({ selectedDate: new Date() });
      expect(screen.getByTestId("week-calendar-today-btn")).toBeDisabled();
    });

    it("is enabled and calls setSelectedDate when viewing a different week", async () => {
      const pastDate = subWeeks(new Date(), 3);
      const { contextValue } = renderWithContext({ selectedDate: pastDate });

      const btn = screen.getByTestId("week-calendar-today-btn");
      expect(btn).toBeEnabled();

      await userEvent.setup().click(btn);

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(
        isSameWeek(called, new Date(), { weekStartsOn: WEEK_STARTS_ON })
      ).toBe(true);
    });
  });

  describe("Navigation", () => {
    it("navigates to previous week", async () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const { contextValue } = renderWithContext({ selectedDate });

      await userEvent.setup().click(screen.getByTestId("week-calendar-prev"));

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(
        isSameWeek(called, subWeeks(selectedDate, 1), {
          weekStartsOn: WEEK_STARTS_ON,
        })
      ).toBe(true);
    });

    it("navigates to next week", async () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const { contextValue } = renderWithContext({ selectedDate });

      await userEvent.setup().click(screen.getByTestId("week-calendar-next"));

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(
        isSameWeek(called, addDays(selectedDate, 7), {
          weekStartsOn: WEEK_STARTS_ON,
        })
      ).toBe(true);
    });
  });

  describe("Weekday grid", () => {
    it("renders 7 day columns with weekday labels in WEEK_STARTS_ON order", () => {
      renderWithContext();
      for (const label of getShortWeekdayLabels()) {
        expect(
          screen.getAllByText(label, { exact: true }).length
        ).toBeGreaterThan(0);
      }
    });

    it("highlights today's column when viewing the current week", () => {
      renderWithContext({ selectedDate: new Date() });
      const todayCell = screen.getByTestId("week-calendar-today-cell");
      expect(todayCell).toBeInTheDocument();
    });
  });

  describe("Events per day", () => {
    it("renders events on the correct day", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day2 = addDays(weekStart, 2);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "m1",
            title: "Standup",
            startDate: midday(day2).toISOString(),
            endDate: midday(day2).toISOString(),
          }),
        ],
      });

      expect(screen.getByText("Standup")).toBeInTheDocument();
    });

    it("renders all timed events on a busy day in side-by-side columns", () => {
      // Time-grid layout positions events absolutely, so there is no
      // "+X more" overflow — overlapping events stack into adjacent
      // sub-columns within the day cell. This replaces the row-list
      // overflow assertion that was removed when WeekCalendar moved
      // from a stacked list to a time grid.
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 1);

      const events = Array.from({ length: 5 }, (_, i) => {
        const start = new Date(day);
        start.setHours(10 + i, 0, 0, 0);
        const end = new Date(day);
        end.setHours(11 + i, 0, 0, 0);
        return createMockEvent({
          id: `m-${i}`,
          title: `Event ${i + 1}`,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });
      });

      renderWithContext({ selectedDate, events });

      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Event ${i}`)).toBeInTheDocument();
      }
    });

    it("shows all-day events with an 'All day' label", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "allday-1",
            title: "Holiday",
            startDate: midday(addDays(weekStart, 3)).toISOString(),
            endDate: midday(addDays(weekStart, 3)).toISOString(),
            isAllDay: true,
          }),
        ],
      });

      expect(screen.getByText("Holiday")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator when isLoading is true", () => {
      renderWithContext({ isLoading: true });
      expect(screen.getByText("Loading events...")).toBeInTheDocument();
    });
  });

  describe("Time grid", () => {
    it("positions a timed event at the correct top within its day column", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 2);
      const start = new Date(day);
      start.setHours(9, 0, 0, 0);
      const end = new Date(day);
      end.setHours(10, 0, 0, 0);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "morning",
            title: "Morning",
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }),
        ],
      });

      const event = screen.getByTestId("week-calendar-event");
      const style = event.getAttribute("style") || "";
      expect(style).toMatch(/top:\s*37\.5%/);
      expect(style).toMatch(/height:\s*4\.16/);
    });

    it("renders the now line for today", () => {
      renderWithContext({ selectedDate: new Date() });
      expect(screen.getByTestId("week-calendar-now-line")).toBeInTheDocument();
    });

    it("does not render the now line for a past or future week", () => {
      renderWithContext({ selectedDate: subWeeks(new Date(), 4) });
      expect(
        screen.queryByTestId("week-calendar-now-line")
      ).not.toBeInTheDocument();
    });
  });

  describe("Multi-day spanning bars", () => {
    it("renders a single bar for an event spanning multiple days", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "trip",
            title: "Family Trip",
            startDate: addDays(weekStart, 1).toISOString(),
            endDate: addDays(weekStart, 4).toISOString(),
          }),
        ],
      });

      const bars = screen.getAllByTestId("week-calendar-multi-day-bar");
      expect(bars).toHaveLength(1);
      expect(bars[0]).toHaveTextContent("Family Trip");
    });

    it("treats all-day events as multi-day bars", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 3);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "holiday",
            title: "Holiday",
            startDate: day.toISOString(),
            endDate: day.toISOString(),
            isAllDay: true,
          }),
        ],
      });

      const bars = screen.getAllByTestId("week-calendar-multi-day-bar");
      expect(bars).toHaveLength(1);
      expect(bars[0]).toHaveTextContent("Holiday");
    });

    it("does not render the multi-day row when no spanning events exist", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15), events: [] });
      expect(
        screen.queryByTestId("week-calendar-multi-day-row")
      ).not.toBeInTheDocument();
    });
  });
});
