"use client";

import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { IEvent, TEventColor } from "@/types/calendar";
import { useRef } from "react";
import { format } from "date-fns";
import { X } from "lucide-react";

export const MAX_INLINE_EVENTS = 3;

export const EVENT_COLOR_CLASSES: Record<TEventColor, string> = {
  blue: "bg-blue-100 text-blue-800 focus:ring-blue-500 dark:bg-blue-900 dark:text-blue-200 dark:focus:ring-blue-400",
  green:
    "bg-green-100 text-green-800 focus:ring-green-500 dark:bg-green-900 dark:text-green-200 dark:focus:ring-green-400",
  red: "bg-red-100 text-red-800 focus:ring-red-500 dark:bg-red-900 dark:text-red-200 dark:focus:ring-red-400",
  yellow:
    "bg-yellow-100 text-yellow-800 focus:ring-yellow-500 dark:bg-yellow-900 dark:text-yellow-200 dark:focus:ring-yellow-400",
  purple:
    "bg-purple-100 text-purple-800 focus:ring-purple-500 dark:bg-purple-900 dark:text-purple-200 dark:focus:ring-purple-400",
  orange:
    "bg-orange-100 text-orange-800 focus:ring-orange-500 dark:bg-orange-900 dark:text-orange-200 dark:focus:ring-orange-400",
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
  /** How many events the day cell already renders inline. The popover label
   * shows the remainder ("+N more"). Defaults to MAX_INLINE_EVENTS. */
  inlineLimit?: number;
  /** Called when a user clicks an event card inside the popover. The second
   * argument is the popover's trigger element, which the parent should use as
   * the focus-restoration target after the event-detail modal closes (the
   * card itself unmounts when the popover dismisses, so it can't receive
   * focus). */
  onSelectEvent?: (event: IEvent, popoverTrigger: HTMLElement) => void;
}

export function DayOverflowPopover({
  day,
  dayEvents,
  use24HourFormat,
  inlineLimit = MAX_INLINE_EVENTS,
  onSelectEvent,
}: DayOverflowPopoverProps) {
  const dayKey = format(day, "yyyy-MM-dd");
  const dayHeading = format(day, "EEEE, MMMM d, yyyy");
  const overflowCount = dayEvents.length - inlineLimit;
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          ref={triggerRef}
          type="button"
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring block w-full rounded text-left text-xs underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          data-testid={`day-overflow-trigger-${dayKey}`}
          aria-label={`Show all ${dayEvents.length} events for ${dayHeading}`}
          onClick={(e) => {
            // The trigger sits inside a clickable gridcell; without this the
            // cell's onClick fires too and steals selection on popover open.
            e.stopPropagation();
          }}
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
            <li key={event.id} data-event-id={event.id}>
              <button
                type="button"
                disabled={!onSelectEvent}
                onClick={() => {
                  if (!onSelectEvent || !triggerRef.current) return;
                  onSelectEvent(event, triggerRef.current);
                }}
                data-testid={`day-events-popover-event-${event.id}`}
                className={`block w-full cursor-pointer rounded px-3 py-2 text-left text-xs transition-opacity hover:opacity-80 focus:ring-2 focus:ring-offset-1 focus:outline-none disabled:cursor-default disabled:hover:opacity-100 ${
                  EVENT_COLOR_CLASSES[event.color]
                }`}
              >
                <p className="font-semibold">{event.title}</p>
                <p className="mt-0.5 opacity-80">
                  {formatEventTimeRange(event, use24HourFormat)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
