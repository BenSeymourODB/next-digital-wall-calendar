"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  WEEK_STARTS_ON,
  formatTime,
  getEventsForWeek,
  getShortWeekdayLabels,
  getWeekDates,
} from "@/lib/calendar-helpers";
import type { IEvent, TEventColor } from "@/types/calendar";
import {
  addDays,
  endOfWeek,
  format,
  isSameDay,
  isSameWeek,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MAX_EVENTS_PER_DAY = 3;

function getEventPillClasses(color: TEventColor): string {
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

function getEventsStartingOnDay(events: IEvent[], day: Date): IEvent[] {
  return events
    .filter((event) => isSameDay(parseISO(event.startDate), day))
    .sort(
      (a, b) =>
        parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
    );
}

export function WeekCalendar() {
  const { selectedDate, setSelectedDate, events, isLoading, use24HourFormat } =
    useCalendar();

  const weekdayHeaders = getShortWeekdayLabels();
  const weekDates = getWeekDates(selectedDate);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });

  const weekEvents = getEventsForWeek(events, selectedDate);
  const weekEventCount = weekEvents.length;

  const today = new Date();
  const isCurrentWeek = isSameWeek(selectedDate, today, {
    weekStartsOn: WEEK_STARTS_ON,
  });

  const previousWeek = () => setSelectedDate(subDays(selectedDate, 7));
  const nextWeek = () => setSelectedDate(addDays(selectedDate, 7));
  const goToToday = () => setSelectedDate(new Date());

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-2xl font-bold">
              {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")}
            </h2>
            <span
              className="text-muted-foreground text-sm"
              data-testid="week-calendar-event-count"
            >
              {weekEventCount} {weekEventCount === 1 ? "event" : "events"}
            </span>
          </div>
          <p
            className="text-muted-foreground text-sm"
            data-testid="week-calendar-range"
          >
            {format(weekStart, "MMM d, yyyy")} –{" "}
            {format(weekEnd, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={isCurrentWeek}
            className="text-xs font-semibold"
            data-testid="week-calendar-today-btn"
            aria-label="Go to this week"
          >
            {format(today, "MMM d").toUpperCase()}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={previousWeek}
            data-testid="week-calendar-prev"
            aria-label="Previous week"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextWeek}
            data-testid="week-calendar-next"
            aria-label="Next week"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="text-muted-foreground text-center">
          Loading events...
        </div>
      )}

      {/* Week grid */}
      <div className="border-border bg-card rounded-lg border">
        <div className="border-border bg-muted grid grid-cols-7 border-b">
          {weekdayHeaders.map((label) => (
            <div
              key={label}
              className="text-muted-foreground p-3 text-center text-sm font-semibold"
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {weekDates.map((day, index) => {
            const dayEvents = getEventsStartingOnDay(weekEvents, day);
            const isToday = isSameDay(day, today);
            const visible = dayEvents.slice(0, MAX_EVENTS_PER_DAY);
            const overflow = dayEvents.length - visible.length;

            return (
              <div
                key={day.toISOString()}
                data-testid={isToday ? "week-calendar-today-cell" : undefined}
                className={`border-border min-h-[240px] border-r border-b p-2 last:border-r-0 ${
                  isToday ? "bg-blue-50 dark:bg-blue-950" : "bg-card"
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-muted-foreground text-xs font-medium">
                    {weekdayHeaders[index]}
                  </span>
                  <span
                    className={
                      isToday
                        ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-sm text-white"
                        : "text-foreground text-sm font-semibold"
                    }
                  >
                    {format(day, "d")}
                  </span>
                </div>

                <div className="space-y-1">
                  {visible.map((event) => (
                    <div
                      key={event.id}
                      className={`truncate rounded px-2 py-1 text-xs ${getEventPillClasses(event.color)}`}
                      title={event.title}
                    >
                      {!event.isAllDay && (
                        <span className="mr-1 font-medium">
                          {formatTime(event.startDate, use24HourFormat)}
                        </span>
                      )}
                      {event.title}
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-muted-foreground text-xs">
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
