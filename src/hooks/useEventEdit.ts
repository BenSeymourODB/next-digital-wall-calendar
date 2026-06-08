"use client";

/**
 * Returns a stable handler suitable for `<EventDetailModal onEdit>` (#265).
 *
 * Wraps `CalendarProvider.editEvent` with the user-facing toast that the
 * modal contract expects: success surfaces as a `toast.success` and the
 * modal closes; failure surfaces as `toast.error` and the modal keeps its
 * form open so the user can fix the input or retry. Mirrors
 * `useEventDelete` for the delete half of #115.
 */
import type { EventEditPatch } from "@/components/calendar/EventDetailModal";
import { useCalendar } from "@/components/providers/CalendarProvider";
import type { IEvent } from "@/types/calendar";
import { toast } from "sonner";

export function useEventEdit() {
  const { editEvent } = useCalendar();

  return async (event: IEvent, patch: EventEditPatch) => {
    try {
      await editEvent(event.id, event.calendarId, {
        title: patch.title,
        description: patch.description,
        color: patch.color,
        isAllDay: patch.isAllDay,
        startDate: patch.startDate,
        endDate: patch.endDate,
        calendarId: event.calendarId,
      });
      toast.success("Event updated");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update event";
      toast.error(message);
      throw error;
    }
  };
}
