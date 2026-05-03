/**
 * Tests for /calendar page layout.
 *
 * The mini-calendar sidebar duplicates content the active view already
 * provides on month (full month grid), year (twelve-month overview), and
 * clock (built-in all-day aside), so it's hidden on those views and shown
 * on day and week. (Pre-#150 it also showed on agenda, which is now an
 * internal mode of Day/Week rather than a peer view.) See issues #146,
 * #150, #152.
 *
 * Issue #238 — the page reads `?view=...` (and `?agendaMode=true`) from
 * the URL via `useSearchParams` and forwards the values to
 * `CalendarProvider` as `initialView` / `initialAgendaMode`, so deep
 * links honour the requested view even when localStorage holds a
 * different one. Legacy `view=agenda` maps to `view=day` +
 * `agendaMode=true` (mirrors the provider's internal migration in
 * #150).
 */
import type { TCalendarView } from "@/types/calendar";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "../page";

const mockUseCalendar = vi.fn();
const calendarProviderProps = vi.fn();
const searchParamsState: { current: URLSearchParams } = {
  current: new URLSearchParams(),
};

vi.mock("next/navigation", () => ({
  useSearchParams: () => searchParamsState.current,
}));

vi.mock("@/components/providers/CalendarProvider", () => ({
  CalendarProvider: ({
    children,
    ...props
  }: {
    children: ReactNode;
    initialView?: TCalendarView;
    initialAgendaMode?: boolean;
  }) => {
    calendarProviderProps(props);
    return <>{children}</>;
  },
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
  CalendarFilterPanel: () => <div data-testid="mock-filter-panel" />,
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

function setSearchParams(query: string): void {
  searchParamsState.current = new URLSearchParams(query);
}

describe("CalendarPage — mini-calendar sidebar visibility", () => {
  afterEach(() => {
    setSearchParams("");
    calendarProviderProps.mockClear();
  });

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

  // Pre-#150 there was a separate "agenda" view that this suite asserted
  // showed the sidebar. Agenda is now an internal mode of Day/Week
  // (`agendaMode: true`) and the sidebar rule keys on the top-level view
  // only — already covered by the day/week cases above.

  it("hides the mini-calendar sidebar when the active view is year", () => {
    setView("year");
    render(<CalendarPage />);
    expect(
      screen.queryByTestId("mini-calendar-sidebar")
    ).not.toBeInTheDocument();
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

describe("CalendarPage — URL ?view= deep linking (#238)", () => {
  afterEach(() => {
    setSearchParams("");
    calendarProviderProps.mockClear();
  });

  it("forwards ?view=year to CalendarProvider as initialView=year", () => {
    setView("year");
    setSearchParams("view=year");

    render(<CalendarPage />);

    expect(calendarProviderProps).toHaveBeenCalled();
    const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
      initialView?: TCalendarView;
      initialAgendaMode?: boolean;
    };
    expect(props.initialView).toBe("year");
    expect(props.initialAgendaMode).toBeUndefined();
  });

  it.each([["day"], ["week"], ["month"], ["year"], ["clock"]] as const)(
    "forwards ?view=%s as initialView=%s",
    (view) => {
      setView(view);
      setSearchParams(`view=${view}`);

      render(<CalendarPage />);

      const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
        initialView?: TCalendarView;
      };
      expect(props.initialView).toBe(view);
    }
  );

  it("maps legacy ?view=agenda to initialView=day + initialAgendaMode=true", () => {
    setView("day");
    setSearchParams("view=agenda");

    render(<CalendarPage />);

    const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
      initialView?: TCalendarView;
      initialAgendaMode?: boolean;
    };
    expect(props.initialView).toBe("day");
    expect(props.initialAgendaMode).toBe(true);
  });

  it("forwards ?agendaMode=true alongside a non-legacy view", () => {
    setView("week");
    setSearchParams("view=week&agendaMode=true");

    render(<CalendarPage />);

    const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
      initialView?: TCalendarView;
      initialAgendaMode?: boolean;
    };
    expect(props.initialView).toBe("week");
    expect(props.initialAgendaMode).toBe(true);
  });

  it("ignores an unknown view param and leaves overrides undefined", () => {
    setView("month");
    setSearchParams("view=cosmic");

    render(<CalendarPage />);

    const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
      initialView?: TCalendarView;
      initialAgendaMode?: boolean;
    };
    expect(props.initialView).toBeUndefined();
    expect(props.initialAgendaMode).toBeUndefined();
  });

  // Regression: a stray `?agendaMode=true` without a paired `?view=` would
  // previously seed agenda-mode on top of whatever view localStorage held,
  // and the provider's mount-effect would write it through — silently
  // corrupting the persisted setting. The page must keep
  // `initialAgendaMode` undefined in that scenario so the existing
  // localStorage value is preserved.
  it("ignores ?agendaMode=true when no view param is present", () => {
    setView("month");
    setSearchParams("agendaMode=true");

    render(<CalendarPage />);

    const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
      initialView?: TCalendarView;
      initialAgendaMode?: boolean;
    };
    expect(props.initialView).toBeUndefined();
    expect(props.initialAgendaMode).toBeUndefined();
  });

  it("leaves overrides undefined when no view param is present", () => {
    setView("month");
    setSearchParams("");

    render(<CalendarPage />);

    const props = calendarProviderProps.mock.calls.at(-1)?.[0] as {
      initialView?: TCalendarView;
      initialAgendaMode?: boolean;
    };
    expect(props.initialView).toBeUndefined();
    expect(props.initialAgendaMode).toBeUndefined();
  });
});
