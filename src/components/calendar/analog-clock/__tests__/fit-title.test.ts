import { describe, expect, it } from "vitest";
import { fitTitleToArc } from "../fit-title";

// Helpful constants for the tests:
// - 2π × radius = arc circumference
// - charBudget(span°, radius, fontSize) ≈ floor(span/360 × 2π × radius / (fontSize × 0.6))
//
// titleRadius=200, fontSize=14, charWidth=8.4 → 2π×200 = 1256.6
// Per-line char budget at various spans:
//   30°  → 1256.6 × 30/360  / 8.4  ≈ 12 chars
//   60°  → 1256.6 × 60/360  / 8.4  ≈ 24 chars
//   90°  → 1256.6 × 90/360  / 8.4  ≈ 37 chars
//   120° → 1256.6 × 120/360 / 8.4  ≈ 49 chars
//   180° → 1256.6 × 180/360 / 8.4  ≈ 74 chars
//
// Tests choose spans where the expected behavior is unambiguous regardless
// of small tweaks to the heuristic constants.

const RADIUS = 200;
const FONT = 14;

describe("fitTitleToArc", () => {
  it("fits a short single word on one line", () => {
    const result = fitTitleToArc("Lunch", 60, RADIUS, FONT);
    expect(result.lines).toEqual(["Lunch"]);
    expect(result.didOverflow).toBe(false);
  });

  it("fits two short words on one line when the budget allows", () => {
    // "Team Lunch" = 10 chars; budget at 60°/200/14 ≈ 24, well under capacity.
    const result = fitTitleToArc("Team Lunch", 60, RADIUS, FONT);
    expect(result.lines).toEqual(["Team Lunch"]);
    expect(result.didOverflow).toBe(false);
  });

  it("splits to two lines when content fits on two but not one", () => {
    // "Family Game Night" = 17 chars; budget at 30° ≈ 12 → overflows one line,
    // but split into "Family Game" (11) + "Night" (5) fits two lines.
    const result = fitTitleToArc("Family Game Night", 30, RADIUS, FONT);
    expect(result.lines.length).toBe(2);
    expect(result.didOverflow).toBe(false);
    expect(result.lines.join(" ")).toBe("Family Game Night");
    // Word boundaries respected (no mid-word splits).
    expect(result.lines.every((line) => !line.includes("..."))).toBe(true);
  });

  it("greedy-packs the first line when splitting", () => {
    // "Pick up groceries today" = 23 chars; at 30° (~12 chars/line):
    // line 1 = "Pick up" (7), line 2 = "groceries" (9, "today" doesn't fit).
    // This is an overflow case — line 2 is truncated with an ellipsis.
    const result = fitTitleToArc("Pick up groceries today", 30, RADIUS, FONT);
    expect(result.lines.length).toBe(2);
    expect(result.lines[0]).toBe("Pick up");
    expect(result.lines[1]).toMatch(/^groceries/);
    expect(result.didOverflow).toBe(true);
    expect(result.lines[1].endsWith("...")).toBe(true);
  });

  it("ellipsizes line 2 when the next word alone exceeds the line budget", () => {
    // Two-word title where word 2 alone is wider than the budget.
    // budget=12 at 30°/200/14. "Hi" packs onto line 1 (2 chars). Word 2
    // "supercalifragilistic" (20 chars) won't fit on line 2 — packLine
    // returns an empty line2 and the fallback truncates that word.
    const result = fitTitleToArc("Hi supercalifragilistic", 30, RADIUS, FONT);
    expect(result.lines.length).toBe(2);
    expect(result.lines[0]).toBe("Hi");
    expect(result.lines[1].endsWith("...")).toBe(true);
    expect(result.lines[1].startsWith("super")).toBe(true);
    expect(result.didOverflow).toBe(true);
  });

  it("ellipsizes line 2 when content needs three or more lines", () => {
    // 30° → ~12 chars/line. Title with many short words can't fit on 2 lines.
    const longTitle = "the quick brown fox jumps over the lazy dog";
    const result = fitTitleToArc(longTitle, 30, RADIUS, FONT);
    expect(result.lines.length).toBe(2);
    expect(result.didOverflow).toBe(true);
    // Line 2 should end with the ASCII ellipsis at this comfortable budget.
    expect(result.lines[1].endsWith("...")).toBe(true);
  });

  it("does not split a single word mid-character even if it exceeds the line budget", () => {
    // 30° budget ≈ 12 chars; supercalifragilisticexpialidocious is 34 chars.
    // Behavior: keep as a single line, ellipsize, mark overflow. No mid-word split.
    const result = fitTitleToArc(
      "supercalifragilisticexpialidocious",
      30,
      RADIUS,
      FONT
    );
    expect(result.lines.length).toBe(1);
    expect(result.didOverflow).toBe(true);
    expect(result.lines[0].endsWith("...")).toBe(true);
    // Truncation should leave at least one character of the original.
    expect(result.lines[0].length).toBeGreaterThan(3);
  });

  it("keeps the title on one line when it already fits comfortably", () => {
    // 120° → ~49 chars/line; "Family Game Night" (17) fits on one line easily.
    const result = fitTitleToArc("Family Game Night", 120, RADIUS, FONT);
    expect(result.lines).toEqual(["Family Game Night"]);
    expect(result.didOverflow).toBe(false);
  });

  it("returns empty lines + didOverflow=true when even one character cannot fit", () => {
    // span=2°, radius=200, font=14:
    //   2π × 200 × 2/360 = 6.98 px circumference; charWidth=8.4 → 0 chars per line.
    const result = fitTitleToArc("A", 2, RADIUS, FONT);
    expect(result.lines).toEqual([]);
    expect(result.didOverflow).toBe(true);
  });

  it("trims redundant whitespace between words on output", () => {
    const result = fitTitleToArc("  Family   Game   Night  ", 60, RADIUS, FONT);
    expect(result.lines.join(" ")).toBe("Family Game Night");
  });

  it("scales the per-line budget with the title radius", () => {
    // Larger radius = more circumference at the same span = more chars per line.
    // "Family Game Night" at 30° fits two lines at radius 200; at radius 400
    // the same span has 2× circumference, so it should fit on a single line.
    const small = fitTitleToArc("Family Game Night", 30, 200, 14);
    const large = fitTitleToArc("Family Game Night", 30, 400, 14);
    expect(small.lines.length).toBe(2);
    expect(large.lines.length).toBe(1);
  });

  it("scales the per-line budget inversely with font size", () => {
    // Halving the font roughly doubles characters per line.
    const big = fitTitleToArc("Family Game Night", 30, 200, 14);
    const small = fitTitleToArc("Family Game Night", 30, 200, 7);
    expect(big.lines.length).toBe(2);
    expect(small.lines.length).toBe(1);
  });

  it("never returns more than two lines", () => {
    // Extremely narrow arc with multi-word content.
    const result = fitTitleToArc(
      "one two three four five six seven eight",
      20,
      RADIUS,
      FONT
    );
    expect(result.lines.length).toBeLessThanOrEqual(2);
  });

  describe("at tight budgets the truncation marker is always present", () => {
    // Carve out a tiny budget by using a small radius so the per-line char
    // budget lands at 1, 2, or 3 characters and exercises the Unicode-ellipsis
    // branch. budget = floor((span/360) × 2π × R / (font × 0.6)).
    //
    // span=15°, R=20, font=14 → circumference = 5.236, charWidth = 8.4
    //   → budget = floor(0.62) = 0 → empty/overflow path
    // span=30°, R=20, font=14 → circumference = 10.47, charWidth = 8.4
    //   → budget = floor(1.25) = 1
    // span=60°, R=20, font=14 → budget = floor(2.49) = 2
    // span=90°, R=20, font=14 → budget = floor(3.74) = 3

    it("returns the single-character ellipsis on a budget-1 single-word arc", () => {
      const result = fitTitleToArc("supercali", 30, 20, 14);
      expect(result.lines).toEqual(["…"]);
      expect(result.didOverflow).toBe(true);
    });

    it("keeps one original character + ellipsis at budget 2", () => {
      const result = fitTitleToArc("supercali", 60, 20, 14);
      expect(result.lines).toEqual(["s…"]);
      expect(result.didOverflow).toBe(true);
    });

    it("keeps two original characters + ellipsis at budget 3", () => {
      const result = fitTitleToArc("supercali", 90, 20, 14);
      expect(result.lines).toEqual(["su…"]);
      expect(result.didOverflow).toBe(true);
    });

    it("does not invent an ellipsis when content fits exactly within a tight budget", () => {
      // budget=3 case where the text is exactly 3 chars long → no truncation needed.
      const result = fitTitleToArc("abc", 90, 20, 14);
      expect(result.lines).toEqual(["abc"]);
      expect(result.didOverflow).toBe(false);
    });
  });

  describe("with maxLines = 1", () => {
    it("renders a fitting title on a single line", () => {
      const result = fitTitleToArc("Lunch", 60, RADIUS, FONT, 1);
      expect(result.lines).toEqual(["Lunch"]);
      expect(result.didOverflow).toBe(false);
    });

    it("ellipsizes to a single line when content would otherwise wrap", () => {
      // Same input that produces a 2-line result at the default maxLines=2:
      // "Family Game Night" at 30° budget ≈ 12 chars. With maxLines=1 we
      // truncate to a single line and report overflow.
      const result = fitTitleToArc("Family Game Night", 30, RADIUS, FONT, 1);
      expect(result.lines.length).toBe(1);
      expect(result.didOverflow).toBe(true);
      expect(result.lines[0].endsWith("...")).toBe(true);
    });

    it("never returns more than one line when maxLines is 1", () => {
      const result = fitTitleToArc(
        "the quick brown fox jumps over the lazy dog",
        30,
        RADIUS,
        FONT,
        1
      );
      expect(result.lines.length).toBe(1);
      expect(result.didOverflow).toBe(true);
    });
  });
});
