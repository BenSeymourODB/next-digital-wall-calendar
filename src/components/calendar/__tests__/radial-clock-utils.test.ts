import { describe, expect, it } from "vitest";
import {
  calculateArcAngles,
  calculateArcPath,
  filterEventsForPeriod,
  get12HourPeriod,
  parseEventTitle,
  timeToAngle,
} from "../radial-clock-utils";

describe("parseEventTitle", () => {
  it("extracts color emoji and maps to hex color", () => {
    const result = parseEventTitle("🟢 Team Meeting");
    expect(result.colorEmoji).toBe("🟢");
    expect(result.color).toBe("#22C55E");
    expect(result.cleanTitle).toBe("Team Meeting");
  });

  it("extracts event emoji after color emoji", () => {
    const result = parseEventTitle("🟢 🎮 Family Game Night");
    expect(result.colorEmoji).toBe("🟢");
    expect(result.eventEmoji).toBe("🎮");
    expect(result.color).toBe("#22C55E");
    expect(result.cleanTitle).toBe("Family Game Night");
  });

  it("extracts event emoji when no color emoji present", () => {
    const result = parseEventTitle("🏋️ Gym Session");
    expect(result.colorEmoji).toBeUndefined();
    expect(result.eventEmoji).toBe("🏋️");
    expect(result.cleanTitle).toBe("Gym Session");
  });

  it("handles title with no emoji", () => {
    const result = parseEventTitle("Regular Meeting");
    expect(result.colorEmoji).toBeUndefined();
    expect(result.eventEmoji).toBeUndefined();
    expect(result.cleanTitle).toBe("Regular Meeting");
  });

  it("uses fallback color when no color emoji", () => {
    const result = parseEventTitle("Regular Meeting", "#3B82F6");
    expect(result.color).toBe("#3B82F6");
  });

  it("uses default gray when no color emoji and no fallback", () => {
    const result = parseEventTitle("Regular Meeting");
    expect(result.color).toBe("#6B7280");
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
    for (const [emoji, hex] of Object.entries(colorMap)) {
      const result = parseEventTitle(`${emoji} Test`);
      expect(result.color).toBe(hex);
      expect(result.colorEmoji).toBe(emoji);
    }
  });

  it("handles empty string", () => {
    const result = parseEventTitle("");
    expect(result.cleanTitle).toBe("");
    expect(result.colorEmoji).toBeUndefined();
    expect(result.eventEmoji).toBeUndefined();
  });

  it("handles color emoji only (no title text)", () => {
    const result = parseEventTitle("🔴");
    expect(result.colorEmoji).toBe("🔴");
    expect(result.cleanTitle).toBe("");
    expect(result.color).toBe("#EF4444");
  });
});

describe("get12HourPeriod", () => {
  it("returns AM period for morning time", () => {
    const date = new Date(2026, 3, 2, 9, 30); // 9:30 AM
    const { periodStart, periodEnd } = get12HourPeriod(date);
    expect(periodStart.getHours()).toBe(0);
    expect(periodStart.getMinutes()).toBe(0);
    expect(periodEnd.getHours()).toBe(12);
    expect(periodEnd.getMinutes()).toBe(0);
  });

  it("returns PM period for afternoon time", () => {
    const date = new Date(2026, 3, 2, 15, 0); // 3:00 PM
    const { periodStart, periodEnd } = get12HourPeriod(date);
    expect(periodStart.getHours()).toBe(12);
    expect(periodStart.getMinutes()).toBe(0);
    expect(periodEnd.getHours()).toBe(0); // midnight next day or 24:00
  });

  it("returns AM period at exactly midnight", () => {
    const date = new Date(2026, 3, 2, 0, 0);
    const { periodStart } = get12HourPeriod(date);
    expect(periodStart.getHours()).toBe(0);
  });

  it("returns PM period at exactly noon", () => {
    const date = new Date(2026, 3, 2, 12, 0);
    const { periodStart } = get12HourPeriod(date);
    expect(periodStart.getHours()).toBe(12);
  });

  it("returns AM period at 11:59 AM", () => {
    const date = new Date(2026, 3, 2, 11, 59);
    const { periodStart } = get12HourPeriod(date);
    expect(periodStart.getHours()).toBe(0);
  });
});

describe("timeToAngle", () => {
  it("converts 12 o'clock (period start) to -90 degrees (top)", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const time = new Date(2026, 3, 2, 0, 0);
    expect(timeToAngle(time, periodStart)).toBe(-90);
  });

  it("converts 3 o'clock position to 0 degrees", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const time = new Date(2026, 3, 2, 3, 0);
    expect(timeToAngle(time, periodStart)).toBe(0);
  });

  it("converts 6 o'clock position to 90 degrees", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const time = new Date(2026, 3, 2, 6, 0);
    expect(timeToAngle(time, periodStart)).toBe(90);
  });

  it("converts 9 o'clock position to 180 degrees", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const time = new Date(2026, 3, 2, 9, 0);
    expect(timeToAngle(time, periodStart)).toBe(180);
  });

  it("handles minutes correctly (1:30 = 45 degrees from top = -45)", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const time = new Date(2026, 3, 2, 1, 30);
    // 1.5 hours / 12 hours * 360 = 45 degrees from 12 o'clock
    // In SVG coords: -90 + 45 = -45
    expect(timeToAngle(time, periodStart)).toBe(-45);
  });
});

