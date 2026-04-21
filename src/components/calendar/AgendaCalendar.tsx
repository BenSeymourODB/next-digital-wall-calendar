"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useState } from "react";
import { format, isAfter, isBefore, startOfDay } from "date-fns";
import { Search, X } from "lucide-react";

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
 * Filter events whose title or description contains the query (case-insensitive).
 * An empty/whitespace-only query returns the list unchanged.
 */
function filterEventsBySearch(events: IEvent[], query: string): IEvent[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return events;
  return events.filter((event) => {
    const haystack = `${event.title} ${event.description ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
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
 * Color display order when grouping by color — stable, predictable,
 * and matches the palette order used elsewhere in the calendar UI.
 */
const COLOR_ORDER: TEventColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
];

/**
 * Group events by color
 */
function groupEventsByColor(events: IEvent[]): Map<TEventColor, IEvent[]> {
  const groups = new Map<TEventColor, IEvent[]>();

  events.forEach((event) => {
    if (!groups.has(event.color)) {
      groups.set(event.color, []);
    }
    groups.get(event.color)!.push(event);
  });

  groups.forEach((colorEvents, color) => {
    groups.set(color, sortEventsByStartTime(colorEvents));
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

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    </div>
  );
}

function AgendaGroup({
  headerText,
  eventCount,
  children,
}: {
  headerText: string;
  eventCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="border-border bg-card sticky top-0 z-10 border-b pt-2 pb-2">
        <h3 className="text-foreground text-lg font-semibold">{headerText}</h3>
        <p className="text-muted-foreground text-sm">
          {eventCount} {eventCount === 1 ? "event" : "events"}
        </p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/**
 * Agenda calendar component
 * Displays the next 7 days of events grouped by date or color, with text search.
 */
export function AgendaCalendar() {
  const {
    events,
    use24HourFormat,
    isLoading,
    agendaModeGroupBy,
    setAgendaModeGroupBy,
  } = useCalendar();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter to next 7 days from today, then apply the search query
  const agendaEvents = filterEventsBySearch(
    filterEventsForNextNDays(events, 7),
    searchQuery
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Loading events...</p>
      </div>
    );
  }

  const hasEventsBeforeSearch = filterEventsForNextNDays(events, 7).length > 0;
  const searchActive = searchQuery.trim().length > 0;
  const noMatches = searchActive && agendaEvents.length === 0;

  return (
    <div className="w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground text-2xl font-bold">Upcoming Events</h2>

        <div
          className="flex items-center gap-1 rounded-md border p-1"
          role="group"
          aria-label="Group agenda events by"
        >
          <Button
            type="button"
            variant={agendaModeGroupBy === "date" ? "default" : "ghost"}
            size="sm"
            onClick={() => setAgendaModeGroupBy("date")}
            aria-pressed={agendaModeGroupBy === "date"}
          >
            Group by date
          </Button>
          <Button
            type="button"
            variant={agendaModeGroupBy === "color" ? "default" : "ghost"}
            size="sm"
            onClick={() => setAgendaModeGroupBy("color")}
            aria-pressed={agendaModeGroupBy === "color"}
          >
            Group by color
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
        <Input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search events by title or description…"
          aria-label="Search events"
          data-testid="agenda-search-input"
          className="pr-9 pl-9"
        />
        {searchActive && (
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            aria-label="Clear search"
            data-testid="agenda-search-clear"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="border-border bg-card max-h-[600px] overflow-y-auto rounded-lg border">
        {noMatches ? (
          <div className="text-muted-foreground py-12 text-center">
            <p>No events match &ldquo;{searchQuery.trim()}&rdquo;</p>
          </div>
        ) : !hasEventsBeforeSearch ? (
          <div className="text-muted-foreground py-12 text-center">
            <p>No upcoming events in the next 7 days</p>
          </div>
        ) : agendaModeGroupBy === "color" ? (
          <div className="space-y-6 p-4">
            {COLOR_ORDER.filter((color) =>
              groupEventsByColor(agendaEvents).has(color)
            ).map((color) => {
              const colorEvents =
                groupEventsByColor(agendaEvents).get(color) ?? [];
              return (
                <AgendaGroup
                  key={color}
                  headerText={capitalize(color)}
                  eventCount={colorEvents.length}
                >
                  {colorEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      use24HourFormat={use24HourFormat}
                    />
                  ))}
                </AgendaGroup>
              );
            })}
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {Array.from(groupEventsByDate(agendaEvents).entries())
              .sort(
                ([a], [b]) =>
                  parseDateKeyAsLocal(a).getTime() -
                  parseDateKeyAsLocal(b).getTime()
              )
              .map(([dateKey, dayEvents]) => (
                <AgendaGroup
                  key={dateKey}
                  headerText={format(
                    parseDateKeyAsLocal(dateKey),
                    "EEEE, MMMM d"
                  )}
                  eventCount={dayEvents.length}
                >
                  {dayEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      use24HourFormat={use24HourFormat}
                    />
                  ))}
                </AgendaGroup>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
