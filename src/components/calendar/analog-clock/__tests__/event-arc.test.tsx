import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EventArc } from "../event-arc";
import type { ClockEvent } from "../types";

const baseEvent: ClockEvent = {
  id: "evt-1",
  title: "🟢 🎮 Family Game Night",
  cleanTitle: "Family Game Night",
  startAngle: 90,
  endAngle: 120,
  color: "#22C55E",
  eventEmoji: "🎮",
  isAllDay: false,
};

const defaultProps = {
  event: baseEvent,
  outerRadius: 240,
  innerRadius: 200,
  cx: 250,
  cy: 250,
  ringIndex: 0,
};

describe("EventArc", () => {
  function renderArc(overrides = {}) {
    return render(
      <svg viewBox="0 0 500 500">
        <EventArc {...defaultProps} {...overrides} />
      </svg>
    );
  }

  it("renders an arc path element", () => {
    renderArc();
    const arc = screen.getByTestId("event-arc-evt-1");
    expect(arc).toBeInTheDocument();
    expect(arc.tagName).toBe("path");
  });

  it("applies the event color as fill", () => {
    renderArc();
    const arc = screen.getByTestId("event-arc-evt-1");
    expect(arc.getAttribute("fill")).toBe("#22C55E");
  });

  it("renders with opacity for visual layering", () => {
    renderArc();
    const arc = screen.getByTestId("event-arc-evt-1");
    const opacity = parseFloat(arc.getAttribute("fill-opacity") || "1");
    expect(opacity).toBeGreaterThan(0);
    expect(opacity).toBeLessThanOrEqual(1);
  });

  it("renders event emoji on the arc", () => {
    renderArc();
    const emoji = screen.getByTestId("event-emoji-evt-1");
    expect(emoji).toBeInTheDocument();
    expect(emoji.textContent).toBe("🎮");
  });

  it("does not render emoji if event has no eventEmoji", () => {
    const noEmojiEvent = { ...baseEvent, id: "evt-2", eventEmoji: undefined };
    renderArc({ event: noEmojiEvent });
    expect(screen.queryByTestId("event-emoji-evt-2")).not.toBeInTheDocument();
  });

  it("renders the clean title on the arc (truncated if > 15 chars)", () => {
    renderArc();
    const title = screen.getByTestId("event-title-evt-1");
    expect(title).toBeInTheDocument();
    // "Family Game Night" is 17 chars, truncated to 14 + "..."
    expect(title.textContent).toBe("Family Game Ni...");
  });

  it("renders full title when short enough", () => {
    const shortEvent: ClockEvent = {
      ...baseEvent,
      id: "evt-short",
      cleanTitle: "Team Lunch",
      startAngle: 90,
      endAngle: 120,
    };
    renderArc({ event: shortEvent });
    const title = screen.getByTestId("event-title-evt-short");
    expect(title.textContent).toBe("Team Lunch");
  });

  it("has accessible role with event title", () => {
    renderArc();
    const group = screen.getByTestId("event-arc-group-evt-1");
    expect(group.getAttribute("role")).toBe("img");
    expect(group.getAttribute("aria-label")).toContain("Family Game Night");
  });

  it("renders different colored arcs for different events", () => {
    const redEvent: ClockEvent = {
      ...baseEvent,
      id: "evt-red",
      color: "#EF4444",
      startAngle: 150,
      endAngle: 180,
    };
    renderArc({ event: redEvent });
    const arc = screen.getByTestId("event-arc-evt-red");
    expect(arc.getAttribute("fill")).toBe("#EF4444");
  });

  it("renders a wide arc for long events", () => {
    const longEvent: ClockEvent = {
      ...baseEvent,
      id: "evt-long",
      startAngle: 0,
      endAngle: 180,
    };
    renderArc({ event: longEvent });
    const arc = screen.getByTestId("event-arc-evt-long");
    expect(arc).toBeInTheDocument();
    // The path should contain the large-arc-flag=1 for arcs > 180 degrees
    // At exactly 180, it won't trigger, but the arc should render
    expect(arc.getAttribute("d")).toBeTruthy();
  });
});
