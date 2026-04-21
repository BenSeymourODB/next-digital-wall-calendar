"use client";

import { AnalogClock } from "@/components/calendar/analog-clock";
import { useCalendar } from "@/components/providers/CalendarProvider";
import { getColorClass } from "@/lib/calendar-helpers";
import type { IEvent } from "@/types/calendar";
import { format, parseISO } from "date-fns";

const CLOCK_MAX_PX = 720;
const ARC_THICKNESS_RATIO = 0.08;

function isAllDayToday(event: IEvent, today: Date): boolean {
  if (!event.isAllDay) return false;
  const start = parseISO(event.startDate);
  const end = parseISO(event.endDate);
  // Consider an all-day event "for today" if today falls within [start, end).
  // All-day events typically end at the start of the next day.
  return today >= start && today < end;
}

/**
 * AnalogClockView — full-page mount of the AnalogClock for the production
 * /calendar route. The component itself filters timed events to the current
 * 12-hour period and excludes all-day events; we surface today's all-day
 * events in a sibling list so they remain visible in this view.
 */
export function AnalogClockView() {
  const { events } = useCalendar();
  const today = new Date();

  const allDayToday = events
    .filter((event) => isAllDayToday(event, today))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <div
      data-testid="analog-clock-view"
      className="grid gap-6 lg:grid-cols-[1fr_240px]"
    >
      {/* Responsive square wrapper. AnalogClock renders an SVG with explicit
          width/height attributes (720px); the descendant selector forces the
          SVG to fill its container so narrow viewports scale via the viewBox
          rather than overflowing the card. */}
      <div className="flex justify-center">
        <div
          data-testid="analog-clock-wrapper"
          className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
          style={{ maxWidth: `${CLOCK_MAX_PX}px` }}
        >
          <AnalogClock
            size={CLOCK_MAX_PX}
            rawEvents={events}
            arcThickness={CLOCK_MAX_PX * ARC_THICKNESS_RATIO}
          />
        </div>
      </div>

      <aside
        aria-label="All-day events for today"
        className="space-y-3"
        data-testid="analog-clock-all-day-aside"
      >
        <h3 className="text-foreground text-sm font-semibold">
          {format(today, "EEE, MMM d")} — all day
        </h3>
        {allDayToday.length === 0 ? (
          <p
            data-testid="analog-clock-all-day-empty"
            className="text-muted-foreground text-xs italic"
          >
            No all-day events
          </p>
        ) : (
          <ul
            role="list"
            data-testid="analog-clock-all-day-list"
            className="space-y-2"
          >
            {allDayToday.map((event) => (
              <li
                key={event.id}
                data-testid={`analog-clock-all-day-${event.id}`}
                className={`rounded-md border px-3 py-2 text-xs ${getColorClass(event.color)}`}
              >
                <div className="font-medium">{event.title}</div>
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