describe("calculateArcAngles", () => {
  it("calculates correct angles for a 1-hour event at 3 o'clock", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const eventStart = new Date(2026, 3, 2, 3, 0);
    const eventEnd = new Date(2026, 3, 2, 4, 0);
    const { startAngle, endAngle } = calculateArcAngles(
      eventStart,
      eventEnd,
      periodStart
    );
    expect(startAngle).toBe(0); // 3 o'clock = 0 degrees
    expect(endAngle).toBe(30); // 4 o'clock = 30 degrees
  });

  it("clamps events that start before period", () => {
    const periodStart = new Date(2026, 3, 2, 12, 0);
    const eventStart = new Date(2026, 3, 2, 11, 0); // before PM period
    const eventEnd = new Date(2026, 3, 2, 13, 0);
    const { startAngle } = calculateArcAngles(
      eventStart,
      eventEnd,
      periodStart
    );
    expect(startAngle).toBe(-90); // clamped to period start (12 o'clock = -90)
  });

  it("clamps events that end after period", () => {
    const periodStart = new Date(2026, 3, 2, 0, 0);
    const eventStart = new Date(2026, 3, 2, 11, 0);
    const eventEnd = new Date(2026, 3, 2, 13, 0); // after AM period
    const { endAngle } = calculateArcAngles(eventStart, eventEnd, periodStart);
    expect(endAngle).toBe(270); // clamped to period end (12 o'clock again = -90 + 360 = 270)
  });
});

describe("calculateArcPath", () => {
  it("generates a valid SVG path string", () => {
    const path = calculateArcPath(0, 90, 200, 50);
    expect(path).toContain("M"); // moveTo
    expect(path).toContain("A"); // arc
    expect(path).toContain("L"); // lineTo
  });

  it("returns empty string for zero-length arc", () => {
    const path = calculateArcPath(45, 45, 200, 50);
    expect(path).toBe("");
  });

  it("handles full circle (360 degree) arc", () => {
    const path = calculateArcPath(-90, 270, 200, 50);
    expect(path).toContain("A");
  });
});

describe("filterEventsForPeriod", () => {
  const periodStart = new Date(2026, 3, 2, 0, 0);
  const periodEnd = new Date(2026, 3, 2, 12, 0);

  it("includes events fully within period", () => {
    const events = [
      {
        id: "1",
        title: "Morning Meeting",
        startDate: new Date(2026, 3, 2, 9, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 10, 0).toISOString(),
        color: "blue" as const,
        description: "",
        isAllDay: false,
        calendarId: "primary",
        user: { id: "1", name: "Test", picturePath: null },
      },
    ];
    const result = filterEventsForPeriod(events, periodStart, periodEnd);
    expect(result).toHaveLength(1);
  });

  it("includes events that overlap the period start", () => {
    const events = [
      {
        id: "1",
        title: "Late Night",
        startDate: new Date(2026, 3, 1, 23, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 1, 0).toISOString(),
        color: "blue" as const,
        description: "",
        isAllDay: false,
        calendarId: "primary",
        user: { id: "1", name: "Test", picturePath: null },
      },
    ];
    const result = filterEventsForPeriod(events, periodStart, periodEnd);
    expect(result).toHaveLength(1);
  });

  it("excludes events completely outside the period", () => {
    const events = [
      {
        id: "1",
        title: "Afternoon Meeting",
        startDate: new Date(2026, 3, 2, 14, 0).toISOString(),
        endDate: new Date(2026, 3, 2, 15, 0).toISOString(),
        color: "blue" as const,
        description: "",
        isAllDay: false,
        calendarId: "primary",
        user: { id: "1", name: "Test", picturePath: null },
      },
    ];
    const result = filterEventsForPeriod(events, periodStart, periodEnd);
    expect(result).toHaveLength(0);
  });

  it("excludes all-day events", () => {
    const events = [
      {
        id: "1",
        title: "Holiday",
        startDate: new Date(2026, 3, 2, 0, 0).toISOString(),
        endDate: new Date(2026, 3, 3, 0, 0).toISOString(),
        color: "blue" as const,
        description: "",
        isAllDay: true,
        calendarId: "primary",
        user: { id: "1", name: "Test", picturePath: null },
      },
    ];
    const result = filterEventsForPeriod(events, periodStart, periodEnd);
    expect(result).toHaveLength(0);
  });
});
