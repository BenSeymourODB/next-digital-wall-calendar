"use client";

/**
 * Returns a stable handler suitable for `<EventDetailModal onDelete>`.
 *
 * Wraps `CalendarProvider.deleteEvent` with the user-facing toast that the
 * modal contract expects (success and failure surface as toasts; the modal
 * stays open on failure so the user can retry).
 */
import { useCalendar } from "@/components/providers/CalendarProvider";
import type { IEvent } from "@/types/calendar";
import { toast } from "sonner";

export function useEventDelete() {
  const { deleteEvent } = useCalendar();

  return async (event: IEvent) => {
    try {
      await deleteEvent(event.id, event.calendarId);
      toast.success("Event deleted");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete event";
      toast.error(message);
      throw error;
    }
  };
}
