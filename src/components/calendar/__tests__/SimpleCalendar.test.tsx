import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { getShortWeekdayLabels } from "@/lib/calendar-helpers";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { format, isSameMonth } from "date-fns";
import { describe, expect, it, vi } from "vitest";
import { SimpleCalendar } from "../SimpleCalendar";

/**
 * Tests for SimpleCalendar component.
 *
 * Covers:
 * - Today button rendering and behavior
 * - Event count badge
 * - Date range display
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
    view: "month" as TCalendarView,
    setView: vi.fn(),
    agendaModeGroupBy: "date",
    setAgendaModeGroupBy: vi.fn(),
    weekStartDay: 0,
    setWeekStartDay: vi.fn(),
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

function renderWithContext(contextOverrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(contextOverrides);
  return {
    ...render(
      <CalendarContext.Provider value={contextValue}>
        <SimpleCalendar />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

describe("SimpleCalendar", () => {
  describe("Today button", () => {
    it("renders a Today button with current date abbreviation", () => {
      renderWithContext();

      const todayBtn = screen.getByTestId("calendar-today-btn");
      expect(todayBtn).toBeInTheDocument();

      // Should show abbreviated month + day (e.g., "APR 1")
      const expectedText = format(new Date(), "MMM d").toUpperCase();
      expect(todayBtn).toHaveTextContent(expectedText);
    });

    it("calls setSelectedDate with today's date when clicked", async () => {
      const user = userEvent.setup();
      // Navigate to a different month so button is enabled
      const pastDate = new Date(2025, 0, 15); // January 2025
      const { contextValue } = renderWithContext({ selectedDate: pastDate });

      const todayBtn = screen.getByTestId("calendar-today-btn");
      await user.click(todayBtn);

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(isSameMonth(calledWith, new Date())).toBe(true);
    });

    it("is disabled when viewing the current month", () => {
      renderWithContext({ selectedDate: new Date() });

      const todayBtn = screen.getByTestId("calendar-today-btn");
      expect(todayBtn).toBeDisabled();
    });

    it("is enabled when viewing a different month", () => {
      const pastDate = new Date(2025, 0, 15); // January 2025
      renderWithContext({ selectedDate: pastDate });

      const todayBtn = screen.getByTestId("calendar-today-btn");
      expect(todayBtn).toBeEnabled();
    });
  });

  describe("Event count badge", () => {
    it("shows correct event count for the current month", () => {
      const now = new Date();
      const eventsThisMonth = [
        createMockEvent({
          id: "e1",
          title: "Event 1",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            5,
            10,
            0
          ).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          title: "Event 2",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            10,
            14,
            0
          ).toISOString(),
        }),
        createMockEvent({
          id: "e3",
          title: "Event 3",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            20,
            9,
            0
          ).toISOString(),
        }),
      ];

      renderWithContext({ events: eventsThisMonth });

      expect(screen.getByTestId("calendar-event-count")).toHaveTextContent(
        "3 events"
      );
    });

    it("shows '0 events' when no events in current month", () => {
      renderWithContext({ events: [] });

      expect(screen.getByTestId("calendar-event-count")).toHaveTextContent(
        "0 events"
      );
    });

    it("shows '1 event' for singular count", () => {
      const now = new Date();
      const singleEvent = [
        createMockEvent({
          id: "e1",
          title: "Solo Event",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            15,
            10,
            0
          ).toISOString(),
        }),
      ];

      renderWithContext({ events: singleEvent });

      expect(screen.getByTestId("calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });

    it("only counts events in the displayed month", () => {
      const now = new Date();
      const mixedEvents = [
        createMockEvent({
          id: "this-month",
          title: "This Month Event",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth(),
            10,
            10,
            0
          ).toISOString(),
        }),
        createMockEvent({
          id: "other-month",
          title: "Other Month Event",
          startDate: new Date(
            now.getFullYear(),
            now.getMonth() + 2,
            10,
            10,
            0
          ).toISOString(),
        }),
      ];

      renderWithContext({ events: mixedEvents });

      expect(screen.getByTestId("calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });
  });

  describe("Date range display", () => {
    it("shows the date range for the current month", () => {
      const selectedDate = new Date(2026, 3, 15); // April 2026
      renderWithContext({ selectedDate });

      expect(screen.getByTestId("calendar-date-range")).toHaveTextContent(
        "Apr 1, 2026 – Apr 30, 2026"
      );
    });
  });

  describe("Weekday headers", () => {
    it("renders weekday headers in WEEK_STARTS_ON order", () => {
      renderWithContext();
      const labels = getShortWeekdayLabels();
      const rendered = labels.map((label) => screen.getByText(label));
      // Each label should appear, in document order matching the array.
      rendered.forEach((el, i) => {
        expect(el).toBeInTheDocument();
        if (i > 0) {
          // Preceding sibling order is preserved in the grid.
          expect(
            rendered[i - 1].compareDocumentPosition(el) &
              Node.DOCUMENT_POSITION_FOLLOWING
          ).toBeTruthy();
        }
      });
    });
  });
});
