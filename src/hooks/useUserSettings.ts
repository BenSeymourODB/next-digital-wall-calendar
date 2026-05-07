"use client";

import { logger } from "@/lib/logger";
import {
  type UserSettingsPartial,
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export type TTimeFormat = "12h" | "24h";

const VALID_TIME_FORMATS: readonly TTimeFormat[] = ["12h", "24h"] as const;

export interface UserCalendarSettings {
  calendarRefreshIntervalMinutes: number;
  calendarFetchMonthsAhead: number;
  calendarFetchMonthsBehind: number;
  calendarMaxEventsPerDay: number;
  /**
   * App-wide time format (#337). The single source of truth replacing the
   * standalone `CalendarProvider.use24HourFormat` localStorage key.
   * Mirrors `UserSettings.timeFormat` in the database; default `"12h"`
   * matches the Prisma schema default.
   */
  timeFormat: TTimeFormat;
}

export const DEFAULT_USER_CALENDAR_SETTINGS: UserCalendarSettings = {
  calendarRefreshIntervalMinutes: 15,
  calendarFetchMonthsAhead: 6,
  calendarFetchMonthsBehind: 1,
  calendarMaxEventsPerDay: 3,
  timeFormat: "12h",
};

interface UseUserSettingsResult {
  settings: UserCalendarSettings;
  isLoading: boolean;
  /**
   * Persist a partial of `UserSettings` to the server, then update local
   * state and notify every other in-tab `useUserSettings` instance via
   * the bus. Rejects on non-2xx so callers can toast.
   */
  mutate: (partial: UserSettingsPartial) => Promise<void>;
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
        const data = (await response.json()) as Record<string, unknown>;
        if (cancelled) return;
        setSettings((prev) => ({
          ...prev,
          ...pickCalendarFields(data),
        }));
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

  // Keep this instance's local state in sync with mutations dispatched by
  // any other `useUserSettings` consumer in the same tab (#337). The bus
  // is fire-and-forget — every event carries its own partial, so we just
  // merge the picked subset.
  useEffect(() => {
    return subscribeUserSettings((partial) => {
      const picked = pickCalendarFields(partial);
      if (Object.keys(picked).length === 0) {
        return;
      }
      setSettings((prev) => ({ ...prev, ...picked }));
    });
  }, []);

  const mutate = useCallback(async (partial: UserSettingsPartial) => {
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial),
    });
    if (!response.ok) {
      throw new Error(`Failed to update user settings (${response.status})`);
    }
    // Optimistically merge the fields we own; the bus delivery to
    // ourselves will be a no-op because the same picked values are
    // already in `prev`.
    const picked = pickCalendarFields(partial);
    if (Object.keys(picked).length > 0) {
      setSettings((prev) => ({ ...prev, ...picked }));
    }
    emitUserSettingsChange(partial);
  }, []);

  return { settings, isLoading, mutate };
}

function pickCalendarFields(
  data: Record<string, unknown>
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
    typeof data.timeFormat === "string" &&
    (VALID_TIME_FORMATS as readonly string[]).includes(data.timeFormat)
  ) {
    picked.timeFormat = data.timeFormat as TTimeFormat;
  }
  return picked;
}
