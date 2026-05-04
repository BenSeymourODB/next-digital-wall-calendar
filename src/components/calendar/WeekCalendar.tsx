"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import {
  WEEK_STARTS_ON,
  assignBarRows,
  computeEventColumns,
  formatTime,
  getCurrentTimePosition,
  getEventTimePosition,
  getEventsForWeek,
  getShortWeekdayLabels,
  getWeekDates,
} from "@/lib/calendar-helpers";
import { useTodayStartOfDay } from "@/lib/hooks/use-date-now";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useEffect, useState } from "react";
import {
  addWeeks,
  differenceInCalendarDays,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameWeek,
  parseISO,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AgendaList } from "./AgendaList";

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT_PX = 40;
const TIME_GRID_HEIGHT_PX = HOUR_HEIGHT_PX * 24;
const BAR_ROW_HEIGHT_PX = 22;

function getEventBlockClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "border-l-blue-500 bg-blue-100/80 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100",
    green:
      "border-l-green-500 bg-green-100/80 text-green-900 dark:bg-green-900/40 dark:text-green-100",
    red: "border-l-red-500 bg-red-100/80 text-red-900 dark:bg-red-900/40 dark:text-red-100",
    yellow:
      "border-l-yellow-500 bg-yellow-100/80 text-yellow-900 dark:bg-yellow-900/40 dark:text-yellow-100",
    purple:
      "border-l-purple-500 bg-purple-100/80 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100",
    orange:
      "border-l-orange-500 bg-orange-100/80 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100",
  };
  return classes[color];
}

function getBarPillClasses(color: TEventColor): string {
  const classes: Record<TEventColor, string> = {
    blue: "bg-blue-500 text-white",
    green: "bg-green-500 text-white",
    red: "bg-red-500 text-white",
    yellow: "bg-yellow-500 text-yellow-950",
    purple: "bg-purple-500 text-white",
    orange: "bg-orange-500 text-white",
  };
  return classes[color];
}

function NowLine({ weekStart, weekEnd }: { weekStart: Date; weekEnd: Date }) {
  const [now, setNow] = useState<Date>(() => new Date());
  const visible = !isBefore(now, weekStart) && !isAfter(now, weekEnd);

  // Only tick when "now" is inside the displayed week. Past/future
  // weeks don't need the indicator and shouldn't burn a timer.
  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, [visible]);

  if (!visible) return null;

  const dayIndex = differenceInCalendarDays(now, weekStart);
  if (dayIndex < 0 || dayIndex > 6) return null;

  const { top } = getCurrentTimePosition(now);
  const widthPct = 100 / 7;
  const leftPct = dayIndex * widthPct;

  return (
    <div
      data-testid="week-calendar-now-line"
      className="pointer-events-none absolute z-20 flex items-center"
      style={{
        top: `${top}%`,
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      }}
      aria-hidden="true"
    >
      <span className="-ml-1.5 inline-block h-3 w-3 rounded-full bg-red-500" />
      <span className="h-px flex-1 bg-red-500" />
    </div>
  );
}

function isMultiDayEvent(event: IEvent): boolean {
  if (event.isAllDay) return true;
  return !isSameDay(parseISO(event.startDate), parseISO(event.endDate));
}

