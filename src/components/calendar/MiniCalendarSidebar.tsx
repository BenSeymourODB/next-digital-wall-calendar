"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { getEventsForDay } from "@/lib/calendar-helpers";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DOW_LABELS = [
  { short: "S", full: "Sunday" },
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
] as const;

const COLOR_DOT_CLASS: Record<TEventColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

function formatEventTime(event: IEvent, use24HourFormat: boolean): string {
  if (event.isAllDay) {
    return "All day";
  }
  return format(
    parseISO(event.startDate),
    use24HourFormat ? "HH:mm" : "h:mm a"
  );
}

export function MiniCalendarSidebar() {
  const {
    selectedDate,
    setSelectedDate,
    events,
    use24HourFormat,
    weekStartDay,
  } = useCalendar();

  const [viewMonth, setViewMonth] = useState<Date>(() =>
    startOfMonth(selectedDate)
  );

  const today = new Date();

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: weekStartDay });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: weekStartDay });
  const rotatedDowLabels = [
    ...DOW_LABELS.slice(weekStartDay),
    ...DOW_LABELS.slice(0, weekStartDay),
  ];
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekRows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weekRows.push(days.slice(i, i + 7));
  }

  const selectedEvents = getEventsForDay(events, selectedDate).sort(
    (a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
  );

  const goPrevMonth = () => setViewMonth((m) => subMonths(m, 1));
  const goNextMonth = () => setViewMonth((m) => addMonths(m, 1));

  const handleDayClick = (day: Date, inMonth: boolean) => {
    setSelectedDate(day);
    if (!inMonth) {
      setViewMonth(startOfMonth(day));
    }
  };

  return (
    <aside
      data-testid="mini-calendar-sidebar"
      className="border-border bg-card w-full space-y-4 rounded-lg border p-4"
      aria-label="Mini calendar sidebar"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3
          data-testid="mini-calendar-header"
          className="text-foreground text-sm font-semibold"
        >
          {format(viewMonth, "MMMM yyyy")}
        </h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goPrevMonth}
            data-testid="mini-calendar-prev-month"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={goNextMonth}
            data-testid="mini-calendar-next-month"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Month grid */}
      <div
        data-testid="mini-calendar-grid"
        role="grid"
        aria-label={format(viewMonth, "MMMM yyyy")}
      >
        <div role="row" className="mb-1 grid grid-cols-7">
          {rotatedDowLabels.map((label, i) => (
            <div
              key={`dow-${i}`}
              role="columnheader"
              aria-label={label.full}
              data-testid="mini-calendar-dow"
              className="text-muted-foreground text-center text-[11px] font-medium"
            >
              {label.short}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {weekRows.map((week, rowIdx) => (
            <div key={`week-${rowIdx}`} role="row" className="grid grid-cols-7">
              {week.map((day) => {
                const isToday = isSameDay(day, today);
                const isSelected = isSameDay(day, selectedDate);
                const inMonth = isSameMonth(day, viewMonth);
                const dayEvents = getEventsForDay(events, day);
                const firstColor = dayEvents[0]?.color;

                return (
                  <div key={day.toISOString()} role="gridcell">
                    <button
                      type="button"
                      data-testid={`mini-calendar-day-${format(day, "yyyy-MM-dd")}`}
                      data-today={isToday ? "true" : "false"}
                      data-selected={isSelected ? "true" : "false"}
                      data-in-month={inMonth ? "true" : "false"}
                      onClick={() => handleDayClick(day, inMonth)}
                      aria-label={format(day, "EEEE, MMMM d, yyyy")}
                      aria-pressed={isSelected}
                      className={[
                        "relative mx-auto flex h-8 w-8 flex-col items-center justify-center rounded-full text-xs transition-colors",
                        inMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50",
                        isToday && !isSelected
                          ? "bg-blue-600 font-semibold text-white hover:bg-blue-700"
                          : "",
                        isSelected
                          ? "ring-offset-card font-semibold ring-2 ring-blue-600 ring-offset-1"
                          : "",
                        !isToday && !isSelected ? "hover:bg-muted" : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <span>{format(day, "d")}</span>
                      {firstColor && (
                        <span
                          data-testid="mini-calendar-event-dot"
                          className={`absolute bottom-0.5 h-1 w-1 rounded-full ${COLOR_DOT_CLASS[firstColor]}`}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Events list */}
      <div className="space-y-2">
        <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
          {format(selectedDate, "EEE, MMM d")}
        </div>
        <ul data-testid="mini-calendar-events-list" className="space-y-1.5">
          {selectedEvents.length === 0 ? (
            <li className="text-muted-foreground text-xs italic">No events</li>
          ) : (
            selectedEvents.map((event) => (
              <li
                key={event.id}
                data-testid={`mini-calendar-event-${event.id}`}
                className="flex items-start gap-2 text-xs"
              >
                <span
                  data-testid="mini-calendar-list-dot"
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    COLOR_DOT_CLASS[event.color]
                  }`}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-foreground truncate font-medium">
                    {event.title}
                  </div>
                  <div className="text-muted-foreground">
                    {formatEventTime(event, use24HourFormat)}
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </aside>
  );
}
