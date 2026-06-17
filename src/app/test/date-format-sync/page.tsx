"use client";

import { useUserSettings } from "@/hooks/useUserSettings";
import {
  VALID_DATE_FORMATS,
  formatUserDate,
  isDateFormat,
} from "@/lib/format-date";
import { Toaster } from "sonner";

/**
 * Test fixture for the cross-surface `dateFormat` sync introduced in
 * #339, mirroring `/test/time-format-sync` (#337). A trivial
 * `<select>` writes through `useUserSettings.mutate`, which emits on
 * the in-tab bus; the isolated probe below reads the new value through
 * a second `useUserSettings` instance and re-renders the formatted
 * date.
 *
 * The main Settings page does not yet expose a `dateFormat` control
 * (deferred until PR #381's `DisplaySection` refactor lands), so this
 * fixture is the smallest writer that proves the bus carries the
 * field end-to-end. The Playwright spec
 * (`e2e/date-format-sync.spec.ts`) drives it.
 *
 * Usage: `/test/date-format-sync`. Playwright mocks `/api/settings`
 * PUT with `page.route()` so `mutate` completes its optimistic path.
 */
export default function TestDateFormatSyncPage() {
  return (
    <div className="bg-background min-h-screen p-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200">
          Test page — cross-surface dateFormat sync (#339)
        </div>

        <h1 className="text-foreground mb-6 text-3xl font-bold">
          Date Format Sync
        </h1>

        <DateFormatProbe />

        <DateFormatWriter />
      </div>

      <Toaster />
    </div>
  );
}

/**
 * Reader — an isolated `useUserSettings` instance, modeling the
 * calendar surface. The probe must update via the bus alone (no
 * reload, no shared parent state).
 */
function DateFormatProbe() {
  const { settings } = useUserSettings();
  // A fixed local-noon date is rendered through the user's preference
  // so the visible string changes when the format flips. Local
  // construction avoids the TZ skew an ISO `T00:00:00Z` would carry.
  const sample = new Date(2026, 2, 5); // 2026-03-05 (March = month index 2)

  return (
    <div className="border-border bg-card mb-6 rounded-md border p-4">
      <div className="text-foreground text-sm font-semibold">
        Calendar surface (probe)
      </div>
      <div className="text-muted-foreground text-xs">
        Mirrors <code>useUserSettings().dateFormat</code> — the same hook the
        calendar surface reads. Updates via the user-settings bus when the form
        below writes.
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div>
          <div className="text-muted-foreground text-xs">Format</div>
          <div
            className="text-foreground text-base font-medium"
            data-testid="probe-date-format"
          >
            {settings.dateFormat}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground text-xs">
            Sample (2026-03-05)
          </div>
          <div
            className="text-foreground text-base font-medium"
            data-testid="probe-date-sample"
          >
            {formatUserDate(sample, settings.dateFormat)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Writer — a separate `useUserSettings` instance whose `mutate` call
 * is the only path that emits to the bus. Modeling a future
 * Settings-page control without dragging in the full `SettingsForm`
 * dependency tree (which would also overlap with PR #381's
 * concurrent edits to `DisplaySection`).
 */
function DateFormatWriter() {
  const { settings, mutate } = useUserSettings();

  return (
    <div className="border-border bg-card rounded-md border p-4">
      <div className="text-foreground text-sm font-semibold">
        Settings surface (writer)
      </div>
      <div className="text-muted-foreground mb-3 text-xs">
        Writes via <code>useUserSettings.mutate</code>, which broadcasts on the
        in-tab bus.
      </div>

      <label className="text-foreground block text-sm font-medium">
        Date format
      </label>
      <select
        data-testid="writer-date-format"
        className="border-border bg-background text-foreground mt-1 rounded-md border px-3 py-2"
        value={settings.dateFormat}
        onChange={(e) => {
          // The select is populated from `VALID_DATE_FORMATS`, but route
          // unknown values through the same `isDateFormat` guard the rest
          // of the PR uses rather than bypassing the type system with a
          // cast — keeps the test fixture honest about the production
          // pattern it models.
          const next = e.target.value;
          if (isDateFormat(next)) {
            void mutate({ dateFormat: next });
          }
        }}
      >
        {VALID_DATE_FORMATS.map((fmt) => (
          <option key={fmt} value={fmt}>
            {fmt}
          </option>
        ))}
      </select>
    </div>
  );
}
