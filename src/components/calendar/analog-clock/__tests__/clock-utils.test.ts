import type { IEvent } from "@/types/calendar";
import { describe, expect, it } from "vitest";
import {
  calculateArcAngles,
  eventsToClockEvents,
  filterEventsForPeriod,
  getPeriodBounds,
  getPeriodStart,
  parseEventTitle,
} from "../clock-utils";

function makeEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "e1",
    title: "Event",
    startDate: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
    endDate: new Date(2026, 3, 12, 10, 0, 0).toISOString(),
    color: "blue",
    description: "",
    user: { id: "u1", name: "U", picturePath: null },
    isAllDay: false,
    calendarId: "c1",
    ...overrides,
  };
}

describe("parseEventTitle", () => {
  it("extracts color emoji and returns matching hex color", () => {
    const result = parseEventTitle("🔴 Deadline", "#3B82F6");
    expect(result.colorEmoji).toBe("🔴");
    expect(result.color).toBe("#EF4444");
    expect(result.cleanTitle).toBe("Deadline");
  });

  it("extracts event emoji after color emoji", () => {
    const result = parseEventTitle("🟢 🎮 Family Game Night", "#3B82F6");
    expect(result.colorEmoji).toBe("🟢");
    expect(result.eventEmoji).toBe("🎮");
    expect(result.color).toBe("#22C55E");
    expect(result.cleanTitle).toBe("Family Game Night");
  });

  it("treats non-color emoji as event emoji and uses fallback color", () => {
    const result = parseEventTitle("🏋️ Gym Session", "#F97316");
    expect(result.colorEmoji).toBeUndefined();
    expect(result.eventEmoji).toBe("🏋️");
    expect(result.color).toBe("#F97316");
    expect(result.cleanTitle).toBe("Gym Session");
  });

  it("returns fallback color when no emoji prefix", () => {
    const result = parseEventTitle("Team Meeting", "#A855F7");
    expect(result.colorEmoji).toBeUndefined();
    expect(result.eventEmoji).toBeUndefined();
    expect(result.color).toBe("#A855F7");
    expect(result.cleanTitle).toBe("Team Meeting");
  });

  it("handles all supported color emojis", () => {
    const colorMap: Record<string, string> = {
      "🔴": "#EF4444",
      "🟠": "#F97316",
      "🟡": "#EAB308",
      "🟢": "#22C55E",
      "🔵": "#3B82F6",
      "🟣": "#A855F7",
      "⚫": "#1F2937",
      "⚪": "#F3F4F6",
      "🟤": "#92400E",
    };

    for (const [emoji, expectedColor] of Object.entries(colorMap)) {
      const result = parseEventTitle(`${emoji} Test`, "#000000");
      expect(result.colorEmoji).toBe(emoji);
      expect(result.color).toBe(expectedColor);
    }
  });

  it("handles empty title", () => {
    const result = parseEventTitle("", "#3B82F6");
    expect(result.cleanTitle).toBe("");
    expect(result.color).toBe("#3B82F6");
  });

  it("handles title with only color emoji", () => {
    const result = parseEventTitle("🔴", "#3B82F6");
    expect(result.colorEmoji).toBe("🔴");
    expect(result.color).toBe("#EF4444");
    expect(result.cleanTitle).toBe("");
  });

  it("handles title with color emoji and event emoji only", () => {
    const result = parseEventTitle("🟢 🎮", "#3B82F6");
    expect(result.colorEmoji).toBe("🟢");
    expect(result.eventEmoji).toBe("🎮");
    expect(result.cleanTitle).toBe("");
  });

  it("preserves extra whitespace in title after stripping one delimiter space", () => {
    const result = parseEventTitle("🔴  Multiple  Spaces", "#3B82F6");
    // Only the first delimiter space after emoji is stripped
    expect(result.cleanTitle).toBe(" Multiple  Spaces");
  });
});

