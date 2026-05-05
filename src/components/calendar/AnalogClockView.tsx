"use client";

import { AnalogClock } from "@/components/calendar/analog-clock";
import { useCalendar } from "@/components/providers/CalendarProvider";
import { useEventDelete } from "@/hooks/useEventDelete";
import { getColorClass } from "@/lib/calendar-helpers";
import { useDateNow } from "@/lib/hooks/use-date-now";
import type { IEvent } from "@/types/calendar";
import { useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { EventDetailModal } from "./EventDetailModal";

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
  const { events, use24HourFormat } = useCalendar();
  const today = useDateNow();
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const handleDelete = useEventDelete();

  const allDayToday = events
    .filter((event) => isAllDayToday(event, today))
    .sort((a, b) => a.title.localeCompare(b.title));

  const openEventById = (eventId: string, trigger: HTMLElement | null) => {
    const match = events.find((e) => e.id === eventId);
    if (!match) return;
    triggerRef.current = trigger;
    setSelectedEvent(match);
  };

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
            onEventClick={(eventId) => openEventById(eventId, null)}
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
              >
                <button
                  type="button"
                  data-testid={`analog-clock-all-day-${event.id}-button`}
                  onClick={(e) => openEventById(event.id, e.currentTarget)}
                  className={`focus:ring-ring block w-full cursor-pointer rounded-md border px-3 py-2 text-left text-xs transition-opacity hover:opacity-80 focus:ring-2 focus:ring-offset-1 focus:outline-none ${getColorClass(event.color)}`}
                >
                  <div className="font-medium">{event.title}</div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        use24HourFormat={use24HourFormat}
        returnFocusTo={triggerRef}
        onDelete={handleDelete}
      />
    </div>
  );
}
