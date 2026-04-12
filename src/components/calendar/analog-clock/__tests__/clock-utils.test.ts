import { describe, expect, it } from "vitest";
import {
  calculateArcAngles,
  getPeriodStart,
  parseEventTitle,
} from "../clock-utils";

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
