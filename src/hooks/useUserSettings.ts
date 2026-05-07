"use client";

import { logger } from "@/lib/logger";
import type { TWeekStartDay } from "@/types/calendar";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface UserCalendarSettings {
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
  weekStartDay: TWeekStartDay;
}

export const DEFAULT_USER_CALENDAR_SETTINGS: UserCalendarSettings = {
  calendarRefreshIntervalMinutes: 15,
  calendarFetchMonthsAhead: 6,
  calendarFetchMonthsBehind: 1,
  calendarMaxEventsPerDay: 3,
  weekStartDay: 0,
};

interface UseUserSettingsResult {
  settings: UserCalendarSettings;
  isLoading: boolean;
  /**
   * True only after a `/api/settings` fetch has resolved successfully at
   * least once for the current authenticated session. Distinct from
   * `!isLoading` because the latter is also `false` on the very first
   * render where `status === "authenticated"` but the effect hasn't yet
   * set it to `true` — that window is where consumers must avoid acting
   * on the in-memory default value (e.g. the `weekStartDay` migration
   * shim in `CalendarProvider`, #338).
   */
  hasLoadedFromServer: boolean;
}

export function useUserSettings(): UseUserSettingsResult {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserCalendarSettings>(
    DEFAULT_USER_CALENDAR_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedFromServer, setHasLoadedFromServer] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;

    (async () => {
      if (cancelled) return;
      setIsLoading(true);
      try {
        const response = await fetch("/api/settings");
        if (cancelled) return;
        if (!response.ok) {
          logger.log("useUserSettings: /api/settings returned error status", {
            status: response.status,
          });
          return;
        }
        const data = (await response.json()) as Partial<UserCalendarSettings>;
        if (cancelled) return;
        setSettings({
          ...DEFAULT_USER_CALENDAR_SETTINGS,
          ...pickCalendarFields(data),
        });
        setHasLoadedFromServer(true);
      } catch (error) {
        logger.error(error as Error, { context: "useUserSettings" });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return { settings, isLoading, hasLoadedFromServer };
}

function pickCalendarFields(
  data: Partial<UserCalendarSettings>
): Partial<UserCalendarSettings> {
  const picked: Partial<UserCalendarSettings> = {};
  if (typeof data.calendarRefreshIntervalMinutes === "number") {
    picked.calendarRefreshIntervalMinutes = data.calendarRefreshIntervalMinutes;
  }
  if (typeof data.calendarFetchMonthsAhead === "number") {
    picked.calendarFetchMonthsAhead = data.calendarFetchMonthsAhead;
  }
  if (typeof data.calendarFetchMonthsBehind === "number") {
    picked.calendarFetchMonthsBehind = data.calendarFetchMonthsBehind;
  }
  if (typeof data.calendarMaxEventsPerDay === "number") {
    picked.calendarMaxEventsPerDay = data.calendarMaxEventsPerDay;
  }
  // Discard rogue values: a manually-edited DB row of `5` would silently
  // poison every `weekStartsOn` parameter we feed into date-fns, so reject
  // anything outside the {0, 1} contract enforced server-side.
  if (data.weekStartDay === 0 || data.weekStartDay === 1) {
    picked.weekStartDay = data.weekStartDay;
  }
  return picked;
}
