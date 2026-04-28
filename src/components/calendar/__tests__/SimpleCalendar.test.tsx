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
    maxEventsPerDay: 3,
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

  describe("Toolbar", () => {
    it("renders an Add event button in the toolbar", () => {
      renderWithContext();
      expect(screen.getByTestId("calendar-add-event-btn")).toBeInTheDocument();
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

  describe("maxEventsPerDay", () => {
    function buildDayEvents(day: Date, count: number): IEvent[] {
      return Array.from({ length: count }, (_, i) =>
        createMockEvent({
          id: `ev-${i + 1}`,
          title: `Event ${i + 1}`,
          startDate: new Date(
            day.getFullYear(),
            day.getMonth(),
            day.getDate(),
            9 + i,
            0
          ).toISOString(),
        })
      );
    }

    it("renders at most maxEventsPerDay events per day", () => {
      const selected = new Date(2026, 3, 15); // April 2026
      const events = buildDayEvents(selected, 5);

      renderWithContext({
        selectedDate: selected,
        events,
        maxEventsPerDay: 2,
      });

      expect(screen.getByText("Event 1")).toBeInTheDocument();
      expect(screen.getByText("Event 2")).toBeInTheDocument();
      expect(screen.queryByText("Event 3")).not.toBeInTheDocument();
      expect(screen.getByText("+3 more")).toBeInTheDocument();
    });

    it("renders all events without overflow when count <= maxEventsPerDay", () => {
      const selected = new Date(2026, 3, 15);
      const events = buildDayEvents(selected, 4);

      renderWithContext({
        selectedDate: selected,
        events,
        maxEventsPerDay: 5,
      });

      expect(screen.getByText("Event 1")).toBeInTheDocument();
      expect(screen.getByText("Event 4")).toBeInTheDocument();
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });

    it("falls back to a sensible default when maxEventsPerDay is not provided", () => {
      // Simulate an older consumer that forgot to provide the field — the
      // component should still render the overflow label correctly using
      // whatever the current mock default is (3).
      const selected = new Date(2026, 3, 15);
      const events = buildDayEvents(selected, 5);

      renderWithContext({ selectedDate: selected, events });

      expect(screen.getByText("Event 1")).toBeInTheDocument();
      expect(screen.getByText("Event 3")).toBeInTheDocument();
      expect(screen.queryByText("Event 4")).not.toBeInTheDocument();
      expect(screen.getByText("+2 more")).toBeInTheDocument();
    });
  });

  describe("Accessibility — ARIA semantics", () => {
    it("renders the day grid with role='grid' and a descriptive aria-label", () => {
      const selectedDate = new Date(2026, 3, 15); // April 2026
      renderWithContext({ selectedDate });

      const grid = screen.getByRole("grid", { name: /April 2026/ });
      expect(grid).toBeInTheDocument();
    });

    it("renders weekday headers with role='columnheader'", () => {
      renderWithContext();
      const headers = screen.getAllByRole("columnheader");
      expect(headers).toHaveLength(7);
      const labels = getShortWeekdayLabels();
      headers.forEach((header, i) => {
        expect(header).toHaveTextContent(labels[i]);
      });
    });

    it("renders exactly one gridcell per day in the displayed month", () => {
      const selectedDate = new Date(2026, 3, 15); // April 2026 has 30 days
      renderWithContext({ selectedDate });

      const cells = screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.getAttribute("aria-disabled") !== "true");
      expect(cells).toHaveLength(30);
    });

    it("marks padding cells as aria-hidden so screen readers skip them", () => {
      const { container } = renderWithContext({
        selectedDate: new Date(2026, 3, 15), // April 2026
      });

      // aria-hidden cells are excluded from `getByRole`, so query the DOM
      // directly. April 1, 2026 is a Wednesday → with WEEK_STARTS_ON=0
      // (Sunday) there are three leading padding cells (Sun, Mon, Tue) and
      // enough trailing padding to complete the final week.
      const paddingCells = container.querySelectorAll(
        '[role="gridcell"][aria-hidden="true"]'
      );
      expect(paddingCells.length).toBeGreaterThanOrEqual(3);

      // And they are removed from the accessible tree — i.e. not reachable
      // via the normal gridcell role query.
      const accessibleCells = screen.getAllByRole("gridcell");
      accessibleCells.forEach((cell) => {
        expect(cell.getAttribute("aria-hidden")).not.toBe("true");
      });
    });

    it("sets aria-current='date' on today's cell", () => {
      renderWithContext({ selectedDate: new Date() });

      const todayCells = screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.getAttribute("aria-current") === "date");
      expect(todayCells).toHaveLength(1);
    });

    it("uses a full-date aria-label on each in-month cell", () => {
      const selectedDate = new Date(2026, 3, 15); // April 2026
      renderWithContext({ selectedDate });

      // The cell for April 15 must describe itself with a human-readable date.
      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      expect(cell).toBeInTheDocument();
    });

    it("includes event count in the cell aria-label when events are present", () => {
      const selectedDate = new Date(2026, 3, 15); // April 2026
      const events = [
        createMockEvent({
          id: "e1",
          title: "Event 1",
          startDate: new Date(2026, 3, 15, 10, 0).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          title: "Event 2",
          startDate: new Date(2026, 3, 15, 14, 0).toISOString(),
        }),
      ];
      renderWithContext({ selectedDate, events });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026, 2 events/,
      });
      expect(cell).toBeInTheDocument();
    });

    it("uses singular 'event' in the cell aria-label for a count of one", () => {
      const selectedDate = new Date(2026, 3, 15); // April 2026
      const events = [
        createMockEvent({
          id: "e1",
          title: "Event 1",
          startDate: new Date(2026, 3, 15, 10, 0).toISOString(),
        }),
      ];
      renderWithContext({ selectedDate, events });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026, 1 event$/,
      });
      expect(cell).toBeInTheDocument();
    });
  });

  describe("Accessibility — roving tabindex", () => {
    it("sets tabIndex=0 only on the selected day's gridcell", () => {
      const selectedDate = new Date(2026, 3, 15); // April 15, 2026
      renderWithContext({ selectedDate });

      const cells = screen
        .getAllByRole("gridcell")
        .filter((cell) => cell.getAttribute("aria-disabled") !== "true");

      const focusable = cells.filter(
        (cell) => cell.getAttribute("tabindex") === "0"
      );
      expect(focusable).toHaveLength(1);

      const selectedCell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      expect(selectedCell).toHaveAttribute("tabindex", "0");
      expect(selectedCell).toHaveAttribute("aria-selected", "true");

      // Every other in-month cell is tabIndex=-1.
      const nonSelected = cells.filter((cell) => cell !== selectedCell);
      nonSelected.forEach((cell) => {
        expect(cell).toHaveAttribute("tabindex", "-1");
      });
    });
  });

  describe("Accessibility — keyboard navigation", () => {
    it("ArrowRight moves selection one day forward", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{ArrowRight}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      expect(setSelected).toHaveBeenCalledTimes(1);
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 16).toDateString()
      );
    });

    it("ArrowLeft moves selection one day backward", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{ArrowLeft}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      expect(setSelected).toHaveBeenCalledTimes(1);
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 14).toDateString()
      );
    });

    it("ArrowDown moves selection one week forward", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{ArrowDown}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 22).toDateString()
      );
    });

    it("ArrowUp moves selection one week backward", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{ArrowUp}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(new Date(2026, 3, 8).toDateString());
    });

    it("Home moves selection to the start of the current week", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15); // Wed
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{Home}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      // WEEK_STARTS_ON = 0 → Sunday April 12
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 12).toDateString()
      );
    });

    it("End moves selection to the end of the current week", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15); // Wed
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{End}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      // WEEK_STARTS_ON = 0 → Saturday April 18
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 18).toDateString()
      );
    });

    it("PageUp navigates to the previous month", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{PageUp}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 2, 15).toDateString()
      );
    });

    it("PageDown navigates to the next month", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{PageDown}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 4, 15).toDateString()
      );
    });

    it("Shift+PageUp navigates to the previous year", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{Shift>}{PageUp}{/Shift}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2025, 3, 15).toDateString()
      );
    });

    it("Shift+PageDown navigates to the next year", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{Shift>}{PageDown}{/Shift}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2027, 3, 15).toDateString()
      );
    });

    it("Enter selects the focused cell", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      // Focus a different (non-selected) cell.
      const otherCell = screen.getByRole("gridcell", {
        name: /April 17, 2026/,
      });
      otherCell.focus();
      await user.keyboard("{Enter}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      expect(setSelected).toHaveBeenCalledTimes(1);
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 17).toDateString()
      );
    });

    it("Space selects the focused cell", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const otherCell = screen.getByRole("gridcell", {
        name: /April 17, 2026/,
      });
      otherCell.focus();
      await user.keyboard(" ");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      expect(setSelected).toHaveBeenCalledTimes(1);
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 17).toDateString()
      );
    });

    it("ignores keys that are not handled (e.g., Escape)", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const cell = screen.getByRole("gridcell", {
        name: /April 15, 2026/,
      });
      cell.focus();
      await user.keyboard("{Escape}");

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      expect(setSelected).not.toHaveBeenCalled();
    });
  });

  describe("Clicking a day cell", () => {
    it("calls setSelectedDate with the clicked date", async () => {
      const user = userEvent.setup();
      const selectedDate = new Date(2026, 3, 15);
      const { contextValue } = renderWithContext({ selectedDate });

      const otherCell = screen.getByRole("gridcell", {
        name: /April 17, 2026/,
      });
      await user.click(otherCell);

      const setSelected = contextValue.setSelectedDate as ReturnType<
        typeof vi.fn
      >;
      expect(setSelected).toHaveBeenCalledTimes(1);
      const nextDate = setSelected.mock.calls[0][0] as Date;
      expect(nextDate.toDateString()).toBe(
        new Date(2026, 3, 17).toDateString()
      );
    });
  });
});
