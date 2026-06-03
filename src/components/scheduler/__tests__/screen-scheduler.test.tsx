/**
 * Tests for ScreenScheduler component
 *
 * Tests rendering of children and navigation controls integration.
 */
import type { ScheduleConfig } from "@/components/scheduler/types";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("renders status indicator when scheduler is active", () => {
    render(
      <ScreenScheduler config={defaultConfig} autoStart>
        <div>Content</div>
      </ScreenScheduler>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("does not render status indicator when scheduler is inactive", () => {
    render(
      <ScreenScheduler config={emptyConfig}>
        <div>Content</div>
      </ScreenScheduler>
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("wraps children with screen transition component", () => {
    render(
      <ScreenScheduler config={defaultConfig}>
        <div data-testid="child-content">Calendar Content</div>
      </ScreenScheduler>
    );

    expect(screen.getByTestId("screen-transition")).toBeInTheDocument();
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
  });

  // Regression test for issue #221, bug 2: clicking the scheduler's
  // own pause/resume button used to immediately re-pause the scheduler
  // because the window-level interaction listener treated the click as
  // generic user activity. The fix exempts the navigation controls'
  // container subtree from the interaction detector.
  describe("manual unpause via toggle button (#221, bug 2)", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("a click outside the controls subtree pauses the scheduler", () => {
      render(
        <ScreenScheduler config={defaultConfig} autoStart>
          <div data-testid="content">Content</div>
        </ScreenScheduler>
      );

      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/next screen in/i)
      );

      // Click on page content (outside navigation controls subtree).
      act(() => {
        fireEvent.click(screen.getByTestId("content"));
      });

      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Screen rotation paused"
      );
    });

    it("a click on the pause/resume button does NOT re-pause the scheduler", () => {
      render(
        <ScreenScheduler config={defaultConfig} autoStart>
          <div data-testid="content">Content</div>
        </ScreenScheduler>
      );

      // First, pause via a click outside the controls.
      act(() => {
        fireEvent.click(screen.getByTestId("content"));
      });
      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        "Screen rotation paused"
      );

      // Now click the toggle button to resume. The click happens inside
      // the controls subtree, so the interaction detector must ignore
      // it; the scheduler should be unpaused and STAY unpaused.
      const toggleButton = screen.getByRole("button", {
        name: /resume rotation/i,
      });
      act(() => {
        fireEvent.click(toggleButton);
      });

      // Without the fix, the click would have re-set the
      // interaction-pause and the status would still read paused.
      expect(screen.getByRole("status")).toHaveAttribute(
        "aria-label",
        expect.stringMatching(/next screen in/i)
      );
    });
  });

  it("applies transition config from schedule config", () => {
    const configWithTransition: ScheduleConfig = {
      ...defaultConfig,
      transition: { type: "none", durationMs: 0 },
    };

    render(
      <ScreenScheduler config={configWithTransition}>
        <div data-testid="content">Content</div>
      </ScreenScheduler>
    );

    // With type: none, children should be rendered directly
    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("screen-transition")).toBeInTheDocument();
  });
});
