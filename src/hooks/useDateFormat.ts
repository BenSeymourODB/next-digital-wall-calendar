"use client";

import { type TDateFormat, formatUserDate } from "@/lib/format-date";
import { useUserSettings } from "./useUserSettings";

/**
 * Convenience hook pairing the user's current `dateFormat` with a
 * pre-bound formatter. Calendar / task / recipe surfaces that just want
 * "give me a string for this date in the user's preferred format" should
 * use this rather than reaching into `useUserSettings` directly — the
 * indirection keeps a future locale-aware refactor (e.g. swapping
 * `date-fns` for `Intl.DateTimeFormat`, threading `locale` from the
 * session) confined to a single seam.
 *
 * Lives in `src/hooks/` rather than `src/lib/format-date.ts` so that
 * `format-date` stays a leaf module — the helper is depended on by
 * `useUserSettings.pickCalendarFields` and adding a hook in the same
 * file would create a `lib → hooks → lib` cycle.
 *
 * No `useCallback` / `useMemo` — CLAUDE.md forbids manual memoization
 * and the React Compiler memoizes call sites that need it.
 */
export function useDateFormat(): {
  dateFormat: TDateFormat;
  format: (value: Date | string) => string;
} {
  const { settings } = useUserSettings();
  return {
    dateFormat: settings.dateFormat,
    format: (value) => formatUserDate(value, settings.dateFormat),
  };
}
