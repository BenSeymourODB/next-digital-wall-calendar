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
import { computeArcTitleLayout } from "./arc-title-layout";
import { ClockFace } from "./clock-face";
import {
  eventsToClockEvents,
  filterEventsForPeriod,
  getPeriodBounds,
} from "./clock-utils";
import { EventArc } from "./event-arc";
import { FloatingLabel } from "./floating-label";
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
  onEventClick,
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

  // Per-event layout so we can decide which titles overflow the in-arc
  // budget and need to render as floating labels (#311). Computed once and
  // shared between EventArc and FloatingLabel — see arc-title-layout.ts.
  const eventLayouts = resolvedEvents.map((event) => {
    const ringIndex = ringIndices.get(event.id) ?? 0;
    const ringOuterRadius = outerRadius - ringIndex * (ringThickness + ringGap);
    const ringInnerRadius = Math.max(
      ringOuterRadius - ringThickness,
      clockRadius
    );
    const arcSpan = event.endAngle - event.startAngle;
    const layout = computeArcTitleLayout({
      cleanTitle: event.cleanTitle,
      arcSpan,
      innerRadius: ringInnerRadius,
      outerRadius: ringOuterRadius,
    });
    return {
      event,
      ringIndex,
      ringOuterRadius,
      ringInnerRadius,
      layout,
    };
  });

  // Floating-label geometry shared by every overflowing event:
  // - labelRadius sits slightly beyond the outermost arc ring.
  // - clockBox spans the SVG y-extents of the clock face plus arc band; the
  //   vertical clamp keeps every label inside [top - 0.10×h, bottom + 0.10×h]
  //   so overflowing events do not grow the AnalogClockView grid row height.
  const labelRadius = outerRadius + arcThickness * 0.6;
  const clockTop = cy - outerRadius;
  const clockBottom = cy + outerRadius;
  const clockBox = {
    top: clockTop,
    bottom: clockBottom,
    height: clockBottom - clockTop,
  };

  // When the clock is interactive (onEventClick provided), the inner arcs are
  // role="button" descendants. role="img" on the parent <svg> would tell AT to
  // treat the whole SVG as a single opaque graphic, hiding those buttons from
  // screen readers — so widen to role="group" in that mode. The non-interactive
  // mode keeps role="img" because the SVG is then a single graphic.
  return (
    <svg
      data-testid="analog-clock"
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      role={onEventClick ? "group" : "img"}
      aria-label={`Analog clock showing ${time.toLocaleTimeString()} with ${resolvedEvents.length} events`}
      className="select-none"
      // Floating off-arc labels (#311) sit beyond the SVG viewBox; the
      // `overflow` SVG attribute lets them paint outside the nominal box.
      overflow="visible"
    >
      {/* Event arcs layer (behind clock face numbers but in front of background) */}
      <g data-testid="event-arcs-layer">
        {eventLayouts.map(
          ({ event, ringIndex, ringOuterRadius, ringInnerRadius, layout }) => (
            <EventArc
              key={event.id}
              event={event}
              outerRadius={ringOuterRadius}
              innerRadius={ringInnerRadius}
              cx={cx}
              cy={cy}
              ringIndex={ringIndex}
              onEventClick={onEventClick}
              forceHideTitle={layout.fit.didOverflow}
            />
          )
        )}
      </g>

      {/* Floating off-arc title labels for overflowing events (#311). Painted
          above the arcs but below the clock face so the hands draw over any
          label that bleeds toward the centre. */}
      <g data-testid="floating-labels-layer">
        {eventLayouts
          .filter(({ layout }) => layout.fit.didOverflow)
          .sort((a, b) => a.event.startAngle - b.event.startAngle)
          .map(({ event, ringOuterRadius, layout }) => {
            const midAngle = (event.startAngle + event.endAngle) / 2;
            return (
              <FloatingLabel
                key={event.id}
                id={event.id}
                text={event.cleanTitle}
                anchorAngle={midAngle}
                anchorRadius={ringOuterRadius}
                labelRadius={labelRadius}
                color={event.color}
                cx={cx}
                cy={cy}
                clockBox={clockBox}
                fontSize={layout.titleFontSize}
                onClick={onEventClick}
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
