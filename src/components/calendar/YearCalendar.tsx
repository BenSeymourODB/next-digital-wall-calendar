"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useEffect } from "react";
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

function getUniqueColorsForDay(events: IEvent[], day: Date): TEventColor[] {
  const colors = new Set<TEventColor>();
  for (const event of events) {
    if (isSameDay(new Date(event.startDate), day)) {
      colors.add(event.color);
    }
  }
  return COLOR_DISPLAY_ORDER.filter((c) => colors.has(c));
}

interface MonthPanelProps {
  monthDate: Date;
  today: Date;
  events: IEvent[];
  onDayClick: (date: Date) => void;
  onMonthClick: (monthDate: Date) => void;
}

function MonthPanel({
  monthDate,
  today,
  events,
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
          const colors = getUniqueColorsForDay(events, day);
          const visibleDots = colors.slice(0, MAX_DOTS_PER_DAY);
          const isToday = isSameDay(day, today);
          const key = formatDayKey(day);

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

  const today = new Date();
  const year = selectedDate.getFullYear();
  const yearStart = startOfYear(selectedDate);
  const yearEnd = endOfYear(selectedDate);
  const isCurrentYear = isSameYear(selectedDate, today);

  // Ask the provider to widen its loaded range to the full year. The
  // default refresh window (-1mo / +6mo) is too narrow for the year
  // grid, so without this trigger Dec/Jan cells outside the window
  // would render blank. The provider's loader is itself idempotent
  // when the year is already covered, so depending on `year` (rather
  // than `selectedDate`) avoids redundant fetches as the user moves
  // around within the same year.
  useEffect(() => {
    loadEventsForYear(year);
  }, [year, loadEventsForYear]);

  const months = Array.from({ length: 12 }, (_, i) => new Date(year, i, 1));

  const yearEventCount = events.filter((event) =>
    isSameYear(new Date(event.startDate), selectedDate)
  ).length;

  const previousYear = () => {
    setSelectedDate(new Date(year - 1, selectedDate.getMonth(), 1));
  };

  const nextYear = () => {
    setSelectedDate(new Date(year + 1, selectedDate.getMonth(), 1));
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

      <div
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        data-testid="year-calendar-grid"
      >
        {months.map((monthDate) => (
          <MonthPanel
            key={monthDate.getMonth()}
            monthDate={monthDate}
            today={today}
            events={events}
            onDayClick={handleDayClick}
            onMonthClick={handleMonthClick}
          />
        ))}
      </div>
    </div>
  );
}
