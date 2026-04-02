import type { IEvent } from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RadialClock } from "../radial-clock";

function createEvent(overrides: Partial<IEvent> & { id: string }): IEvent {
  return {
    title: "Test Event",
    startDate: new Date(2026, 3, 2, 9, 0).toISOString(),
    endDate: new Date(2026, 3, 2, 10, 0).toISOString(),
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: { id: "1", name: "Test", picturePath: null },
    ...overrides,
  };
}

// Fixed time: 9:30 AM on April 2, 2026
const FIXED_TIME = new Date(2026, 3, 2, 9, 30, 0);

describe("RadialClock", () => {
  it("renders the clock container", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("radial-clock")).toBeInTheDocument();
  });

  it("renders the SVG with correct role and label", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute(
      "aria-label",
      expect.stringContaining("AM period")
    );
  });

  it("displays AM indicator for morning times", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("ampm-indicator")).toHaveTextContent("AM");
  });

  it("displays PM indicator for afternoon times", () => {
    const pmTime = new Date(2026, 3, 2, 15, 0, 0);
    render(<RadialClock events={[]} currentTime={pmTime} />);
    expect(screen.getByTestId("ampm-indicator")).toHaveTextContent("PM");
  });

  it("renders hour numbers 1-12", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} />);
    for (let i = 1; i <= 12; i++) {
      expect(screen.getByTestId(`hour-number-${i}`)).toHaveTextContent(
        String(i)
      );
    }
  });

  it("renders clock hands", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("hour-hand")).toBeInTheDocument();
    expect(screen.getByTestId("minute-hand")).toBeInTheDocument();
    expect(screen.getByTestId("second-hand")).toBeInTheDocument();
  });

  it("renders event arcs for events in the current period", () => {
    const events = [
      createEvent({
        id: "event-1",
        title: "🟢 🎮 Game Time",
        startDate: new Date(2026, 3, 2, 3, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 5, 0).toISOString(),
      }),
    ];
    render(<RadialClock events={events} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("event-arc-event-1")).toBeInTheDocument();
  });

  it("renders event emoji on the arc", () => {
    const events = [
      createEvent({
        id: "event-1",
        title: "🟢 🎮 Game Time",
        startDate: new Date(2026, 3, 2, 3, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 5, 0).toISOString(),
      }),
    ];
    render(<RadialClock events={events} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("event-emoji-event-1")).toHaveTextContent("🎮");
  });

  it("does not render events outside the current 12-hour period", () => {
    const events = [
      createEvent({
        id: "pm-event",
        title: "Afternoon Meeting",
        startDate: new Date(2026, 3, 2, 14, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 15, 0).toISOString(),
      }),
    ];
    render(<RadialClock events={events} currentTime={FIXED_TIME} />);
    expect(screen.queryByTestId("event-arc-pm-event")).not.toBeInTheDocument();
  });

  it("renders multiple events", () => {
    const events = [
      createEvent({
        id: "e1",
        title: "🔴 Early",
        startDate: new Date(2026, 3, 2, 1, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 2, 0).toISOString(),
      }),
      createEvent({
        id: "e2",
        title: "🔵 Mid",
        startDate: new Date(2026, 3, 2, 5, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 7, 0).toISOString(),
      }),
      createEvent({
        id: "e3",
        title: "🟢 Late",
        startDate: new Date(2026, 3, 2, 10, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 11, 0).toISOString(),
      }),
    ];
    render(<RadialClock events={events} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("event-arc-e1")).toBeInTheDocument();
    expect(screen.getByTestId("event-arc-e2")).toBeInTheDocument();
    expect(screen.getByTestId("event-arc-e3")).toBeInTheDocument();
  });

  it("excludes all-day events", () => {
    const events = [
      createEvent({
        id: "allday",
        title: "Holiday",
        startDate: new Date(2026, 3, 2, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 3, 0, 0).toISOString(),
        isAllDay: true,
      }),
    ];
    render(<RadialClock events={events} currentTime={FIXED_TIME} />);
    expect(screen.queryByTestId("event-arc-allday")).not.toBeInTheDocument();
  });

  it("accepts custom size prop", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} size={400} />);
    const clock = screen.getByTestId("radial-clock");
    expect(clock).toHaveStyle({ width: "400px", height: "400px" });
  });

  it("renders the arc ring background", () => {
    render(<RadialClock events={[]} currentTime={FIXED_TIME} />);
    expect(screen.getByTestId("arc-ring-background")).toBeInTheDocument();
  });

  it("updates aria-label with event count", () => {
    const events = [
      createEvent({
        id: "e1",
        startDate: new Date(2026, 3, 2, 9, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 10, 0).toISOString(),
      }),
      createEvent({
        id: "e2",
        startDate: new Date(2026, 3, 2, 10, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 11, 0).toISOString(),
      }),
    ];
    render(<RadialClock events={events} currentTime={FIXED_TIME} />);
    const svg = screen.getByRole("img");
    expect(svg).toHaveAttribute(
      "aria-label",
      "Analog clock showing 2 events in the current AM period"
    );
  });
});
