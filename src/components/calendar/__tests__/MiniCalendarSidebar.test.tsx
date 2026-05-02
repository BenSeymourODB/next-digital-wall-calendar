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
import type React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addMonths, format, isSameDay, subMonths } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiniCalendarSidebar } from "../MiniCalendarSidebar";

let mockEventSeq = 0;
function createMockEvent(overrides: Partial<IEvent> = {}): IEvent {
  mockEventSeq += 1;
  return {
    id: `test-event-${mockEventSeq}`,
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
    deleteEvent: vi.fn().mockResolvedValue(undefined),
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
  const tree = (value: ICalendarContext): React.ReactElement => (
    <CalendarContext.Provider value={value}>
      <MiniCalendarSidebar />
    </CalendarContext.Provider>
  );
  const utils = render(tree(contextValue));
  return {
    ...utils,
    contextValue,
    rerenderWithContext: (next: Partial<ICalendarContext>) =>
      utils.rerender(tree(createMockContext(next))),
  };
}

describe("MiniCalendarSidebar", () => {
  describe("Month grid", () => {
    it("renders a mini-calendar sidebar root", () => {
      renderWithContext();
      expect(screen.getByTestId("mini-calendar-sidebar")).toBeInTheDocument();
    });

    it("displays the selected date's month and year in the header", () => {
      const may2025 = new Date(2025, 4, 10);
      renderWithContext({ selectedDate: may2025 });

      const header = screen.getByTestId("mini-calendar-header");
      expect(header).toHaveTextContent("May 2025");
    });

    it("renders single-letter day-of-week headers", () => {
      renderWithContext();
      const grid = screen.getByTestId("mini-calendar-grid");
      // 7 day-of-week labels
      const labels = within(grid).getAllByTestId("mini-calendar-dow");
      expect(labels).toHaveLength(7);
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

    it("reorders day-of-week headers when weekStartDay is Monday", () => {
      renderWithContext({ weekStartDay: 1 });
      const grid = screen.getByTestId("mini-calendar-grid");
      const labels = within(grid).getAllByTestId("mini-calendar-dow");
      expect(labels.map((el) => el.textContent)).toEqual([
        "M",
        "T",
        "W",
        "T",
        "F",
        "S",
        "S",
      ]);
    });

    it("renders a day cell for each day of the month", () => {
      // February 2025 has 28 days
      const feb2025 = new Date(2025, 1, 15);
      renderWithContext({ selectedDate: feb2025 });

      const grid = screen.getByTestId("mini-calendar-grid");
      const dayCells = within(grid).getAllByTestId(/^mini-calendar-day-/);
      // Should include every day of Feb (28) plus leading/trailing padding
      const inMonth = dayCells.filter(
        (el) => el.getAttribute("data-in-month") === "true"
      );
      expect(inMonth).toHaveLength(28);
    });
  });

  describe("Today highlight", () => {
    const FIXED_TODAY = new Date(2025, 4, 15, 12, 0, 0);

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(FIXED_TODAY);
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("marks today's cell with data-today='true'", () => {
      renderWithContext({ selectedDate: FIXED_TODAY });
      const todayCell = screen.getByTestId(
        `mini-calendar-day-${format(FIXED_TODAY, "yyyy-MM-dd")}`
      );
      expect(todayCell).toHaveAttribute("data-today", "true");
    });
  });

  describe("Selected day highlight", () => {
    it("marks the selected day's cell with data-selected='true'", () => {
      const selected = new Date(2025, 4, 15);
      renderWithContext({ selectedDate: selected });

      const cell = screen.getByTestId(
        `mini-calendar-day-${format(selected, "yyyy-MM-dd")}`
      );
      expect(cell).toHaveAttribute("data-selected", "true");
    });
  });

  describe("Navigation", () => {
    it("advances the mini-calendar view month without changing selectedDate", async () => {
      const user = userEvent.setup();
      const selected = new Date(2025, 4, 15);
      const { contextValue } = renderWithContext({ selectedDate: selected });

      const nextBtn = screen.getByTestId("mini-calendar-next-month");
      await user.click(nextBtn);

      // Header moved to June 2025
      const header = screen.getByTestId("mini-calendar-header");
      expect(header).toHaveTextContent(
        format(addMonths(selected, 1), "MMMM yyyy")
      );
      // selectedDate must not have been changed by browsing months
      expect(contextValue.setSelectedDate).not.toHaveBeenCalled();
    });

    it("retreats the mini-calendar view month without changing selectedDate", async () => {
      const user = userEvent.setup();
      const selected = new Date(2025, 4, 15);
      const { contextValue } = renderWithContext({ selectedDate: selected });

      const prevBtn = screen.getByTestId("mini-calendar-prev-month");
      await user.click(prevBtn);

      const header = screen.getByTestId("mini-calendar-header");
      expect(header).toHaveTextContent(
        format(subMonths(selected, 1), "MMMM yyyy")
      );
      expect(contextValue.setSelectedDate).not.toHaveBeenCalled();
    });

    it("calls setSelectedDate when a day cell is clicked", async () => {
      const user = userEvent.setup();
      const selected = new Date(2025, 4, 15);
      const { contextValue } = renderWithContext({ selectedDate: selected });

      const target = new Date(2025, 4, 20);
      const cell = screen.getByTestId(
        `mini-calendar-day-${format(target, "yyyy-MM-dd")}`
      );
      await user.click(cell);

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(isSameDay(calledWith, target)).toBe(true);
    });

    it("auto-advances the view month when selectedDate changes externally to a different month", () => {
      // Sidebar starts in May 2025; CalendarProvider then navigates to July 10.
      const may = new Date(2025, 4, 15);
      const july = new Date(2025, 6, 10);
      const { rerenderWithContext } = renderWithContext({ selectedDate: may });

      expect(screen.getByTestId("mini-calendar-header")).toHaveTextContent(
        "May 2025"
      );

      rerenderWithContext({ selectedDate: july });

      expect(screen.getByTestId("mini-calendar-header")).toHaveTextContent(
        "July 2025"
      );
      // The newly selected day should be visible (in-month) so the highlight
      // is not orphaned outside the rendered grid.
      const julyCell = screen.getByTestId(
        `mini-calendar-day-${format(july, "yyyy-MM-dd")}`
      );
      expect(julyCell).toHaveAttribute("data-in-month", "true");
      expect(julyCell).toHaveAttribute("data-selected", "true");
    });

    it("does not change the view month when selectedDate moves within the same month", async () => {
      // User browses the sidebar to June via the chevron, then the main view
      // updates selectedDate within the originally-selected month (May). The
      // sidebar's local browsing should not be reset.
      const user = userEvent.setup();
      const may15 = new Date(2025, 4, 15);
      const may20 = new Date(2025, 4, 20);
      const { rerenderWithContext } = renderWithContext({
        selectedDate: may15,
      });

      // Browse forward to June.
      await user.click(screen.getByTestId("mini-calendar-next-month"));
      expect(screen.getByTestId("mini-calendar-header")).toHaveTextContent(
        "June 2025"
      );

      // External selectedDate update inside May (same month as the original).
      rerenderWithContext({ selectedDate: may20 });

      // The sidebar should keep its locally-browsed June view.
      expect(screen.getByTestId("mini-calendar-header")).toHaveTextContent(
        "June 2025"
      );
    });

    it("advances the view month when an out-of-month padding cell is clicked", async () => {
      // May 2025 starts Thursday May 1; grid pads with Apr 27-30.
      const user = userEvent.setup();
      const selected = new Date(2025, 4, 15);
      const { contextValue } = renderWithContext({ selectedDate: selected });

      const outOfMonthDay = new Date(2025, 3, 30); // Apr 30
      const cell = screen.getByTestId(
        `mini-calendar-day-${format(outOfMonthDay, "yyyy-MM-dd")}`
      );
      expect(cell).toHaveAttribute("data-in-month", "false");

      await user.click(cell);

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(isSameDay(calledWith, outOfMonthDay)).toBe(true);

      // Header should have flipped to April so the selection stays visible.
      expect(screen.getByTestId("mini-calendar-header")).toHaveTextContent(
        "April 2025"
      );
    });
  });

  describe("Event indicators", () => {
    it("shows a colored dot on days with events", () => {
      const anchor = new Date(2025, 4, 15);
      const eventDay = new Date(2025, 4, 20, 10, 0, 0);
      const events = [
        createMockEvent({
          id: "e1",
          startDate: eventDay.toISOString(),
          endDate: eventDay.toISOString(),
          color: "blue",
        }),
      ];
      renderWithContext({ selectedDate: anchor, events });

      const cell = screen.getByTestId(
        `mini-calendar-day-${format(eventDay, "yyyy-MM-dd")}`
      );
      const dot = within(cell).queryByTestId("mini-calendar-event-dot");
      expect(dot).toBeInTheDocument();
    });

    it("does not show an event dot on empty days", () => {
      const anchor = new Date(2025, 4, 15);
      renderWithContext({ selectedDate: anchor, events: [] });

      const emptyDay = new Date(2025, 4, 7);
      const cell = screen.getByTestId(
        `mini-calendar-day-${format(emptyDay, "yyyy-MM-dd")}`
      );
      const dot = within(cell).queryByTestId("mini-calendar-event-dot");
      expect(dot).not.toBeInTheDocument();
    });

    it("renders one dot per distinct event color on a busy day", () => {
      const anchor = new Date(2025, 4, 15);
      const eventDay = new Date(2025, 4, 20);
      const events = [
        createMockEvent({
          id: "e1",
          startDate: new Date(2025, 4, 20, 9, 0).toISOString(),
          endDate: new Date(2025, 4, 20, 10, 0).toISOString(),
          color: "blue",
        }),
        createMockEvent({
          id: "e2",
          startDate: new Date(2025, 4, 20, 11, 0).toISOString(),
          endDate: new Date(2025, 4, 20, 12, 0).toISOString(),
          color: "green",
        }),
        createMockEvent({
          id: "e3",
          startDate: new Date(2025, 4, 20, 13, 0).toISOString(),
          endDate: new Date(2025, 4, 20, 14, 0).toISOString(),
          color: "blue", // duplicate color — should NOT add a second dot
        }),
        createMockEvent({
          id: "e4",
          startDate: new Date(2025, 4, 20, 15, 0).toISOString(),
          endDate: new Date(2025, 4, 20, 16, 0).toISOString(),
          color: "red",
        }),
      ];
      renderWithContext({ selectedDate: anchor, events });

      const cell = screen.getByTestId(
        `mini-calendar-day-${format(eventDay, "yyyy-MM-dd")}`
      );
      const dots = within(cell).getAllByTestId("mini-calendar-event-dot");
      expect(dots).toHaveLength(3); // blue, green, red — duplicate blue collapsed
      // Order should follow first-occurrence in event list.
      expect(dots[0].className).toMatch(/bg-blue-500/);
      expect(dots[1].className).toMatch(/bg-green-500/);
      expect(dots[2].className).toMatch(/bg-red-500/);
    });

    it("caps dot count at 3 distinct colors per day", () => {
      const anchor = new Date(2025, 4, 15);
      const eventDay = new Date(2025, 4, 20);
      const colors: TEventColor[] = [
        "blue",
        "green",
        "red",
        "yellow",
        "purple",
      ];
      const events = colors.map((c, i) =>
        createMockEvent({
          id: `e${i}`,
          startDate: new Date(2025, 4, 20, 9 + i, 0).toISOString(),
          endDate: new Date(2025, 4, 20, 10 + i, 0).toISOString(),
          color: c,
        })
      );
      renderWithContext({ selectedDate: anchor, events });

      const cell = screen.getByTestId(
        `mini-calendar-day-${format(eventDay, "yyyy-MM-dd")}`
      );
      const dots = within(cell).getAllByTestId("mini-calendar-event-dot");
      expect(dots).toHaveLength(3);
    });

    it("shows event dots on every day spanned by a multi-day event", () => {
      const anchor = new Date(2025, 4, 15);
      const events = [
        createMockEvent({
          id: "vacation",
          startDate: new Date(2025, 4, 20, 9, 0).toISOString(),
          endDate: new Date(2025, 4, 22, 17, 0).toISOString(),
          color: "green",
        }),
      ];
      renderWithContext({ selectedDate: anchor, events });

      for (const day of [
        new Date(2025, 4, 20),
        new Date(2025, 4, 21),
        new Date(2025, 4, 22),
      ]) {
        const cell = screen.getByTestId(
          `mini-calendar-day-${format(day, "yyyy-MM-dd")}`
        );
        expect(
          within(cell).queryByTestId("mini-calendar-event-dot")
        ).toBeInTheDocument();
      }
    });
  });

  describe("Events list", () => {
    it("renders an events list for the selected date", () => {
      const selected = new Date(2025, 4, 15, 9, 0, 0);
      const events = [
        createMockEvent({
          id: "e1",
          title: "Morning Standup",
          startDate: new Date(2025, 4, 15, 9, 0).toISOString(),
          endDate: new Date(2025, 4, 15, 9, 30).toISOString(),
          color: "blue",
        }),
        createMockEvent({
          id: "e2",
          title: "Project Review",
          startDate: new Date(2025, 4, 15, 14, 0).toISOString(),
          endDate: new Date(2025, 4, 15, 15, 0).toISOString(),
          color: "green",
        }),
        // An event on another day should NOT appear in the list
        createMockEvent({
          id: "e3",
          title: "Tomorrow",
          startDate: new Date(2025, 4, 16, 9, 0).toISOString(),
          endDate: new Date(2025, 4, 16, 10, 0).toISOString(),
          color: "red",
        }),
      ];
      renderWithContext({ selectedDate: selected, events });

      const list = screen.getByTestId("mini-calendar-events-list");
      expect(within(list).getByText("Morning Standup")).toBeInTheDocument();
      expect(within(list).getByText("Project Review")).toBeInTheDocument();
      expect(within(list).queryByText("Tomorrow")).not.toBeInTheDocument();
    });

    it("renders an empty state when the selected day has no events", () => {
      const selected = new Date(2025, 4, 15);
      renderWithContext({ selectedDate: selected, events: [] });

      const list = screen.getByTestId("mini-calendar-events-list");
      expect(list).toHaveTextContent(/no events/i);
    });

    it("sorts events chronologically within the day", () => {
      const selected = new Date(2025, 4, 15);
      const events = [
        createMockEvent({
          id: "late",
          title: "Late meeting",
          startDate: new Date(2025, 4, 15, 16, 0).toISOString(),
          endDate: new Date(2025, 4, 15, 17, 0).toISOString(),
          color: "red",
        }),
        createMockEvent({
          id: "early",
          title: "Early breakfast",
          startDate: new Date(2025, 4, 15, 7, 0).toISOString(),
          endDate: new Date(2025, 4, 15, 8, 0).toISOString(),
          color: "yellow",
        }),
      ];
      renderWithContext({ selectedDate: selected, events });

      const list = screen.getByTestId("mini-calendar-events-list");
      const items = within(list).getAllByTestId(/^mini-calendar-event-/);
      expect(items[0]).toHaveTextContent("Early breakfast");
      expect(items[1]).toHaveTextContent("Late meeting");
    });

    it("formats times using the configured time format (24h)", () => {
      const selected = new Date(2025, 4, 15);
      const events = [
        createMockEvent({
          id: "e1",
          title: "Afternoon block",
          startDate: new Date(2025, 4, 15, 14, 30).toISOString(),
          endDate: new Date(2025, 4, 15, 15, 30).toISOString(),
          color: "blue",
        }),
      ];
      renderWithContext({
        selectedDate: selected,
        events,
        use24HourFormat: true,
      });

      const list = screen.getByTestId("mini-calendar-events-list");
      expect(list).toHaveTextContent("14:30");
    });

    it("formats times using the configured time format (12h)", () => {
      const selected = new Date(2025, 4, 15);
      const events = [
        createMockEvent({
          id: "e1",
          title: "Afternoon block",
          startDate: new Date(2025, 4, 15, 14, 30).toISOString(),
          endDate: new Date(2025, 4, 15, 15, 30).toISOString(),
          color: "blue",
        }),
      ];
      renderWithContext({
        selectedDate: selected,
        events,
        use24HourFormat: false,
      });

      const list = screen.getByTestId("mini-calendar-events-list");
      expect(list).toHaveTextContent(/2:30\s*PM/i);
    });

    it("shows 'All day' label for all-day events", () => {
      const selected = new Date(2025, 4, 15);
      const events = [
        createMockEvent({
          id: "e1",
          title: "Vacation day",
          startDate: new Date(2025, 4, 15, 0, 0).toISOString(),
          endDate: new Date(2025, 4, 16, 0, 0).toISOString(),
          isAllDay: true,
          color: "green",
        }),
      ];
      renderWithContext({ selectedDate: selected, events });

      const list = screen.getByTestId("mini-calendar-events-list");
      expect(list).toHaveTextContent(/all day/i);
    });
  });
});
