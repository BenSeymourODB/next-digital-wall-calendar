/**
 * Tests for SchedulerStatusIndicator component
 *
 * Tests rendering in rotating/paused states, countdown display,
 * progress ring calculations, and accessibility attributes.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SchedulerStatusIndicator } from "../scheduler-status-indicator";

describe("SchedulerStatusIndicator", () => {
  const defaultProps = {
    isRotating: true,
    isPaused: false,
    timeUntilNextNav: 45,
    intervalSeconds: 60,
  };

  describe("rotating state", () => {
    it("renders with role='status'", () => {
      render(<SchedulerStatusIndicator {...defaultProps} />);
      expect(screen.getByRole("status")).toBeInTheDocument();
    });

    it("displays countdown seconds using Math.ceil", () => {
      render(<SchedulerStatusIndicator {...defaultProps} />);
      expect(screen.getByText("45")).toBeInTheDocument();
    });

    it("displays aria-label describing rotating state", () => {
      render(<SchedulerStatusIndicator {...defaultProps} />);
      const el = screen.getByRole("status");
      expect(el).toHaveAttribute(
        "aria-label",
        expect.stringContaining("45 seconds")
      );
    });

    it("renders progress ring at correct angle for 25% elapsed", () => {
      // 60s interval, 45s remaining => 15s elapsed => 25% => 90deg
      const { container } = render(
        <SchedulerStatusIndicator {...defaultProps} />
      );
      const ring = container.querySelector("[data-testid='progress-ring']");
      expect(ring).toBeInTheDocument();
      const style = ring!.getAttribute("style");
      expect(style).toContain("90deg");
    });

    it("renders progress ring at 0deg when full time remaining", () => {
      const { container } = render(
        <SchedulerStatusIndicator
          {...defaultProps}
          timeUntilNextNav={60}
          intervalSeconds={60}
        />
      );
      const ring = container.querySelector("[data-testid='progress-ring']");
      const style = ring!.getAttribute("style");
      expect(style).toContain("0deg");
    });

    it("renders progress ring at 360deg when 0 time remaining", () => {
      const { container } = render(
        <SchedulerStatusIndicator
          {...defaultProps}
          timeUntilNextNav={0}
          intervalSeconds={60}
        />
      );
      const ring = container.querySelector("[data-testid='progress-ring']");
      const style = ring!.getAttribute("style");
      expect(style).toContain("360deg");
    });

    it("renders progress ring at 180deg for midpoint", () => {
      const { container } = render(
        <SchedulerStatusIndicator
          {...defaultProps}
          timeUntilNextNav={30}
          intervalSeconds={60}
        />
      );
      const ring = container.querySelector("[data-testid='progress-ring']");
      const style = ring!.getAttribute("style");
      expect(style).toContain("180deg");
    });
  });

  describe("paused state", () => {
    it("shows pause icon when paused", () => {
      render(<SchedulerStatusIndicator {...defaultProps} isPaused={true} />);
      expect(screen.getByText("❚❚")).toBeInTheDocument();
    });

    it("does not show countdown when paused", () => {
      render(<SchedulerStatusIndicator {...defaultProps} isPaused={true} />);
      expect(screen.queryByText("45")).not.toBeInTheDocument();
    });

    it("displays aria-label describing paused state", () => {
      render(<SchedulerStatusIndicator {...defaultProps} isPaused={true} />);
      const el = screen.getByRole("status");
      expect(el).toHaveAttribute(
        "aria-label",
        expect.stringContaining("paused")
      );
    });
  });

  describe("edge cases", () => {
    it("handles intervalSeconds === 0 without division by zero", () => {
      expect(() =>
        render(
          <SchedulerStatusIndicator
            {...defaultProps}
            intervalSeconds={0}
            timeUntilNextNav={0}
          />
        )
      ).not.toThrow();
    });

    it("does not render when not rotating and not paused", () => {
      const { container } = render(
        <SchedulerStatusIndicator
          {...defaultProps}
          isRotating={false}
          isPaused={false}
        />
      );
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(container.firstChild).toBeNull();
    });

    it("renders when paused even if isRotating is false", () => {
      render(
        <SchedulerStatusIndicator
          {...defaultProps}
          isRotating={false}
          isPaused={true}
        />
      );
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("composable positioning", () => {
    it("applies custom className for positioning", () => {
      render(
        <SchedulerStatusIndicator
          {...defaultProps}
          className="absolute bottom-2 left-2"
        />
      );
      const el = screen.getByRole("status");
      expect(el.className).toContain("absolute");
      expect(el.className).toContain("bottom-2");
      expect(el.className).toContain("left-2");
    });

    it("uses default positioning when no className provided", () => {
      render(<SchedulerStatusIndicator {...defaultProps} />);
      const el = screen.getByRole("status");
      expect(el.className).toContain("fixed");
      expect(el.className).toContain("bottom-6");
      expect(el.className).toContain("left-6");
    });
  });
});
