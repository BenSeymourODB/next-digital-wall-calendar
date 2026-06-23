"use client";

/**
 * Returns a stable handler suitable for `<EventCreateDialog onCreate>`.
 *
 * Wraps `CalendarProvider.createEvent` with the user-facing toast that the
 * dialog contract expects: success and failure surface as toasts; the
 * promise rejects on failure so the caller can keep the dialog open or
 * branch on error.
 */
import {
  type CreateEventInput,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import type { IEvent } from "@/types/calendar";
import { toast } from "sonner";

export interface UseEventCreateOptions {
  /**
   * Default `calendarId` to write to when the caller does not pass one.
   * Defaults to `"primary"`.
   */
  defaultCalendarId?: string;
}

export type CreateEventDialogInput = Omit<CreateEventInput, "calendarId"> & {
  calendarId?: string;
};

export function useEventCreate(options: UseEventCreateOptions = {}) {
  const { createEvent } = useCalendar();
  const defaultCalendarId = options.defaultCalendarId ?? "primary";

  return async (
    optimistic: IEvent,
    input: CreateEventDialogInput
  ): Promise<IEvent> => {
    try {
      const created = await createEvent(optimistic, {
        ...input,
        calendarId: input.calendarId ?? defaultCalendarId,
      });
      // The toast fires after Google's `events.insert` confirms the write,
      // not on optimistic insert. The user sees the row appear immediately
      // and a "saved" confirmation lands a moment later — the toast carries
      // *durability* meaning, not first-render meaning. Move it above the
      // await only if you also surface an explicit pending state to the
      // user; otherwise an early toast claims success a failed POST will
      // contradict 200ms later.
      toast.success("Event created");
      return created;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create event";
      toast.error(message);
      throw error;
    }
  };
}
