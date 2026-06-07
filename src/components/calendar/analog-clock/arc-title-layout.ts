/**
 * Shared layout helper for an event arc's title — keeps EventArc (which
 * renders the in-arc text) and AnalogClock (which decides when to render a
 * sibling FloatingLabel for overflows, #311) agreeing on `didOverflow`.
 *
 * If these two surfaces ever disagreed, the floating label could render for
 * an event whose in-arc text actually fit (or fail to render for one that
 * was truncated), which would manifest as a missing title or a duplicate
 * title in the production view.
 */
import { roundCoord } from "./clock-utils";
import { type FitTitleResult, fitTitleToArc } from "./fit-title";

/** Minimum arc span (degrees) below which the 2-line wrap is suppressed. */
export const TWO_LINE_MIN_SPAN_DEGREES = 30;

/** Title baseline sits at this fraction of the arc band, measured from the inner radius. */
export const TITLE_RADIUS_RATIO = 0.68;

/** Title font size = arcHeight × this ratio (capped). */
export const TITLE_FONT_SIZE_RATIO = 0.3;

/** Upper bound on title font size, in px. */
export const TITLE_FONT_SIZE_MAX = 18;

export interface ArcTitleLayout {
  /** Curved-text baseline radius. */
  titleRadius: number;
  /** Resolved title font size in px. */
  titleFontSize: number;
  /** Number of lines the title is allowed to occupy on this arc. */
  maxLines: 1 | 2;
  /** Result of the word-pack fit — drives both rendering and overflow detection. */
  fit: FitTitleResult;
}

export function computeArcTitleLayout(params: {
  cleanTitle: string;
  arcSpan: number;
  innerRadius: number;
  outerRadius: number;
}): ArcTitleLayout {
  const { cleanTitle, arcSpan, innerRadius, outerRadius } = params;
  const arcHeight = outerRadius - innerRadius;
  const titleRadius = innerRadius + arcHeight * TITLE_RADIUS_RATIO;
  const titleFontSize = roundCoord(
    Math.min(arcHeight * TITLE_FONT_SIZE_RATIO, TITLE_FONT_SIZE_MAX)
  );
  const maxLines: 1 | 2 = arcSpan >= TWO_LINE_MIN_SPAN_DEGREES ? 2 : 1;
  const fit = fitTitleToArc(
    cleanTitle,
    arcSpan,
    titleRadius,
    titleFontSize,
    maxLines
  );
  return { titleRadius, titleFontSize, maxLines, fit };
}
