"use client";

import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

// TODO(#328): rename to UserClientSettings (or split per-feature) once the
// app-wide settings consolidation lands. The "Calendar" prefix is no longer
// accurate now that non-calendar fields (e.g. defaultZoomLevel) flow through
// this hook.
export interface UserCalendarSettings {
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
  defaultZoomLevel: number;
}

export const DEFAULT_USER_CALENDAR_SETTINGS: UserCalendarSettings = {
  calendarRefreshIntervalMinutes: 15,
  calendarFetchMonthsAhead: 6,
  calendarFetchMonthsBehind: 1,
  calendarMaxEventsPerDay: 3,
  defaultZoomLevel: 1.0,
};

interface UseUserSettingsResult {
  settings: UserCalendarSettings;
  isLoading: boolean;
}

export function useUserSettings(): UseUserSettingsResult {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserCalendarSettings>(
    DEFAULT_USER_CALENDAR_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(false);

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

  return { settings, isLoading };
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
  if (
    typeof data.defaultZoomLevel === "number" &&
    Number.isFinite(data.defaultZoomLevel)
  ) {
    picked.defaultZoomLevel = data.defaultZoomLevel;
  }
  return picked;
}
