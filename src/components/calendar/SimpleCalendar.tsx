"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { WEEK_STARTS_ON, getShortWeekdayLabels } from "@/lib/calendar-helpers";
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
import { ChevronLeft, ChevronRight } from "lucide-react";

export function SimpleCalendar() {
  const { selectedDate, setSelectedDate, events, isLoading, maxEventsPerDay } =
    useCalendar();

  // Computed per render so a future user-configurable WEEK_STARTS_ON
  // flows through without a module reload. React Compiler memoizes.
  const weekdayHeaders = getShortWeekdayLabels();

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Leading padding cells before the 1st, measured from WEEK_STARTS_ON.
  const leadingPadding = (getDay(monthStart) - WEEK_STARTS_ON + 7) % 7;
  const paddingDays = Array.from({ length: leadingPadding }, (_, i) => i);

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
          {weekdayHeaders.map((day) => (
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
                  {dayEvents.slice(0, maxEventsPerDay).map((event) => (
                    <div
                      key={event.id}
                      className={`rounded px-2 py-1 text-xs ${
                        event.color === "blue"
                          ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                          : event.color === "green"
                            ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            : event.color === "red"
                              ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                              : event.color === "yellow"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                                : event.color === "purple"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                                  : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                      }`}
                    >
                      {event.title}
                    </div>
                  ))}
                  {dayEvents.length > maxEventsPerDay && (
                    <div className="text-muted-foreground text-xs">
                      +{dayEvents.length - maxEventsPerDay} more
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