export function WeekCalendar() {
  const {
    selectedDate,
    setSelectedDate,
    events,
    isLoading,
    use24HourFormat,
    agendaMode,
  } = useCalendar();

  const today = useTodayStartOfDay();
  const weekdayHeaders = getShortWeekdayLabels();
  const weekDates = getWeekDates(selectedDate);
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });

  const weekEvents = getEventsForWeek(events, selectedDate);
  const weekEventCount = weekEvents.length;

  const isCurrentWeek = isSameWeek(selectedDate, today, {
    weekStartsOn: WEEK_STARTS_ON,
  });

  const previousWeek = () => setSelectedDate(subWeeks(selectedDate, 1));
  const nextWeek = () => setSelectedDate(addWeeks(selectedDate, 1));
  const goToToday = () => setSelectedDate(new Date());

  // Split into multi-day vs single-day timed events.
  const multiDayEvents = weekEvents.filter(isMultiDayEvent);
  const timedEvents = weekEvents.filter((e) => !isMultiDayEvent(e));
  const barRows = assignBarRows(multiDayEvents, weekStart, weekEnd);
  const barRowCount =
    Object.values(barRows).length === 0
      ? 0
      : Math.max(...Object.values(barRows)) + 1;

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2
              className="text-foreground text-2xl font-bold"
              data-testid="week-calendar-range"
            >
              {format(weekStart, "MMM d, yyyy")} –{" "}
              {format(weekEnd, "MMM d, yyyy")}
            </h2>
            <span
              className="text-muted-foreground text-sm"
              data-testid="week-calendar-event-count"
            >
              {weekEventCount} {weekEventCount === 1 ? "event" : "events"}
            </span>
          </div>
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

      {isLoading && (
        <div className="text-muted-foreground text-center">
          Loading events...
        </div>
      )}

      {agendaMode ? (
        <AgendaList
          events={weekEvents}
          rangeStart={weekStart}
          rangeEnd={weekEnd}
          emptyLabel={`No events from ${format(weekStart, "MMM d")} to ${format(weekEnd, "MMM d")}`}
        />
      ) : (
        <div
          className="border-border bg-card overflow-hidden rounded-lg border"
          role="grid"
          aria-label={`Week of ${format(weekStart, "MMMM d, yyyy")}`}
        >
          <div className="border-border bg-muted flex border-b" role="row">
            <div className="w-12 shrink-0" aria-hidden="true" />
            <div className="grid flex-1 grid-cols-7">
              {weekDates.map((day, index) => {
                const isTodayCell = isSameDay(day, today);
                return (
                  <div
                    key={day.toISOString()}
                    role="columnheader"
                    data-testid={
                      isTodayCell ? "week-calendar-today-cell" : undefined
                    }
                    className={`flex flex-col items-center p-2 ${isTodayCell ? "bg-blue-50 dark:bg-blue-950" : ""}`}
                  >
                    <span className="text-muted-foreground text-xs font-semibold">
                      {weekdayHeaders[index]}
                    </span>
                    <span
                      className={
                        isTodayCell
                          ? "mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-sm text-white"
                          : "text-foreground mt-0.5 text-sm font-semibold"
                      }
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {(barRowCount > 0 || multiDayEvents.length > 0) && (
            <div
              className="border-border flex border-b"
              data-testid="week-calendar-multi-day-row"
              role="row"
              aria-label="All-day and multi-day events"
            >
              <div className="w-12 shrink-0" aria-hidden="true" />
              <div
                className="relative flex-1"
                style={{
                  height: `${Math.max(barRowCount, 1) * BAR_ROW_HEIGHT_PX + 8}px`,
                }}
              >
                {multiDayEvents.map((event) => {
                  const row = barRows[event.id];
                  if (row === undefined) return null;
                  const eventStart = parseISO(event.startDate);
                  const eventEnd = parseISO(event.endDate);
                  const visibleStart =
                    eventStart < weekStart ? weekStart : eventStart;
                  const visibleEnd = eventEnd > weekEnd ? weekEnd : eventEnd;
                  const startCol = differenceInCalendarDays(
                    visibleStart,
                    weekStart
                  );
                  const span =
                    differenceInCalendarDays(visibleEnd, visibleStart) + 1;
                  const widthPct = (span * 100) / 7;
                  const leftPct = (startCol * 100) / 7;

                  return (
                    <div
                      key={event.id}
                      data-testid="week-calendar-multi-day-bar"
                      className={`absolute mx-0.5 truncate rounded px-2 py-0.5 text-xs ${getBarPillClasses(event.color)}`}
                      style={{
                        top: `${row * BAR_ROW_HEIGHT_PX + 4}px`,
                        left: `${leftPct}%`,
                        width: `calc(${widthPct}% - 0.25rem)`,
                        height: `${BAR_ROW_HEIGHT_PX - 4}px`,
                      }}
                      title={event.title}
                    >
                      <span data-testid="week-calendar-event-title">
                        {event.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="relative flex max-h-[calc(100vh-320px)] overflow-y-auto">
            <div
              className="w-12 shrink-0"
              style={{ height: `${TIME_GRID_HEIGHT_PX}px` }}
              aria-hidden="true"
            >
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="border-border relative border-b"
                  style={{ height: `${HOUR_HEIGHT_PX}px` }}
                >
                  <span className="text-muted-foreground absolute -top-2 right-1 text-[10px]">
                    {use24HourFormat
                      ? `${String(hour).padStart(2, "0")}:00`
                      : hour === 0
                        ? "12 AM"
                        : hour < 12
                          ? `${hour} AM`
                          : hour === 12
                            ? "12 PM"
                            : `${hour - 12} PM`}
                  </span>
                </div>
              ))}
            </div>

            <div
              className="relative grid flex-1 grid-cols-7"
              style={{ height: `${TIME_GRID_HEIGHT_PX}px` }}
            >
              {weekDates.map((day) => {
                const isTodayCol = isSameDay(day, today);
                const dayTimedEvents = timedEvents
                  .filter((e) => isSameDay(parseISO(e.startDate), day))
                  .sort(
                    (a, b) =>
                      parseISO(a.startDate).getTime() -
                      parseISO(b.startDate).getTime()
                  );
                const eventColumn = computeEventColumns(dayTimedEvents);

                return (
                  <div
                    key={day.toISOString()}
                    role="gridcell"
                    data-testid={`week-calendar-day-col-${format(day, "yyyy-MM-dd")}`}
                    className={`border-border relative border-r last:border-r-0 ${
                      isTodayCol ? "bg-blue-50/40 dark:bg-blue-950/40" : ""
                    }`}
                  >
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="border-border absolute right-0 left-0 border-b"
                        style={{
                          top: `${hour * HOUR_HEIGHT_PX}px`,
                          height: `${HOUR_HEIGHT_PX}px`,
                        }}
                        aria-hidden="true"
                      />
                    ))}

                    {dayTimedEvents.map((event) => {
                      const { top, height } = getEventTimePosition(event, day);
                      const slot = eventColumn[event.id] ?? {
                        column: 0,
                        columns: 1,
                      };
                      const widthPct = 100 / slot.columns;
                      const leftPct = slot.column * widthPct;

                      return (
                        <div
                          key={event.id}
                          data-testid="week-calendar-event"
                          role="button"
                          aria-label={`${event.title}, ${formatTime(event.startDate, use24HourFormat)} to ${formatTime(event.endDate, use24HourFormat)}`}
                          className={`absolute overflow-hidden rounded border-l-4 px-1 py-0.5 text-[10px] leading-tight ${getEventBlockClasses(event.color)}`}
                          style={{
                            top: `${top}%`,
                            height: `${height}%`,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 0.125rem)`,
                          }}
                        >
                          <div
                            className="truncate font-semibold"
                            data-testid="week-calendar-event-title"
                            title={event.title}
                          >
                            {event.title}
                          </div>
                          {!event.isAllDay && (
                            <div className="truncate opacity-80">
                              {formatTime(event.startDate, use24HourFormat)}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              <NowLine weekStart={weekStart} weekEnd={weekEnd} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
