"use client";

import { logger } from "@/lib/logger";
import {
  type UserSettingsPartial,
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import { useEffect, useRef, useState } from "react";
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
   * Apply a partial of `UserSettings` optimistically — local state is
   * updated immediately and the change is broadcast on the in-tab bus
   * before the network round-trip starts. The PUT runs only when
   * authenticated; failures roll back local state and re-emit the
   * pre-update values, then reject so callers can toast.
   *
   * Sign-in mid-session caveat: an anonymous mutation lives only in the
   * tab's in-memory state + bus. When `status` flips to `"authenticated"`
   * the GET effect fetches the server's value and overwrites local state,
   * so the unauthenticated optimistic write is silently lost. By design —
   * the DB is the source of truth for an authenticated user.
   */
  mutate: (partial: UserSettingsPartial) => Promise<void>;
}

export function useUserSettings(): UseUserSettingsResult {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserCalendarSettings>(
    DEFAULT_USER_CALENDAR_SETTINGS
  );
  const [isLoading, setIsLoading] = useState(false);

  // Generation counter incremented on every mutate. The settings GET
  // captures the gen at start and refuses to write its result back to
  // state if a mutate has happened since — otherwise a slow GET would
  // clobber a fast optimistic mutate that landed first.
  const mutationGenRef = useRef(0);

  // Keep `settings` accessible to `mutate` without re-creating the
  // function on every render — the closure capture is stale across
  // an async PUT, but the ref is always current. Used to snapshot the
  // pre-update values for rollback.
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    const startGen = mutationGenRef.current;

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
        // A mutate has happened since this GET started — its optimistic
        // write is the most recent intent; do not overwrite.
        if (mutationGenRef.current !== startGen) return;
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
      const picked = pickCalendarFields(partial as Record<string, unknown>);
      if (Object.keys(picked).length === 0) {
        return;
      }
      setSettings((prev) => ({ ...prev, ...picked }));
    });
  }, []);

  // No `useCallback` — React Compiler memoizes call sites that need it
  // (CLAUDE.md forbids manual memoization). Closure is fresh each render
  // so `status` and `settingsRef.current` are always current.
  const mutate = async (partial: UserSettingsPartial) => {
    mutationGenRef.current += 1;
    const picked = pickCalendarFields(partial as Record<string, unknown>);
    const hasOwnedFields = Object.keys(picked).length > 0;

    // Snapshot of the values we're about to overwrite, for rollback on
    // PUT failure. Read from the ref so an in-flight render doesn't
    // capture stale state.
    let snapshot: Partial<UserCalendarSettings> | null = null;
    if (hasOwnedFields) {
      const snap: Partial<UserCalendarSettings> = {};
      for (const key of Object.keys(picked) as Array<
        keyof UserCalendarSettings
      >) {
        // The cast is safe because `picked` keys come from
        // `pickCalendarFields`, which only writes keys of UserCalendarSettings.
        (snap as Record<string, unknown>)[key] = settingsRef.current[key];
      }
      snapshot = snap;
      setSettings((prev) => ({ ...prev, ...picked }));
    }
    // Broadcast optimistically — every other in-tab consumer can update
    // before the PUT round-trip lands.
    emitUserSettingsChange(partial);

    if (status !== "authenticated") {
      return;
    }

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(partial),
      });
      if (!response.ok) {
        throw new Error(`Failed to update user settings (${response.status})`);
      }
    } catch (error) {
      // Roll back the optimistic write. Re-emit the snapshot to revert
      // every other in-tab subscriber too.
      if (snapshot && Object.keys(snapshot).length > 0) {
        const rollback = snapshot;
        setSettings((prev) => ({ ...prev, ...rollback }));
        emitUserSettingsChange(rollback as UserSettingsPartial);
      }
      throw error;
    }
  };

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
