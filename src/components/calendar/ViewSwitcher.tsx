"use client";

import { useCalendar } from "@/components/providers/CalendarProvider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TCalendarView } from "@/types/calendar";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  LayoutGrid,
  List,
} from "lucide-react";

/**
 * View switcher component
 * Allows switching between Day, Week, Month, Year, and Agenda calendar views.
 */
export function ViewSwitcher() {
  const { view, setView } = useCalendar();

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as TCalendarView)}
    >
      <TabsList className="grid w-full max-w-xl grid-cols-5">
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
        <TabsTrigger value="year" className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          <span>Year</span>
        </TabsTrigger>
        <TabsTrigger value="agenda" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          <span>Agenda</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
