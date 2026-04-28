"use client";

import { AccountManager } from "@/components/calendar/AccountManager";
import { AgendaCalendar } from "@/components/calendar/AgendaCalendar";
import { DayCalendar } from "@/components/calendar/DayCalendar";
import { MiniCalendarSidebar } from "@/components/calendar/MiniCalendarSidebar";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import { YearCalendar } from "@/components/calendar/YearCalendar";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import {
  CalendarProvider,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import type { TCalendarView } from "@/types/calendar";
import { useState } from "react";
import { Settings } from "lucide-react";

/**
 * Route to the correct calendar view. Year falls back to month until
 * #83 / #117 ship a dedicated year view.
 */
function CalendarView({ view }: { view: TCalendarView }) {
  switch (view) {
    case "day":
      return <DayCalendar />;
    case "week":
      return <WeekCalendar />;
    case "agenda":
      return <AgendaCalendar />;
    case "month":
    case "year":
    default:
      return <SimpleCalendar />;
  }
}

/**
 * Calendar content component
 * Extracted to access useCalendar hook
 */
function CalendarContent() {
  const { view } = useCalendar();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="bg-background min-h-screen p-4 sm:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground text-3xl font-bold">
              Wall Calendar
            </h1>
            <p className="text-muted-foreground">
              Your family&apos;s digital calendar
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Settings panel */}
        {showSettings && (
          <div className="border-border bg-card rounded-lg border p-6">
            <AccountManager />
          </div>
        )}

        {/* View Switcher */}
        <ViewSwitcher />

        {/* Calendar - Conditional rendering based on view
         * The mini-calendar is hidden on month view where it duplicates the
         * main grid; on day/week/agenda it acts as a date-picker / at-a-glance
         * overview. See issue #146. */}
        <div className="border-border bg-card rounded-lg border p-6">
          {view === "month" && <SimpleCalendar />}
          {view === "year" && <YearCalendar />}
          {view === "agenda" && <AgendaCalendar />}
        </div>
        {view !== "month" && view !== "year" && <MiniCalendarSidebar />}
      </div>
    </div>
  );
}

export default function CalendarPage() {
  return (
    <CalendarProvider>
      <CalendarContent />
      <Toaster />
    </CalendarProvider>
  );
}
