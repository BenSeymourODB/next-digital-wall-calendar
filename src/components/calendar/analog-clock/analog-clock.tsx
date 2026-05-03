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
import {
  eventsToClockEvents,
  filterEventsForPeriod,
  getPeriodBounds,
} from "./clock-utils";
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
  events,
  rawEvents,
  showSeconds = false,
  currentTime,
  arcThickness = DEFAULT_ARC_THICKNESS,
}: AnalogClockProps) {
  const time = useClockTime(currentTime);

  const cx = size / 2;
  const cy = size / 2;
  const outerRadius = size / 2 - 8; // Small padding from SVG edge
  const clockRadius = outerRadius - arcThickness;

  // Resolve events: prefer `events` if provided; otherwise derive from rawEvents.
  let resolvedEvents: ClockEvent[];
  if (events) {
    resolvedEvents = events;
  } else if (rawEvents) {
    const { periodStart, periodEnd } = getPeriodBounds(time);
    const periodEvents = filterEventsForPeriod(
      rawEvents,
      periodStart,
      periodEnd
    );
    resolvedEvents = eventsToClockEvents(periodEvents, periodStart);
  } else {
    resolvedEvents = [];
  }

  // Assign ring indices for overlapping events
  const ringIndices = assignRingIndices(resolvedEvents);

  // Fit all ring slots into the band between the clock face edge and the
  // SVG outer edge. With a single ring (no overlaps) the arc fills the
  // whole band so emoji + title have enough radial room to stack. With
  // N overlapping rings, the band is split into N equal rings plus gaps.
  const maxRingIndex = resolvedEvents.reduce(
    (max, e) => Math.max(max, ringIndices.get(e.id) ?? 0),
    0
  );
  const ringCount = maxRingIndex + 1;
  const ringGap = ringCount > 1 ? Math.max(2, arcThickness * 0.06) : 0;
  const ringThickness = (arcThickness - (ringCount - 1) * ringGap) / ringCount;

  return (
    <svg
      data-testid="analog-clock"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Analog clock showing ${time.toLocaleTimeString()} with ${resolvedEvents.length} events`}
      className="select-none"
    >
      {/* Event arcs layer (behind clock face numbers but in front of background) */}
      <g data-testid="event-arcs-layer">
        {resolvedEvents.map((event) => {
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
