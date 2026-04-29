"use client";

import { AccountManager } from "@/components/calendar/AccountManager";
import { AgendaCalendar } from "@/components/calendar/AgendaCalendar";
import { AnalogClockView } from "@/components/calendar/AnalogClockView";
import { DayCalendar } from "@/components/calendar/DayCalendar";
import { MiniCalendarSidebar } from "@/components/calendar/MiniCalendarSidebar";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { YearCalendar } from "@/components/calendar/YearCalendar";
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

function CalendarView({ view }: { view: TCalendarView }) {
  switch (view) {
    case "day":
      return <DayCalendar />;
    case "week":
      return <WeekCalendar />;
    case "year":
      return <YearCalendar />;
    case "agenda":
      return <AgendaCalendar />;
    case "clock":
      return <AnalogClockView />;
    case "month":
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

        {/* Calendar + mini-calendar sidebar.
         * The mini-calendar is hidden on month view where it duplicates the
         * main grid (issue #146), and on clock view where AnalogClockView
         * already ships its own all-day-events aside (issue #154). On
         * day/week/year/agenda it acts as a date-picker / overview. */}
        <div
          className={
            view === "month" || view === "clock"
              ? "grid gap-6"
              : "grid gap-6 lg:grid-cols-[1fr_280px]"
          }
        >
          <div className="border-border bg-card rounded-lg border p-6">
            <CalendarView view={view} />
          </div>
          {view !== "month" && view !== "clock" && <MiniCalendarSidebar />}
        </div>
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
