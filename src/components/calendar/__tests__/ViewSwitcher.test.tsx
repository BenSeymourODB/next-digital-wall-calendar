/**
 * Tests for the post-#150 ViewSwitcher.
 *
 * The flat tab row is replaced by a row of buttons. Day and Week are now
 * dropdown triggers (Day ▾ / Week ▾) that surface "Grid" and "Agenda" as
 * sub-options matching the Windows / Teams Calendar widget UX. Month, Year,
 * and Clock stay as plain buttons.
 */
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
import { describe, expect, it, vi } from "vitest";
import { ViewSwitcher } from "../ViewSwitcher";

function createMockContext(
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
        <ViewSwitcher />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

describe("ViewSwitcher (#150)", () => {
  describe("primary buttons", () => {
    it("renders Day, Week, Month, Year, and Clock controls", () => {
      renderWithContext();
      expect(screen.getByTestId("view-switcher-day")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-week")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-month")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-year")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-clock")).toBeInTheDocument();
    });

    it("does NOT render an Agenda primary button (agenda is now a sub-mode)", () => {
      renderWithContext();
      expect(
        screen.queryByTestId("view-switcher-agenda")
      ).not.toBeInTheDocument();
    });

    it("marks the active view's button as selected via aria-pressed", () => {
      renderWithContext({ view: "year" });
      expect(screen.getByTestId("view-switcher-year")).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByTestId("view-switcher-month")).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });

    it("calls setView when a primary button is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({ view: "month" });

      await user.click(screen.getByTestId("view-switcher-clock"));
      expect(contextValue.setView).toHaveBeenCalledWith("clock");
    });
  });

  describe("Day ▾ dropdown", () => {
    it("opens a menu with Grid and Agenda options when clicked", async () => {
      const user = userEvent.setup();
      renderWithContext({ view: "day" });

      await user.click(screen.getByTestId("view-switcher-day"));

      expect(
        screen.getByRole("menuitemradio", { name: /grid/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("menuitemradio", { name: /agenda/i })
      ).toBeInTheDocument();
    });

    it("Grid is checked when day view + agendaMode=false", async () => {
      const user = userEvent.setup();
      renderWithContext({ view: "day", agendaMode: false });

      await user.click(screen.getByTestId("view-switcher-day"));
      expect(
        screen.getByRole("menuitemradio", { name: /grid/i })
      ).toHaveAttribute("aria-checked", "true");
      expect(
        screen.getByRole("menuitemradio", { name: /agenda/i })
      ).toHaveAttribute("aria-checked", "false");
    });

    it("Agenda is checked when day view + agendaMode=true", async () => {
      const user = userEvent.setup();
      renderWithContext({ view: "day", agendaMode: true });

      await user.click(screen.getByTestId("view-switcher-day"));
      expect(
        screen.getByRole("menuitemradio", { name: /agenda/i })
      ).toHaveAttribute("aria-checked", "true");
    });

    it("clicking Agenda calls setView('day') AND setAgendaMode(true)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "month",
        agendaMode: false,
      });

      await user.click(screen.getByTestId("view-switcher-day"));
      await user.click(screen.getByRole("menuitemradio", { name: /agenda/i }));

      expect(contextValue.setView).toHaveBeenCalledWith("day");
      expect(contextValue.setAgendaMode).toHaveBeenCalledWith(true);
    });

    it("clicking Grid calls setView('day') AND setAgendaMode(false)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "day",
        agendaMode: true,
      });

      await user.click(screen.getByTestId("view-switcher-day"));
      await user.click(screen.getByRole("menuitemradio", { name: /grid/i }));

      expect(contextValue.setView).toHaveBeenCalledWith("day");
      expect(contextValue.setAgendaMode).toHaveBeenCalledWith(false);
    });
  });

  describe("Week ▾ dropdown", () => {
    it("clicking Agenda calls setView('week') AND setAgendaMode(true)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "month",
        agendaMode: false,
      });

      await user.click(screen.getByTestId("view-switcher-week"));
      await user.click(screen.getByRole("menuitemradio", { name: /agenda/i }));

      expect(contextValue.setView).toHaveBeenCalledWith("week");
      expect(contextValue.setAgendaMode).toHaveBeenCalledWith(true);
    });
  });

  describe("Month / Year / Clock — no agenda menu", () => {
    it("Month is a plain button — clicking it just selects month view", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({ view: "year" });

      await user.click(screen.getByTestId("view-switcher-month"));
      expect(contextValue.setView).toHaveBeenCalledTimes(1);
      expect(contextValue.setView).toHaveBeenCalledWith("month");
      expect(
        screen.queryByRole("menuitemradio", { name: /agenda/i })
      ).not.toBeInTheDocument();
    });

    it("Year is a plain button without a dropdown", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({ view: "month" });

      await user.click(screen.getByTestId("view-switcher-year"));
      expect(contextValue.setView).toHaveBeenCalledWith("year");
      expect(
        screen.queryByRole("menuitemradio", { name: /agenda/i })
      ).not.toBeInTheDocument();
    });
  });
});