describe("getPeriodStart", () => {
  it("returns midnight for AM times", () => {
    const time = new Date(2026, 3, 12, 9, 30, 0); // 9:30 AM
    const periodStart = getPeriodStart(time);
    expect(periodStart.getHours()).toBe(0);
    expect(periodStart.getMinutes()).toBe(0);
    expect(periodStart.getSeconds()).toBe(0);
    expect(periodStart.getMilliseconds()).toBe(0);
  });

  it("returns noon for PM times", () => {
    const time = new Date(2026, 3, 12, 14, 30, 0); // 2:30 PM
    const periodStart = getPeriodStart(time);
    expect(periodStart.getHours()).toBe(12);
    expect(periodStart.getMinutes()).toBe(0);
  });

  it("returns midnight for exactly 12:00 AM", () => {
    const time = new Date(2026, 3, 12, 0, 0, 0);
    const periodStart = getPeriodStart(time);
    expect(periodStart.getHours()).toBe(0);
  });

  it("returns noon for exactly 12:00 PM", () => {
    const time = new Date(2026, 3, 12, 12, 0, 0);
    const periodStart = getPeriodStart(time);
    expect(periodStart.getHours()).toBe(12);
  });

  it("returns midnight for 11:59 AM", () => {
    const time = new Date(2026, 3, 12, 11, 59, 59);
    const periodStart = getPeriodStart(time);
    expect(periodStart.getHours()).toBe(0);
  });

  it("returns noon for 11:59 PM", () => {
    const time = new Date(2026, 3, 12, 23, 59, 59);
    const periodStart = getPeriodStart(time);
    expect(periodStart.getHours()).toBe(12);
  });
});

describe("calculateArcAngles", () => {
  it("maps event at 12:00-1:00 to 0-30 degrees (AM period)", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0); // midnight
    const eventStart = new Date(2026, 3, 12, 0, 0, 0); // 12:00 AM
    const eventEnd = new Date(2026, 3, 12, 1, 0, 0); // 1:00 AM

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(0);
    expect(angles.endAngle).toBeCloseTo(30);
  });

  it("maps event at 3:00-4:00 to 90-120 degrees", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0);
    const eventStart = new Date(2026, 3, 12, 3, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 4, 0, 0);

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(90);
    expect(angles.endAngle).toBeCloseTo(120);
  });

  it("maps event at 6:00-6:30 to 180-195 degrees", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0);
    const eventStart = new Date(2026, 3, 12, 6, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 6, 30, 0);

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(180);
    expect(angles.endAngle).toBeCloseTo(195);
  });

  it("maps event at 9:00-10:00 to 270-300 degrees", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0);
    const eventStart = new Date(2026, 3, 12, 9, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 10, 0, 0);

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(270);
    expect(angles.endAngle).toBeCloseTo(300);
  });

  it("handles PM period (12:00 PM - 1:00 PM)", () => {
    const periodStart = new Date(2026, 3, 12, 12, 0, 0); // noon
    const eventStart = new Date(2026, 3, 12, 12, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 13, 0, 0);

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(0);
    expect(angles.endAngle).toBeCloseTo(30);
  });

  it("handles 15-minute event (minimum visible arc)", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0);
    const eventStart = new Date(2026, 3, 12, 3, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 3, 15, 0);

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(90);
    expect(angles.endAngle).toBeCloseTo(97.5);
  });

  it("clamps events that extend beyond the 12-hour period", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0);
    const eventStart = new Date(2026, 3, 12, 11, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 13, 0, 0); // extends past noon

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(330);
    expect(angles.endAngle).toBeCloseTo(360);
  });

  it("clamps events that start before the period", () => {
    const periodStart = new Date(2026, 3, 12, 12, 0, 0); // noon
    const eventStart = new Date(2026, 3, 12, 11, 0, 0); // before noon
    const eventEnd = new Date(2026, 3, 12, 13, 0, 0);

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(angles.startAngle).toBeCloseTo(0);
    expect(angles.endAngle).toBeCloseTo(30);
  });

  it("enforces minimum arc span of 7.5 degrees (15 min equivalent)", () => {
    const periodStart = new Date(2026, 3, 12, 0, 0, 0);
    const eventStart = new Date(2026, 3, 12, 3, 0, 0);
    const eventEnd = new Date(2026, 3, 12, 3, 5, 0); // only 5 minutes

    const angles = calculateArcAngles(eventStart, eventEnd, periodStart);
    // Should be at least 7.5 degrees wide
    expect(angles.endAngle - angles.startAngle).toBeGreaterThanOrEqual(7.5);
  });
});

describe("getPeriodBounds", () => {
  it("returns AM start and end for morning times", () => {
    const time = new Date(2026, 3, 12, 9, 30, 0);
    const { periodStart, periodEnd } = getPeriodBounds(time);
    expect(periodStart.getHours()).toBe(0);
    expect(periodEnd.getHours()).toBe(12);
    expect(periodEnd.getMinutes()).toBe(0);
    expect(periodEnd.getSeconds()).toBe(0);
  });

  it("returns PM start and end for afternoon times", () => {
    const time = new Date(2026, 3, 12, 14, 30, 0);
    const { periodStart, periodEnd } = getPeriodBounds(time);
    expect(periodStart.getHours()).toBe(12);
    // PM period ends at midnight of the next day
    expect(periodEnd.getDate()).toBe(13);
    expect(periodEnd.getHours()).toBe(0);
    expect(periodEnd.getMinutes()).toBe(0);
  });

  it("periodEnd is exactly 12 hours after periodStart", () => {
    const time = new Date(2026, 3, 12, 14, 30, 0);
    const { periodStart, periodEnd } = getPeriodBounds(time);
    expect(periodEnd.getTime() - periodStart.getTime()).toBe(
      12 * 60 * 60 * 1000
    );
  });

  it("agrees with getPeriodStart for the start value", () => {
    const time = new Date(2026, 3, 12, 7, 0, 0);
    const { periodStart } = getPeriodBounds(time);
    expect(periodStart.getTime()).toBe(getPeriodStart(time).getTime());
  });
});

