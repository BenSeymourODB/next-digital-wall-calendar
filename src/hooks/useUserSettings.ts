"use client";

import {
  type CalendarTransitionSpeed,
  DEFAULT_CALENDAR_TRANSITION_SPEED,
  isCalendarTransitionSpeed,
} from "@/lib/calendar/transition-speed";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export interface UserCalendarSettings {
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
  /** Hour (0–23) the Day/Week grids auto-scroll to on first render (#288). */
  calendarWorkingHoursStart: number;
  calendarTransitionSpeed: CalendarTransitionSpeed;
}

export const DEFAULT_USER_CALENDAR_SETTINGS: UserCalendarSettings = {
  calendarRefreshIntervalMinutes: 15,
  calendarFetchMonthsAhead: 6,
  calendarFetchMonthsBehind: 1,
  calendarMaxEventsPerDay: 3,
  calendarWorkingHoursStart: 7,
  calendarTransitionSpeed: DEFAULT_CALENDAR_TRANSITION_SPEED,
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
  data: Partial<UserCalendarSettings> & { calendarTransitionSpeed?: unknown }
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
    typeof data.calendarWorkingHoursStart === "number" &&
    Number.isInteger(data.calendarWorkingHoursStart) &&
    data.calendarWorkingHoursStart >= 0 &&
    data.calendarWorkingHoursStart <= 23
  ) {
    picked.calendarWorkingHoursStart = data.calendarWorkingHoursStart;
  }
  // Defensive: the server should already validate this, but if a stale row
  // ever ships an unknown value we drop back to the default rather than
  // crash a strict union elsewhere.
  if (isCalendarTransitionSpeed(data.calendarTransitionSpeed)) {
    picked.calendarTransitionSpeed = data.calendarTransitionSpeed;
  }
  return picked;
}
