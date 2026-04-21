"use client";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IEvent, TEventColor } from "@/types/calendar";
import { format } from "date-fns";
import { X } from "lucide-react";

export const MAX_INLINE_EVENTS = 3;

export const EVENT_COLOR_CLASSES: Record<TEventColor, string> = {
  blue: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  green: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  red: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  yellow:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  purple:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  orange:
    "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

function formatEventTimeRange(event: IEvent, use24HourFormat: boolean): string {
  if (event.isAllDay) {
    return "All day";
  }
  const pattern = use24HourFormat ? "HH:mm" : "h:mm a";
  return `${format(new Date(event.startDate), pattern)} - ${format(
    new Date(event.endDate),
    pattern
  )}`;
}

interface DayOverflowPopoverProps {
  day: Date;
  dayEvents: IEvent[];
  use24HourFormat: boolean;
}

export function DayOverflowPopover({
  day,
  dayEvents,
  use24HourFormat,
}: DayOverflowPopoverProps) {
  const dayKey = format(day, "yyyy-MM-dd");
  const dayHeading = format(day, "EEEE, MMMM d, yyyy");
  const overflowCount = dayEvents.length - MAX_INLINE_EVENTS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring block w-full rounded text-left text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          data-testid={`day-overflow-trigger-${dayKey}`}
          aria-label={`Show all ${dayEvents.length} events for ${dayHeading}`}
        >
          +{overflowCount} more
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="w-80"
        data-testid={`day-events-popover-${dayKey}`}
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-foreground text-sm font-semibold">
            Events on {dayHeading}
          </h3>
          <PopoverClose
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring -mt-1 -mr-1 rounded p-1 focus-visible:ring-2 focus-visible:outline-none"
            aria-label={`Close events for ${dayHeading}`}
            data-testid={`day-events-popover-close-${dayKey}`}
          >
            <X className="h-4 w-4" />
          </PopoverClose>
        </div>
        <ul className="mt-3 space-y-2">
          {dayEvents.map((event) => (
            <li
              key={event.id}
              data-event-id={event.id}
              className={`rounded px-3 py-2 text-xs ${
                EVENT_COLOR_CLASSES[event.color]
              }`}
            >
              <p className="font-semibold">{event.title}</p>
              <p className="mt-0.5 opacity-80">
                {formatEventTimeRange(event, use24HourFormat)}
              </p>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
