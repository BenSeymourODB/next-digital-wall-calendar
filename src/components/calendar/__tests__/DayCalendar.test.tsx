import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addDays, format, isSameDay, startOfDay, subDays } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { DayCalendar } from "../DayCalendar";

/**
 * Tests for DayCalendar component.
 *
 * Covers:
 * - Header with full date + event count
 * - Today button (disabled on current day)
 * - Previous/next day navigation
 * - Empty state and loading state
 * - All-day section + timed section ordering
 * - Chronological sorting of timed events
 * - 12-hour and 24-hour time formatting
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
    view: "day" as TCalendarView,
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
        <DayCalendar />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

function at(date: Date, hours: number, minutes = 0): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

describe("DayCalendar", () => {
  describe("Header", () => {
    it("renders the full date of the selected day", () => {
      const selectedDate = new Date(2026, 3, 15); // Apr 15 2026
      renderWithContext({ selectedDate });

      expect(screen.getByTestId("day-calendar-heading")).toHaveTextContent(
        format(selectedDate, "EEEE, MMMM d, yyyy")
      );
    });

    it("shows singular 'event' for one event", () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "e1",
            startDate: at(selectedDate, 10),
            endDate: at(selectedDate, 11),
          }),
        ],
      });
      expect(screen.getByTestId("day-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });

    it("shows plural 'events' with the correct count for the day", () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "e1",
            startDate: at(selectedDate, 9),
            endDate: at(selectedDate, 10),
          }),
          createMockEvent({
            id: "e2",
            startDate: at(selectedDate, 14),
            endDate: at(selectedDate, 15),
          }),
          createMockEvent({
            id: "off",
            startDate: at(addDays(selectedDate, 2), 10),
            endDate: at(addDays(selectedDate, 2), 11),
          }),
        ],
      });
      expect(screen.getByTestId("day-calendar-event-count")).toHaveTextContent(
        "2 events"
      );
    });
  });

  describe("Today button", () => {
    it("is disabled when the selected date is today", () => {
      renderWithContext({ selectedDate: new Date() });
      expect(screen.getByTestId("day-calendar-today-btn")).toBeDisabled();
    });

    it("is enabled and jumps back to today for a past date", async () => {
      const pastDate = subDays(new Date(), 3);
      const { contextValue } = renderWithContext({ selectedDate: pastDate });

      const btn = screen.getByTestId("day-calendar-today-btn");
      expect(btn).toBeEnabled();

      await userEvent.setup().click(btn);

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(isSameDay(called, new Date())).toBe(true);
    });
  });

  describe("Navigation", () => {
    it("navigates to previous day", async () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      const { contextValue } = renderWithContext({ selectedDate });

      await userEvent.setup().click(screen.getByTestId("day-calendar-prev"));

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(isSameDay(called, subDays(selectedDate, 1))).toBe(true);
    });

    it("navigates to next day", async () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      const { contextValue } = renderWithContext({ selectedDate });

      await userEvent.setup().click(screen.getByTestId("day-calendar-next"));

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(isSameDay(called, addDays(selectedDate, 1))).toBe(true);
    });
  });

  describe("Event rendering", () => {
    it("renders timed events in chronological order", () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "late",
            title: "Late Meeting",
            startDate: at(selectedDate, 16),
            endDate: at(selectedDate, 17),
          }),
          createMockEvent({
            id: "early",
            title: "Early Standup",
            startDate: at(selectedDate, 9),
            endDate: at(selectedDate, 9, 30),
          }),
          createMockEvent({
            id: "mid",
            title: "Lunch",
            startDate: at(selectedDate, 12),
            endDate: at(selectedDate, 13),
          }),
        ],
      });

      const titles = screen
        .getAllByTestId("day-calendar-event-title")
        .map((el) => el.textContent);

      expect(titles).toEqual(["Early Standup", "Lunch", "Late Meeting"]);
    });

    it("renders all-day events under the 'All day' section", () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "allday-1",
            title: "Holiday",
            startDate: at(selectedDate, 0),
            endDate: at(selectedDate, 0),
            isAllDay: true,
          }),
          createMockEvent({
            id: "timed-1",
            title: "Standup",
            startDate: at(selectedDate, 9),
            endDate: at(selectedDate, 9, 30),
          }),
        ],
      });

      // Section label (uppercase styled) and the event-card "All day" text
      // may both appear; assert at least one instance of each piece.
      expect(screen.getAllByText("All day").length).toBeGreaterThan(0);
      expect(screen.getByText("Holiday")).toBeInTheDocument();
      expect(screen.getByText("Standup")).toBeInTheDocument();
      // The all-day section wrapper should be present.
      expect(
        screen.getByRole("region", { name: /all day/i })
      ).toBeInTheDocument();
    });

    it("formats times in 24-hour when use24HourFormat is true", () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      renderWithContext({
        selectedDate,
        use24HourFormat: true,
        events: [
          createMockEvent({
            id: "e1",
            title: "Meeting",
            startDate: at(selectedDate, 14, 30),
            endDate: at(selectedDate, 15, 30),
          }),
        ],
      });

      expect(screen.getByText("14:30 – 15:30")).toBeInTheDocument();
    });

    it("formats times in 12-hour when use24HourFormat is false", () => {
      const selectedDate = startOfDay(new Date(2026, 3, 15));
      renderWithContext({
        selectedDate,
        use24HourFormat: false,
        events: [
          createMockEvent({
            id: "e1",
            title: "Meeting",
            startDate: at(selectedDate, 14, 30),
            endDate: at(selectedDate, 15, 30),
          }),
        ],
      });

      // date-fns uses 'h:mm a' which produces "2:30 PM" in English locale.
      expect(screen.getByText(/2:30 PM\s*[–-]\s*3:30 PM/)).toBeInTheDocument();
    });
  });

  describe("Empty and loading states", () => {
    it("shows empty state when the day has no events", () => {
      renderWithContext();
      expect(
        screen.getByText("No events scheduled for this day")
      ).toBeInTheDocument();
    });

    it("shows loading indicator when isLoading is true", () => {
      renderWithContext({ isLoading: true });
      expect(screen.getByText("Loading events...")).toBeInTheDocument();
    });

    it("does not show empty state while loading", () => {
      renderWithContext({ isLoading: true, events: [] });
      expect(
        screen.queryByText("No events scheduled for this day")
      ).not.toBeInTheDocument();
    });
  });
});
