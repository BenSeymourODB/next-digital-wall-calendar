import { describe, expect, it } from "vitest";
import {
  CALENDAR_TRANSITION_SPEEDS,
  DEFAULT_CALENDAR_TRANSITION_SPEED,
  TRANSITION_SPEED_TO_MS,
  isCalendarTransitionSpeed,
  resolveTransitionDurationMs,
} from "../transition-speed";

describe("CalendarTransitionSpeed", () => {
  it("exposes the four canonical speeds", () => {
    expect(CALENDAR_TRANSITION_SPEEDS).toEqual([
      "off",
      "fast",
      "normal",
      "slow",
    ]);
  });

  it("defaults to 'normal' so existing users see no behavioural change", () => {
    expect(DEFAULT_CALENDAR_TRANSITION_SPEED).toBe("normal");
  });

  it("maps each speed to a non-decreasing duration in ms", () => {
    expect(TRANSITION_SPEED_TO_MS.off).toBe(0);
    expect(TRANSITION_SPEED_TO_MS.fast).toBeGreaterThan(0);
    expect(TRANSITION_SPEED_TO_MS.fast).toBeLessThan(
      TRANSITION_SPEED_TO_MS.normal
    );
    expect(TRANSITION_SPEED_TO_MS.normal).toBeLessThan(
      TRANSITION_SPEED_TO_MS.slow
    );
  });

  it("keeps 'normal' at 300ms — the historical hard-coded SimpleCalendar value", () => {
    expect(TRANSITION_SPEED_TO_MS.normal).toBe(300);
  });

  describe("isCalendarTransitionSpeed", () => {
    it("accepts known values", () => {
      for (const speed of CALENDAR_TRANSITION_SPEEDS) {
        expect(isCalendarTransitionSpeed(speed)).toBe(true);
      }
    });

    it("rejects unknown / non-string values", () => {
      expect(isCalendarTransitionSpeed("ludicrous")).toBe(false);
      expect(isCalendarTransitionSpeed("")).toBe(false);
      expect(isCalendarTransitionSpeed(null)).toBe(false);
      expect(isCalendarTransitionSpeed(undefined)).toBe(false);
      expect(isCalendarTransitionSpeed(300)).toBe(false);
      expect(isCalendarTransitionSpeed({ speed: "fast" })).toBe(false);
    });
  });

  describe("resolveTransitionDurationMs", () => {
    it("returns the mapped duration for a known speed", () => {
      expect(resolveTransitionDurationMs("off")).toBe(0);
      expect(resolveTransitionDurationMs("fast")).toBe(
        TRANSITION_SPEED_TO_MS.fast
      );
      expect(resolveTransitionDurationMs("normal")).toBe(
        TRANSITION_SPEED_TO_MS.normal
      );
      expect(resolveTransitionDurationMs("slow")).toBe(
        TRANSITION_SPEED_TO_MS.slow
      );
    });

    it("falls back to the default speed when the input is unknown / undefined", () => {
      expect(resolveTransitionDurationMs(undefined)).toBe(
        TRANSITION_SPEED_TO_MS[DEFAULT_CALENDAR_TRANSITION_SPEED]
      );
      expect(resolveTransitionDurationMs("ludicrous")).toBe(
        TRANSITION_SPEED_TO_MS[DEFAULT_CALENDAR_TRANSITION_SPEED]
      );
    });
  });
});
