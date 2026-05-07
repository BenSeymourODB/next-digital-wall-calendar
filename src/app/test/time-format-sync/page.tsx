"use client";

import { SettingsForm } from "@/components/settings/settings-form";
import { useUserSettings } from "@/hooks/useUserSettings";
import { Toaster } from "sonner";

/**
 * Test fixture for the cross-surface `timeFormat` sync introduced in
 * #337. The Settings form (`SettingsForm` → `DisplaySection`) and the
 * calendar surface (`CalendarSettingsPanel` via `CalendarProvider`) both
 * mutate the same `UserSettings.timeFormat` field; this page mounts the
 * Settings form alongside an isolated `useUserSettings` probe so a
 * Playwright spec can assert that toggling in the form propagates to
 * the probe via the in-tab user-settings bus — without spinning up the
 * heavy `CalendarProvider` machinery.
 *
 * The other direction (calendar → settings) is symmetric and covered by
 * the unit tests for `useUserSettings` (writer/reader render trees) and
 * `CalendarProvider` (toggle wiring through `mutateUserSettings`).
 *
 * Usage: `/test/time-format-sync`. Playwright mocks `/api/settings` PUT
 * with `page.route()`.
 */
export default function TestTimeFormatSyncPage() {
  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200">
          Test page — cross-surface timeFormat sync (#337)
        </div>

        <h1 className="text-foreground mb-6 text-3xl font-bold">
          Time Format Sync
        </h1>

        <TimeFormatProbe />

        <SettingsForm
          user={{
            name: "Jane Doe",
            email: "jane.doe@example.com",
            image: null,
          }}
          createdAt={new Date(2024, 0, 15).toISOString()}
          providers={["google"]}
          initialSettings={{
            theme: "light",
            timeFormat: "12h",
            dateFormat: "MM/DD/YYYY",
            defaultZoomLevel: 1.0,
            rewardSystemEnabled: true,
            defaultTaskPoints: 10,
            showPointsOnCompletion: true,
            schedulerIntervalSeconds: 10,
            schedulerPauseOnInteractionSeconds: 30,
            calendarRefreshIntervalMinutes: 15,
            calendarFetchMonthsAhead: 6,
            calendarFetchMonthsBehind: 1,
            calendarMaxEventsPerDay: 3,
          }}
        />
      </div>

      <Toaster />
    </div>
  );
}

function TimeFormatProbe() {
  const { settings } = useUserSettings();
  return (
    <div
      className="border-border bg-card mb-6 rounded-md border p-4"
      data-testid="time-format-probe"
    >
      <div className="text-foreground text-sm font-semibold">
        Calendar surface (probe)
      </div>
      <div className="text-muted-foreground text-xs">
        Mirrors `useUserSettings().timeFormat` — the same hook the calendar
        surface reads. Updates via the user-settings bus when the form below
        writes.
      </div>
      <div
        className="text-foreground mt-2 text-base font-medium"
        data-testid="probe-time-format"
      >
        {settings.timeFormat}
      </div>
    </div>
  );
}
