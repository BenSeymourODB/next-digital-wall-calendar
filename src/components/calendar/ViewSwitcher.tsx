"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TCalendarView } from "@/types/calendar";
import { Calendar, CalendarDays, CalendarRange, List } from "lucide-react";

/**
 * View switcher component
 * Allows switching between Day, Week, Month, and Agenda calendar views.
 * Year view is deferred to #83 / #117.
 */
export function ViewSwitcher() {
  const { view, setView } = useCalendar();

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as TCalendarView)}
    >
      <TabsList className="grid w-full max-w-xl grid-cols-4">
        <TabsTrigger value="day" className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4" />
          <span>Day</span>
        </TabsTrigger>
        <TabsTrigger value="week" className="flex items-center gap-2">
          <CalendarRange className="h-4 w-4" />
          <span>Week</span>
        </TabsTrigger>
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
