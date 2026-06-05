import { describe, expect, it } from "vitest";
import {
  TITLE_FONT_SIZE_MAX,
  TITLE_FONT_SIZE_RATIO,
  TITLE_RADIUS_RATIO,
  TWO_LINE_MIN_SPAN_DEGREES,
  computeArcTitleLayout,
} from "../arc-title-layout";

const baseInput = {
  cleanTitle: "Family Game Night",
  innerRadius: 244,
  outerRadius: 292,
};

describe("computeArcTitleLayout", () => {
  describe("maxLines branching", () => {
    it("returns maxLines=2 at exactly TWO_LINE_MIN_SPAN_DEGREES", () => {
      const r = computeArcTitleLayout({
        ...baseInput,
        arcSpan: TWO_LINE_MIN_SPAN_DEGREES,
      });
      expect(r.maxLines).toBe(2);
    });

    it("returns maxLines=2 above TWO_LINE_MIN_SPAN_DEGREES", () => {
      const r = computeArcTitleLayout({
        ...baseInput,
        arcSpan: TWO_LINE_MIN_SPAN_DEGREES + 15,
      });
      expect(r.maxLines).toBe(2);
    });

    it("returns maxLines=1 below TWO_LINE_MIN_SPAN_DEGREES", () => {
      const r = computeArcTitleLayout({
        ...baseInput,
        arcSpan: TWO_LINE_MIN_SPAN_DEGREES - 1,
      });
      expect(r.maxLines).toBe(1);
    });
  });

  describe("titleRadius geometry", () => {
    it("places the title baseline at innerRadius + arcHeight × TITLE_RADIUS_RATIO", () => {
      const r = computeArcTitleLayout({ ...baseInput, arcSpan: 60 });
      const arcHeight = baseInput.outerRadius - baseInput.innerRadius;
      expect(r.titleRadius).toBe(
        baseInput.innerRadius + arcHeight * TITLE_RADIUS_RATIO
      );
    });

    it("scales titleRadius linearly with the arc band thickness", () => {
      const thin = computeArcTitleLayout({
        cleanTitle: "x",
        innerRadius: 200,
        outerRadius: 220,
        arcSpan: 60,
      });
      const thick = computeArcTitleLayout({
        cleanTitle: "x",
        innerRadius: 200,
        outerRadius: 280,
        arcSpan: 60,
      });
      expect(thin.titleRadius).toBe(200 + 20 * TITLE_RADIUS_RATIO);
      expect(thick.titleRadius).toBe(200 + 80 * TITLE_RADIUS_RATIO);
    });
  });

  describe("titleFontSize cap", () => {
    it("scales titleFontSize with arc height by TITLE_FONT_SIZE_RATIO", () => {
      const r = computeArcTitleLayout({
        ...baseInput,
        arcSpan: 60,
      });
      const arcHeight = baseInput.outerRadius - baseInput.innerRadius;
      expect(r.titleFontSize).toBeLessThanOrEqual(TITLE_FONT_SIZE_MAX);
      expect(r.titleFontSize).toBeCloseTo(arcHeight * TITLE_FONT_SIZE_RATIO, 4);
    });

    it("caps titleFontSize at TITLE_FONT_SIZE_MAX on very thick arcs", () => {
      const r = computeArcTitleLayout({
        cleanTitle: "x",
        innerRadius: 100,
        outerRadius: 600, // arcHeight=500, ratio=0.3 → 150 unclamped
        arcSpan: 60,
      });
      expect(r.titleFontSize).toBe(TITLE_FONT_SIZE_MAX);
    });
  });

  describe("fit / didOverflow signal", () => {
    it("reports didOverflow=false for a title that fits the arc budget", () => {
      const r = computeArcTitleLayout({
        cleanTitle: "Lunch",
        innerRadius: 244,
        outerRadius: 292,
        arcSpan: 60,
      });
      expect(r.fit.didOverflow).toBe(false);
    });

    it("reports didOverflow=true for a title that exceeds even the 2-line budget", () => {
      const r = computeArcTitleLayout({
        cleanTitle: "the quick brown fox jumps over the lazy dog",
        innerRadius: 244,
        outerRadius: 292,
        arcSpan: 30, // 2-line budget is small here
      });
      expect(r.fit.didOverflow).toBe(true);
    });

    it("reports didOverflow=true for a long single-line arc that cannot fit on 1 line", () => {
      const r = computeArcTitleLayout({
        cleanTitle: "Team Standup",
        innerRadius: 244,
        outerRadius: 292,
        arcSpan: 15, // < TWO_LINE_MIN_SPAN_DEGREES → maxLines=1
      });
      expect(r.maxLines).toBe(1);
      expect(r.fit.didOverflow).toBe(true);
    });

    it("returns the same FitTitleResult shape regardless of arcSpan", () => {
      const r = computeArcTitleLayout({ ...baseInput, arcSpan: 60 });
      expect(r.fit).toMatchObject({
        lines: expect.any(Array),
        didOverflow: expect.any(Boolean),
      });
    });
  });

  describe("shared-source-of-truth invariant", () => {
    /**
     * AnalogClock uses `fit.didOverflow` to decide whether to render a
     * sibling FloatingLabel; EventArc consumes the same `fit` to decide
     * whether to render in-arc title lines. Calling the helper twice with
     * the same inputs MUST produce strictly identical results so the two
     * surfaces never disagree.
     */
    it("is deterministic — two calls with identical inputs produce identical output", () => {
      const a = computeArcTitleLayout({ ...baseInput, arcSpan: 45 });
      const b = computeArcTitleLayout({ ...baseInput, arcSpan: 45 });
      expect(a.titleRadius).toBe(b.titleRadius);
      expect(a.titleFontSize).toBe(b.titleFontSize);
      expect(a.maxLines).toBe(b.maxLines);
      expect(a.fit.lines).toEqual(b.fit.lines);
      expect(a.fit.didOverflow).toBe(b.fit.didOverflow);
    });
  });
});
