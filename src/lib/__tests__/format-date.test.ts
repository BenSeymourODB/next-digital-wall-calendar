import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATE_FORMAT,
  VALID_DATE_FORMATS,
  formatUserDate,
  isDateFormat,
} from "../format-date";

describe("formatUserDate", () => {
  // Pin to a known local-date instance so the test is independent of the
  // environment's TZ — `new Date(year, month, day)` builds a local-midnight
  // Date that all three of our patterns are timezone-agnostic against
  // (date-fns' `format()` reads local fields).
  const fixed = new Date(2026, 0, 7); // 2026-01-07 (Jan = month index 0)

  it("formats MM/DD/YYYY", () => {
    expect(formatUserDate(fixed, "MM/DD/YYYY")).toBe("01/07/2026");
  });

  it("formats DD/MM/YYYY", () => {
    expect(formatUserDate(fixed, "DD/MM/YYYY")).toBe("07/01/2026");
  });

  it("formats YYYY-MM-DD", () => {
    expect(formatUserDate(fixed, "YYYY-MM-DD")).toBe("2026-01-07");
  });

  it("zero-pads single-digit days and months for every format", () => {
    const singleDigit = new Date(2026, 2, 5); // March 5
    expect(formatUserDate(singleDigit, "MM/DD/YYYY")).toBe("03/05/2026");
    expect(formatUserDate(singleDigit, "DD/MM/YYYY")).toBe("05/03/2026");
    expect(formatUserDate(singleDigit, "YYYY-MM-DD")).toBe("2026-03-05");
  });

  it("accepts a local-datetime string and reads its local Y/M/D fields", () => {
    // The string is intentionally without a `Z` suffix — `new Date(...)`
    // interprets it as local time, and `format()` reads local fields, so
    // the assertion is TZ-safe. A `Z`-suffixed (true UTC) input would be
    // shifted by the harness's offset and produce a different calendar
    // day in negative-offset zones, so don't add one without a UTC-aware
    // helper to assert against.
    expect(formatUserDate("2026-01-07T12:00:00", "YYYY-MM-DD")).toBe(
      "2026-01-07"
    );
  });

  it("defaults to MM/DD/YYYY when the second argument is omitted", () => {
    expect(formatUserDate(fixed)).toBe("01/07/2026");
    expect(DEFAULT_DATE_FORMAT).toBe("MM/DD/YYYY");
  });

  it("returns an empty string for invalid date inputs (does not throw)", () => {
    expect(formatUserDate("not a date", "MM/DD/YYYY")).toBe("");
    // `new Date(NaN)` produces an invalid Date; ensure callers passing a
    // bad Date object don't crash the render path.
    expect(formatUserDate(new Date(NaN), "MM/DD/YYYY")).toBe("");
  });
});

describe("isDateFormat", () => {
  it("accepts every documented format", () => {
    for (const fmt of VALID_DATE_FORMATS) {
      expect(isDateFormat(fmt)).toBe(true);
    }
  });

  it("rejects unknown strings and non-strings", () => {
    expect(isDateFormat("YYYY/MM/DD")).toBe(false);
    expect(isDateFormat("")).toBe(false);
    expect(isDateFormat(undefined)).toBe(false);
    expect(isDateFormat(null)).toBe(false);
    expect(isDateFormat(42)).toBe(false);
  });
});
