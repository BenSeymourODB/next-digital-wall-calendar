/**
 * Tests for time-utils.ts
 *
 * Tests time matching, day checking, and time formatting utilities.
 */
import { describe, expect, it } from "vitest";
import { formatTimeRemaining, isActiveDay, isTimeMatch } from "../time-utils";

describe("isTimeMatch", () => {
  it("returns true for exact time match", () => {
    const current = new Date(2024, 2, 15, 17, 30, 0); // 17:30
    expect(isTimeMatch(current, "17:30")).toBe(true);
  });

  it("returns true when current time is 1 minute before scheduled", () => {
    const current = new Date(2024, 2, 15, 17, 29, 0); // 17:29
    expect(isTimeMatch(current, "17:30")).toBe(true);
  });

  it("returns true when current time is 1 minute after scheduled", () => {
    const current = new Date(2024, 2, 15, 17, 31, 0); // 17:31
    expect(isTimeMatch(current, "17:30")).toBe(true);
  });

  it("returns false when current time is 2 minutes before scheduled", () => {
    const current = new Date(2024, 2, 15, 17, 28, 0); // 17:28
    expect(isTimeMatch(current, "17:30")).toBe(false);
  });

  it("returns false when current time is 2 minutes after scheduled", () => {
    const current = new Date(2024, 2, 15, 17, 32, 0); // 17:32
    expect(isTimeMatch(current, "17:30")).toBe(false);
  });

  it("handles midnight correctly", () => {
    const current = new Date(2024, 2, 15, 0, 0, 0); // 00:00
    expect(isTimeMatch(current, "00:00")).toBe(true);
  });

  it("handles edge time 23:59", () => {
    const current = new Date(2024, 2, 15, 23, 59, 0);
    expect(isTimeMatch(current, "23:59")).toBe(true);
  });

  it("handles single-digit hours in scheduled time", () => {
    const current = new Date(2024, 2, 15, 9, 0, 0);
    expect(isTimeMatch(current, "09:00")).toBe(true);
  });

  it("matches across midnight: scheduled 23:59, current 00:00", () => {
    const current = new Date(2024, 2, 15, 0, 0, 0);
    expect(isTimeMatch(current, "23:59")).toBe(true);
  });

  it("matches across midnight: scheduled 00:00, current 23:59", () => {
    const current = new Date(2024, 2, 15, 23, 59, 0);
    expect(isTimeMatch(current, "00:00")).toBe(true);
  });

  it("does not match across midnight with 2 minute gap: scheduled 23:58, current 00:00", () => {
    const current = new Date(2024, 2, 15, 0, 0, 0);
    expect(isTimeMatch(current, "23:58")).toBe(false);
  });

  // Regression: issue #221 bug 3 — naive `Math.abs(curr - sched)` produced a
  // diff of 1439 minutes between 23:59 and 00:00 instead of 1, so a scheduled
  // 23:59 entry would silently miss its 60s firing window once the clock
  // ticked past midnight. The wraparound is now handled by
  // `Math.min(diff, 1440 - diff)` and these cases lock that in.
  describe("regression: midnight wraparound (issue #221, bug 3)", () => {
    it("scheduled 23:59 still matches at 00:00 the next day", () => {
      expect(isTimeMatch(new Date(2024, 2, 16, 0, 0, 0), "23:59")).toBe(true);
    });

    it("scheduled 00:00 still matches at 23:59 the previous day", () => {
      expect(isTimeMatch(new Date(2024, 2, 15, 23, 59, 0), "00:00")).toBe(true);
    });

    it("rejects a 2-minute gap across the midnight boundary", () => {
      expect(isTimeMatch(new Date(2024, 2, 16, 0, 0, 0), "23:58")).toBe(false);
      expect(isTimeMatch(new Date(2024, 2, 15, 23, 58, 0), "00:00")).toBe(
        false
      );
    });
  });
});

describe("isActiveDay", () => {
  it("returns true when days is undefined (every day)", () => {
    expect(isActiveDay(undefined, 0)).toBe(true);
    expect(isActiveDay(undefined, 3)).toBe(true);
    expect(isActiveDay(undefined, 6)).toBe(true);
  });

  it("returns true when days array is empty (every day)", () => {
    expect(isActiveDay([], 0)).toBe(true);
    expect(isActiveDay([], 3)).toBe(true);
  });

  it("returns true when current day is in the days array", () => {
    expect(isActiveDay([1, 3, 5], 1)).toBe(true); // Monday
    expect(isActiveDay([1, 3, 5], 3)).toBe(true); // Wednesday
    expect(isActiveDay([1, 3, 5], 5)).toBe(true); // Friday
  });

  it("returns false when current day is not in the days array", () => {
    expect(isActiveDay([1, 3, 5], 0)).toBe(false); // Sunday
    expect(isActiveDay([1, 3, 5], 2)).toBe(false); // Tuesday
    expect(isActiveDay([1, 3, 5], 6)).toBe(false); // Saturday
  });

  it("handles weekend-only schedule", () => {
    expect(isActiveDay([0, 6], 0)).toBe(true); // Sunday
    expect(isActiveDay([0, 6], 6)).toBe(true); // Saturday
    expect(isActiveDay([0, 6], 1)).toBe(false); // Monday
  });
});

describe("formatTimeRemaining", () => {
  it("formats zero seconds", () => {
    expect(formatTimeRemaining(0)).toBe("0s");
  });

  it("formats seconds only", () => {
    expect(formatTimeRemaining(45)).toBe("45s");
  });

  it("formats minutes and seconds", () => {
    expect(formatTimeRemaining(90)).toBe("1m 30s");
  });

  it("formats exact minutes", () => {
    expect(formatTimeRemaining(120)).toBe("2m 0s");
  });

  it("formats large values", () => {
    expect(formatTimeRemaining(3661)).toBe("61m 1s");
  });

  it("handles 1 second", () => {
    expect(formatTimeRemaining(1)).toBe("1s");
  });

  it("handles 59 seconds", () => {
    expect(formatTimeRemaining(59)).toBe("59s");
  });

  it("handles 60 seconds (1 minute)", () => {
    expect(formatTimeRemaining(60)).toBe("1m 0s");
  });
});
