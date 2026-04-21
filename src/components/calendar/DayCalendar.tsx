"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { formatTime } from "@/lib/calendar-helpers";
import type { IEvent, TEventColor } from "@/types/calendar";
import {
  addDays,
  format,
  isSameDay,
  parseISO,
  startOfDay,
  subDays,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

// Stable reference so relative labels ("Today" / "Tomorrow" / "Yesterday")
// and the disabled state of the Today button don't drift across midnight
// within a single render pass.
const today = startOfDay(new Date());

function getColorClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "border-blue-500 bg-blue-50 dark:bg-blue-950",
    green: "border-green-500 bg-green-50 dark:bg-green-950",
    red: "border-red-500 bg-red-50 dark:bg-red-950",
    yellow: "border-yellow-500 bg-yellow-50 dark:bg-yellow-950",
    purple: "border-purple-500 bg-purple-50 dark:bg-purple-950",
    orange: "border-orange-500 bg-orange-50 dark:bg-orange-950",
  };
  return classes[color];
}

function getBadgeClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "bg-blue-500",
    green: "bg-green-500",
    red: "bg-red-500",
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
  };
  return classes[color];
}

function eventStartsOnDay(event: IEvent, day: Date): boolean {
  return isSameDay(parseISO(event.startDate), day);
}

function EventCard({
  event,
  use24HourFormat,
}: {
  event: IEvent;
  use24HourFormat: boolean;
}) {
  const start = formatTime(event.startDate, use24HourFormat);
  const end = formatTime(event.endDate, use24HourFormat);

  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${getColorClasses(event.color)}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4
            className="text-foreground font-semibold"
            data-testid="day-calendar-event-title"
          >
            {event.title}
          </h4>
          <p className="text-muted-foreground mt-1 text-sm">
            {event.isAllDay ? "All day" : `${start} – ${end}`}
          </p>
          {event.description && (
            <p className="text-muted-foreground mt-2 text-sm">
              {event.description}
            </p>
          )}
        </div>
        <div
          aria-hidden="true"
          className={`h-3 w-3 shrink-0 rounded-full ${getBadgeClasses(event.color)}`}
        />
      </div>
    </div>
  );
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

  const previousDay = () => setSelectedDate(subDays(selectedDate, 1));
  const nextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  return (
    <div className="w-full space-y-4">
      {/* Header */}
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

      {/* All-day section */}
      {allDayEvents.length > 0 && (
        <section
          className="border-border bg-card space-y-2 rounded-lg border p-4"
          aria-labelledby="day-calendar-allday-label"
        >
          <h3
            id="day-calendar-allday-label"
            className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
          >
            All day
          </h3>
          <div className="space-y-2">
            {allDayEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                use24HourFormat={use24HourFormat}
              />
            ))}
          </div>
        </section>
      )}

      {/* Timed events */}
      {timedEvents.length > 0 ? (
        <section
          className="border-border bg-card space-y-2 rounded-lg border p-4"
          aria-label="Scheduled events"
        >
          <div className="space-y-2">
            {timedEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                use24HourFormat={use24HourFormat}
              />
            ))}
          </div>
        </section>
      ) : (
        allDayEvents.length === 0 &&
        !isLoading && (
          <div className="border-border bg-card text-muted-foreground rounded-lg border py-12 text-center">
            <p>No events scheduled for this day</p>
          </div>
        )
      )}
    </div>
  );
}
