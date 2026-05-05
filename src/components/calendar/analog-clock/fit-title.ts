/**
 * Pure helper: lay out an event title along an arc on up to two lines.
 *
 * Used by EventArc to decide between a single curved <textPath> and two
 * concentric <textPath>s, and by the companion floating-label feature
 * (#311) to decide whether the title overflowed even the two-line budget.
 *
 * No DOM measurement: the budget is approximated from the arc circumference
 * (`(arcSpan / 360) × 2π × titleRadius`) and a monospace heuristic
 * (~`fontSize × 0.6` per character). This is good enough for the 1-vs-2
 * line decision while staying SSR-safe.
 */

const CHAR_WIDTH_RATIO = 0.6;

export interface FitTitleResult {
  /** 0, 1, or 2 lines of text to render along the arc. */
  lines: string[];
  /** True when the title did not fit on two lines and was truncated. */
  didOverflow: boolean;
}

/**
 * Estimated maximum characters that fit on a single curved line.
 * Floors to a whole-character budget so ascenders/descenders don't bleed
 * past the arc edges at sub-character precision.
 */
function charBudgetForArc(
  arcSpanDegrees: number,
  titleRadius: number,
  fontSize: number
): number {
  if (arcSpanDegrees <= 0 || titleRadius <= 0 || fontSize <= 0) return 0;
  const circumference = (arcSpanDegrees / 360) * 2 * Math.PI * titleRadius;
  const charWidth = fontSize * CHAR_WIDTH_RATIO;
  return Math.floor(circumference / charWidth);
}

function truncateWithEllipsis(text: string, budget: number): string {
  // Keep at least one character of the original alongside the ellipsis;
  // otherwise drop the ellipsis entirely.
  if (budget <= 3) return text.slice(0, Math.max(0, budget));
  return `${text.slice(0, budget - 3)}...`;
}

/**
 * Greedy word-pack: walk through `words` in order and pull as many as fit
 * within `budget` onto one line. Returns the consumed line plus the index
 * of the first word that did NOT fit (= start of the next line).
 */
function packLine(
  words: string[],
  startIndex: number,
  budget: number
): { line: string; nextIndex: number } {
  let line = "";
  let i = startIndex;
  while (i < words.length) {
    const word = words[i];
    const candidate = line.length === 0 ? word : `${line} ${word}`;
    if (candidate.length <= budget) {
      line = candidate;
      i += 1;
    } else {
      break;
    }
  }
  return { line, nextIndex: i };
}

export function fitTitleToArc(
  cleanTitle: string,
  arcSpanDegrees: number,
  titleRadius: number,
  fontSize: number,
  maxLines: 1 | 2 = 2
): FitTitleResult {
  const budget = charBudgetForArc(arcSpanDegrees, titleRadius, fontSize);
  const normalised = cleanTitle.trim().replace(/\s+/g, " ");

  if (normalised.length === 0) {
    return { lines: [], didOverflow: false };
  }
  if (budget <= 0) {
    return { lines: [], didOverflow: true };
  }

  // Title fits on a single line.
  if (normalised.length <= budget) {
    return { lines: [normalised], didOverflow: false };
  }

  const words = normalised.split(" ");

  // Single very long word with no spaces to split on: keep on one line and
  // ellipsize. Mid-word splits are deliberately not produced (consistent with
  // the existing single-line truncation behavior).
  if (words.length === 1) {
    return {
      lines: [truncateWithEllipsis(normalised, budget)],
      didOverflow: true,
    };
  }

  // Pack line 1 greedily.
  const { line: line1, nextIndex } = packLine(words, 0, budget);

  // Edge case: no word fit on line 1 (every individual word exceeds budget).
  // Truncate the longest-fitting prefix of the first word as a single line.
  if (line1.length === 0) {
    return {
      lines: [truncateWithEllipsis(words[0], budget)],
      didOverflow: true,
    };
  }

  // Single-line mode: ellipsize line 1 since more content remains.
  if (maxLines === 1) {
    return {
      lines: [truncateWithEllipsis(normalised, budget)],
      didOverflow: true,
    };
  }

  // Pack line 2 from the remaining words.
  const { line: line2, nextIndex: afterLine2 } = packLine(
    words,
    nextIndex,
    budget
  );

  // No remaining words after line 2 → both lines render with no overflow.
  if (afterLine2 >= words.length) {
    return { lines: [line1, line2], didOverflow: false };
  }

  // Overflow: more words remain. Ellipsize line 2 to signal truncation.
  // If line 2 has nothing on it (the next word didn't fit), fall back to the
  // raw next word truncated with an ellipsis so the user still sees a hint
  // of what was cut.
  const truncatedLine2 =
    line2.length > 0
      ? truncateWithEllipsis(line2, budget)
      : truncateWithEllipsis(words[nextIndex], budget);

  return { lines: [line1, truncatedLine2], didOverflow: true };
}
