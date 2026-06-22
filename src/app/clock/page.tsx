"use client";

/**
 * /clock — standalone chrome-free wall-display route (issue #398).
 *
 * Mounts its own `CalendarProvider` seeded with `initialView="clock"` and
 * renders only `AnalogClockView`. No header, no `ViewSwitcher`, no
 * settings/account controls; `AppShell` also skips `SideNavigation`,
 * `PointsBadge`, and `ScreenTransition` for this path (see
 * `src/components/navigation/app-shell.tsx`).
 *
 * Out of scope (tracked separately): URL/saved-config filter wiring
 * (#399) and the upcoming-events / countdown UI (#400).
 */
import { AnalogClockView } from "@/components/calendar/AnalogClockView";
import { CalendarProvider } from "@/components/providers/CalendarProvider";
import { Toaster } from "@/components/ui/sonner";

export default function ClockPage() {
  return (
    <CalendarProvider initialView="clock">
      <main
        data-testid="clock-page"
        className="bg-background min-h-screen p-4 sm:p-8"
      >
        <div className="mx-auto max-w-7xl">
          <AnalogClockView />
        </div>
      </main>
      <Toaster />
    </CalendarProvider>
  );
}
