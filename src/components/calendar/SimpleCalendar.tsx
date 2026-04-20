"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IEvent, TEventColor } from "@/types/calendar";
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

const MAX_INLINE_EVENTS = 3;

const EVENT_COLOR_CLASSES: Record<TEventColor, string> = {
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

function formatEventTimeRange(event: IEvent, use24HourFormat: boolean): string {
  if (event.isAllDay) {
    return "All day";
  }
  const pattern = use24HourFormat ? "HH:mm" : "h:mm a";
  return `${format(new Date(event.startDate), pattern)} - ${format(
    new Date(event.endDate),
    pattern
  )}`;
}

function DayOverflowPopover({
  day,
  dayEvents,
  use24HourFormat,
}: {
  day: Date;
  dayEvents: IEvent[];
  use24HourFormat: boolean;
}) {
  const dayKey = format(day, "yyyy-MM-dd");
  const dayHeading = format(day, "EEEE, MMMM d, yyyy");
  const overflowCount = dayEvents.length - MAX_INLINE_EVENTS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring block w-full rounded text-left text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          data-testid={`day-overflow-trigger-${dayKey}`}
          aria-label={`Show all ${dayEvents.length} events for ${dayHeading}`}
        >
          +{overflowCount} more
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-80"
        data-testid={`day-events-popover-${dayKey}`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-foreground text-sm font-semibold">
            Events on {dayHeading}
          </h3>
          <PopoverClose
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mt-1 -mr-1 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Close events for ${dayHeading}`}
            data-testid={`day-events-popover-close-${dayKey}`}
          >
            <X className="h-4 w-4" />
          </PopoverClose>
        </div>
        <ul className="mt-3 space-y-2">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              className={`rounded px-3 py-2 text-xs ${
                EVENT_COLOR_CLASSES[event.color]
              }`}
            >
              <p className="font-semibold">{event.title}</p>
              <p className="mt-0.5 opacity-80">
                {formatEventTimeRange(event, use24HourFormat)}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

export function SimpleCalendar() {
  const { selectedDate, setSelectedDate, events, isLoading, use24HourFormat } =
    useCalendar();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the day of week for the first day (0 = Sunday, 6 = Saturday)
  const startDayOfWeek = getDay(monthStart);

  // Create padding cells for days before the first day of the month
  const paddingDays = Array.from({ length: startDayOfWeek }, (_, i) => i);

  const previousMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const nextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const getEventsForDay = (day: Date) => {
    return events.filter((event) => {
      const eventStart = new Date(event.startDate);
      return isSameDay(eventStart, day);
    });
  };

  const today = new Date();
  const isCurrentMonth = isSameMonth(selectedDate, today);

  // Count events in the displayed month
  const monthEventCount = events.filter((event) => {
    const eventStart = new Date(event.startDate);
    return (
      (isAfter(eventStart, monthStart) ||
        eventStart.getTime() === monthStart.getTime()) &&
      (isBefore(eventStart, monthEnd) ||
        eventStart.getTime() === monthEnd.getTime())
    );
  }).length;

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-2xl font-bold">
              {format(selectedDate, "MMMM yyyy")}
            </h2>
            <span
              className="text-muted-foreground text-sm"
              data-testid="calendar-event-count"
            >
              {monthEventCount} {monthEventCount === 1 ? "event" : "events"}
            </span>
          </div>
          <p
            className="text-muted-foreground text-sm"
            data-testid="calendar-date-range"
          >
            {format(monthStart, "MMM d, yyyy")} –{" "}
            {format(monthEnd, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={isCurrentMonth}
            className="text-xs font-semibold"
            data-testid="calendar-today-btn"
            aria-label="Go to today"
          >
            {format(today, "MMM d").toUpperCase()}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={previousMonth}
            data-testid="calendar-prev-month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            data-testid="calendar-next-month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="text-muted-foreground text-center">
          Loading events...
        </div>
      )}

      {/* Calendar Grid */}
      <div className="border-border bg-card rounded-lg border">
        {/* Day headers */}
        <div className="border-border bg-muted grid grid-cols-7 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-muted-foreground p-3 text-center text-sm font-semibold"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {/* Padding cells for days before the first day of the month */}
          {paddingDays.map((index) => (
            <div
              key={`padding-${index}`}
              className="border-border bg-muted min-h-[100px] border-r border-b"
            />
          ))}

          {/* Actual days of the month */}
          {daysInMonth.map((day) => {
            const dayEvents = getEventsForDay(day);
            const isToday = isSameDay(day, today);

            return (
              <div
                key={day.toISOString()}
                className={`border-border min-h-[100px] border-r border-b p-2 ${
                  isToday ? "bg-blue-50 dark:bg-blue-950" : "bg-card"
                }`}
              >
                <div
                  className={`mb-1 text-sm ${
                    isToday
                      ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
                      : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </div>

                {/* Events for this day */}
                <div className="space-y-1">
                  {dayEvents.slice(0, MAX_INLINE_EVENTS).map((event) => (
                    <div
                      key={event.id}
                      className={`rounded px-2 py-1 text-xs ${
                        EVENT_COLOR_CLASSES[event.color]
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > MAX_INLINE_EVENTS && (
                    <DayOverflowPopover
                      day={day}
                      dayEvents={dayEvents}
                      use24HourFormat={use24HourFormat}
                    />
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
