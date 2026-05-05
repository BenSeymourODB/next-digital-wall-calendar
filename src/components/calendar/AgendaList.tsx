"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useRef, useState } from "react";
import { format, isAfter, isBefore } from "date-fns";
import { EventDetailModal } from "./EventDetailModal";

/**
 * Reusable agenda renderer extracted from AgendaCalendar so the Day and
 * Week views can render their date range as a chronological list when
 * `agendaMode` is on (issue #150).
 *
 * Design choices:
 * - Accepts pre-fetched `events` and an explicit `[rangeStart, rangeEnd]`.
 *   The hosting view owns date navigation; this component only renders
 *   what falls inside the window.
 * - Reads `agendaModeGroupBy` and `use24HourFormat` from CalendarContext
 *   so the existing settings panel keeps working in agenda mode.
 * - No empty hours are drawn — the entire point of agenda mode is to
 *   skip the wall of whitespace that the time-grid shows for sparse days.
 */
export interface AgendaListProps {
  /** Events to consider; the component windows them by [rangeStart, rangeEnd]. */
  events: IEvent[];
  /** Inclusive lower bound of the agenda window. */
  rangeStart: Date;
  /** Inclusive upper bound of the agenda window. */
  rangeEnd: Date;
  /** Override the empty-state text (default: "No events in this range"). */
  emptyLabel?: string;
}

const COLOR_ORDER: TEventColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
];

function isWithinRange(event: IEvent, rangeStart: Date, rangeEnd: Date) {
  const eventStart = new Date(event.startDate);
  return !isBefore(eventStart, rangeStart) && !isAfter(eventStart, rangeEnd);
}

function sortByStart(events: IEvent[]): IEvent[] {
  return [...events].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
}

function groupByDate(events: IEvent[]): Map<string, IEvent[]> {
  const groups = new Map<string, IEvent[]>();
  for (const event of events) {
    const key = format(new Date(event.startDate), "yyyy-MM-dd");
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  for (const [k, list] of groups.entries()) {
    groups.set(k, sortByStart(list));
  }
  return groups;
}

function groupByColor(events: IEvent[]): Map<TEventColor, IEvent[]> {
  const groups = new Map<TEventColor, IEvent[]>();
  for (const event of events) {
    const list = groups.get(event.color) ?? [];
    list.push(event);
    groups.set(event.color, list);
  }
  for (const [k, list] of groups.entries()) {
    groups.set(k, sortByStart(list));
  }
  return groups;
}

/**
 * Parse a yyyy-MM-dd key as a local date so we don't shift to the prior
 * day in negative-UTC timezones.
 */
function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

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

interface EventCardProps {
  event: IEvent;
  use24HourFormat: boolean;
  onClick: (event: IEvent, trigger: HTMLElement) => void;
}

function EventCard({ event, use24HourFormat, onClick }: EventCardProps) {
  const startTime = format(
    new Date(event.startDate),
    use24HourFormat ? "HH:mm" : "h:mm a"
  );
  const endTime = format(
    new Date(event.endDate),
    use24HourFormat ? "HH:mm" : "h:mm a"
  );
  const hasDescription = Boolean(event.description?.trim());

  return (
    <button
      type="button"
      onClick={(e) => onClick(event, e.currentTarget)}
      className={`hover:bg-accent/40 focus:ring-ring w-full cursor-pointer rounded-lg border-l-4 p-4 text-left transition-colors focus:ring-2 focus:ring-offset-1 focus:outline-none ${getColorClasses(event.color)}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4
            className="text-foreground font-semibold"
            data-testid="agenda-list-event-title"
          >
            {event.title}
          </h4>
          <p className="text-muted-foreground mt-1 text-sm">
            {event.isAllDay ? "All day" : `${startTime} - ${endTime}`}
          </p>
          {hasDescription && (
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
    <div className="space-y-3" data-testid="agenda-list-group">
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

export function AgendaList({
  events,
  rangeStart,
  rangeEnd,
  emptyLabel = "No events in this range",
}: AgendaListProps) {
  const { use24HourFormat, agendaModeGroupBy } = useCalendar();
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const openModal = (event: IEvent, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setSelectedEvent(event);
  };

  const windowed = events.filter((event) =>
    isWithinRange(event, rangeStart, rangeEnd)
  );

  if (windowed.length === 0) {
    return (
      <div
        className="border-border bg-card text-muted-foreground rounded-lg border py-12 text-center"
        data-testid="agenda-list-empty"
      >
        <p>{emptyLabel}</p>
      </div>
    );
  }

  const colorGroups =
    agendaModeGroupBy === "color" ? groupByColor(windowed) : null;

  return (
    <div
      className="border-border bg-card max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border"
      data-testid="agenda-list"
    >
      {agendaModeGroupBy === "color" && colorGroups ? (
        <div className="space-y-6 p-4">
          {COLOR_ORDER.filter((color) => colorGroups.has(color)).map(
            (color) => {
              const colorEvents = colorGroups.get(color) ?? [];
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
                      onClick={openModal}
                    />
                  ))}
                </AgendaGroup>
              );
            }
          )}
        </div>
      ) : (
        <div className="space-y-6 p-4">
          {Array.from(groupByDate(windowed).entries())
            .sort(
              ([a], [b]) =>
                parseDateKey(a).getTime() - parseDateKey(b).getTime()
            )
            .map(([dateKey, dayEvents]) => (
              <AgendaGroup
                key={dateKey}
                headerText={format(parseDateKey(dateKey), "EEEE, MMMM d")}
                eventCount={dayEvents.length}
              >
                {dayEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    use24HourFormat={use24HourFormat}
                    onClick={openModal}
                  />
                ))}
              </AgendaGroup>
            ))}
        </div>
      )}

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        use24HourFormat={use24HourFormat}
        returnFocusTo={triggerRef}
      />
    </div>
  );
}
