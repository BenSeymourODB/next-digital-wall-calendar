/**
 * Tests for the post-#235 ViewSwitcher.
 *
 * The Day/Week controls are split buttons:
 *   ┌─────────────┬───┐
 *   │ ☐ Day · …   │ ▾ │
 *   └─────────────┴───┘
 *      primary    caret
 *
 * - Primary button (data-testid="view-switcher-day" / "view-switcher-week"):
 *     plain button that switches the view. Preserves agendaMode (global).
 * - Caret button (data-testid="view-switcher-day-mode" / "view-switcher-week-mode"):
 *     DropdownMenu trigger that surfaces "Grid" / "Agenda" radio items.
 *     Picking one commits both setView(view) and setAgendaMode(mode === "agenda").
 *
 * Month / Year / Clock stay as plain primary buttons. Agenda is not a
 * primary button — it is a sub-mode of Day/Week.
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

describe("ViewSwitcher (#235 split-button affordance)", () => {
  describe("primary buttons", () => {
    it("renders Day, Week, Month, Year, and Clock primary controls", () => {
      renderWithContext();
      expect(screen.getByTestId("view-switcher-day")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-week")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-month")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-year")).toBeInTheDocument();
      expect(screen.getByTestId("view-switcher-clock")).toBeInTheDocument();
    });

    it("does NOT render an Agenda primary button (agenda is a sub-mode)", () => {
      renderWithContext();
      expect(
        screen.queryByTestId("view-switcher-agenda")
      ).not.toBeInTheDocument();
    });

    it("marks the active view's primary button as selected via aria-pressed", () => {
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

    it("calls setView when a Month/Year/Clock primary button is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({ view: "month" });

      await user.click(screen.getByTestId("view-switcher-clock"));
      expect(contextValue.setView).toHaveBeenCalledWith("clock");
    });
  });

  describe("Day primary button (split-button affordance)", () => {
    it("clicking the primary Day button switches view without opening a menu", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "month",
        agendaMode: false,
      });

      await user.click(screen.getByTestId("view-switcher-day"));

      expect(contextValue.setView).toHaveBeenCalledWith("day");
      // No agenda menu opens from the primary button.
      expect(
        screen.queryByRole("menuitemradio", { name: /grid/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("menuitemradio", { name: /agenda/i })
      ).not.toBeInTheDocument();
    });

    it("primary Day button does not advertise a popup (no aria-haspopup)", () => {
      renderWithContext();
      expect(screen.getByTestId("view-switcher-day")).not.toHaveAttribute(
        "aria-haspopup"
      );
    });

    it("primary Day click preserves the current agendaMode (does not reset it)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "week",
        agendaMode: true,
      });

      await user.click(screen.getByTestId("view-switcher-day"));

      expect(contextValue.setView).toHaveBeenCalledWith("day");
      // The primary button is intentionally a pure setView — agendaMode is
      // global and should not be reset by a view switch.
      expect(contextValue.setAgendaMode).not.toHaveBeenCalled();
    });

    it("reflects the active sub-mode in the primary label (Day · Agenda)", () => {
      renderWithContext({ view: "day", agendaMode: true });
      expect(screen.getByTestId("view-switcher-day")).toHaveTextContent(
        /Day · Agenda/
      );
    });

    it("shows just the bare label when the view is not active", () => {
      renderWithContext({ view: "month", agendaMode: true });
      expect(screen.getByTestId("view-switcher-day")).toHaveTextContent(
        /^Day$/
      );
    });
  });

  describe("Day caret button (mode dropdown)", () => {
    it("renders a separate caret with view-switcher-day-mode test id", () => {
      renderWithContext();
      expect(screen.getByTestId("view-switcher-day-mode")).toBeInTheDocument();
    });

    it("caret advertises a popup via aria-haspopup=menu", () => {
      renderWithContext();
      const caret = screen.getByTestId("view-switcher-day-mode");
      expect(caret).toHaveAttribute("aria-haspopup", "menu");
    });

    it("caret has an accessible label describing its purpose", () => {
      renderWithContext();
      const caret = screen.getByTestId("view-switcher-day-mode");
      expect(caret).toHaveAccessibleName(/day display mode/i);
    });

    it("clicking the caret opens a menu with Grid and Agenda options", async () => {
      const user = userEvent.setup();
      renderWithContext({ view: "day" });

      await user.click(screen.getByTestId("view-switcher-day-mode"));

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

      await user.click(screen.getByTestId("view-switcher-day-mode"));
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

      await user.click(screen.getByTestId("view-switcher-day-mode"));
      expect(
        screen.getByRole("menuitemradio", { name: /agenda/i })
      ).toHaveAttribute("aria-checked", "true");
    });

    it("clicking Agenda from caret menu calls setView('day') AND setAgendaMode(true)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "month",
        agendaMode: false,
      });

      await user.click(screen.getByTestId("view-switcher-day-mode"));
      await user.click(screen.getByRole("menuitemradio", { name: /agenda/i }));

      expect(contextValue.setView).toHaveBeenCalledWith("day");
      expect(contextValue.setAgendaMode).toHaveBeenCalledWith(true);
    });

    it("clicking Grid from caret menu calls setView('day') AND setAgendaMode(false)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "day",
        agendaMode: true,
      });

      await user.click(screen.getByTestId("view-switcher-day-mode"));
      await user.click(screen.getByRole("menuitemradio", { name: /grid/i }));

      expect(contextValue.setView).toHaveBeenCalledWith("day");
      expect(contextValue.setAgendaMode).toHaveBeenCalledWith(false);
    });
  });

  describe("Week primary + caret", () => {
    it("clicking primary Week switches to week view without opening a menu", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({ view: "month" });

      await user.click(screen.getByTestId("view-switcher-week"));

      expect(contextValue.setView).toHaveBeenCalledWith("week");
      expect(
        screen.queryByRole("menuitemradio", { name: /grid/i })
      ).not.toBeInTheDocument();
    });

    it("primary Week click preserves agendaMode", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "day",
        agendaMode: true,
      });

      await user.click(screen.getByTestId("view-switcher-week"));

      expect(contextValue.setView).toHaveBeenCalledWith("week");
      expect(contextValue.setAgendaMode).not.toHaveBeenCalled();
    });

    it("Week caret opens a menu and Agenda commits both view and mode", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        view: "month",
        agendaMode: false,
      });

      await user.click(screen.getByTestId("view-switcher-week-mode"));
      await user.click(screen.getByRole("menuitemradio", { name: /agenda/i }));

      expect(contextValue.setView).toHaveBeenCalledWith("week");
      expect(contextValue.setAgendaMode).toHaveBeenCalledWith(true);
    });

    it("Week caret has aria-haspopup=menu and an accessible label", () => {
      renderWithContext();
      const caret = screen.getByTestId("view-switcher-week-mode");
      expect(caret).toHaveAttribute("aria-haspopup", "menu");
      expect(caret).toHaveAccessibleName(/week display mode/i);
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

    it("Month/Year/Clock primary buttons do not advertise a popup", () => {
      renderWithContext();
      for (const id of [
        "view-switcher-month",
        "view-switcher-year",
        "view-switcher-clock",
      ]) {
        expect(screen.getByTestId(id)).not.toHaveAttribute("aria-haspopup");
      }
    });
  });
});
