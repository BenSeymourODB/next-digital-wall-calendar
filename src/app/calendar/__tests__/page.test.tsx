/**
 * Tests for /calendar page layout.
 *
 * The mini-calendar sidebar is redundant on the month view (renders a mini
 * month grid next to the full month grid) and should only be shown on
 * views where it adds value: day, week, and agenda. See issue #146.
 */
import type { TCalendarView } from "@/types/calendar";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import CalendarPage from "../page";

const mockUseCalendar = vi.fn();

vi.mock("@/components/providers/CalendarProvider", () => ({
  CalendarProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useCalendar: () => mockUseCalendar(),
}));

vi.mock("@/components/calendar/AccountManager", () => ({
  AccountManager: () => <div data-testid="mock-account-manager" />,
}));

vi.mock("@/components/calendar/SimpleCalendar", () => ({
  SimpleCalendar: () => <div data-testid="mock-simple-calendar" />,
}));

vi.mock("@/components/calendar/DayCalendar", () => ({
  DayCalendar: () => <div data-testid="mock-day-calendar" />,
}));

vi.mock("@/components/calendar/WeekCalendar", () => ({
  WeekCalendar: () => <div data-testid="mock-week-calendar" />,
}));

vi.mock("@/components/calendar/YearCalendar", () => ({
  YearCalendar: () => <div data-testid="mock-year-calendar" />,
}));

vi.mock("@/components/calendar/AgendaCalendar", () => ({
  AgendaCalendar: () => <div data-testid="mock-agenda-calendar" />,
}));

vi.mock("@/components/calendar/AnalogClockView", () => ({
  AnalogClockView: () => <div data-testid="mock-analog-clock-view" />,
}));

vi.mock("@/components/calendar/MiniCalendarSidebar", () => ({
  MiniCalendarSidebar: () => <aside data-testid="mini-calendar-sidebar" />,
}));

vi.mock("@/components/calendar/ViewSwitcher", () => ({
  ViewSwitcher: () => <div data-testid="mock-view-switcher" />,
}));

vi.mock("@/components/calendar/CalendarFilterPanel", () => ({
  CalendarFilterPanel: () => <div data-testid="mock-calendar-filter-panel" />,
}));

vi.mock("@/components/theme/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="mock-theme-toggle" />,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="mock-toaster" />,
}));

function setView(view: TCalendarView): void {
  mockUseCalendar.mockReturnValue({ view });
}

describe("CalendarPage — mini-calendar sidebar visibility", () => {
  it("hides the mini-calendar sidebar when the active view is month", () => {
    setView("month");
    render(<CalendarPage />);
    expect(
      screen.queryByTestId("mini-calendar-sidebar")
    ).not.toBeInTheDocument();
  });

  it("shows the mini-calendar sidebar when the active view is day", () => {
    setView("day");
    render(<CalendarPage />);
    expect(screen.getByTestId("mini-calendar-sidebar")).toBeInTheDocument();
  });

  it("shows the mini-calendar sidebar when the active view is week", () => {
    setView("week");
    render(<CalendarPage />);
    expect(screen.getByTestId("mini-calendar-sidebar")).toBeInTheDocument();
  });

  it("shows the mini-calendar sidebar when the active view is agenda", () => {
    setView("agenda");
    render(<CalendarPage />);
    expect(screen.getByTestId("mini-calendar-sidebar")).toBeInTheDocument();
  });

  it("shows the mini-calendar sidebar when the active view is year", () => {
    setView("year");
    render(<CalendarPage />);
    expect(screen.getByTestId("mini-calendar-sidebar")).toBeInTheDocument();
  });

  it("hides the mini-calendar sidebar when the active view is clock", () => {
    setView("clock");
    render(<CalendarPage />);
    expect(
      screen.queryByTestId("mini-calendar-sidebar")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-analog-clock-view")).toBeInTheDocument();
  });
});
