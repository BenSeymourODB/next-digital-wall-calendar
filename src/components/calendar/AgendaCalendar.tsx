"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import type { IEvent, TEventColor } from "@/types/calendar";
import { format, isAfter, isBefore, startOfDay } from "date-fns";

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
 * Check if event is all-day
 */
function isAllDayEvent(event: IEvent): boolean {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  // Check if event starts at midnight and spans 24 hours or more
  const isStartMidnight = start.getHours() === 0 && start.getMinutes() === 0;
  const duration = end.getTime() - start.getTime();
  const is24HoursOrMore = duration >= 24 * 60 * 60 * 1000;

  return isStartMidnight && is24HoursOrMore;
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
 * Get color classes for event cards
 */
function getColorClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "border-blue-500 bg-blue-50",
    green: "border-green-500 bg-green-50",
    red: "border-red-500 bg-red-50",
    yellow: "border-yellow-500 bg-yellow-50",
    purple: "border-purple-500 bg-purple-50",
    orange: "border-orange-500 bg-orange-50",
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
}: {
  event: IEvent;
  use24HourFormat: boolean;
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
    <div
      className={`rounded-lg border-l-4 p-4 ${getColorClasses(event.color)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900">{event.title}</h4>
          <p className="mt-1 text-sm text-gray-600">
            {isAllDay ? "All day" : `${startTime} - ${endTime}`}
          </p>
          {event.description && (
            <p className="mt-2 text-sm text-gray-600">{event.description}</p>
          )}
        </div>
        <div
          className={`h-3 w-3 rounded-full ${getColorBadgeClasses(event.color)}`}
        />
      </div>
    </div>
  );
}

/**
 * Agenda calendar component
 * Displays the next 7 days of events grouped by date
 */
export function AgendaCalendar() {
  const { events, use24HourFormat, isLoading } = useCalendar();

  // Filter to next 7 days from today
  const agendaEvents = filterEventsForNextNDays(events, 7);

  // Group events by date
  const groupedEvents = groupEventsByDate(agendaEvents);

  // Convert grouped events to sorted array of [date, events] pairs
  const sortedGroupedEvents = Array.from(groupedEvents.entries()).sort(
    (a, b) => {
      const dateA = new Date(a[0]);
      const dateB = new Date(b[0]);
      return dateA.getTime() - dateB.getTime();
    }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-500">Loading events...</p>
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>

      {/* Scrollable container */}
      <div className="max-h-[600px] overflow-y-auto rounded-lg border border-gray-200 bg-white">
        {sortedGroupedEvents.length > 0 ? (
          <div className="space-y-6 p-4">
            {sortedGroupedEvents.map(([dateKey, dayEvents]) => (
              <div key={dateKey} className="space-y-3">
                {/* Date Header - Sticky */}
                <div className="sticky top-0 z-10 border-b border-gray-200 bg-white pt-2 pb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {format(new Date(dateKey), "EEEE, MMMM d")}
                  </h3>
                  <p className="text-sm text-gray-600">
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
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div className="py-12 text-center text-gray-500">
            <p>No upcoming events in the next 7 days</p>
          </div>
        )}
      </div>
    </div>
  );
}
