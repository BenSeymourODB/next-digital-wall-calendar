"use client";

/**
 * AnalogClock component - SVG analog clock with calendar event arcs.
 *
 * Displays a clock face with hour/minute hands and colored event arcs
 * on the outer ring. Events are rendered as donut-arc segments with
 * emoji and truncated titles.
 *
 * Overlapping events are stacked at different radii (inner rings).
 */
import { useEffect, useState } from "react";
import { ClockFace } from "./clock-face";
import { EventArc } from "./event-arc";
import type { AnalogClockProps, ClockEvent } from "./types";

/** Default clock diameter in pixels */
const DEFAULT_SIZE = 600;

/** Default arc thickness in pixels */
const DEFAULT_ARC_THICKNESS = 48;

/**
 * Detect overlapping events and assign ring indices.
 * Events that overlap in angle range get pushed to inner rings.
 */
function assignRingIndices(events: ClockEvent[]): Map<string, number> {
  const ringMap = new Map<string, number>();
  const sorted = [...events].sort((a, b) => a.startAngle - b.startAngle);

  // Track the end angles of each ring level
  const ringEnds: number[] = [];

  for (const event of sorted) {
    let assigned = false;
    for (let ring = 0; ring < ringEnds.length; ring++) {
      if (event.startAngle >= ringEnds[ring]) {
        ringMap.set(event.id, ring);
        ringEnds[ring] = event.endAngle;
        assigned = true;
        break;
      }
    }
    if (!assigned) {
      ringMap.set(event.id, ringEnds.length);
      ringEnds.push(event.endAngle);
    }
  }

  return ringMap;
}

/** Hook to provide a live-ticking clock or a fixed time for testing */
function useClockTime(currentTime?: Date): Date {
  const [liveTime, setLiveTime] = useState(() => new Date());

  useEffect(() => {
    if (currentTime) return;
    const interval = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [currentTime]);

  return currentTime ?? liveTime;
}

export function AnalogClock({
  size = DEFAULT_SIZE,
  events = [],
  showSeconds = false,
  currentTime,
  arcThickness = DEFAULT_ARC_THICKNESS,
}: AnalogClockProps) {
  const time = useClockTime(currentTime);

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 8; // Small padding from SVG edge
  const clockRadius = outerRadius - arcThickness;

  // Assign ring indices for overlapping events
  const ringIndices = assignRingIndices(events);

  // Calculate radii for stacked rings
  const ringThickness = arcThickness * 0.9;
  const ringGap = arcThickness * 0.1;

  return (
    <svg
      data-testid="analog-clock"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Analog clock showing ${time.toLocaleTimeString()} with ${events.length} events`}
      className="select-none"
    >
      {/* Event arcs layer (behind clock face numbers but in front of background) */}
      <g data-testid="event-arcs-layer">
        {events.map((event) => {
          const ringIndex = ringIndices.get(event.id) ?? 0;
          const ringOuterRadius =
            outerRadius - ringIndex * (ringThickness + ringGap);
          const ringInnerRadius = ringOuterRadius - ringThickness;

          return (
            <EventArc
              key={event.id}
              event={event}
              outerRadius={ringOuterRadius}
              innerRadius={Math.max(ringInnerRadius, clockRadius)}
              cx={cx}
              cy={cy}
              ringIndex={ringIndex}
            />
          );
        })}
      </g>

      {/* Clock face with hands (rendered on top) */}
      <ClockFace
        radius={clockRadius}
        cx={cx}
        cy={cy}
        time={time}
        showSeconds={showSeconds}
      />
    </svg>
  );
}
