"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TCalendarView } from "@/types/calendar";
import { Calendar, List } from "lucide-react";

/**
 * View switcher component
 * Allows switching between Month and Agenda calendar views
 */
export function ViewSwitcher() {
  const { view, setView } = useCalendar();

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as TCalendarView)}
    >
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="month" className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Month</span>
        </TabsTrigger>
        <TabsTrigger value="agenda" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          <span>Agenda</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
