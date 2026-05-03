/**
 * EventArc component - renders a single calendar event as a colored SVG arc
 * on the border of the analog clock face.
 *
 * Uses SVG textPath for curved text that follows the arc path,
 * with emoji positioned at the midpoint of the arc.
 */
import { describeArc, polarToCartesian, roundCoord } from "./clock-utils";
import type { EventArcProps } from "./types";

/**
 * Generate an SVG arc path for textPath (single arc, not a donut).
 * Goes from startAngle to endAngle at the given radius.
 * For the bottom half of the clock (90-270°), we reverse the path
 * direction so text reads left-to-right instead of upside-down.
 */
function describeTextArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const midAngle = (startAngle + endAngle) / 2;
  const isBottomHalf = midAngle > 90 && midAngle < 270;

  // For bottom half, reverse the direction so text is right-side-up
  const fromAngle = isBottomHalf ? endAngle : startAngle;
  const toAngle = isBottomHalf ? startAngle : endAngle;

  const start = polarToCartesian(cx, cy, radius, fromAngle);
  const end = polarToCartesian(cx, cy, radius, toAngle);
  const arcSpan = Math.abs(endAngle - startAngle);
  const largeArcFlag = arcSpan > 180 ? 1 : 0;
  // Sweep: 1 for clockwise (normal), 0 for counter-clockwise (reversed)
  const sweepFlag = isBottomHalf ? 0 : 1;

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`;
}

export function EventArc({
  event,
  outerRadius,
  innerRadius,
  cx,
  cy,
}: EventArcProps) {
  const { id, cleanTitle, color, eventEmoji, startAngle, endAngle } = event;

  // Generate the donut-arc path for the colored background
  const arcPath = describeArc(
    cx,
    cy,
    outerRadius,
    innerRadius,
    startAngle,
    endAngle
  );

  // Calculate arc span and midpoint
  const arcSpan = endAngle - startAngle;
  const midAngle = (startAngle + endAngle) / 2;
  const arcHeight = outerRadius - innerRadius;

  // Place emoji near the inner edge (closer to the clock face) and the
  // title near the outer edge so they stack radially instead of overlaying.
  // For arcs on the bottom half of the clock, textPath direction is reversed
  // (so text reads right-side-up); this doesn't affect the radial split.
  const emojiRadius = innerRadius + arcHeight * 0.28;
  const titleRadius = innerRadius + arcHeight * 0.68;

  // Whether we have enough room for different elements
  const showEmoji = arcSpan >= 10;
  const showTitle = arcSpan >= 20;

  // Text positioning for emoji (centered on arc midpoint, on inner radius)
  const emojiPos = polarToCartesian(cx, cy, emojiRadius, midAngle);
  const emojiRotation =
    midAngle > 90 && midAngle < 270 ? midAngle + 180 : midAngle;

  // Font sizing — arcs are now thicker so we can use more of the height
  const emojiFontSize = roundCoord(Math.min(arcHeight * 0.4, 26));
  const titleFontSize = roundCoord(Math.min(arcHeight * 0.3, 18));

  // Prepare display text: emoji + title combined for textPath
  const displayText =
    cleanTitle.length > 15 ? `${cleanTitle.slice(0, 14)}...` : cleanTitle;

  // Text path for curved title
  const textArcPath = describeTextArc(
    cx,
    cy,
    titleRadius,
    startAngle,
    endAngle
  );
  const textPathId = `text-path-${id}`;

  return (
    <g
      data-testid={`event-arc-group-${id}`}
      role="img"
      aria-label={`Event: ${cleanTitle}, ${eventEmoji || ""}`}
    >
      {/* Colored arc background */}
      <path
        data-testid={`event-arc-${id}`}
        d={arcPath}
        fill={color}
        fillOpacity={0.85}
        stroke="white"
        strokeWidth={1.5}
      />

      {/* Define the text path for curved text */}
      <defs>
        <path id={textPathId} d={textArcPath} fill="none" />
      </defs>

      {/* Event emoji - inner-radius midpoint, rotated to match arc angle */}
      {eventEmoji && showEmoji && (
        <text
          data-testid={`event-emoji-${id}`}
          x={emojiPos.x}
          y={emojiPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={emojiFontSize}
          transform={`rotate(${roundCoord(emojiRotation)}, ${emojiPos.x}, ${emojiPos.y})`}
        >
          {eventEmoji}
        </text>
      )}

      {/* Event title - curved along the arc using textPath */}
      {showTitle && (
        <text
          data-testid={`event-title-${id}`}
          fontSize={titleFontSize}
          fontWeight={500}
          fill="white"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          <textPath
            href={`#${textPathId}`}
            startOffset="50%"
            textAnchor="middle"
            dominantBaseline="central"
          >
            {displayText}
          </textPath>
        </text>
      )}
    </g>
  );
}
