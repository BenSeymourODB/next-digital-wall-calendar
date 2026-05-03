/**
 * SVG clock face with hour markers and clock hands.
 */

interface ClockFaceProps {
  radius: number;
  /** Current time for hand positions */
  currentTime: Date;
  /** Whether we're showing AM or PM period */
  isPM: boolean;
}

/**
 * Renders the static clock face elements: outer ring, hour markers, and numbers.
 */
export function ClockFace({ radius, currentTime, isPM }: ClockFaceProps) {
  const cx = radius;
  const cy = radius;
  const faceRadius = radius * 0.7; // Inner face area (inside the event arc ring)
  const markerOuterR = radius * 0.72;
  const markerInnerR = radius * 0.67;
  const numberR = radius * 0.58;

  // Clock hand angles (SVG: 0 = 3 o'clock, -90 = 12 o'clock)
  const hours = currentTime.getHours() % 12;
  const minutes = currentTime.getMinutes();
  const seconds = currentTime.getSeconds();

  const hourAngle = -90 + (hours + minutes / 60) * 30; // 30 degrees per hour
  const minuteAngle = -90 + minutes * 6 + seconds * 0.1; // 6 degrees per minute
  const secondAngle = -90 + seconds * 6; // 6 degrees per second

  return (
    <g data-testid="clock-face">
      {/* Clock face background */}
      <circle
        cx={cx}
        cy={cy}
        r={faceRadius}
        fill="white"
        stroke="#E5E7EB"
        strokeWidth={1}
      />

      {/* Hour markers and numbers */}
      {Array.from({ length: 12 }, (_, i) => {
        const angle = -90 + i * 30;
        const rad = (angle * Math.PI) / 180;
        const isMain = i % 3 === 0;

        const outerX = cx + markerOuterR * Math.cos(rad);
        const outerY = cy + markerOuterR * Math.sin(rad);
        const innerX = cx + markerInnerR * Math.cos(rad);
        const innerY = cy + markerInnerR * Math.sin(rad);
        const numX = cx + numberR * Math.cos(rad);
        const numY = cy + numberR * Math.sin(rad);

        const displayHour = i === 0 ? 12 : i;

        return (
          <g key={i}>
            <line
              x1={outerX}
              y1={outerY}
              x2={innerX}
              y2={innerY}
              stroke={isMain ? "#1F2937" : "#9CA3AF"}
              strokeWidth={isMain ? 2.5 : 1}
              strokeLinecap="round"
            />
            <text
              x={numX}
              y={numY}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={radius * 0.08}
              fontWeight={isMain ? "bold" : "normal"}
              fill="#374151"
              data-testid={`hour-number-${displayHour}`}
            >
              {displayHour}
            </text>
          </g>
        );
      })}

      {/* AM/PM indicator */}
      <text
        x={cx}
        y={cy + faceRadius * 0.35}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={radius * 0.07}
        fill="#9CA3AF"
        fontWeight="bold"
        data-testid="ampm-indicator"
      >
        {isPM ? "PM" : "AM"}
      </text>

      {/* Hour hand */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + faceRadius * 0.5 * Math.cos((hourAngle * Math.PI) / 180)}
        y2={cy + faceRadius * 0.5 * Math.sin((hourAngle * Math.PI) / 180)}
        stroke="#1F2937"
        strokeWidth={4}
        strokeLinecap="round"
        data-testid="hour-hand"
      />

      {/* Minute hand */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + faceRadius * 0.7 * Math.cos((minuteAngle * Math.PI) / 180)}
        y2={cy + faceRadius * 0.7 * Math.sin((minuteAngle * Math.PI) / 180)}
        stroke="#374151"
        strokeWidth={2.5}
        strokeLinecap="round"
        data-testid="minute-hand"
      />

      {/* Second hand */}
      <line
        x1={cx}
        y1={cy}
        x2={cx + faceRadius * 0.75 * Math.cos((secondAngle * Math.PI) / 180)}
        y2={cy + faceRadius * 0.75 * Math.sin((secondAngle * Math.PI) / 180)}
        stroke="#EF4444"
        strokeWidth={1}
        strokeLinecap="round"
        data-testid="second-hand"
      />

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={4} fill="#1F2937" />
    </g>
  );
}
