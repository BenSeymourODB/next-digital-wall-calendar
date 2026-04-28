import type { IEvent } from "@/types/calendar";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AnalogClock } from "../analog-clock";
import type { ClockEvent } from "../types";

function makeRawEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "raw-1",
    title: "Raw Event",
    startDate: new Date(2026, 3, 12, 3, 0, 0).toISOString(),
    endDate: new Date(2026, 3, 12, 4, 0, 0).toISOString(),
    color: "blue",
    description: "",
    user: { id: "u1", name: "U", picturePath: null },
    isAllDay: false,
    calendarId: "c1",
    ...overrides,
  };
}

const mockEvents: ClockEvent[] = [
  {
    id: "evt-1",
    title: "🟢 🎮 Game Night",
    cleanTitle: "Game Night",
    startAngle: 90,
    endAngle: 120,
    color: "#22C55E",
    eventEmoji: "🎮",
    isAllDay: false,
  },
  {
    id: "evt-2",
    title: "Team Standup",
    cleanTitle: "Team Standup",
    startAngle: 270,
    endAngle: 285,
    color: "#3B82F6",
    isAllDay: false,
  },
  {
    id: "evt-3",
    title: "🔴 Deadline",
    cleanTitle: "Deadline",
    startAngle: 150,
    endAngle: 180,
    color: "#EF4444",
    isAllDay: false,
  },
];

describe("AnalogClock", () => {
  it("renders the SVG container", () => {
    render(<AnalogClock currentTime={new Date(2026, 3, 12, 10, 10, 0)} />);
    const svg = screen.getByTestId("analog-clock");
    expect(svg).toBeInTheDocument();
    expect(svg.tagName).toBe("svg");
  });

  it("renders with default size", () => {
    render(<AnalogClock currentTime={new Date(2026, 3, 12, 10, 10, 0)} />);
    const svg = screen.getByTestId("analog-clock");
    expect(svg.getAttribute("width")).toBe("600");
    expect(svg.getAttribute("height")).toBe("600");
  });

  it("renders with custom size", () => {
    render(
      <AnalogClock size={400} currentTime={new Date(2026, 3, 12, 10, 10, 0)} />
    );
    const svg = screen.getByTestId("analog-clock");
    expect(svg.getAttribute("width")).toBe("400");
    expect(svg.getAttribute("height")).toBe("400");
  });

  it("renders the clock face", () => {
    render(<AnalogClock currentTime={new Date(2026, 3, 12, 10, 10, 0)} />);
    expect(screen.getByTestId("clock-face")).toBeInTheDocument();
  });

  it("renders event arcs when events are provided", () => {
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
      />
    );
    expect(screen.getByTestId("event-arc-evt-1")).toBeInTheDocument();
    expect(screen.getByTestId("event-arc-evt-2")).toBeInTheDocument();
    expect(screen.getByTestId("event-arc-evt-3")).toBeInTheDocument();
  });

  it("renders no event arcs when no events provided", () => {
    render(<AnalogClock currentTime={new Date(2026, 3, 12, 10, 10, 0)} />);
    expect(screen.queryByTestId(/^event-arc-/)).not.toBeInTheDocument();
  });

  it("renders events container group", () => {
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
      />
    );
    expect(screen.getByTestId("event-arcs-layer")).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
      />
    );
    const svg = screen.getByTestId("analog-clock");
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toContain("clock");
  });

  it("accepts raw IEvent[] via rawEvents prop and renders arcs for current period", () => {
    const now = new Date(2026, 3, 12, 9, 0, 0); // AM
    const rawEvents: IEvent[] = [
      makeRawEvent({
        id: "raw-morning",
        startDate: new Date(2026, 3, 12, 3, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 4, 0, 0).toISOString(),
      }),
    ];
    render(<AnalogClock rawEvents={rawEvents} currentTime={now} />);
    expect(screen.getByTestId("event-arc-raw-morning")).toBeInTheDocument();
  });

  it("filters out all-day events when using rawEvents", () => {
    const now = new Date(2026, 3, 12, 9, 0, 0);
    const rawEvents: IEvent[] = [
      makeRawEvent({
        id: "raw-all-day",
        isAllDay: true,
        startDate: new Date(2026, 3, 12, 0, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 13, 0, 0, 0).toISOString(),
      }),
      makeRawEvent({
        id: "raw-timed",
        startDate: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 10, 0, 0).toISOString(),
      }),
    ];
    render(<AnalogClock rawEvents={rawEvents} currentTime={now} />);
    expect(
      screen.queryByTestId("event-arc-raw-all-day")
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("event-arc-raw-timed")).toBeInTheDocument();
  });

  it("filters out events outside the current 12-hour period when using rawEvents", () => {
    const now = new Date(2026, 3, 12, 9, 0, 0); // AM
    const rawEvents: IEvent[] = [
      makeRawEvent({
        id: "raw-am",
        startDate: new Date(2026, 3, 12, 3, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 4, 0, 0).toISOString(),
      }),
      makeRawEvent({
        id: "raw-pm",
        startDate: new Date(2026, 3, 12, 14, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 15, 0, 0).toISOString(),
      }),
    ];
    render(<AnalogClock rawEvents={rawEvents} currentTime={now} />);
    expect(screen.getByTestId("event-arc-raw-am")).toBeInTheDocument();
    expect(screen.queryByTestId("event-arc-raw-pm")).not.toBeInTheDocument();
  });

  it("handles overlapping events by stacking at different radii", () => {
    const overlapping: ClockEvent[] = [
      {
        id: "overlap-1",
        title: "Event A",
        cleanTitle: "Event A",
        startAngle: 90,
        endAngle: 150,
        color: "#22C55E",
        isAllDay: false,
      },
      {
        id: "overlap-2",
        title: "Event B",
        cleanTitle: "Event B",
        startAngle: 120,
        endAngle: 180,
        color: "#3B82F6",
        isAllDay: false,
      },
    ];
    render(
      <AnalogClock
        events={overlapping}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
      />
    );
    // Both arcs should render
    expect(screen.getByTestId("event-arc-overlap-1")).toBeInTheDocument();
    expect(screen.getByTestId("event-arc-overlap-2")).toBeInTheDocument();
  });
});
