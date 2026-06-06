import type { IEvent } from "@/types/calendar";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("forwards onEventClick to event arcs (clicking an arc fires the callback with the event id and the <g> element)", () => {
    const onEventClick = vi.fn();
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        onEventClick={onEventClick}
      />
    );
    const group = screen.getByTestId("event-arc-group-evt-2");
    fireEvent.click(group);
    expect(onEventClick).toHaveBeenCalledTimes(1);
    expect(onEventClick).toHaveBeenCalledWith("evt-2", group);
  });

  it("makes arcs focusable buttons when onEventClick is provided", () => {
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        onEventClick={vi.fn()}
      />
    );
    const group = screen.getByTestId("event-arc-group-evt-1");
    expect(group.getAttribute("role")).toBe("button");
    expect(group.getAttribute("tabindex")).toBe("0");
  });

  it("widens the outer <svg> role to 'group' when interactive so AT exposes inner role='button' arcs", () => {
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        onEventClick={vi.fn()}
      />
    );
    const svg = screen.getByTestId("analog-clock");
    expect(svg.getAttribute("role")).toBe("group");
  });

  it("keeps the outer <svg> role='img' when no onEventClick is provided", () => {
    render(
      <AnalogClock
        events={mockEvents}
        currentTime={new Date(2026, 3, 12, 10, 10, 0)}
      />
    );
    const svg = screen.getByTestId("analog-clock");
    expect(svg.getAttribute("role")).toBe("img");
  });

  describe("floating off-arc title labels (#311)", () => {
    /**
     * Build a 30°-arc event whose cleanTitle is long enough to overflow even
     * the 2-line wrap from #310. With size=600 and arcThickness=48, the
     * resulting char budget per line on a 30° arc is small enough that
     * "the quick brown fox jumps over the lazy dog" (43 chars) overflows.
     */
    const overflowEvent: ClockEvent = {
      id: "evt-overflow",
      title: "the quick brown fox jumps over the lazy dog",
      cleanTitle: "the quick brown fox jumps over the lazy dog",
      startAngle: 90,
      endAngle: 120,
      color: "#22C55E",
      eventEmoji: "🎮",
      isAllDay: false,
    };

    const shortEvent: ClockEvent = {
      id: "evt-short",
      title: "Lunch",
      cleanTitle: "Lunch",
      startAngle: 200,
      endAngle: 220,
      color: "#3B82F6",
      isAllDay: false,
    };

    it("renders a FloatingLabel for events whose title overflows the arc budget", () => {
      render(
        <AnalogClock
          events={[overflowEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      expect(
        screen.getByTestId("floating-label-evt-overflow")
      ).toBeInTheDocument();
      const text = screen.getByTestId("floating-label-text-evt-overflow");
      expect(text.textContent).toBe(overflowEvent.cleanTitle);
    });

    it("does not render an in-arc title <g> for an overflowing event", () => {
      render(
        <AnalogClock
          events={[overflowEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      expect(
        screen.queryByTestId("event-title-evt-overflow")
      ).not.toBeInTheDocument();
    });

    it("still renders the leading event emoji on the overflowing arc", () => {
      render(
        <AnalogClock
          events={[overflowEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      expect(
        screen.getByTestId("event-emoji-evt-overflow")
      ).toBeInTheDocument();
    });

    it("does NOT render a FloatingLabel for sub-10° arcs even when didOverflow=true", () => {
      // A 5° arc is below the emoji-visibility threshold; per spec the
      // floating-label trigger requires the arc to be wide enough to render
      // visibly. fitTitleToArc reports didOverflow=true (budget collapses
      // to ~0–2 chars) but no floating label should appear.
      const slivers: ClockEvent[] = [
        {
          ...overflowEvent,
          id: "evt-sliver",
          startAngle: 90,
          endAngle: 95, // 5° span
        },
      ];
      render(
        <AnalogClock
          events={slivers}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      expect(
        screen.queryByTestId("floating-label-evt-sliver")
      ).not.toBeInTheDocument();
    });

    it("does NOT render a FloatingLabel for events whose title fits in-arc", () => {
      render(
        <AnalogClock
          events={[shortEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      expect(
        screen.queryByTestId("floating-label-evt-short")
      ).not.toBeInTheDocument();
      // ...and the in-arc title is still rendered.
      expect(screen.getByTestId("event-title-evt-short")).toBeInTheDocument();
    });

    it("renders FloatingLabel for an overflowing event even when it has no leading emoji", () => {
      const noEmojiOverflow: ClockEvent = {
        ...overflowEvent,
        id: "evt-noemoji",
        eventEmoji: undefined,
      };
      render(
        <AnalogClock
          events={[noEmojiOverflow]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      expect(
        screen.getByTestId("floating-label-evt-noemoji")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("event-emoji-evt-noemoji")
      ).not.toBeInTheDocument();
    });

    it("renders the FloatingLabel layer in a sibling <g data-testid='floating-labels-layer'>", () => {
      render(
        <AnalogClock
          events={[overflowEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      const layer = screen.getByTestId("floating-labels-layer");
      expect(layer).toBeInTheDocument();
      // The label group must be a descendant of the dedicated layer.
      expect(
        layer.querySelector('[data-testid="floating-label-evt-overflow"]')
      ).not.toBeNull();
    });

    it("forwards onEventClick to FloatingLabel — clicking the label fires the same callback", () => {
      const onEventClick = vi.fn();
      render(
        <AnalogClock
          events={[overflowEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
          onEventClick={onEventClick}
        />
      );
      const label = screen.getByTestId("floating-label-evt-overflow");
      fireEvent.click(label);
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onEventClick).toHaveBeenCalledWith("evt-overflow", label);
    });

    it("renders the SVG with overflow='visible' so labels can paint outside the clock-face viewBox", () => {
      render(
        <AnalogClock
          events={[overflowEvent]}
          currentTime={new Date(2026, 3, 12, 10, 10, 0)}
        />
      );
      const svg = screen.getByTestId("analog-clock");
      expect(svg.getAttribute("overflow")).toBe("visible");
    });
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
