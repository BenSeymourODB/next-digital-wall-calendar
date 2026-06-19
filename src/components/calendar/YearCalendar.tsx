"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { useSlideDirection } from "@/hooks/use-slide-direction";
import { getEventsForYear, parseEventStart } from "@/lib/calendar-helpers";
import { useDateNow } from "@/lib/hooks/use-date-now";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useEffect, useRef } from "react";
import {
  eachDayOfInterval,
  endOfMonth,
  endOfYear,
  format,
  getDay,
  isSameDay,
  isSameYear,
  startOfMonth,
  startOfYear,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AnimatedSwap } from "./animated-swap";

const INTRA_VIEW_SLIDE_DURATION_MS = 300;

const DOT_COLOR_CLASS: Record<TEventColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

const COLOR_DISPLAY_ORDER: TEventColor[] = [
  "blue",
  "green",
  "red",
  "yellow",
  "purple",
  "orange",
];

const MAX_DOTS_PER_DAY = 3;

const DAY_OF_WEEK_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function formatDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Pre-bucket events into a Map<dayKey, Set<TEventColor>> so each day cell
// reduces to an O(1) lookup instead of scanning the whole event array.
// Drops the year-grid render from O(events × cells) to O(events + cells).
// Exported for unit testing — the map shape is the contract that lets
// MonthPanel render dots without ever touching the raw event list.
//
// Uses the shared `parseEventStart` so the dot path and the
// `getEventsForX` count path agree on bare-date semantics (issue #375).
export function bucketEventColorsByDayKey(
  events: IEvent[]
): Map<string, Set<TEventColor>> {
  const map = new Map<string, Set<TEventColor>>();
  for (const event of events) {
    const key = formatDayKey(parseEventStart(event));
    let colors = map.get(key);
    if (!colors) {
      colors = new Set<TEventColor>();
      map.set(key, colors);
    }
    colors.add(event.color);
  }
  return map;
}

const EMPTY_COLORS: ReadonlySet<TEventColor> = new Set();

function orderedColorsForDay(
  colorsByDayKey: Map<string, Set<TEventColor>>,
  dayKey: string
): TEventColor[] {
  const colors = colorsByDayKey.get(dayKey) ?? EMPTY_COLORS;
  if (colors.size === 0) return [];
  return COLOR_DISPLAY_ORDER.filter((c) => colors.has(c));
}

interface MonthPanelProps {
  monthDate: Date;
  today: Date;
  colorsByDayKey: Map<string, Set<TEventColor>>;
  onDayClick: (date: Date) => void;
  onMonthClick: (monthDate: Date) => void;
}

