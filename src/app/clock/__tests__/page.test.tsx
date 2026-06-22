/**
 * Tests for /clock standalone wall-display page (issue #398).
 *
 * The route must render only AnalogClockView inside its own
 * CalendarProvider — no ViewSwitcher, no page header, no settings or
 * account controls. AppShell-level unwrap is covered separately in
 * `app-shell.test.tsx`.
 *
 * The chrome components (`ViewSwitcher`, `CalendarSettingsPanel`,
 * `AccountManager`) are mocked here so the negative assertions below
 * would fail loudly if any of them were accidentally imported into the
 * page — without the mocks, importing the real components would either
 * throw under the mocked `CalendarProvider` or render their real DOM,
 * neither of which exercises a meaningful regression guard. (Surfaced
 * by PR #431 review — the prior `mock-view-switcher` / `mock-calendar-
 * settings-panel` testids never existed because the mocks were never
 * declared.)
 */
import type { TCalendarView } from "@/types/calendar";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ClockPage from "../page";

const calendarProviderProps = vi.fn();

vi.mock("@/components/providers/CalendarProvider", () => ({
  CalendarProvider: ({
    children,
    ...props
  }: {
    children: ReactNode;
    initialView?: TCalendarView;
  }) => {
    calendarProviderProps(props);
    return <div data-testid="mock-calendar-provider">{children}</div>;
  },
}));

vi.mock("@/components/calendar/AnalogClockView", () => ({
  AnalogClockView: () => <div data-testid="mock-analog-clock-view" />,
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: () => <div data-testid="mock-toaster" />,
}));

// Chrome components must NOT appear on /clock. Mock them so the
// negative assertions below have something to bind to if the page is
// accidentally regressed.
vi.mock("@/components/calendar/ViewSwitcher", () => ({
  ViewSwitcher: () => <div data-testid="mock-view-switcher" />,
}));

vi.mock("@/components/calendar/CalendarSettingsPanel", () => ({
  CalendarSettingsPanel: () => (
    <div data-testid="mock-calendar-settings-panel" />
  ),
}));

vi.mock("@/components/calendar/AccountManager", () => ({
  AccountManager: () => <div data-testid="mock-account-manager" />,
}));

describe("ClockPage (/clock)", () => {
  it("mounts AnalogClockView inside a CalendarProvider seeded with view=clock", () => {
    render(<ClockPage />);

    expect(screen.getByTestId("mock-calendar-provider")).toBeInTheDocument();
    expect(screen.getByTestId("mock-analog-clock-view")).toBeInTheDocument();
    expect(calendarProviderProps).toHaveBeenCalledWith(
      expect.objectContaining({ initialView: "clock" satisfies TCalendarView })
    );
  });

  it("does not render the /calendar page header or controls", () => {
    render(<ClockPage />);

    // Production /calendar header text — must not leak into the wall display.
    expect(screen.queryByText(/Wall Calendar/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Your family's digital calendar/i)
    ).not.toBeInTheDocument();

    // ViewSwitcher / settings / account-manager controls live on /calendar
    // and must not appear on /clock. These assertions are wired to mock
    // testids declared above so they fail loudly if any of these
    // components are accidentally imported into the page.
    expect(screen.queryByTestId("mock-view-switcher")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("mock-calendar-settings-panel")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("mock-account-manager")
    ).not.toBeInTheDocument();
  });

  it("renders a Toaster so EventDetailModal feedback still works", () => {
    render(<ClockPage />);
    expect(screen.getByTestId("mock-toaster")).toBeInTheDocument();
  });
});
