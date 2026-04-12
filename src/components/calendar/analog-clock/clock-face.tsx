/**
 * ClockFace component - renders SVG clock face with hour markers, numbers, and hands.
 * Designed as a child of an SVG element.
 */
import type { ClockFaceProps } from "./types";

/** Hour marker positions (1-12) at 30-degree intervals */
const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);

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
  const hourAngle = hours * 30 + minutes * 0.5; // 30° per hour + 0.5° per minute
  const minuteAngle = minutes * 6; // 6° per minute
  const secondAngle = seconds * 6; // 6° per second

  const isPM = time.getHours() >= 12;

  // Hand lengths relative to radius
  const hourHandLength = radius * 0.5;
  const minuteHandLength = radius * 0.7;
  const secondHandLength = radius * 0.75;

  // Marker dimensions
  const markerOuterRadius = radius * 0.92;
  const markerInnerRadius = radius * 0.84;
  const markerInnerRadiusMinor = radius * 0.88;
  const numberRadius = radius * 0.72;

  return (
    <g data-testid="clock-face">
      {/* Clock face background */}
      <circle
        data-testid="clock-face-bg"
        cx={cx}
        cy={cy}
        r={radius * 0.8}
        fill="white"
        stroke="#d1d5db"
        strokeWidth={1}
      />

      {/* Hour markers and numbers */}
      {HOURS.map((hour) => {
        const angle = hourToDegrees(hour);
        const angleRad = ((angle - 90) * Math.PI) / 180;
        const isQuarter = hour % 3 === 0;

        const outerX = cx + markerOuterRadius * Math.cos(angleRad);
        const outerY = cy + markerOuterRadius * Math.sin(angleRad);
        const innerR = isQuarter ? markerInnerRadius : markerInnerRadiusMinor;
        const innerX = cx + innerR * Math.cos(angleRad);
        const innerY = cy + innerR * Math.sin(angleRad);

        const numberX = cx + numberRadius * Math.cos(angleRad);
        const numberY = cy + numberRadius * Math.sin(angleRad);

        return (
          <g key={hour}>
            {/* Hour tick mark */}
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
            {/* Hour number */}
            <text
              data-testid={`hour-number-${hour}`}
              x={numberX}
              y={numberY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={radius * 0.12}
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
        y={cy + radius * 0.3}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={radius * 0.08}
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
        y2={cy - hourHandLength}
        stroke="#1f2937"
        strokeWidth={radius * 0.04}
        strokeLinecap="round"
        transform={`rotate(${hourAngle}, ${cx}, ${cy})`}
      />

      {/* Minute hand */}
      <line
        data-testid="minute-hand"
        x1={cx}
        y1={cy}
        x2={cx}
        y2={cy - minuteHandLength}
        stroke="#374151"
        strokeWidth={radius * 0.025}
        strokeLinecap="round"
        transform={`rotate(${minuteAngle}, ${cx}, ${cy})`}
      />

      {/* Second hand (optional) */}
      {showSeconds && (
        <line
          data-testid="second-hand"
          x1={cx}
          y1={cy + radius * 0.1}
          x2={cx}
          y2={cy - secondHandLength}
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
        r={radius * 0.03}
        fill="#1f2937"
      />
    </g>
  );
}
