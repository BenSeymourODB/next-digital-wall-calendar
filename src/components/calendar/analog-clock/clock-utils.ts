/**
 * Utility functions for the analog clock with calendar event arcs
 */
import { TAILWIND_COLORS } from "@/lib/color-utils";
import type { IEvent } from "@/types/calendar";
import type { ArcAngles, ClockEvent, ParsedEventTitle } from "./types";

/** Map of color emoji to their hex color values */
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

/** Regex to match emoji characters (covers most common emoji) */
const EMOJI_REGEX =
  /^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?)/u;

/** Minimum arc span in degrees (~15 minutes on a 12-hour clock) */
const MIN_ARC_DEGREES = 7.5;

/** Total minutes in a 12-hour period */
const PERIOD_MINUTES = 720;

/**
 * Parse an event title for color emoji prefix and event emoji.
 *
 * Supported patterns:
 * - "🔴 Deadline"             → color=red, no event emoji
 * - "🟢 🎮 Family Game Night" → color=green, eventEmoji=🎮
 * - "🏋️ Gym Session"         → fallback color, eventEmoji=🏋️
 * - "Team Meeting"            → fallback color, no emoji
 */
export function parseEventTitle(
  title: string,
  fallbackColor: string
): ParsedEventTitle {
  let remaining = title;
  let colorEmoji: string | undefined;
  let eventEmoji: string | undefined;
  let color = fallbackColor;

  // Try to extract a color emoji from the start
  const colorMatch = remaining.match(EMOJI_REGEX);
  if (colorMatch) {
    const candidate = colorMatch[0];
    if (COLOR_EMOJI_MAP[candidate]) {
      colorEmoji = candidate;
      color = COLOR_EMOJI_MAP[candidate];
      remaining = remaining.slice(candidate.length).replace(/^ /, "");
    }
  }

  // Try to extract an event emoji (either after color emoji, or as first char)
  const eventMatch = remaining.match(EMOJI_REGEX);
  if (eventMatch) {
    eventEmoji = eventMatch[0];
    remaining = remaining.slice(eventEmoji.length).replace(/^ /, "");
  }

  return {
    colorEmoji,
    eventEmoji,
    cleanTitle: remaining,
    color,
  };
}

/**
 * Get the start of the current 12-hour period.
 * AM period: 12:00 AM (midnight) to 11:59 AM
 * PM period: 12:00 PM (noon) to 11:59 PM
 */
export function getPeriodStart(time: Date): Date {
  const periodStart = new Date(time);
  periodStart.setMinutes(0, 0, 0);
  periodStart.setHours(time.getHours() < 12 ? 0 : 12);
  return periodStart;
}

/**
 * Get both the start and end of the current 12-hour period.
 * periodEnd is exactly 12 hours after periodStart.
 */
export function getPeriodBounds(time: Date): {
  periodStart: Date;
  periodEnd: Date;
} {
  const periodStart = getPeriodStart(time);
  const periodEnd = new Date(periodStart.getTime() + 12 * 60 * 60 * 1000);
  return { periodStart, periodEnd };
}

/**
 * Filter raw calendar events to those that overlap a 12-hour period.
 * All-day events are excluded (they do not map to arc positions).
 *
 * Overlap is exclusive at both boundaries: an event ending exactly at
 * periodStart, or starting exactly at periodEnd, is not included.
 */
export function filterEventsForPeriod(
  events: IEvent[],
  periodStart: Date,
  periodEnd: Date
): IEvent[] {
  const startMs = periodStart.getTime();
  const endMs = periodEnd.getTime();
  return events.filter((event) => {
    if (event.isAllDay) return false;
    const eventStart = new Date(event.startDate).getTime();
    const eventEnd = new Date(event.endDate).getTime();
    return eventStart < endMs && eventEnd > startMs;
  });
}

/**
 * Convert raw calendar events (IEvent[]) into ClockEvent[] suitable for
 * rendering on the AnalogClock. Each event's title is parsed for emoji
 * prefixes, arc angles are computed against the supplied periodStart,
 * and the event's configured color is used as the fallback.
 *
 * This does not filter the events — pass through filterEventsForPeriod
 * first if you only want events for the current 12-hour period.
 */
export function eventsToClockEvents(
  events: IEvent[],
  periodStart: Date
): ClockEvent[] {
  return events.map((event) => {
    const fallbackColor = TAILWIND_COLORS[event.color];
    const parsed = parseEventTitle(event.title, fallbackColor);
    const angles = calculateArcAngles(
      new Date(event.startDate),
      new Date(event.endDate),
      periodStart
    );
    return {
      id: event.id,
      title: event.title,
      cleanTitle: parsed.cleanTitle,
      startAngle: angles.startAngle,
      endAngle: angles.endAngle,
      color: parsed.color,
      eventEmoji: parsed.eventEmoji,
      isAllDay: event.isAllDay,
    };
  });
}

/**
 * Calculate arc start/end angles for an event within a 12-hour period.
 *
 * - 0 degrees = 12 o'clock position
 * - 90 degrees = 3 o'clock position
 * - 180 degrees = 6 o'clock position
 * - 270 degrees = 9 o'clock position
 *
 * Events are clamped to the 12-hour period boundaries.
 * A minimum arc span of MIN_ARC_DEGREES is enforced for visibility.
 */
export function calculateArcAngles(
  eventStart: Date,
  eventEnd: Date,
  periodStart: Date
): ArcAngles {
  const periodEndMs = periodStart.getTime() + PERIOD_MINUTES * 60 * 1000;

  // Clamp event times to the period
  const clampedStart = Math.max(eventStart.getTime(), periodStart.getTime());
  const clampedEnd = Math.min(eventEnd.getTime(), periodEndMs);

  // Convert to minutes from period start
  const startMinutes = (clampedStart - periodStart.getTime()) / (60 * 1000);
  const endMinutes = (clampedEnd - periodStart.getTime()) / (60 * 1000);

  // Convert to degrees (720 minutes = 360 degrees)
  let startAngle = (startMinutes / PERIOD_MINUTES) * 360;
  let endAngle = (endMinutes / PERIOD_MINUTES) * 360;

  // Enforce minimum arc span
  if (endAngle - startAngle < MIN_ARC_DEGREES) {
    endAngle = startAngle + MIN_ARC_DEGREES;
    // Clamp to 360 max
    if (endAngle > 360) {
      endAngle = 360;
      startAngle = Math.max(0, endAngle - MIN_ARC_DEGREES);
    }
  }

  return { startAngle, endAngle };
}

/**
 * Convert polar coordinates (angle in degrees, radius) to cartesian (x, y).
 * 0 degrees = 12 o'clock (top), clockwise.
 */
export function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleDegrees: number
): { x: number; y: number } {
  // Offset by -90 degrees so 0° = 12 o'clock (top)
  const angleRad = ((angleDegrees - 90) * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

/**
 * Generate an SVG arc path between two angles at a given radius.
 * Creates a donut-arc (annular sector) between innerRadius and outerRadius.
 */
export function describeArc(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const outerStart = polarToCartesian(cx, cy, outerRadius, startAngle);
  const outerEnd = polarToCartesian(cx, cy, outerRadius, endAngle);
  const innerStart = polarToCartesian(cx, cy, innerRadius, startAngle);
  const innerEnd = polarToCartesian(cx, cy, innerRadius, endAngle);

  const arcSpan = endAngle - startAngle;
  const largeArcFlag = arcSpan > 180 ? 1 : 0;

  // Outer arc (clockwise), line to inner end, inner arc (counter-clockwise), close
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}
