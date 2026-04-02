"use client";

import type { IEvent } from "@/types/calendar";
import { useEffect, useState } from "react";
import { ClockFace } from "./clock-face";
import { EventArc } from "./event-arc";
import { filterEventsForPeriod, get12HourPeriod } from "./radial-clock-utils";

interface RadialClockProps {
  /** Clock diameter in pixels */
  size?: number;
  /** Calendar events to display */
  events: IEvent[];
  /** Override current time (useful for testing/demos) */
  currentTime?: Date;
  /** Arc ring thickness as fraction of radius (default: 0.2) */
  arcThickness?: number;
}

/**
 * Radial clock component that displays an analog clock face with
 * calendar events rendered as colored arcs around the outer ring.
 *
 * Events in the current 12-hour period (AM/PM) are shown as arcs
 * positioned at their corresponding time on the clock face.
 */
export function RadialClock({
  size = 600,
  events,
  currentTime: currentTimeProp,
  arcThickness = 0.2,
}: RadialClockProps) {
  const [liveTime, setLiveTime] = useState(() => new Date());

  // Update clock every second (only when no fixed time prop)
  useEffect(() => {
    if (currentTimeProp) return;
    const interval = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, [currentTimeProp]);

  const time = currentTimeProp ?? liveTime;

  const radius = size / 2;
  const thickness = radius * arcThickness;
  const { periodStart, periodEnd } = get12HourPeriod(time);
  const isPM = time.getHours() >= 12;

  const periodEvents = filterEventsForPeriod(events, periodStart, periodEnd);

  return (
    <div
      data-testid="radial-clock"
      className="inline-block"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        role="img"
        aria-label={`Analog clock showing ${periodEvents.length} events in the current ${isPM ? "PM" : "AM"} period`}
      >
        {/* Outer ring background (where arcs go) */}
        <circle
          cx={radius}
          cy={radius}
          r={radius - 1}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={thickness}
          data-testid="arc-ring-background"
        />

        {/* Event arcs */}
        <g data-testid="event-arcs">
          {periodEvents.map((event) => (
            <EventArc
              key={event.id}
              event={event}
              periodStart={periodStart}
              radius={radius}
              thickness={thickness}
            />
          ))}
        </g>

        {/* Clock face (on top of arcs) */}
        <ClockFace radius={radius} currentTime={time} isPM={isPM} />
      </svg>
    </div>
  );
}
