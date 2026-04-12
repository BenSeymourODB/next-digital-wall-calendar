/**
 * EventArc component - renders a single calendar event as a colored SVG arc
 * on the border of the analog clock face.
 */
import { describeArc, polarToCartesian } from "./clock-utils";
import type { EventArcProps } from "./types";

export function EventArc({
  event,
  outerRadius,
  innerRadius,
  cx,
  cy,
}: EventArcProps) {
  const { id, cleanTitle, color, eventEmoji, startAngle, endAngle } = event;

  // Generate the arc path
  const arcPath = describeArc(
    cx,
    cy,
    outerRadius,
    innerRadius,
    startAngle,
    endAngle
  );

  // Calculate midpoint angle for positioning text/emoji
  const midAngle = (startAngle + endAngle) / 2;
  const textRadius = (outerRadius + innerRadius) / 2;
  const textPos = polarToCartesian(cx, cy, textRadius, midAngle);

  // Calculate arc span in degrees to determine what fits
  const arcSpan = endAngle - startAngle;
  const showTitle = arcSpan >= 20; // Only show title text if arc is wide enough

  // Text rotation: align text along the arc direction
  // For top half (270-90), text reads left-to-right
  // For bottom half (90-270), flip so text isn't upside-down
  const textRotation =
    midAngle > 90 && midAngle < 270 ? midAngle + 180 : midAngle;

  // Title position offset from emoji
  const titleRadius = textRadius;
  const emojiOffset = eventEmoji ? 8 : 0;
  const titleAngleOffset = eventEmoji
    ? (emojiOffset / textRadius) * (180 / Math.PI)
    : 0;
  const titleAngle = midAngle + titleAngleOffset;
  const titlePos = polarToCartesian(cx, cy, titleRadius, titleAngle);
  const titleRotation =
    titleAngle > 90 && titleAngle < 270 ? titleAngle + 180 : titleAngle;

  return (
    <g
      data-testid={`event-arc-group-${id}`}
      role="img"
      aria-label={`Event: ${cleanTitle}, ${eventEmoji || ""}`}
    >
      {/* Colored arc */}
      <path
        data-testid={`event-arc-${id}`}
        d={arcPath}
        fill={color}
        fillOpacity={0.85}
        stroke="white"
        strokeWidth={1.5}
      />

      {/* Event emoji */}
      {eventEmoji && (
        <text
          data-testid={`event-emoji-${id}`}
          x={textPos.x}
          y={textPos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min(outerRadius - innerRadius - 4, 20)}
          transform={`rotate(${textRotation}, ${textPos.x}, ${textPos.y})`}
        >
          {eventEmoji}
        </text>
      )}

      {/* Event title (only if arc is wide enough) */}
      {showTitle && (
        <text
          data-testid={`event-title-${id}`}
          x={titlePos.x}
          y={titlePos.y}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={Math.min((outerRadius - innerRadius) * 0.35, 12)}
          fontWeight={500}
          fill="white"
          fontFamily="system-ui, -apple-system, sans-serif"
          transform={`rotate(${titleRotation}, ${titlePos.x}, ${titlePos.y})`}
        >
          {cleanTitle.length > 15
            ? `${cleanTitle.slice(0, 14)}...`
            : cleanTitle}
        </text>
      )}
    </g>
  );
}
