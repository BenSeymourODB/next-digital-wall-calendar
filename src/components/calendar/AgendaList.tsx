"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useEventDelete } from "@/hooks/useEventDelete";
import { useEventEdit } from "@/hooks/useEventEdit";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useRef, useState } from "react";
import { format, isAfter, isBefore } from "date-fns";
import { Search, X } from "lucide-react";
import { groupEventsByCategory, sortCategoryEntries } from "./AgendaCalendar";
import { EventDetailModal } from "./EventDetailModal";
import { filterEventsBySearch } from "./agenda-helpers";

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
  const { use24HourFormat, agendaModeGroupBy, getAccessRole } = useCalendar();
  const handleDelete = useEventDelete();
  const handleEdit = useEventEdit();
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const triggerRef = useRef<HTMLElement | SVGElement | null>(null);

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

  const filtered = filterEventsBySearch(windowed, searchQuery);
  const searchActive = searchQuery.trim().length > 0;
  const noMatches = searchActive && filtered.length === 0;
  const matchCount = filtered.length;
  const colorGroups =
    !noMatches && agendaModeGroupBy === "color" ? groupByColor(filtered) : null;
  const categoryGroups =
    !noMatches && agendaModeGroupBy === "category"
      ? groupEventsByCategory(filtered)
      : null;

  return (
    <div className="space-y-3" data-testid="agenda-list-wrapper">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search events by title, description, or attendee…"
            aria-label="Search events"
            data-testid="agenda-list-search-input"
            className="pr-9 pl-9"
          />
          {searchActive && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              data-testid="agenda-list-search-clear"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {searchActive && (
          <span
            className="text-muted-foreground shrink-0 text-xs tabular-nums"
            data-testid="agenda-list-search-match-count"
            aria-hidden="true"
          >
            {matchCount} {matchCount === 1 ? "match" : "matches"}
          </span>
        )}
      </div>

      {/* Live region announces result count while the user types. Visually
          hidden so it doesn't displace other UI. */}
      <p
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="agenda-list-search-status"
      >
        {searchActive
          ? `${matchCount} ${matchCount === 1 ? "event matches" : "events match"} "${searchQuery.trim()}"`
          : ""}
      </p>

      <div
        className="border-border bg-card max-h-[calc(100vh-280px)] overflow-y-auto rounded-lg border"
        data-testid="agenda-list"
      >
        {noMatches ? (
          <div
            className="text-muted-foreground py-12 text-center"
            data-testid="agenda-list-search-no-matches"
          >
            <p>No events match &ldquo;{searchQuery.trim()}&rdquo;</p>
          </div>
        ) : agendaModeGroupBy === "color" && colorGroups ? (
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
        ) : agendaModeGroupBy === "category" && categoryGroups ? (
          <div className="space-y-6 p-4">
            {sortCategoryEntries(Array.from(categoryGroups.entries())).map(
              ([category, categoryEvents]) => (
                <AgendaGroup
                  key={category}
                  headerText={category}
                  eventCount={categoryEvents.length}
                >
                  {categoryEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      use24HourFormat={use24HourFormat}
                      onClick={openModal}
                    />
                  ))}
                </AgendaGroup>
              )
            )}
          </div>
        ) : (
          <div className="space-y-6 p-4">
            {Array.from(groupByDate(filtered).entries())
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
      </div>

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        use24HourFormat={use24HourFormat}
        returnFocusTo={triggerRef}
        onDelete={handleDelete}
        onEdit={handleEdit}
        accessRole={
          selectedEvent ? getAccessRole(selectedEvent.calendarId) : undefined
        }
      />
    </div>
  );
}
