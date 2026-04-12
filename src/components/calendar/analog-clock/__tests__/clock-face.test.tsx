import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClockFace } from "../clock-face";

describe("ClockFace", () => {
  const defaultProps = {
    radius: 200,
    cx: 250,
    cy: 250,
    time: new Date(2026, 3, 12, 10, 10, 30), // 10:10:30 AM
    showSeconds: false,
  };

  function renderClockFace(overrides = {}) {
    return render(
      <svg viewBox="0 0 500 500">
        <ClockFace {...defaultProps} {...overrides} />
      </svg>
    );
  }

  it("renders the clock face circle", () => {
    renderClockFace();
    const face = screen.getByTestId("clock-face-bg");
    expect(face).toBeInTheDocument();
    expect(face.tagName).toBe("circle");
  });

  it("renders 12 hour markers", () => {
    renderClockFace();
    const markers = screen.getAllByTestId(/^hour-marker-/);
    expect(markers).toHaveLength(12);
  });

  it("renders hour numbers 1 through 12", () => {
    renderClockFace();
    for (let i = 1; i <= 12; i++) {
      expect(screen.getByTestId(`hour-number-${i}`)).toBeInTheDocument();
    }
  });

  it("renders the hour hand", () => {
    renderClockFace();
    expect(screen.getByTestId("hour-hand")).toBeInTheDocument();
  });

  it("renders the minute hand", () => {
    renderClockFace();
    expect(screen.getByTestId("minute-hand")).toBeInTheDocument();
  });

  it("does not render second hand by default", () => {
    renderClockFace();
    expect(screen.queryByTestId("second-hand")).not.toBeInTheDocument();
  });

  it("renders second hand when showSeconds is true", () => {
    renderClockFace({ showSeconds: true });
    expect(screen.getByTestId("second-hand")).toBeInTheDocument();
  });

  it("renders center dot", () => {
    renderClockFace();
    expect(screen.getByTestId("clock-center-dot")).toBeInTheDocument();
  });

  it("positions hour hand based on time", () => {
    // At 10:10, hour hand should be at roughly 305 degrees
    // (10 hours * 30 + 10 minutes * 0.5 = 305 degrees)
    renderClockFace();
    const hourHand = screen.getByTestId("hour-hand");
    const transform = hourHand.getAttribute("transform");
    expect(transform).toContain("rotate(305");
  });

  it("positions minute hand based on time", () => {
    // At :10 minutes, minute hand should be at 60 degrees (10 * 6)
    renderClockFace();
    const minuteHand = screen.getByTestId("minute-hand");
    const transform = minuteHand.getAttribute("transform");
    expect(transform).toContain("rotate(60");
  });

  it("renders AM/PM indicator", () => {
    renderClockFace();
    const indicator = screen.getByTestId("period-indicator");
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toBe("AM");
  });

  it("shows PM indicator for afternoon time", () => {
    renderClockFace({ time: new Date(2026, 3, 12, 14, 30, 0) });
    const indicator = screen.getByTestId("period-indicator");
    expect(indicator.textContent).toBe("PM");
  });
});
