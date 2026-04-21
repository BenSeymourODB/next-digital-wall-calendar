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
    clearFilter: vi.fn(),
    refreshEvents: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
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

    it("shows '+X more' when a day has more than 3 events", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 1);

      const events = Array.from({ length: 5 }, (_, i) =>
        createMockEvent({
          id: `m-${i}`,
          title: `Event ${i + 1}`,
          startDate: midday(day).toISOString(),
          endDate: midday(day).toISOString(),
        })
      );

      renderWithContext({ selectedDate, events });

      expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
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
});
