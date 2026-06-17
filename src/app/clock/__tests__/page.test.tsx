/**
 * Tests for /clock standalone wall-display page (issue #398).
 *
 * The route must render only AnalogClockView inside its own
 * CalendarProvider — no ViewSwitcher, no page header, no settings or
 * account controls. AppShell-level unwrap is covered separately in
 * `app-shell.test.tsx`.
 */
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
    initialView?: string;
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

describe("ClockPage (/clock)", () => {
  it("mounts AnalogClockView inside a CalendarProvider seeded with view=clock", () => {
    render(<ClockPage />);

    expect(screen.getByTestId("mock-calendar-provider")).toBeInTheDocument();
    expect(screen.getByTestId("mock-analog-clock-view")).toBeInTheDocument();
    expect(calendarProviderProps).toHaveBeenCalledWith(
      expect.objectContaining({ initialView: "clock" })
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
    // and must not appear on /clock.
    expect(screen.queryByTestId("mock-view-switcher")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("calendar-settings-panel")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /account manager/i })
    ).not.toBeInTheDocument();
  });

  it("renders a Toaster so EventDetailModal feedback still works", () => {
    render(<ClockPage />);
    expect(screen.getByTestId("mock-toaster")).toBeInTheDocument();
  });
});
