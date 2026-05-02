"use client";

import { AnimatedSwap } from "@/components/calendar/animated-swap";
import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { getShortWeekdayLabels } from "@/lib/calendar-helpers";
import {
  applyCalendarKeyboardAction,
  keyboardEventToAction,
} from "@/lib/calendar-keyboard";
import type { IEvent } from "@/types/calendar";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
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
import { AddEventButton } from "./AddEventButton";
import { EventDetailModal } from "./EventDetailModal";

const CELL_DATE_ATTR = "data-date";

function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

const MONTH_SLIDE_DURATION_MS = 300;

/** Stable absolute month index used to derive slide direction across year
 * boundaries (e.g. Dec 2024 -> Jan 2025 should still slide "forward"). */
function absoluteMonthIndex(date: Date): number {
  return date.getFullYear() * 12 + date.getMonth();
}

export function SimpleCalendar() {
  const {
    selectedDate,
    setSelectedDate,
    events,
    isLoading,
    maxEventsPerDay,
    use24HourFormat,
    weekStartDay,
  } = useCalendar();
  const [selectedEvent, setSelectedEvent] = useState<IEvent | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const weekdayHeaders = getShortWeekdayLabels(weekStartDay);

  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Leading padding: days from the previous month that fill the first row
  // before the 1st, measured from the user's weekStartDay setting.
  const leadingPadding = (getDay(monthStart) - weekStartDay + 7) % 7;
  const leadingPaddingDays = Array.from({ length: leadingPadding }, (_, i) => {
    const date = new Date(monthStart);
    date.setDate(date.getDate() - (leadingPadding - i));
    return date;
  });

  // Trailing padding: days from the next month that complete the final row,
  // so every row has exactly 7 cells. The grid pattern expects uniform rows.
  const totalSoFar = leadingPadding + daysInMonth.length;
  const trailingPadding = (7 - (totalSoFar % 7)) % 7;
  const trailingPaddingDays = Array.from(
    { length: trailingPadding },
    (_, i) => {
      const date = new Date(monthEnd);
      date.setDate(date.getDate() + (i + 1));
      return date;
    }
  );

  // Flatten then chunk into rows of 7 so we can render role="row" wrappers
  // cleanly.
  const allCells: Array<{ date: Date; isCurrentMonth: boolean }> = [
    ...leadingPaddingDays.map((date) => ({ date, isCurrentMonth: false })),
    ...daysInMonth.map((date) => ({ date, isCurrentMonth: true })),
    ...trailingPaddingDays.map((date) => ({ date, isCurrentMonth: false })),
  ];
  const weekRows: Array<Array<{ date: Date; isCurrentMonth: boolean }>> = [];
  for (let i = 0; i < allCells.length; i += 7) {
    weekRows.push(allCells.slice(i, i + 7));
  }

  // Track the previously rendered month so we can derive slide direction
  // automatically as the user navigates (next/prev buttons, today, keyboard,
  // mini-calendar). Uses the React-recommended "setState during render" pattern
  // (same as AnimatedSwap) so the direction is settled in a single pass; React
  // Compiler handles memoization automatically — no useMemo/useCallback needed.
  const currentMonthIndex = absoluteMonthIndex(monthStart);
  const [prevMonthIndex, setPrevMonthIndex] = useState(currentMonthIndex);
  const [slideDirection, setSlideDirection] = useState<"forward" | "backward">(
    "forward"
  );
  if (prevMonthIndex !== currentMonthIndex) {
    setSlideDirection(
      currentMonthIndex < prevMonthIndex ? "backward" : "forward"
    );
    setPrevMonthIndex(currentMonthIndex);
  }

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

  // Roving-tabindex focus sync: when the user navigates with the keyboard,
  // selectedDate updates and the DOM re-renders. After render, if the
  // previously-focused element was inside the grid, move focus to the cell
  // matching the new selectedDate so the user's focus never gets stranded.
  const gridRef = useRef<HTMLDivElement | null>(null);
  const pendingFocusRef = useRef(false);
  useEffect(() => {
    if (!pendingFocusRef.current || !gridRef.current) return;
    pendingFocusRef.current = false;
    const target = gridRef.current.querySelector<HTMLElement>(
      `[${CELL_DATE_ATTR}="${toDateKey(selectedDate)}"]`
    );
    target?.focus();
  }, [selectedDate]);

  const handleGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    // Only handle keys originating from a focusable gridcell — filtering by
    // role keeps stray events (e.g., bubbling from nested buttons) from
    // hijacking navigation.
    const targetRole = (event.target as HTMLElement).getAttribute?.("role");
    if (targetRole !== "gridcell") return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const dateKey = (event.target as HTMLElement).getAttribute(
        CELL_DATE_ATTR
      );
      if (!dateKey) return;
      const [y, m, d] = dateKey.split("-").map(Number);
      pendingFocusRef.current = true;
      setSelectedDate(new Date(y, m - 1, d));
      return;
    }

    const action = keyboardEventToAction(event);
    if (!action) return;
    event.preventDefault();
    const nextDate = applyCalendarKeyboardAction(selectedDate, action);
    pendingFocusRef.current = true;
    setSelectedDate(nextDate);
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
          <AddEventButton />
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

      {/* Calendar Grid — role="grid" wraps both the header rowgroup and the
       * body rowgroup so all rows and columnheaders are true descendants of
       * the grid per WAI-ARIA ownership rules. The role="grid" element itself
       * is intentionally stable (does NOT remount on month change) so screen
       * readers retain context; only the day-cell rowgroup inside is wrapped
       * in <AnimatedSwap> for the slide animation.
       */}
      <div
        ref={gridRef}
        role="grid"
        aria-label={`${format(selectedDate, "MMMM yyyy")} calendar`}
        aria-multiselectable="false"
        aria-rowcount={weekRows.length + 1}
        aria-colcount={7}
        onKeyDown={handleGridKeyDown}
        className="border-border bg-card rounded-lg border"
      >
        {/* Day headers — stable across month changes */}
        <div role="rowgroup">
          <div
            role="row"
            className="border-border bg-muted grid grid-cols-7 border-b"
          >
            {weekdayHeaders.map((day) => (
              <div
                key={day}
                role="columnheader"
                data-testid="calendar-dow"
                className="text-muted-foreground p-3 text-center text-sm font-semibold"
              >
                {day}
              </div>
            ))}
          </div>
        </div>

        {/* Calendar days — animated swap on month change. Direction is
         * derived from the previous month index so navigating forward slides
         * left-to-right and backward slides right-to-left. */}
        <AnimatedSwap
          swapKey={format(monthStart, "yyyy-MM")}
          type="slide"
          direction={slideDirection}
          durationMs={MONTH_SLIDE_DURATION_MS}
        >
          <div role="rowgroup" data-testid="calendar-month-grid">
            {weekRows.map((row, rowIndex) => (
              <div
                key={`row-${rowIndex}`}
                role="row"
                className="grid grid-cols-7"
              >
                {row.map(({ date, isCurrentMonth: inMonth }) => {
                  const dayEvents = inMonth ? getEventsForDay(date) : [];
                  const isToday = isSameDay(date, today);
                  const isSelected = isSameDay(date, selectedDate);
                  const dateKey = toDateKey(date);
                  const longLabel = format(date, "EEEE, MMMM d, yyyy");
                  const ariaLabel =
                    dayEvents.length === 0
                      ? longLabel
                      : `${longLabel}, ${dayEvents.length} ${
                          dayEvents.length === 1 ? "event" : "events"
                        }`;

                  if (!inMonth) {
                    // Padding cells are decorative — screen readers shouldn't
                    // navigate them, so we hide them from the a11y tree. They
                    // remain gridcells for layout/ARIA row-ownership purposes.
                    return (
                      <div
                        key={dateKey}
                        role="gridcell"
                        aria-hidden="true"
                        tabIndex={-1}
                        {...{ [CELL_DATE_ATTR]: dateKey }}
                        className="border-border bg-muted min-h-[100px] border-r border-b"
                      />
                    );
                  }

                  return (
                    <div
                      key={dateKey}
                      role="gridcell"
                      aria-label={ariaLabel}
                      {...{ [CELL_DATE_ATTR]: dateKey }}
                      aria-selected={isSelected}
                      aria-current={isToday ? "date" : undefined}
                      tabIndex={isSelected ? 0 : -1}
                      onClick={() => setSelectedDate(date)}
                      className={`border-border min-h-[100px] cursor-pointer border-r border-b p-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-inset ${
                        isToday ? "bg-blue-50 dark:bg-blue-950" : "bg-card"
                      } ${isSelected ? "ring-2 ring-blue-500 ring-inset" : ""}`}
                    >
                      <div
                        className={`mb-1 text-sm ${
                          isToday
                            ? "inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white"
                            : "text-muted-foreground"
                        }`}
                      >
                        {format(date, "d")}
                      </div>

                      {/* Events for this day */}
                      <div className="space-y-1">
                        {dayEvents.slice(0, maxEventsPerDay).map((event) => (
                          <button
                            key={event.id}
                            type="button"
                            onClick={(e) => {
                              // Don't bubble to the gridcell's onClick (which
                              // would also call setSelectedDate).
                              e.stopPropagation();
                              triggerRef.current = e.currentTarget;
                              setSelectedEvent(event);
                            }}
                            className={`block w-full cursor-pointer truncate rounded px-2 py-1 text-left text-xs transition-opacity hover:opacity-80 focus:ring-2 focus:ring-offset-1 focus:outline-none ${
                              event.color === "blue"
                                ? "bg-blue-100 text-blue-800 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:focus:ring-blue-400"
                                : event.color === "green"
                                  ? "bg-green-100 text-green-800 focus:ring-green-500 dark:bg-green-900 dark:text-green-200 dark:focus:ring-green-400"
                                  : event.color === "red"
                                    ? "bg-red-100 text-red-800 focus:ring-red-500 dark:bg-red-900 dark:text-red-200 dark:focus:ring-red-400"
                                    : event.color === "yellow"
                                      ? "bg-yellow-100 text-yellow-800 focus:ring-yellow-500 dark:bg-yellow-900 dark:text-yellow-200 dark:focus:ring-yellow-400"
                                      : event.color === "purple"
                                        ? "bg-purple-100 text-purple-800 focus:ring-purple-500 dark:bg-purple-900 dark:text-purple-200 dark:focus:ring-purple-400"
                                        : "bg-orange-100 text-orange-800 focus:ring-orange-500 dark:bg-orange-900 dark:text-orange-200 dark:focus:ring-orange-400"
                            }`}
                          >
                            {event.title}
                          </button>
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
            ))}
          </div>
        </AnimatedSwap>
      </div>

      <EventDetailModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        use24HourFormat={use24HourFormat}
        returnFocusTo={triggerRef}
      />
    </div>
  );
}
