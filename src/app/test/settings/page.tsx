"use client";

import { SettingsForm } from "@/components/settings/settings-form";
import { Toaster } from "sonner";

/**
 * Test page for settings UI - renders SettingsForm with mock data
 * so it can be validated without authentication.
 *
 * Usage: /test/settings
 */
export default function TestSettingsPage() {
  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200">
          Test page — rendering SettingsForm with mock data (no auth required)
        </div>

        <h1 className="text-foreground mb-6 text-3xl font-bold">Settings</h1>

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
