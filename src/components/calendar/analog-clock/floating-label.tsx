/**
 * FloatingLabel — renders an event title outside the clock face when the title
 * is too long to fit inside its arc, with a thin connector line back to the
 * arc midpoint. Used by the analog clock's overflow path (#311).
 *
 * Pure positioning — no React state. Vertical clamp delegated to
 * `clampLabelPosition` so the AnalogClockView grid row height stays stable
 * regardless of how many overflowing labels exist.
 */
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { type ClockBox, clampLabelPosition } from "./clamp-label";
import { polarToCartesian, roundCoord } from "./clock-utils";

const CHAR_WIDTH_RATIO = 0.6;
const LINE_HEIGHT_RATIO = 1.4;
const RECT_PADDING_X = 6;
const RECT_PADDING_Y = 3;
const CONNECTOR_OPACITY = 0.6;
const CONNECTOR_STROKE_WIDTH = 1;
const RECT_BORDER_OPACITY = 0.4;
const RECT_CORNER_RADIUS = 3;
const DEFAULT_FONT_SIZE = 14;

export interface FloatingLabelProps {
  /** Stable id (typically the calendar event id) used for testids and a11y. */
  id: string;
  /** Full text to render (typically `cleanTitle`). */
  text: string;
  /** Arc midpoint angle in degrees (0° = 12 o'clock, clockwise). */
  anchorAngle: number;
  /** Outer radius of the arc — connector line origin. */
  anchorRadius: number;
  /**
   * Radius of the invisible outer circle on which the label centre sits
   * (before vertical clamping).
   */
  labelRadius: number;
  /** Event color — used for connector stroke and rect border. */
  color: string;
  /** Clock centre X. */
  cx: number;
  /** Clock centre Y. */
  cy: number;
  /** Clock face vertical extents — defines the vertical clamp band. */
  clockBox: ClockBox;
  /** Optional font size override. */
  fontSize?: number;
  /**
   * Optional click handler. When provided, the group becomes focusable
   * role="button" and fires on click and on Enter/Space, mirroring EventArc.
   */
  onClick?: (id: string, trigger: SVGGElement) => void;
}

/**
 * Find the point on the boundary of an axis-aligned rectangle (centred at
 * `center` with the given `width`/`height`) along the ray from `center`
 * toward `toward`. Returns `center` if the two points coincide.
 */
function rectEdgeIntersection(
  center: { x: number; y: number },
  width: number,
  height: number,
  toward: { x: number; y: number }
): { x: number; y: number } {
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (dx === 0 && dy === 0) return center;
  const halfW = width / 2;
  const halfH = height / 2;
  const tx = dx === 0 ? Number.POSITIVE_INFINITY : halfW / Math.abs(dx);
  const ty = dy === 0 ? Number.POSITIVE_INFINITY : halfH / Math.abs(dy);
  const t = Math.min(tx, ty);
  return {
    x: center.x + t * dx,
    y: center.y + t * dy,
  };
}

export function FloatingLabel({
  id,
  text,
  anchorAngle,
  anchorRadius,
  labelRadius,
  color,
  cx,
  cy,
  clockBox,
  fontSize = DEFAULT_FONT_SIZE,
  onClick,
}: FloatingLabelProps) {
  const isInteractive = Boolean(onClick);

  const anchor = polarToCartesian(cx, cy, anchorRadius, anchorAngle);
  const idealCentre = polarToCartesian(cx, cy, labelRadius, anchorAngle);
  const centre = clampLabelPosition(idealCentre, clockBox);

  const textWidth = text.length * fontSize * CHAR_WIDTH_RATIO;
  const textHeight = fontSize * LINE_HEIGHT_RATIO;
  const rectWidth = textWidth + RECT_PADDING_X * 2;
  const rectHeight = textHeight + RECT_PADDING_Y * 2;

  const rectX = centre.x - rectWidth / 2;
  const rectY = centre.y - rectHeight / 2;

  const connectorEnd = rectEdgeIntersection(
    centre,
    rectWidth,
    rectHeight,
    anchor
  );

  const handleKeyDown = (e: ReactKeyboardEvent<SVGGElement>) => {
    if (!onClick) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(id, e.currentTarget);
    }
  };

  return (
    <g
      data-testid={`floating-label-${id}`}
      role={isInteractive ? "button" : undefined}
      aria-label={isInteractive ? `Event: ${text}` : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={
        isInteractive ? (e) => onClick?.(id, e.currentTarget) : undefined
      }
      onKeyDown={isInteractive ? handleKeyDown : undefined}
      className={
        isInteractive
          ? "cursor-pointer focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          : undefined
      }
    >
      <line
        data-testid={`floating-label-connector-${id}`}
        x1={roundCoord(anchor.x)}
        y1={roundCoord(anchor.y)}
        x2={roundCoord(connectorEnd.x)}
        y2={roundCoord(connectorEnd.y)}
        stroke={color}
        strokeOpacity={CONNECTOR_OPACITY}
        strokeWidth={CONNECTOR_STROKE_WIDTH}
      />
      <rect
        data-testid={`floating-label-rect-${id}`}
        x={roundCoord(rectX)}
        y={roundCoord(rectY)}
        width={roundCoord(rectWidth)}
        height={roundCoord(rectHeight)}
        rx={RECT_CORNER_RADIUS}
        ry={RECT_CORNER_RADIUS}
        fill="white"
        stroke={color}
        strokeOpacity={RECT_BORDER_OPACITY}
        strokeWidth={1}
      />
      <text
        data-testid={`floating-label-text-${id}`}
        x={roundCoord(centre.x)}
        y={roundCoord(centre.y)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontFamily="system-ui, -apple-system, sans-serif"
        fill="#1f2937"
      >
        {text}
      </text>
    </g>
  );
}