function MonthPanel({
  monthDate,
  today,
  colorsByDayKey,
  onDayClick,
  onMonthClick,
}: MonthPanelProps) {
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingBlanks = getDay(monthStart);
  const monthIndex = monthDate.getMonth();

  return (
    <div
      className="border-border bg-card rounded-md border p-3"
      data-testid={`year-calendar-month-${monthIndex}`}
    >
      <button
        type="button"
        onClick={() => onMonthClick(monthDate)}
        className="text-foreground mb-2 block text-left text-sm font-semibold hover:text-blue-600 dark:hover:text-blue-400"
      >
        {format(monthDate, "MMMM")}
      </button>

      <div className="grid grid-cols-7 gap-0.5 text-center">
        {DAY_OF_WEEK_LABELS.map((label, i) => (
          <div
            key={`dow-${i}`}
            data-testid="year-calendar-dow-label"
            className="text-muted-foreground text-[10px] font-medium"
          >
            {label}
          </div>
        ))}

        {Array.from({ length: leadingBlanks }, (_, i) => (
          <div key={`blank-${i}`} aria-hidden="true" />
        ))}

        {days.map((day) => {
          const key = formatDayKey(day);
          const colors = orderedColorsForDay(colorsByDayKey, key);
          const visibleDots = colors.slice(0, MAX_DOTS_PER_DAY);
          const isToday = isSameDay(day, today);

          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(day)}
              data-testid={`year-calendar-day-${key}`}
              data-today={isToday ? "true" : "false"}
              aria-label={format(day, "EEEE, MMMM d, yyyy")}
              className={`flex aspect-square flex-col items-center justify-center rounded-sm text-[11px] transition-colors ${
                isToday
                  ? "bg-blue-600 font-semibold text-white hover:bg-blue-700"
                  : "text-foreground hover:bg-muted"
              }`}
            >
              <span className="leading-none">{day.getDate()}</span>
              <span className="mt-0.5 flex h-1.5 items-center gap-0.5">
                {visibleDots.map((color) => (
                  <span
                    key={color}
                    data-testid="year-calendar-dot"
                    className={`h-1 w-1 rounded-full ${DOT_COLOR_CLASS[color]}`}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function YearCalendar() {
  const {
    selectedDate,
    setSelectedDate,
    setView,
    events,
    isLoading,
    loadEventsForYear,
  } = useCalendar();

  const today = useDateNow();
  const year = selectedDate.getFullYear();
  const yearStart = startOfYear(selectedDate);
  const yearEnd = endOfYear(selectedDate);
  const isCurrentYear = isSameYear(selectedDate, today);

  // Ask the provider to widen its loaded range to the full year. The
  // default refresh window (-1mo / +6mo) is too narrow for the year
  // grid, so without this trigger Dec/Jan cells outside the window
  // would render blank.
  //
  // The loader function from useCalendar() gets a new identity every
  // time `loadedRange` advances (which is whenever any lazy-load
  // happens, including from `loadEventsForDate`). Re-firing this
  // effect on every such churn is wasteful — the loader is idempotent
  // once the year is covered, but it still burns a guard cycle and
  // logs a "Loading events for full year" line. Stabilize via a ref
  // so the effect re-runs only when `year` actually changes.
  const loadEventsForYearRef = useRef(loadEventsForYear);
  useEffect(() => {
    loadEventsForYearRef.current = loadEventsForYear;
  }, [loadEventsForYear]);

  useEffect(() => {
    loadEventsForYearRef.current(year);
  }, [year]);

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  // Bucket once per render: each day cell then resolves its dots via an
  // O(1) Map.get instead of scanning the full event array (was up to
  // 366 cells × N events). React Compiler memoises identity automatically.
  const colorsByDayKey = bucketEventColorsByDayKey(events);

  // Use overlap logic so an event spanning Dec → Jan is counted in both
  // years. Filtering only by `startDate` would drop the Dec 30 → Jan 2
  // case from the Jan-side year's count.
  const yearEventCount = getEventsForYear(events, selectedDate).length;

  // Prev/next-year nav lands on Jan 1 of the target year so the destination
  // doesn't depend on the month the user happened to be viewing. Issue #203
  // bug 4: previously preserved `selectedDate.getMonth()`, which made the
  // semantics "go to April 1 of the next year" rather than "go to next year".
  const previousYear = () => {
    setSelectedDate(new Date(year - 1, 0, 1));
  };

  const nextYear = () => {
    setSelectedDate(new Date(year + 1, 0, 1));
  };

  const goToToday = () => {
    setSelectedDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setView("month");
  };

  const handleMonthClick = (monthDate: Date) => {
    setSelectedDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
    setView("month");
  };

  const slideDirection = useSlideDirection(year);

  return (
    <div className="w-full space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-foreground text-2xl font-bold">
              {format(selectedDate, "yyyy")}
            </h2>
            <span
              className="text-muted-foreground text-sm"
              data-testid="year-calendar-event-count"
            >
              {yearEventCount} {yearEventCount === 1 ? "event" : "events"}
            </span>
          </div>
          <p
            className="text-muted-foreground text-sm"
            data-testid="year-calendar-date-range"
          >
            {format(yearStart, "MMM d, yyyy")} –{" "}
            {format(yearEnd, "MMM d, yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goToToday}
            disabled={isCurrentYear}
            className="text-xs font-semibold"
            data-testid="year-calendar-today-btn"
            aria-label="Go to today"
          >
            {format(today, "yyyy")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={previousYear}
            data-testid="year-calendar-prev-year"
            aria-label="Previous year"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextYear}
            data-testid="year-calendar-next-year"
            aria-label="Next year"
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

      <AnimatedSwap
        swapKey={String(year)}
        type="slide"
        direction={slideDirection}
        durationMs={INTRA_VIEW_SLIDE_DURATION_MS}
      >
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          data-testid="year-calendar-grid"
        >
          {months.map((monthDate) => (
            <MonthPanel
              key={monthDate.getMonth()}
              monthDate={monthDate}
              today={today}
              colorsByDayKey={colorsByDayKey}
              onDayClick={handleDayClick}
              onMonthClick={handleMonthClick}
            />
          ))}
        </div>
      </AnimatedSwap>
    </div>
  );
}
