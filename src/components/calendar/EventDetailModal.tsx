"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { IEvent, TEventColor } from "@/types/calendar";
import type { RefObject } from "react";
import { format, isSameDay } from "date-fns";

const COLOR_INDICATOR_CLASSES: Record<TEventColor, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-yellow-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
};

interface EventDetailModalProps {
  event: IEvent | null;
  onClose: () => void;
  use24HourFormat: boolean;
  /**
   * Ref to the element that opened the modal. On close, focus is explicitly
   * restored to this element so keyboard users land back where they were
   * (WCAG 2.4.3), since the triggers are not wrapped in a Radix DialogTrigger.
   */
  returnFocusTo?: RefObject<HTMLElement | null>;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatTimeRange(event: IEvent, use24HourFormat: boolean): string {
  if (event.isAllDay) return "All day";
  const timePattern = use24HourFormat ? "HH:mm" : "h:mm a";
  const start = format(new Date(event.startDate), timePattern);
  const end = format(new Date(event.endDate), timePattern);
  return `${start} – ${end}`;
}

function formatDateLabel(event: IEvent): string {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);

  if (isSameDay(start, end)) {
    return format(start, "EEEE, MMMM d, yyyy");
  }

  const startLabel = format(start, "EEE, MMM d");
  const endLabel = format(end, "EEE, MMM d, yyyy");
  return `${startLabel} – ${endLabel}`;
}

export function EventDetailModal({
  event,
  onClose,
  use24HourFormat,
  returnFocusTo,
}: EventDetailModalProps) {
  if (!event) return null;

  const timeRange = formatTimeRange(event, use24HourFormat);
  const dateLabel = formatDateLabel(event);
  const hasDescription = Boolean(event.description?.trim());

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        onCloseAutoFocus={(e) => {
          const el = returnFocusTo?.current;
          if (el) {
            e.preventDefault();
            el.focus();
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-start gap-3">
            <span
              data-testid="event-detail-color"
              data-color={event.color}
              aria-hidden="true"
              className={`mt-2 h-3 w-3 shrink-0 rounded-full ${COLOR_INDICATOR_CLASSES[event.color]}`}
            />
            <div className="flex-1">
              <DialogTitle>{event.title}</DialogTitle>
              <DialogDescription
                data-testid="event-detail-date"
                className="mt-1"
              >
                {dateLabel}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p
            data-testid="event-detail-time"
            className="text-foreground text-sm font-medium"
          >
            {timeRange}
          </p>

          {hasDescription && (
            <p
              data-testid="event-detail-description"
              className="text-muted-foreground text-sm whitespace-pre-wrap"
            >
              {event.description}
            </p>
          )}

          <div className="flex items-center gap-2">
            <Avatar>
              {event.user.picturePath && (
                <AvatarImage
                  src={event.user.picturePath}
                  alt={event.user.name}
                />
              )}
              <AvatarFallback>{getInitials(event.user.name)}</AvatarFallback>
            </Avatar>
            <span className="text-foreground text-sm">{event.user.name}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
