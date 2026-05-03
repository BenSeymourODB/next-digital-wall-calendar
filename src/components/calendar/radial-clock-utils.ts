import type { IEvent } from "@/types/calendar";

/**
 * Parsed result from an event title with emoji prefixes
 */
export interface ParsedEventTitle {
  colorEmoji?: string;
  eventEmoji?: string;
  cleanTitle: string;
  color: string;
}

/**
 * Color emoji to hex color mapping (Tailwind-aligned)
 */
const COLOR_EMOJI_MAP: Record<string, string> = {
  "\u{1F534}": "#EF4444", // 🔴 red-500
  "\u{1F7E0}": "#F97316", // 🟠 orange-500
  "\u{1F7E1}": "#EAB308", // 🟡 yellow-500
  "\u{1F7E2}": "#22C55E", // 🟢 green-500
  "\u{1F535}": "#3B82F6", // 🔵 blue-500
  "\u{1F7E3}": "#A855F7", // 🟣 purple-500
  "\u26AB": "#1F2937", // ⚫ gray-800
  "\u26AA": "#F3F4F6", // ⚪ gray-100
  "\u{1F7E4}": "#92400E", // 🟤 amber-800
};

const DEFAULT_COLOR = "#6B7280"; // gray-500

/**
 * Regex to match emoji characters. Covers most common emoji including
 * multi-codepoint sequences (skin tones, ZWJ, variation selectors).
 */
const EMOJI_REGEX =
  /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(\u200D(\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/u;

/**
 * Parse an event title to extract color emoji, event emoji, and clean title.
 */
export function parseEventTitle(
  title: string,
  fallbackColor?: string
): ParsedEventTitle {
  let remaining = title.trim();
  let colorEmoji: string | undefined;
  let eventEmoji: string | undefined;
  let color = fallbackColor ?? DEFAULT_COLOR;

  if (!remaining) {
    return { cleanTitle: "", color };
  }

  // Try to extract a color emoji from the start
  const colorMatch = remaining.match(
    new RegExp(`^(${Object.keys(COLOR_EMOJI_MAP).join("|")})`)
  );
  if (colorMatch) {
    colorEmoji = colorMatch[1];
    color = COLOR_EMOJI_MAP[colorEmoji];
    remaining = remaining.slice(colorEmoji.length).trim();
  }

  // Try to extract an event emoji from the (now possibly shortened) start
  if (remaining) {
    const emojiMatch = remaining.match(
      new RegExp(`^(${EMOJI_REGEX.source})`, "u")
    );
    if (emojiMatch) {
      // Only treat as event emoji if it's NOT a color emoji (to avoid double-matching)
      const candidate = emojiMatch[0];
      if (!COLOR_EMOJI_MAP[candidate]) {
        eventEmoji = candidate;
        remaining = remaining.slice(candidate.length).trim();
      }
    }
  }

  return {
    colorEmoji,
    eventEmoji,
    cleanTitle: remaining,
    color,
  };
}

/**
 * Get the 12-hour period (AM/PM) boundaries for a given date.
 */
export function get12HourPeriod(date: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = new Date(date);
  const isAM = date.getHours() < 12;

  if (isAM) {
    periodStart.setHours(0, 0, 0, 0);
  } else {
    periodStart.setHours(12, 0, 0, 0);
  }

  const periodEnd = new Date(periodStart);
  periodEnd.setHours(periodStart.getHours() + 12, 0, 0, 0);

  return { periodStart, periodEnd };
}

/**
 * Convert a time to an angle in degrees on the clock face.
 * 12 o'clock (period start) = -90 degrees (SVG top).
 * Clock goes clockwise: 3 o'clock = 0, 6 o'clock = 90, 9 o'clock = 180.
 */
export function timeToAngle(time: Date, periodStart: Date): number {
  const minutesFromStart =
    (time.getTime() - periodStart.getTime()) / (1000 * 60);
  const totalMinutes = 12 * 60; // 720 minutes in 12 hours
  const degrees = (minutesFromStart / totalMinutes) * 360;
  // SVG: 0 degrees = 3 o'clock, -90 = 12 o'clock
  return degrees - 90;
}

/**
 * Calculate start and end angles for an event arc, clamped to the period.
 */
export function calculateArcAngles(
  eventStart: Date,
  eventEnd: Date,
  periodStart: Date
): { startAngle: number; endAngle: number } {
  const periodEnd = new Date(periodStart);
  periodEnd.setHours(periodStart.getHours() + 12, 0, 0, 0);

  const clampedStart = eventStart < periodStart ? periodStart : eventStart;
  const clampedEnd = eventEnd > periodEnd ? periodEnd : eventEnd;

  return {
    startAngle: timeToAngle(clampedStart, periodStart),
    endAngle: timeToAngle(clampedEnd, periodStart),
  };
}

/**
 * Helper to convert polar coordinates to cartesian (SVG coordinates).
 */
function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDeg: number
): { x: number; y: number } {
  const angleRad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/**
 * Generate an SVG path for an arc (annular sector) between two angles.
 *
 * The arc is drawn as an annular ring between outerRadius and innerRadius
 * (outerRadius = radius, innerRadius = radius - thickness).
 */
export function calculateArcPath(
  startAngle: number,
  endAngle: number,
  radius: number,
  thickness: number
): string {
  const sweep = endAngle - startAngle;
  if (Math.abs(sweep) < 0.01) return "";

  const cx = radius;
  const cy = radius;
  const outerR = radius;
  const innerR = radius - thickness;
  const largeArc = sweep > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerR, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);

  // Draw outer arc clockwise, then inner arc counter-clockwise
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

/**
 * Filter events that overlap with the given period. Excludes all-day events.
 */
export function filterEventsForPeriod(
  events: IEvent[],
  periodStart: Date,
  periodEnd: Date
): IEvent[] {
  return events.filter((event) => {
    if (event.isAllDay) return false;
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    // Overlaps if event starts before period ends AND event ends after period starts
    return start < periodEnd && end > periodStart;
  });
}
