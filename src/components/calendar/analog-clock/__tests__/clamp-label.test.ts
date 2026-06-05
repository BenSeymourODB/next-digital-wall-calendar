import { describe, expect, it } from "vitest";
import { clampLabelPosition } from "../clamp-label";

const clockBox = {
  top: 100,
  bottom: 700,
  height: 600,
};

describe("clampLabelPosition", () => {
  it("returns the input unchanged when y is inside the allowed band", () => {
    const result = clampLabelPosition({ x: 250, y: 400 }, clockBox);
    expect(result).toEqual({ x: 250, y: 400 });
  });

  it("preserves x exactly when no clamp is needed", () => {
    const result = clampLabelPosition({ x: 123.456, y: 400 }, clockBox);
    expect(result.x).toBe(123.456);
  });

  it("preserves x exactly when y is clamped at the top", () => {
    const result = clampLabelPosition({ x: 123.456, y: -1000 }, clockBox);
    expect(result.x).toBe(123.456);
  });

  it("preserves x exactly when y is clamped at the bottom", () => {
    const result = clampLabelPosition({ x: 123.456, y: 99999 }, clockBox);
    expect(result.x).toBe(123.456);
  });

  it("clamps y to clockTop - 0.10 × clockHeight when label is far above", () => {
    // top=100, height=600 → upper limit = 100 - 60 = 40
    const result = clampLabelPosition({ x: 250, y: -500 }, clockBox);
    expect(result.y).toBe(40);
  });

  it("clamps y to the upper limit when ideal y is just above the limit", () => {
    // upper limit = 40; pass y=39 → clamp to 40
    const result = clampLabelPosition({ x: 250, y: 39 }, clockBox);
    expect(result.y).toBe(40);
  });

  it("clamps y to clockBottom + 0.10 × clockHeight when label is far below", () => {
    // bottom=700, height=600 → lower limit = 700 + 60 = 760
    const result = clampLabelPosition({ x: 250, y: 9999 }, clockBox);
    expect(result.y).toBe(760);
  });

  it("clamps y to the lower limit when ideal y is just below the limit", () => {
    // lower limit = 760; pass y=761 → clamp to 760
    const result = clampLabelPosition({ x: 250, y: 761 }, clockBox);
    expect(result.y).toBe(760);
  });

  it("does not clamp y exactly at the upper limit", () => {
    const result = clampLabelPosition({ x: 250, y: 40 }, clockBox);
    expect(result.y).toBe(40);
  });

  it("does not clamp y exactly at the lower limit", () => {
    const result = clampLabelPosition({ x: 250, y: 760 }, clockBox);
    expect(result.y).toBe(760);
  });

  it("uses the provided height (not bottom - top) for the 10% allowance", () => {
    // Provide a non-physical clockBox where height differs from bottom-top to
    // confirm the allowance is computed from the explicit `height` field.
    const oddBox = { top: 100, bottom: 700, height: 1000 };
    // Allowance is 100; upper limit = 100 - 100 = 0; lower limit = 700 + 100 = 800
    expect(clampLabelPosition({ x: 0, y: -50 }, oddBox).y).toBe(0);
    expect(clampLabelPosition({ x: 0, y: 900 }, oddBox).y).toBe(800);
  });
});
