"use client";

import { AnalogClock } from "@/components/calendar/analog-clock";
import { useCalendar } from "@/components/providers/CalendarProvider";
import { ThemeScope } from "@/components/theme/theme-scope";
import { useEventDelete } from "@/hooks/useEventDelete";
import { getColorClass } from "@/lib/calendar-helpers";
import { useDateNow } from "@/lib/hooks/use-date-now";
import type { IEvent } from "@/types/calendar";
import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { format, parseISO } from "date-fns";
import { Sparkles } from "lucide-react";
import { EventDetailModal } from "./EventDetailModal";

const CLOCK_MAX_PX = 720;
const ARC_THICKNESS_RATIO = 0.08;
const EMPHASIS_STORAGE_KEY = "calendar_clock_face_emphasis";

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
  const triggerRef = useRef<HTMLElement | SVGElement | null>(null);
  const handleDelete = useEventDelete();
  const { theme } = useTheme();

  // Emphasize the clock face with a light scope (issue #319). Only meaningful
  // in `wall-projector` theme; persisted in localStorage so the toggle survives
  // reloads on always-on wall displays. Initialize synchronously from
  // localStorage when running in the browser to avoid a one-frame flicker
  // between the default state and the restored value.
  const [emphasizeFace, setEmphasizeFace] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(EMPHASIS_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      EMPHASIS_STORAGE_KEY,
      emphasizeFace ? "true" : "false"
    );
  }, [emphasizeFace]);

  const allDayToday = events
    .filter((event) => isAllDayToday(event, today))
    .sort((a, b) => a.title.localeCompare(b.title));

  const openEventById = (
    eventId: string,
    trigger: HTMLElement | SVGElement | null
  ) => {
    const match = events.find((e) => e.id === eventId);
    if (!match) return;
    triggerRef.current = trigger;
    setSelectedEvent(match);
  };

  const isWallProjector = theme === "wall-projector";

  const clockSvg = (
    <AnalogClock
      size={CLOCK_MAX_PX}
      rawEvents={events}
      arcThickness={CLOCK_MAX_PX * ARC_THICKNESS_RATIO}
      onEventClick={(eventId, trigger) => openEventById(eventId, trigger)}
    />
  );

  return (
    <div
      data-testid="analog-clock-view"
      className="grid gap-6 lg:grid-cols-[1fr_240px]"
    >
      {/* Responsive square wrapper. AnalogClock renders an SVG with explicit
          width/height attributes (720px); the descendant selector forces the
          SVG to fill its container so narrow viewports scale via the viewBox
          rather than overflowing the card. */}
      <div className="flex flex-col items-center gap-3">
        {isWallProjector && (
          <button
            type="button"
            data-testid="analog-clock-emphasis-toggle"
            aria-pressed={emphasizeFace}
            onClick={() => setEmphasizeFace((prev) => !prev)}
            className="border-border bg-card text-card-foreground hover:bg-accent focus:ring-ring inline-flex items-center gap-2 self-end rounded-md border px-3 py-1.5 text-xs transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none"
          >
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {emphasizeFace ? "Dim clock face" : "Emphasize clock face"}
          </button>
        )}
        <div
          data-testid="analog-clock-wrapper"
          className="aspect-square w-full [&>svg]:h-full [&>svg]:w-full"
          style={{ maxWidth: `${CLOCK_MAX_PX}px` }}
        >
          {emphasizeFace && isWallProjector ? (
            <ThemeScope mode="light" className="h-full w-full">
              {clockSvg}
            </ThemeScope>
          ) : (
            clockSvg
          )}
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