describe("filterEventsForPeriod", () => {
  const periodStart = new Date(2026, 3, 12, 0, 0, 0);
  const periodEnd = new Date(2026, 3, 12, 12, 0, 0);

  it("excludes all-day events", () => {
    const events: IEvent[] = [
      makeEvent({
        id: "a",
        isAllDay: true,
        startDate: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 10, 0, 0).toISOString(),
      }),
      makeEvent({
        id: "b",
        isAllDay: false,
        startDate: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 10, 0, 0).toISOString(),
      }),
    ];
    const result = filterEventsForPeriod(events, periodStart, periodEnd);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("b");
  });

  it("includes events that fully overlap the period", () => {
    const events = [
      makeEvent({
        id: "inside",
        startDate: new Date(2026, 3, 12, 3, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 4, 0, 0).toISOString(),
      }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(
      1
    );
  });

  it("includes events that start before the period but end inside it", () => {
    const events = [
      makeEvent({
        id: "spans-start",
        startDate: new Date(2026, 3, 11, 23, 30, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 1, 0, 0).toISOString(),
      }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(
      1
    );
  });

  it("includes events that start inside the period but end after", () => {
    const events = [
      makeEvent({
        id: "spans-end",
        startDate: new Date(2026, 3, 12, 11, 30, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 13, 0, 0).toISOString(),
      }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(
      1
    );
  });

  it("excludes events that end exactly at period start", () => {
    const events = [
      makeEvent({
        id: "ends-at-start",
        startDate: new Date(2026, 3, 11, 22, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 0, 0, 0).toISOString(),
      }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(
      0
    );
  });

  it("excludes events entirely before or after the period", () => {
    const events = [
      makeEvent({
        id: "before",
        startDate: new Date(2026, 3, 11, 20, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 11, 21, 0, 0).toISOString(),
      }),
      makeEvent({
        id: "after",
        startDate: new Date(2026, 3, 12, 14, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 15, 0, 0).toISOString(),
      }),
    ];
    expect(filterEventsForPeriod(events, periodStart, periodEnd)).toHaveLength(
      0
    );
  });

  it("returns empty array for empty input", () => {
    expect(filterEventsForPeriod([], periodStart, periodEnd)).toEqual([]);
  });
});

describe("eventsToClockEvents", () => {
  const periodStart = new Date(2026, 3, 12, 0, 0, 0);

  it("converts IEvents to ClockEvents with arc angles", () => {
    const events = [
      makeEvent({
        id: "evt-1",
        title: "🟢 🎮 Game Night",
        color: "green",
        startDate: new Date(2026, 3, 12, 3, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 4, 0, 0).toISOString(),
      }),
    ];
    const result = eventsToClockEvents(events, periodStart);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("evt-1");
    expect(result[0].cleanTitle).toBe("Game Night");
    expect(result[0].eventEmoji).toBe("🎮");
    expect(result[0].color).toBe("#22C55E");
    expect(result[0].startAngle).toBeCloseTo(90);
    expect(result[0].endAngle).toBeCloseTo(120);
    expect(result[0].isAllDay).toBe(false);
  });

  it("uses Tailwind fallback color when no color emoji is present", () => {
    const events = [
      makeEvent({
        id: "evt-2",
        title: "Team Standup",
        color: "blue",
        startDate: new Date(2026, 3, 12, 9, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 12, 9, 30, 0).toISOString(),
      }),
    ];
    const result = eventsToClockEvents(events, periodStart);
    // Tailwind blue-500 (from color-utils TAILWIND_COLORS)
    expect(result[0].color.toLowerCase()).toBe("#3b82f6");
  });

  it("preserves all-day flag on output", () => {
    const events = [
      makeEvent({
        id: "evt-3",
        isAllDay: true,
        startDate: new Date(2026, 3, 12, 0, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 13, 0, 0, 0).toISOString(),
      }),
    ];
    const result = eventsToClockEvents(events, periodStart);
    expect(result[0].isAllDay).toBe(true);
  });
});
