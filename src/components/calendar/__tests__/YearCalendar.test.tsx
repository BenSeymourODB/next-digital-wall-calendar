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
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { YearCalendar } from "../YearCalendar";

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
    selectedDate: new Date(2026, 3, 15),
    view: "year" as TCalendarView,
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

function renderWithContext(contextOverrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(contextOverrides);
  return {
    ...render(
      <CalendarContext.Provider value={contextValue}>
        <YearCalendar />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

describe("YearCalendar", () => {
  describe("Header", () => {
    it("renders the year title for the selected date", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      expect(
        screen.getByRole("heading", { name: /2026/, level: 2 })
      ).toBeInTheDocument();
    });

    it("shows the full-year date range Jan 1 – Dec 31", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      expect(screen.getByTestId("year-calendar-date-range")).toHaveTextContent(
        "Jan 1, 2026 – Dec 31, 2026"
      );
    });

    it("displays total event count for the year", () => {
      const events = [
        createMockEvent({
          id: "e1",
          startDate: new Date(2026, 0, 5).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          startDate: new Date(2026, 5, 10).toISOString(),
        }),
        createMockEvent({
          id: "e3",
          startDate: new Date(2026, 11, 20).toISOString(),
        }),
        createMockEvent({
          id: "e-other-year",
          startDate: new Date(2025, 6, 4).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "3 events"
      );
    });

    it("uses singular 'event' for a count of 1", () => {
      const events = [
        createMockEvent({
          id: "e1",
          startDate: new Date(2026, 0, 5).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });
  });

  describe("Year navigation", () => {
    it("navigates to the previous year", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByTestId("year-calendar-prev-year"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2025);
    });

    it("navigates to the next year", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByTestId("year-calendar-next-year"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2027);
    });

    it("disables the Today button when viewing the current year", () => {
      const today = new Date();
      renderWithContext({ selectedDate: today });

      expect(screen.getByTestId("year-calendar-today-btn")).toBeDisabled();
    });

    it("enables the Today button when viewing a different year", () => {
      renderWithContext({ selectedDate: new Date(2000, 0, 1) });

      expect(screen.getByTestId("year-calendar-today-btn")).toBeEnabled();
    });

    it("jumps to today when the Today button is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2000, 0, 1),
      });

      await user.click(screen.getByTestId("year-calendar-today-btn"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(new Date().getFullYear());
    });
  });

  describe("Month grid", () => {
    it("renders all 12 months", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      monthNames.forEach((name) => {
        expect(
          screen.getByRole("button", { name: new RegExp(`^${name}$`) })
        ).toBeInTheDocument();
      });
    });

    it("renders 12 month panels with the expected test ids", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      for (let i = 0; i < 12; i++) {
        expect(
          screen.getByTestId(`year-calendar-month-${i}`)
        ).toBeInTheDocument();
      }
    });

    it("shows Sunday-first weekday labels in each month", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      const january = screen.getByTestId("year-calendar-month-0");
      const labels = within(january).getAllByTestId("year-calendar-dow-label");
      expect(labels.map((el) => el.textContent)).toEqual([
        "S",
        "M",
        "T",
        "W",
        "T",
        "F",
        "S",
      ]);
    });
  });

  describe("Event dot indicators", () => {
    it("renders a dot for a day that has an event", () => {
      const events = [
        createMockEvent({
          id: "e1",
          color: "blue",
          startDate: new Date(2026, 0, 5, 10, 0).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).getAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(1);
    });

    it("renders one dot per unique color on a day with multiple events", () => {
      const events = [
        createMockEvent({
          id: "e1",
          color: "blue",
          startDate: new Date(2026, 0, 5, 10, 0).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          color: "green",
          startDate: new Date(2026, 0, 5, 12, 0).toISOString(),
        }),
        createMockEvent({
          id: "e3",
          color: "blue",
          startDate: new Date(2026, 0, 5, 14, 0).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).getAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(2);
    });

    it("renders no dots for a day with no events", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15), events: [] });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).queryAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(0);
    });

    it("caps the visible dots at 3 per day", () => {
      const events: IEvent[] = (
        ["blue", "green", "red", "yellow", "purple"] as TEventColor[]
      ).map((color, i) =>
        createMockEvent({
          id: `e${i}`,
          color,
          startDate: new Date(2026, 0, 5, 10 + i, 0).toISOString(),
        })
      );

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).getAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(3);
    });

    it("does not count events from a different year", () => {
      const events = [
        createMockEvent({
          id: "wrong-year",
          color: "blue",
          startDate: new Date(2025, 0, 5, 10, 0).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).queryAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(0);
    });
  });

  describe("Day interaction", () => {
    it("clicking a day navigates to that date and switches to month view", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByTestId("year-calendar-day-2026-06-15"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2026);
      expect(calledWith.getMonth()).toBe(5);
      expect(calledWith.getDate()).toBe(15);

      expect(contextValue.setView).toHaveBeenCalledWith("month");
    });

    it("clicking a month name navigates to its first day in month view", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByRole("button", { name: /^September$/ }));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2026);
      expect(calledWith.getMonth()).toBe(8);
      expect(calledWith.getDate()).toBe(1);
      expect(contextValue.setView).toHaveBeenCalledWith("month");
    });

    it("highlights today when the current year is displayed", () => {
      const today = new Date();
      renderWithContext({ selectedDate: today });

      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const todayCell = screen.getByTestId(`year-calendar-day-${y}-${m}-${d}`);
      expect(todayCell).toHaveAttribute("data-today", "true");
    });
  });

  describe("Loading state", () => {
    it("shows a loading message when isLoading is true", () => {
      renderWithContext({ isLoading: true });
      expect(screen.getByText(/loading events/i)).toBeInTheDocument();
    });
  });
});
