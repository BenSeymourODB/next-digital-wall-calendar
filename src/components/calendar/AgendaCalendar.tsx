"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useState } from "react";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { EventDetailModal } from "./EventDetailModal";

/**
 * Filter events for the next N days from today
 */
function filterEventsForNextNDays(events: IEvent[], days: number): IEvent[] {
  const now = new Date();
  const todayStart = startOfDay(now);
  const futureEnd = new Date(todayStart);
  futureEnd.setDate(todayStart.getDate() + days);

  return events.filter((event) => {
    const eventStart = new Date(event.startDate);
    return (
      (isAfter(eventStart, todayStart) ||
        eventStart.getTime() === todayStart.getTime()) &&
      isBefore(eventStart, futureEnd)
    );
  });
}

/**
 * Sort events by start time
 */
function sortEventsByStartTime(events: IEvent[]): IEvent[] {
  return [...events].sort((a, b) => {
    const aStart = new Date(a.startDate);
    const bStart = new Date(b.startDate);
    return aStart.getTime() - bStart.getTime();
  });
}

/**
 * Check if event is all-day.
 * Uses the isAllDay flag from Google Calendar API rather than duration calculation.
 * Google marks all-day events with start.date (not start.dateTime), which is
 * captured during transformation.
 */
function isAllDayEvent(event: IEvent): boolean {
  return event.isAllDay;
}

/**
 * Group events by date
 */
function groupEventsByDate(events: IEvent[]): Map<string, IEvent[]> {
  const groups = new Map<string, IEvent[]>();

  events.forEach((event) => {
    const dateKey = format(new Date(event.startDate), "yyyy-MM-dd");
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(event);
  });

  // Sort events within each day
  groups.forEach((dayEvents, date) => {
    groups.set(date, sortEventsByStartTime(dayEvents));
  });

  return groups;
}

/**
 * Parse a date key string (yyyy-MM-dd) as local time, not UTC
 * This fixes timezone offset issues where new Date("2026-01-05") is interpreted
 * as UTC midnight, which can shift to the previous day in local timezones
 */
function parseDateKeyAsLocal(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Get color classes for event cards
 */
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

/**
 * Get color badge classes
 */
function getColorBadgeClasses(color: TEventColor): string {
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

/**
 * Event card component
 */
function EventCard({
  event,
  use24HourFormat,
  onClick,
}: {
  event: IEvent;
  use24HourFormat: boolean;
  onClick: (event: IEvent) => void;
}) {
  const isAllDay = isAllDayEvent(event);
  const startTime = format(
    new Date(event.startDate),
    use24HourFormat ? "HH:mm" : "h:mm a"
  );
  const endTime = format(
    new Date(event.endDate),
    use24HourFormat ? "HH:mm" : "h:mm a"
  );

  return (
    <button
      type="button"
      onClick={() => onClick(event)}
      className={`hover:bg-accent/40 focus:ring-ring w-full cursor-pointer rounded-lg border-l-4 p-4 text-left transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none ${getColorClasses(event.color)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="text-foreground font-semibold">{event.title}</h4>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAllDay ? "All day" : `${startTime} - ${endTime}`}
          </p>
          {event.description && (
            <p className="text-muted-foreground mt-2 text-sm">
              {event.description}
            </p>
          )}
        </div>
        <div
          className={`h-3 w-3 rounded-full ${getColorBadgeClasses(event.color)}`}
        />
      </div>
    </button>
  );
}

/**
 * Agenda calendar component
 * Displays the next 7 days of events grouped by date
 */
export function AgendaCalendar() {
  const { events, use24HourFormat, isLoading } = useCalendar();
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);

  // Filter to next 7 days from today
  const agendaEvents = filterEventsForNextNDays(events, 7);

  // Group events by date
  const groupedEvents = groupEventsByDate(agendaEvents);

  // Convert grouped events to sorted array of [date, events] pairs
  const sortedGroupedEvents = Array.from(groupedEvents.entries()).sort(
    (a, b) => {
      const dateA = parseDateKeyAsLocal(a[0]);
      const dateB = parseDateKeyAsLocal(b[0]);
      return dateA.getTime() - dateB.getTime();
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <h2 className="text-foreground text-2xl font-bold">Upcoming Events</h2>

      {/* Scrollable container */}
      <div className="border-border bg-card max-h-[600px] overflow-y-auto rounded-lg border">
        {sortedGroupedEvents.length > 0 ? (
          <div className="space-y-6 p-4">
            {sortedGroupedEvents.map(([dateKey, dayEvents]) => (
              <div key={dateKey} className="space-y-3">
                {/* Date Header - Sticky */}
                <div className="border-border bg-card sticky top-0 z-10 border-b pt-2 pb-2">
                  <h3 className="text-foreground text-lg font-semibold">
                    {format(parseDateKeyAsLocal(dateKey), "EEEE, MMMM d")}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {dayEvents.length}{" "}
                    {dayEvents.length === 1 ? "event" : "events"}
                  </p>
                </div>

                {/* Events for this date */}
                <div className="space-y-2">
                  {dayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      use24HourFormat={use24HourFormat}
                      onClick={setSelectedEvent}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="text-muted-foreground py-12 text-center">
            <p>No upcoming events in the next 7 days</p>
          </div>
        )}
      </div>

      <EventDetailModal
        event={selectedEvent}
        isOpen={selectedEvent !== null}
        onClose={() => setSelectedEvent(null)}
        use24HourFormat={use24HourFormat}
      />
    </div>
  );
}
