/**
 * Tests for PointsAnimation.
 *
 * Visibility is fully prop-driven, so tests rerender with `show=false`
 * to model the parent's behaviour after the auto-dismiss callback.
 */
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PointsAnimation } from "../points-animation";

let prefersReducedMotion = false;

vi.mock("@/hooks/use-reduced-motion", () => ({
  useReducedMotion: () => prefersReducedMotion,
}));

describe("PointsAnimation", () => {
  beforeEach(() => {
    prefersReducedMotion = false;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when show is false", () => {
    const { container } = render(<PointsAnimation points={10} show={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders '+N points!' content when show is true", () => {
    render(<PointsAnimation points={25} show={true} />);

    expect(screen.getByText(/\+25 points!/)).toBeInTheDocument();
  });

  it("fires onComplete after the dismiss timer elapses", () => {
    const onComplete = vi.fn();
    render(<PointsAnimation points={10} show={true} onComplete={onComplete} />);

    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("hides when the parent flips show to false (after onComplete)", () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <PointsAnimation points={10} show={true} onComplete={onComplete} />
    );

    expect(screen.getByText(/\+10 points!/)).toBeInTheDocument();

    rerender(
      <PointsAnimation points={10} show={false} onComplete={onComplete} />
    );

    expect(screen.queryByText(/\+10 points!/)).not.toBeInTheDocument();
  });

  it("does not fire onComplete when unmounted before the timer", () => {
    const onComplete = vi.fn();
    const { unmount } = render(
      <PointsAnimation points={10} show={true} onComplete={onComplete} />
    );

    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("respects prefers-reduced-motion: skips animation classes", () => {
    prefersReducedMotion = true;

    render(<PointsAnimation points={10} show={true} />);

    const banner = screen.getByText(/\+10 points!/).closest("[role='status']");
    expect(banner).not.toBeNull();
    expect(banner?.className).not.toMatch(/animate-/);
  });

  it("applies the fade-in animation class when motion is allowed", () => {
    prefersReducedMotion = false;

    render(<PointsAnimation points={10} show={true} />);

    const banner = screen.getByText(/\+10 points!/).closest("[role='status']");
    expect(banner?.className).toMatch(/animate-in/);
  });

  it("uses an aria-live='polite' status region so screen readers announce the award", () => {
    render(<PointsAnimation points={5} show={true} />);

    const banner = screen.getByRole("status");
    expect(banner).toHaveAttribute("aria-live", "polite");
  });

  it("re-shows when show transitions from false → true with a new value", () => {
    const onComplete = vi.fn();
    const { rerender } = render(
      <PointsAnimation points={10} show={false} onComplete={onComplete} />
    );

    rerender(
      <PointsAnimation points={15} show={true} onComplete={onComplete} />
    );

    expect(screen.getByText(/\+15 points!/)).toBeInTheDocument();
  });
});
