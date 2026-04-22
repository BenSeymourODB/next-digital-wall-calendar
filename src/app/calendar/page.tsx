"use client";

import { AccountManager } from "@/components/calendar/AccountManager";
import { AgendaCalendar } from "@/components/calendar/AgendaCalendar";
import { AnalogClockView } from "@/components/calendar/AnalogClockView";
import { AnimatedSwap } from "@/components/calendar/animated-swap";
import { CalendarFilterPanel } from "@/components/calendar/CalendarFilterPanel";
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

const VIEW_FADE_DURATION_MS = 250;

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

  // Views that surface the mini-calendar sidebar. Month duplicates the main
  // grid (issue #146) and the Clock view ships its own all-day events aside,
  // so neither needs the shared sidebar.
  const showSidebar = view !== "month" && view !== "clock" && view !== "year";

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

        {/* View Switcher + Filter Panel */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ViewSwitcher />
          <CalendarFilterPanel />
        </div>

        {/* Calendar + optional mini-calendar sidebar. */}
        <div
          className={
            showSidebar ? "grid gap-6 lg:grid-cols-[1fr_280px]" : "grid gap-6"
          }
        >
          <div className="border-border bg-card rounded-lg border p-6">
            <AnimatedSwap
              swapKey={view}
              type="fade"
              direction="forward"
              durationMs={VIEW_FADE_DURATION_MS}
            >
              <CalendarView view={view} />
            </AnimatedSwap>
          </div>
          {showSidebar && <MiniCalendarSidebar />}
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
