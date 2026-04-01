/**
 * Tests for ScreenScheduler component
 *
 * Tests rendering of children and navigation controls integration.
 */
import type { ScheduleConfig } from "@/components/scheduler/types";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ScreenScheduler } from "../screen-scheduler";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
  usePathname: () => "/calendar",
}));

const defaultConfig: ScheduleConfig = {
  sequences: [
    {
      id: "seq-1",
      name: "Main",
      enabled: true,
      screens: ["/calendar", "/recipe", "/tasks"],
      intervalSeconds: 60,
      pauseOnInteractionSeconds: 120,
    },
  ],
  timeSpecific: [],
};

const emptyConfig: ScheduleConfig = {
  sequences: [],
  timeSpecific: [],
};

describe("ScreenScheduler", () => {
  it("renders children", () => {
    render(
      <ScreenScheduler config={defaultConfig}>
        <div data-testid="child-content">Calendar Content</div>
      </ScreenScheduler>
    );

    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Calendar Content")).toBeInTheDocument();
  });

  it("renders multiple children", () => {
    render(
      <ScreenScheduler config={defaultConfig}>
        <div data-testid="child-1">First</div>
        <div data-testid="child-2">Second</div>
      </ScreenScheduler>
    );

    expect(screen.getByTestId("child-1")).toBeInTheDocument();
    expect(screen.getByTestId("child-2")).toBeInTheDocument();
  });

  it("renders navigation controls when active", () => {
    render(
      <ScreenScheduler config={defaultConfig} autoStart>
        <div>Content</div>
      </ScreenScheduler>
    );

    expect(
      screen.getByRole("navigation", { name: /screen rotation controls/i })
    ).toBeInTheDocument();
  });

  it("does not render navigation controls when no sequences enabled", () => {
    render(
      <ScreenScheduler config={emptyConfig}>
        <div>Content</div>
      </ScreenScheduler>
    );

    expect(
      screen.queryByRole("navigation", { name: /screen rotation controls/i })
    ).not.toBeInTheDocument();
  });
});
