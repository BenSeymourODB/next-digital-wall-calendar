/**
 * ClockFace component - renders SVG clock face with hour markers, numbers, and hands.
 * Designed as a child of an SVG element.
 */
import { roundCoord } from "./clock-utils";
import type { ClockFaceProps } from "./types";

/** Hour marker positions (1-12) at 30-degree intervals */
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);

/** Minute tick positions (60 total, skip multiples of 5 where hour markers go) */
const MINUTE_TICKS = Array.from({ length: 60 }, (_, i) => i).filter(
  (i) => i % 5 !== 0
);

/** Calculate the rotation angle for each hour number (30 degrees per hour) */
function hourToDegrees(hour: number): number {
  return hour * 30;
}

export function ClockFace({
  radius,
  cx,
  cy,
  time,
  showSeconds,
}: ClockFaceProps) {
  const hours = time.getHours() % 12;
  const minutes = time.getMinutes();
  const seconds = time.getSeconds();

  // Hand angles (0 = 12 o'clock, clockwise)
  const hourAngle = hours * 30 + minutes * 0.5;
  const minuteAngle = minutes * 6;
  const secondAngle = seconds * 6;

  const isPM = time.getHours() >= 12;

  // Face fills 80% of radius, leaving room for event arcs
  const faceRadius = radius * 0.8;

  // Hand lengths relative to face radius
  const hourHandLength = faceRadius * 0.55;
  const minuteHandLength = faceRadius * 0.75;
  const secondHandLength = faceRadius * 0.8;

  // Marker dimensions - keep entirely within the face circle
  const markerOuterRadius = faceRadius * 0.96;
  const markerInnerRadiusMajor = faceRadius * 0.84;
  const markerInnerRadiusMinor = faceRadius * 0.9;
  const minuteTickOuter = faceRadius * 0.96;
  const minuteTickInner = faceRadius * 0.93;
  const numberRadius = faceRadius * 0.72;

  return (
    <g data-testid="clock-face">
      {/* Clock face background */}
      <circle
        data-testid="clock-face-bg"
        cx={cx}
        cy={cy}
        r={faceRadius}
        fill="white"
        stroke="#e5e7eb"
        strokeWidth={1.5}
      />

      {/* Minute tick marks */}
      {MINUTE_TICKS.map((minute) => {
        const angle = minute * 6;
        const angleRad = ((angle - 90) * Math.PI) / 180;
        const outerX = roundCoord(cx + minuteTickOuter * Math.cos(angleRad));
        const outerY = roundCoord(cy + minuteTickOuter * Math.sin(angleRad));
        const innerX = roundCoord(cx + minuteTickInner * Math.cos(angleRad));
        const innerY = roundCoord(cy + minuteTickInner * Math.sin(angleRad));

        return (
          <line
            key={`min-${minute}`}
            x1={outerX}
            y1={outerY}
            x2={innerX}
            y2={innerY}
            stroke="#d1d5db"
            strokeWidth={0.75}
          />
        );
      })}

      {/* Hour markers and numbers */}
      {HOURS.map((hour) => {
        const angle = hourToDegrees(hour);
        const angleRad = ((angle - 90) * Math.PI) / 180;
        const isQuarter = hour % 3 === 0;

        const outerX = roundCoord(cx + markerOuterRadius * Math.cos(angleRad));
        const outerY = roundCoord(cy + markerOuterRadius * Math.sin(angleRad));
        const innerR = isQuarter
          ? markerInnerRadiusMajor
          : markerInnerRadiusMinor;
        const innerX = roundCoord(cx + innerR * Math.cos(angleRad));
        const innerY = roundCoord(cy + innerR * Math.sin(angleRad));

        const numberX = roundCoord(cx + numberRadius * Math.cos(angleRad));
        const numberY = roundCoord(cy + numberRadius * Math.sin(angleRad));

        return (
          <g key={hour}>
            <line
              data-testid={`hour-marker-${hour}`}
              x1={outerX}
              y1={outerY}
              x2={innerX}
              y2={innerY}
              stroke="#374151"
              strokeWidth={isQuarter ? 3 : 1.5}
              strokeLinecap="round"
            />
            <text
              data-testid={`hour-number-${hour}`}
              x={numberX}
              y={numberY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={roundCoord(faceRadius * 0.14)}
              fontWeight={isQuarter ? 700 : 500}
              fill="#1f2937"
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {hour}
            </text>
          </g>
        );
      })}

      {/* AM/PM indicator */}
      <text
        data-testid="period-indicator"
        x={cx}
        y={roundCoord(cy + faceRadius * 0.35)}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={roundCoord(faceRadius * 0.09)}
        fontWeight={600}
        fill="#9ca3af"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {isPM ? "PM" : "AM"}
      </text>

      {/* Hour hand */}
      <line
        data-testid="hour-hand"
        x1={cx}
        y1={cy}
        x2={cx}
        y2={roundCoord(cy - hourHandLength)}
        stroke="#1f2937"
        strokeWidth={roundCoord(faceRadius * 0.045)}
        strokeLinecap="round"
        transform={`rotate(${hourAngle}, ${cx}, ${cy})`}
      />

      {/* Minute hand */}
      <line
        data-testid="minute-hand"
        x1={cx}
        y1={cy}
        x2={cx}
        y2={roundCoord(cy - minuteHandLength)}
        stroke="#374151"
        strokeWidth={roundCoord(faceRadius * 0.028)}
        strokeLinecap="round"
        transform={`rotate(${minuteAngle}, ${cx}, ${cy})`}
      />

      {/* Second hand (optional) */}
      {showSeconds && (
        <line
          data-testid="second-hand"
          x1={cx}
          y1={roundCoord(cy + faceRadius * 0.12)}
          x2={cx}
          y2={roundCoord(cy - secondHandLength)}
          stroke="#ef4444"
          strokeWidth={1.5}
          strokeLinecap="round"
          transform={`rotate(${secondAngle}, ${cx}, ${cy})`}
        />
      )}

      {/* Center dot */}
      <circle
        data-testid="clock-center-dot"
        cx={cx}
        cy={cy}
        r={roundCoord(faceRadius * 0.035)}
        fill="#1f2937"
      />
    </g>
  );
}
