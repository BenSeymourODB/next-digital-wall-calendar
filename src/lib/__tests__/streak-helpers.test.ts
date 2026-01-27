/**
 * Tests for streak tracking helper functions
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateNewStreak,
  isConsecutiveDay,
  shouldIncrementStreak,
} from "../streak-helpers";

describe("streak-helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("isConsecutiveDay", () => {
    it("returns true for yesterday", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const yesterday = new Date("2024-06-14T23:59:59Z");
      expect(isConsecutiveDay(yesterday)).toBe(true);
    });

    it("returns true for today", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const today = new Date("2024-06-15T00:00:01Z");
      expect(isConsecutiveDay(today)).toBe(true);
    });

    it("returns false for two days ago", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const twoDaysAgo = new Date("2024-06-13T12:00:00Z");
      expect(isConsecutiveDay(twoDaysAgo)).toBe(false);
    });

    it("returns false for future dates", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const tomorrow = new Date("2024-06-16T12:00:00Z");
      expect(isConsecutiveDay(tomorrow)).toBe(false);
    });

    it("handles edge case at midnight", () => {
      const now = new Date("2024-06-15T00:00:01Z");
      vi.setSystemTime(now);

      const justBeforeMidnight = new Date("2024-06-14T23:59:59Z");
      expect(isConsecutiveDay(justBeforeMidnight)).toBe(true);
    });
  });

  describe("shouldIncrementStreak", () => {
    it("returns true when last activity was yesterday", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const yesterday = new Date("2024-06-14T18:00:00Z");
      expect(shouldIncrementStreak(yesterday)).toBe(true);
    });

    it("returns false when last activity was today", () => {
      const now = new Date("2024-06-15T18:00:00Z");
      vi.setSystemTime(now);

      const today = new Date("2024-06-15T10:00:00Z");
      expect(shouldIncrementStreak(today)).toBe(false);
    });

    it("returns false when streak is broken (more than 1 day)", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const twoDaysAgo = new Date("2024-06-13T12:00:00Z");
      expect(shouldIncrementStreak(twoDaysAgo)).toBe(false);
    });
  });

  describe("calculateNewStreak", () => {
    it("returns 1 for first ever completion", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      expect(calculateNewStreak(0, null)).toBe(1);
    });

    it("increments streak when continuing from yesterday", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const yesterday = new Date("2024-06-14T18:00:00Z");
      expect(calculateNewStreak(5, yesterday)).toBe(6);
    });

    it("keeps streak same when already completed today", () => {
      const now = new Date("2024-06-15T18:00:00Z");
      vi.setSystemTime(now);

      const today = new Date("2024-06-15T10:00:00Z");
      expect(calculateNewStreak(5, today)).toBe(5);
    });

    it("resets streak to 1 when broken", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const twoDaysAgo = new Date("2024-06-13T12:00:00Z");
      expect(calculateNewStreak(10, twoDaysAgo)).toBe(1);
    });

    it("resets from zero when last activity was long ago", () => {
      const now = new Date("2024-06-15T12:00:00Z");
      vi.setSystemTime(now);

      const weekAgo = new Date("2024-06-08T12:00:00Z");
      expect(calculateNewStreak(0, weekAgo)).toBe(1);
    });
  });
});
