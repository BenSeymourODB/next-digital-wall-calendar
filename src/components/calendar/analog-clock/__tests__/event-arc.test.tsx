import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

  it("wraps a long title onto 2 lines instead of single-line ellipsis (#310)", () => {
    // baseEvent: "Family Game Night" (17 chars) at 30° arc. The exact split
    // depends on the layout heuristic constants in event-arc.tsx, so this
    // test only asserts the contract: two lines, words preserved across
    // the split, no mid-word breaks, no single-line ellipsis fallback.
    renderArc();
    const title = screen.getByTestId("event-title-evt-1");
    expect(title).toBeInTheDocument();

    const textPaths = title.querySelectorAll("textPath");
    expect(textPaths.length).toBe(2);

    const renderedLines = Array.from(textPaths).map(
      (tp) => tp.textContent ?? ""
    );
    expect(renderedLines.join(" ")).toBe("Family Game Night");
    expect(renderedLines.every((l) => !l.includes("..."))).toBe(true);
    expect(renderedLines.every((l) => !l.includes("…"))).toBe(true);
  });

  it("renders full title on a single textPath when short enough", () => {
    const shortEvent: ClockEvent = {
      ...baseEvent,
      id: "evt-short",
      cleanTitle: "Team Lunch",
      startAngle: 90,
      endAngle: 120,
    };
    renderArc({ event: shortEvent });
    const title = screen.getByTestId("event-title-evt-short");
    const textPaths = title.querySelectorAll("textPath");
    expect(textPaths.length).toBe(1);
    expect(textPaths[0].textContent).toBe("Team Lunch");
  });

  it("renders 2-line titles at distinct radii (outer line further from center)", () => {
    // Render the wrapped baseEvent and verify the two textPath elements
    // reference distinct paths defined in <defs>.
    renderArc();
    const title = screen.getByTestId("event-title-evt-1");
    const textPaths = title.querySelectorAll("textPath");
    expect(textPaths.length).toBe(2);

    const hrefs = Array.from(textPaths).map((tp) => tp.getAttribute("href"));
    expect(hrefs[0]).not.toEqual(hrefs[1]);

    // Both referenced <path>s should exist in the same arc <g>.
    const arcGroup = screen.getByTestId("event-arc-group-evt-1");
    const defs = arcGroup.querySelector("defs");
    const pathEls = defs ? defs.querySelectorAll("path") : [];
    const pathIds = Array.from(pathEls).map((p) => `#${p.getAttribute("id")}`);
    expect(pathIds).toEqual(expect.arrayContaining(hrefs));
  });

  it("ellipsizes the second line when even 2 lines aren't enough (didOverflow)", () => {
    const overflowEvent: ClockEvent = {
      ...baseEvent,
      id: "evt-overflow",
      cleanTitle: "the quick brown fox jumps over the lazy dog",
      startAngle: 90,
      endAngle: 120, // 30° span → ~16 char budget
    };
    renderArc({ event: overflowEvent });
    const title = screen.getByTestId("event-title-evt-overflow");
    const textPaths = title.querySelectorAll("textPath");
    expect(textPaths.length).toBe(2);
    // Line 2 ends with the truncation marker (ASCII "..." at this budget).
    expect(textPaths[1].textContent?.endsWith("...")).toBe(true);
  });

  it("falls back to a single ellipsized line on narrow arcs (< 30°)", () => {
    // 25° arc is below the 2-line gate. Long title → single-line truncation.
    const narrowEvent: ClockEvent = {
      ...baseEvent,
      id: "evt-narrow",
      cleanTitle: "Family Game Night",
      startAngle: 90,
      endAngle: 115, // 25° span
    };
    renderArc({ event: narrowEvent });
    const title = screen.getByTestId("event-title-evt-narrow");
    const textPaths = title.querySelectorAll("textPath");
    expect(textPaths.length).toBe(1);
    expect(textPaths[0].textContent?.endsWith("...")).toBe(true);
  });

  it("has accessible role with event title", () => {
    renderArc();
    const group = screen.getByTestId("event-arc-group-evt-1");
    expect(group.getAttribute("role")).toBe("img");
    expect(group.getAttribute("aria-label")).toContain("Family Game Night");
  });

  it("omits the trailing ', ' from aria-label when the event has no emoji", () => {
    const noEmojiEvent = {
      ...baseEvent,
      id: "evt-no-emoji",
      eventEmoji: undefined,
    };
    renderArc({ event: noEmojiEvent });
    const group = screen.getByTestId("event-arc-group-evt-no-emoji");
    expect(group.getAttribute("aria-label")).toBe("Event: Family Game Night");
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

  describe("when onEventClick is provided", () => {
    it("renders the group as role='button' with tabIndex=0", () => {
      const onEventClick = vi.fn();
      renderArc({ onEventClick });
      const group = screen.getByTestId("event-arc-group-evt-1");
      expect(group.getAttribute("role")).toBe("button");
      expect(group.getAttribute("tabindex")).toBe("0");
    });

    it("preserves the aria-label so the button has an accessible name", () => {
      const onEventClick = vi.fn();
      renderArc({ onEventClick });
      const group = screen.getByTestId("event-arc-group-evt-1");
      expect(group.getAttribute("aria-label")).toContain("Family Game Night");
    });

    it("calls onEventClick with the event id and the <g> element when clicked", () => {
      const onEventClick = vi.fn();
      renderArc({ onEventClick });
      const group = screen.getByTestId("event-arc-group-evt-1");
      fireEvent.click(group);
      expect(onEventClick).toHaveBeenCalledTimes(1);
      expect(onEventClick).toHaveBeenCalledWith("evt-1", group);
    });

    it("calls onEventClick when Enter is pressed on the focused group", () => {
      const onEventClick = vi.fn();
      renderArc({ onEventClick });
      const group = screen.getByTestId("event-arc-group-evt-1");
      fireEvent.keyDown(group, { key: "Enter" });
      expect(onEventClick).toHaveBeenCalledWith("evt-1", group);
    });

    it("calls onEventClick when Space is pressed on the focused group", () => {
      const onEventClick = vi.fn();
      renderArc({ onEventClick });
      const group = screen.getByTestId("event-arc-group-evt-1");
      fireEvent.keyDown(group, { key: " " });
      expect(onEventClick).toHaveBeenCalledWith("evt-1", group);
    });

    it("does not call onEventClick for other keys", () => {
      const onEventClick = vi.fn();
      renderArc({ onEventClick });
      const group = screen.getByTestId("event-arc-group-evt-1");
      fireEvent.keyDown(group, { key: "Tab" });
      fireEvent.keyDown(group, { key: "a" });
      expect(onEventClick).not.toHaveBeenCalled();
    });
  });

  describe("when onEventClick is NOT provided", () => {
    it("keeps role='img' (non-interactive presentation)", () => {
      renderArc();
      const group = screen.getByTestId("event-arc-group-evt-1");
      expect(group.getAttribute("role")).toBe("img");
    });

    it("does not expose tabIndex", () => {
      renderArc();
      const group = screen.getByTestId("event-arc-group-evt-1");
      expect(group.getAttribute("tabindex")).toBeNull();
    });
  });
});
