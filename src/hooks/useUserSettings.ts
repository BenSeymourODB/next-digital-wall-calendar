"use client";

import {
  type CalendarTransitionSpeed,
  DEFAULT_CALENDAR_TRANSITION_SPEED,
  isCalendarTransitionSpeed,
} from "@/lib/calendar/transition-speed";
import {
  DEFAULT_DATE_FORMAT,
  type TDateFormat,
  isDateFormat,
} from "@/lib/format-date";
import { logger } from "@/lib/logger";
import { type TTimeFormat, isTimeFormat } from "@/lib/time-format";
import {
  type UserSettingsPartial,
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import type { TWeekStartDay } from "@/types/calendar";
import { useEffect, useRef, useState } from "react";
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
  /**
   * App-wide time format (#337). The single source of truth replacing the
   * standalone `CalendarProvider.use24HourFormat` localStorage key.
   * Mirrors `UserSettings.timeFormat` in the database; default `"12h"`
   * matches the Prisma schema default.
   */
  timeFormat: TTimeFormat;
  /**
   * App-wide numeric date format (#339). Mirrors `UserSettings.dateFormat`
   * in the database; default `"MM/DD/YYYY"` matches the Prisma schema
   * default. Consumed via the `formatUserDate` helper in
   * `src/lib/format-date.ts`.
   */
  dateFormat: TDateFormat;
  weekStartDay: TWeekStartDay;
  /** Hour (0–23) the Day/Week grids auto-scroll to on first render (#288). */
  calendarWorkingHoursStart: number;
  calendarTransitionSpeed: CalendarTransitionSpeed;
}

export const DEFAULT_USER_CALENDAR_SETTINGS: UserCalendarSettings = {
  calendarRefreshIntervalMinutes: 15,
  calendarFetchMonthsAhead: 6,
  calendarFetchMonthsBehind: 1,
  calendarMaxEventsPerDay: 3,
  defaultZoomLevel: 1.0,
  timeFormat: "12h",
  dateFormat: DEFAULT_DATE_FORMAT,
  weekStartDay: 0,
  calendarWorkingHoursStart: 7,
  calendarTransitionSpeed: DEFAULT_CALENDAR_TRANSITION_SPEED,
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
      // #420 — compare-and-swap rollback. Only restore the snapshot for
      // keys whose live value still matches what *this* mutate set. A
      // concurrent successful mutate (or bus event) on the same key has
      // already moved local state past our optimistic value; reverting it
      // to our pre-call snapshot would stomp on the most-recent truth and
      // re-broadcast a stale value to every other in-tab subscriber.
      //
      // `settingsRef.current` is updated post-commit via `useEffect`; UI-
      // driven mutates always have an event-loop tick between them, so the
      // ref reflects every preceding optimistic write by the time a
      // concurrent rejection lands. `Object.is` is the right comparator
      // for the all-primitive `UserCalendarSettings` shape today.
      if (snapshot && Object.keys(snapshot).length > 0) {
        const live = settingsRef.current;
        const liveRollback: Partial<UserCalendarSettings> = {};
        for (const key of Object.keys(snapshot) as Array<
          keyof UserCalendarSettings
        >) {
          if (Object.is(live[key], (picked as Record<string, unknown>)[key])) {
            (liveRollback as Record<string, unknown>)[key] = (
              snapshot as Record<string, unknown>
            )[key];
          }
        }
        if (Object.keys(liveRollback).length > 0) {
          setSettings((prev) => ({ ...prev, ...liveRollback }));
          emitUserSettingsChange(liveRollback as UserSettingsPartial);
        }
      }
      throw error;
    }
  };

  return { settings, isLoading, hasLoadedFromServer, mutate };
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
    typeof data.defaultZoomLevel === "number" &&
    Number.isFinite(data.defaultZoomLevel)
  ) {
    picked.defaultZoomLevel = data.defaultZoomLevel;
  }
  if (isTimeFormat(data.timeFormat)) {
    picked.timeFormat = data.timeFormat;
  }
  // Same defensive contract as `timeFormat`: unknown values are dropped so a
  // stale DB row or a typo'd bus emit doesn't poison `formatUserDate` with a
  // string it can't map to a date-fns pattern.
  if (isDateFormat(data.dateFormat)) {
    picked.dateFormat = data.dateFormat;
  }
  // Discard rogue values: a manually-edited DB row of `5` would silently
  // poison every `weekStartsOn` parameter we feed into date-fns, so reject
  // anything outside the {0, 1} contract enforced server-side.
  if (data.weekStartDay === 0 || data.weekStartDay === 1) {
    picked.weekStartDay = data.weekStartDay;
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
