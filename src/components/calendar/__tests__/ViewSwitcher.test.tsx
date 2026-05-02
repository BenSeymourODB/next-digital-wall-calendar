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

describe("ViewSwitcher", () => {
  it("renders Month, Agenda, and Clock tabs", () => {
    renderWithContext();
    expect(screen.getByRole("tab", { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /agenda/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /clock/i })).toBeInTheDocument();
  });

  it("highlights the Clock tab when view is 'clock'", () => {
    renderWithContext({ view: "clock" });
    const clockTab = screen.getByRole("tab", { name: /clock/i });
    expect(clockTab).toHaveAttribute("data-state", "active");
  });

  it("calls setView('clock') when the Clock tab is clicked", async () => {
    const user = userEvent.setup();
    const { contextValue } = renderWithContext({ view: "month" });
    await user.click(screen.getByRole("tab", { name: /clock/i }));
    expect(contextValue.setView).toHaveBeenCalledWith("clock");
  });

  it("calls setView('month') when the Month tab is clicked from clock view", async () => {
    const user = userEvent.setup();
    const { contextValue } = renderWithContext({ view: "clock" });
    await user.click(screen.getByRole("tab", { name: /month/i }));
    expect(contextValue.setView).toHaveBeenCalledWith("month");
  });

  it("renders Month, Year and Agenda tabs", () => {
    renderWithContext();

    expect(screen.getByRole("tab", { name: /month/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /year/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /agenda/i })).toBeInTheDocument();
  });

  it("marks the current view's tab as selected", () => {
    renderWithContext({ view: "year" });

    expect(screen.getByRole("tab", { name: /year/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("calls setView with 'year' when the Year tab is clicked", async () => {
    const user = userEvent.setup();
    const { contextValue } = renderWithContext();

    await user.click(screen.getByRole("tab", { name: /year/i }));

    expect(contextValue.setView).toHaveBeenCalledWith("year");
  });
});
