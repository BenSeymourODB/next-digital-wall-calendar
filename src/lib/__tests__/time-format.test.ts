import { describe, expect, it } from "vitest";
import { VALID_TIME_FORMATS, isTimeFormat } from "../time-format";

describe("isTimeFormat", () => {
  it("accepts the two valid literal values", () => {
    expect(isTimeFormat("12h")).toBe(true);
    expect(isTimeFormat("24h")).toBe(true);
  });

  it("accepts every entry from VALID_TIME_FORMATS", () => {
    for (const fmt of VALID_TIME_FORMATS) {
      expect(isTimeFormat(fmt)).toBe(true);
    }
  });

  it("rejects similar-looking strings outside the allow-list", () => {
    expect(isTimeFormat("13h")).toBe(false);
    expect(isTimeFormat("12H")).toBe(false);
    expect(isTimeFormat("12")).toBe(false);
    expect(isTimeFormat("")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isTimeFormat(null)).toBe(false);
    expect(isTimeFormat(undefined)).toBe(false);
    expect(isTimeFormat(12)).toBe(false);
    expect(isTimeFormat({})).toBe(false);
  });
});
