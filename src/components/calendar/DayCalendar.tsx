"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  formatTime,
  getCurrentTimePosition,
  getEventTimePosition,
  groupEvents,
} from "@/lib/calendar-helpers";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useEffect, useState } from "react";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT_PX = 48;
const TIME_GRID_HEIGHT_PX = HOUR_HEIGHT_PX * 24;

const today = startOfDay(new Date());

function getEventBlockClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "border-l-blue-500 bg-blue-100/80 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
    green:
      "border-l-green-500 bg-green-100/80 text-green-900 dark:bg-green-900/40 dark:text-green-100",
    red: "border-l-red-500 bg-red-100/80 text-red-900 dark:bg-red-900/40 dark:text-red-100",
    yellow:
      "border-l-yellow-500 bg-yellow-100/80 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100",
    purple:
      "border-l-purple-500 bg-purple-100/80 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100",
    orange:
      "border-l-orange-500 bg-orange-100/80 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  };
  return classes[color];
}

function getAllDayPillClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    yellow:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    purple:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    orange:
      "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  };
  return classes[color];
}

function NowLine({ day }: { day: Date }) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!isSameDay(now, day)) return null;

  const { top } = getCurrentTimePosition(now);

  return (
    <div
      data-testid="day-calendar-now-line"
      className="pointer-events-none absolute right-0 left-12 z-20 flex items-center"
      style={{ top: `${top}%` }}
      aria-hidden="true"
    >
      <span className="-ml-1.5 inline-block h-3 w-3 rounded-full bg-red-500" />
      <span className="h-px flex-1 bg-red-500" />
    </div>
  );
}

function eventStartsOnDay(event: IEvent, day: Date): boolean {
  return isSameDay(parseISO(event.startDate), day);
}

export function DayCalendar() {
  const { selectedDate, setSelectedDate, events, isLoading, use24HourFormat } =
    useCalendar();

  const isToday = isSameDay(selectedDate, today);

  const dayEvents = events.filter((event) =>
    eventStartsOnDay(event, selectedDate)
  );
  const allDayEvents = dayEvents.filter((event) => event.isAllDay);
  const timedEvents = dayEvents
    .filter((event) => !event.isAllDay)
    .sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
    );
  const total = dayEvents.length;

  // Compute side-by-side columns for overlapping events using the existing
  // `groupEvents` helper. Each group is one "column" of time-stacked events;
  // events in different groups occupy adjacent sub-columns.
  const groups = groupEvents(timedEvents);
  const eventColumn: Record<string, { column: number; columns: number }> = {};
  groups.forEach((group, groupIndex) => {
    group.forEach((event) => {
      eventColumn[event.id] = { column: groupIndex, columns: groups.length };
    });
  });

  const previousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const nextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2
              className="text-foreground text-2xl font-bold"
              data-testid="day-calendar-heading"
            >
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h2>
            <span
              className="text-muted-foreground text-sm"
              data-testid="day-calendar-event-count"
            >
              {total} {total === 1 ? "event" : "events"}
            </span>
          </div>
          <p
            className="text-muted-foreground text-sm"
            data-testid="day-calendar-relative"
          >
            {isToday
              ? "Today"
              : isSameDay(selectedDate, addDays(today, 1))
                ? "Tomorrow"
                : isSameDay(selectedDate, subDays(today, 1))
                  ? "Yesterday"
                  : format(selectedDate, "PPPP")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={isToday}
            className="text-xs font-semibold"
            data-testid="day-calendar-today-btn"
            aria-label="Go to today"
          >
            {format(today, "MMM d").toUpperCase()}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={previousDay}
            data-testid="day-calendar-prev"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextDay}
            data-testid="day-calendar-next"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="text-muted-foreground text-center">
          Loading events...
        </div>
      )}

      {allDayEvents.length > 0 && (
        <section
          role="region"
          aria-label="All day events"
          className="border-border bg-card space-y-2 rounded-lg border p-3"
          aria-labelledby="day-calendar-allday-label"
        >
          <h3
            id="day-calendar-allday-label"
            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
          >
            All day
          </h3>
          <ul className="flex flex-wrap gap-2">
            {allDayEvents.map((event) => (
              <li
                key={event.id}
                className={`rounded px-2 py-1 text-xs ${getAllDayPillClasses(event.color)}`}
              >
                <span
                  className="font-medium"
                  data-testid="day-calendar-event-title"
                >
                  {event.title}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div
        className="border-border bg-card relative max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border"
        data-testid="day-calendar-grid"
        role="grid"
        aria-label={`Time grid for ${format(selectedDate, "EEEE, MMMM d")}`}
      >
        <div
          className="relative"
          style={{ height: `${TIME_GRID_HEIGHT_PX}px` }}
        >
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="border-border absolute right-0 left-0 border-b"
              style={{
                top: `${hour * HOUR_HEIGHT_PX}px`,
                height: `${HOUR_HEIGHT_PX}px`,
              }}
              aria-hidden="true"
            >
              <span className="text-muted-foreground absolute -top-2 left-1 w-10 pr-1 text-right text-[10px]">
                {use24HourFormat
                  ? `${String(hour).padStart(2, "0")}:00`
                  : hour === 0
                    ? "12 AM"
                    : hour < 12
                      ? `${hour} AM`
                      : hour === 12
                        ? "12 PM"
                        : `${hour - 12} PM`}
              </span>
            </div>
          ))}

          <NowLine day={selectedDate} />

          <div className="absolute top-0 right-2 bottom-0 left-12">
            {timedEvents.map((event) => {
              const { top, height } = getEventTimePosition(event, selectedDate);
              const slot = eventColumn[event.id] ?? { column: 0, columns: 1 };
              const widthPct = 100 / slot.columns;
              const leftPct = slot.column * widthPct;

              return (
                <div
                  key={event.id}
                  data-testid="day-calendar-event"
                  role="button"
                  aria-label={`${event.title}, ${formatTime(event.startDate, use24HourFormat)} to ${formatTime(event.endDate, use24HourFormat)}`}
                  className={`absolute overflow-hidden rounded border-l-4 px-2 py-1 text-xs ${getEventBlockClasses(event.color)}`}
                  style={{
                    top: `${top}%`,
                    height: `${height}%`,
                    left: `${leftPct}%`,
                    width: `calc(${widthPct}% - 0.25rem)`,
                  }}
                >
                  <h4
                    className="truncate font-semibold"
                    data-testid="day-calendar-event-title"
                    title={event.title}
                  >
                    {event.title}
                  </h4>
                  <p className="text-[11px] opacity-80">
                    {formatTime(event.startDate, use24HourFormat)} –{" "}
                    {formatTime(event.endDate, use24HourFormat)}
                  </p>
                  {event.description && (
                    <p className="mt-1 hidden truncate text-[11px] opacity-70 sm:block">
                      {event.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {timedEvents.length === 0 &&
          allDayEvents.length === 0 &&
          !isLoading && (
            <div className="text-muted-foreground pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-transparent text-sm">
              No events scheduled for this day
            </div>
          )}
      </div>
    </div>
  );
}
