"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Button } from "@/components/ui/button";
import type { IEvent, IUser } from "@/types/calendar";
import { useState } from "react";
import { Plus } from "lucide-react";
import { EventCreateDialog, type EventCreateInput } from "./EventCreateDialog";

// Placeholder "self" user for locally created events. Profile / attendee
// assignment is deferred to the multi-profile work and to the API wiring
// in #116 (Google Calendar write-through).
const LOCAL_USER: IUser = {
  id: "local",
  name: "You",
  picturePath: null,
};

function generateId(): string {
  return crypto.randomUUID();
}

export function AddEventButton() {
  const { addEvent, selectedDate } = useCalendar();
  const [open, setOpen] = useState(false);

  const handleCreate = (input: EventCreateInput) => {
    const event: IEvent = {
      id: generateId(),
      title: input.title,
      description: input.description,
      color: input.color,
      isAllDay: input.isAllDay,
      startDate: input.startDate,
      endDate: input.endDate,
      user: LOCAL_USER,
      calendarId: "primary",
    };
    addEvent(event);
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
