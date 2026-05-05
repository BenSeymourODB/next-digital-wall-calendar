"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import { useEventCreate } from "@/hooks/useEventCreate";
import type { IEvent, IUser } from "@/types/calendar";
import { useState } from "react";
import { Plus } from "lucide-react";
import { EventCreateDialog, type EventCreateInput } from "./EventCreateDialog";

// Placeholder "self" user for the optimistic event inserted into local
// state before Google's response comes back. Profile / attendee assignment
// is deferred to the multi-profile work; once #116 lands the canonical
// event from Google replaces this row, so this user is only ever shown
// for the brief optimistic window.
const LOCAL_USER: IUser = {
  id: "local",
  name: "You",
  picturePath: null,
};

const DEFAULT_CALENDAR_ID = "primary";

function generateId(): string {
  return crypto.randomUUID();
}

export function AddEventButton() {
  const { selectedDate } = useCalendar();
  const createEvent = useEventCreate({
    defaultCalendarId: DEFAULT_CALENDAR_ID,
  });
  const [open, setOpen] = useState(false);

  const handleCreate = (input: EventCreateInput) => {
    const optimistic: IEvent = {
      id: generateId(),
      title: input.title,
      description: input.description,
      color: input.color,
      isAllDay: input.isAllDay,
      startDate: input.startDate,
      endDate: input.endDate,
      user: LOCAL_USER,
      calendarId: DEFAULT_CALENDAR_ID,
    };

    // Fire-and-forget against the Google write path. The hook owns the
    // success/failure toasts, and `createEvent` rolls back the optimistic
    // row on failure — the caller does not need to await for UI purposes.
    void createEvent(optimistic, {
      title: input.title,
      description: input.description,
      color: input.color,
      isAllDay: input.isAllDay,
      startDate: input.startDate,
      endDate: input.endDate,
      calendarId: DEFAULT_CALENDAR_ID,
    });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="calendar-add-event-btn"
      >
        <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
        Add event
      </Button>
      <EventCreateDialog
        open={open}
        onOpenChange={setOpen}
        onCreate={handleCreate}
        defaultDate={selectedDate}
      />
    </>
  );
}
