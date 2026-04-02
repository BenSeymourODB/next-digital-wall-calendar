import type { IEvent } from "@/types/calendar";
import {
  type ParsedEventTitle,
  calculateArcAngles,
  calculateArcPath,
  parseEventTitle,
} from "./radial-clock-utils";

interface EventArcProps {
  event: IEvent;
  periodStart: Date;
  radius: number;
  thickness: number;
}

/**
 * Calculate the midpoint angle of an arc for positioning emoji/text.
 */
function midAngle(startAngle: number, endAngle: number): number {
  return (startAngle + endAngle) / 2;
}

/**
 * Convert degrees to radians.
 */
function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Renders a single event as a colored arc segment on the radial clock.
 * Displays an emoji (if present) centered on the arc.
 */
export function EventArc({
  event,
  periodStart,
  radius,
  thickness,
}: EventArcProps) {
  const eventStart = new Date(event.startDate);
  const eventEnd = new Date(event.endDate);

  const { startAngle, endAngle } = calculateArcAngles(
    eventStart,
    eventEnd,
    periodStart
  );

  const parsed: ParsedEventTitle = parseEventTitle(event.title);
  const path = calculateArcPath(startAngle, endAngle, radius, thickness);

  if (!path) return null;

  const sweepDeg = endAngle - startAngle;
  const mid = midAngle(startAngle, endAngle);
  const midR = radius - thickness / 2;
  const cx = radius;
  const cy = radius;

  // Position for emoji at arc midpoint
  const emojiX = cx + midR * Math.cos(toRad(mid));
  const emojiY = cy + midR * Math.sin(toRad(mid));

  const displayEmoji = parsed.eventEmoji;
  // Show text only if arc is wide enough (> 30 degrees ~ 1 hour)
  const showText = sweepDeg > 30 && parsed.cleanTitle;

  return (
    <g data-testid={`event-arc-${event.id}`} className="event-arc">
      {/* Arc background */}
      <path
        d={path}
        fill={parsed.color}
        opacity={0.75}
        stroke="white"
        strokeWidth={1.5}
      />

      {/* Emoji centered on arc */}
      {displayEmoji && (
        <text
          x={emojiX}
          y={emojiY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={thickness * 0.5}
          data-testid={`event-emoji-${event.id}`}
        >
          {displayEmoji}
        </text>
      )}

      {/* Event title as curved text along the arc (for wider arcs) */}
      {showText && (
        <ArcText
          text={parsed.cleanTitle}
          startAngle={startAngle}
          endAngle={endAngle}
          radius={midR}
          cx={cx}
          cy={cy}
          fontSize={thickness * 0.25}
          hasEmoji={!!displayEmoji}
        />
      )}
    </g>
  );
}

/**
 * Renders text along a circular arc path using SVG textPath.
 */
function ArcText({
  text,
  startAngle,
  endAngle,
  radius,
  cx,
  cy,
  fontSize,
  hasEmoji,
}: {
  text: string;
  startAngle: number;
  endAngle: number;
  radius: number;
  cx: number;
  cy: number;
  fontSize: number;
  hasEmoji: boolean;
}) {
  // Create an arc path for the text to follow
  const pathId = `text-path-${startAngle.toFixed(1)}-${endAngle.toFixed(1)}`;

  // Offset start if emoji present to avoid overlap
  const textStart = hasEmoji
    ? startAngle + (endAngle - startAngle) * 0.35
    : startAngle + 2;
  const textEnd = endAngle - 2;

  if (textEnd <= textStart) return null;

  const startPt = {
    x: cx + radius * Math.cos(toRad(textStart)),
    y: cy + radius * Math.sin(toRad(textStart)),
  };
  const endPt = {
    x: cx + radius * Math.cos(toRad(textEnd)),
    y: cy + radius * Math.sin(toRad(textEnd)),
  };
  const sweep = textEnd - textStart;
  const largeArc = sweep > 180 ? 1 : 0;

  const d = `M ${startPt.x} ${startPt.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPt.x} ${endPt.y}`;

  return (
    <g>
      <defs>
        <path id={pathId} d={d} fill="none" />
      </defs>
      <text
        fontSize={fontSize}
        fill="white"
        fontWeight="bold"
        data-testid="event-arc-text"
      >
        <textPath href={`#${pathId}`} startOffset="0%">
          {text}
        </textPath>
      </text>
    </g>
  );
}
