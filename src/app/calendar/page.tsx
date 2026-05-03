"use client";

import { AccountManager } from "@/components/calendar/AccountManager";
import { AnalogClockView } from "@/components/calendar/AnalogClockView";
import { CalendarFilterPanel } from "@/components/calendar/CalendarFilterPanel";
import { CalendarSettingsPanel } from "@/components/calendar/CalendarSettingsPanel";
import { DayCalendar } from "@/components/calendar/DayCalendar";
import { MiniCalendarSidebar } from "@/components/calendar/MiniCalendarSidebar";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { YearCalendar } from "@/components/calendar/YearCalendar";
import { AnimatedSwap } from "@/components/calendar/animated-swap";
import {
  CalendarProvider,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import type { TCalendarView } from "@/types/calendar";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Settings } from "lucide-react";

const VIEW_PARAM_VALUES = [
  "day",
  "week",
  "month",
  "year",
  "clock",
  "agenda",
] as const;
type TViewParam = (typeof VIEW_PARAM_VALUES)[number];

function isViewParam(value: string | null): value is TViewParam {
  return (
    value !== null && (VIEW_PARAM_VALUES as readonly string[]).includes(value)
  );
}

const VIEW_FADE_DURATION_MS = 250;

function CalendarView({ view }: { view: TCalendarView }) {
  switch (view) {
    case "day":
      return <DayCalendar />;
    case "week":
      return <WeekCalendar />;
    case "year":
      return <YearCalendar />;
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
            <CalendarSettingsPanel />
            <Button
              variant="outline"
              size="icon"
              aria-label="Account manager"
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

function CalendarPageBody() {
  // Issue #238 — honour ?view=year (and other view= URL params) so deep
  // links and bookmarks land on the requested view even when the user's
  // persisted localStorage points elsewhere. Mirrors the test page
  // pattern. Legacy ?view=agenda maps to day + agendaMode=true to match
  // the provider's pre-#150 → post-#150 migration.
  const searchParams = useSearchParams();
  const rawView = searchParams.get("view");
  const isLegacyAgenda = rawView === "agenda";
  const initialView: TCalendarView | undefined = isViewParam(rawView)
    ? isLegacyAgenda
      ? "day"
      : (rawView as TCalendarView)
    : undefined;
  const initialAgendaMode = isLegacyAgenda
    ? true
    : searchParams.get("agendaMode") === "true"
      ? true
      : undefined;

  return (
    <CalendarProvider
      initialView={initialView}
      initialAgendaMode={initialAgendaMode}
    >
      <CalendarContent />
      <Toaster />
    </CalendarProvider>
  );
}

export default function CalendarPage() {
  return (
    <Suspense
      fallback={<div className="bg-background min-h-screen p-4 sm:p-8" />}
    >
      <CalendarPageBody />
    </Suspense>
  );
}
