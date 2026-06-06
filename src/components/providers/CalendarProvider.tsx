"use client";

import type { CalendarsResponse } from "@/app/api/calendar/calendars/route";
import { useProfileOptional } from "@/components/profiles/profile-context";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { type TTimeFormat, useUserSettings } from "@/hooks/useUserSettings";
import {
  type HiddenEventCounts,
  ZERO_HIDDEN_COUNTS,
  computeHiddenEventCounts,
} from "@/lib/calendar-filter-counts";
import {
  getActiveProfileId,
  loadFilterState,
  saveFilterState,
} from "@/lib/calendar-filter-storage";
import {
  type CalendarColorMapping,
  eventCache,
  loadColorMappings,
  saveColorMappings,
} from "@/lib/calendar-storage";
import {
  type CalendarAttributionMetadata,
  type CalendarMetadataMap,
  transformGoogleEvent,
} from "@/lib/calendar-transform";
import { resolveTransitionDurationMs } from "@/lib/calendar/transition-speed";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import type {
  ICalendarInfo,
  IEvent,
  IUser,
  TCalendarAccessRole,
  TCalendarView,
  TEventColor,
  TWeekStartDay,
} from "@/types/calendar";
import type React from "react";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { endOfMonth, isAfter, isBefore, startOfMonth } from "date-fns";

/**
 * Track the loaded date range to enable lazy-loading
 */
interface LoadedRange {
  start: Date;
  end: Date;
}

/**
 * Server-bound payload for `createEvent`. Mirrors the body of
 * `POST /api/calendar/events` (#116) — `calendarId` is mandatory at this
 * layer because the provider doesn't second-guess the caller's choice.
 */
export interface CreateEventInput {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: boolean;
  startDate: string;
  endDate: string;
  calendarId: string;
}

export interface ICalendarContext {
  selectedDate: Date;
  view: TCalendarView;
  setView: (view: TCalendarView) => void;
  /**
   * Whether the active Day or Week view renders as a chronological agenda
   * list instead of the hourly time-grid. Has no effect on month/year/clock.
   * Issue #150.
   */
  agendaMode: boolean;
  setAgendaMode: (enabled: boolean) => void;
  agendaModeGroupBy: "date" | "color";
  setAgendaModeGroupBy: (groupBy: "date" | "color") => void;
  use24HourFormat: boolean;
  toggleTimeFormat: () => void;
  weekStartDay: TWeekStartDay;
  setWeekStartDay: (day: TWeekStartDay) => void;
  setSelectedDate: (date: Date | undefined) => void;
  selectedUserId: IUser["id"] | "all";
  setSelectedUserId: (userId: IUser["id"] | "all") => void;
  badgeVariant: "dot" | "colored";
  setBadgeVariant: (variant: "dot" | "colored") => void;
  selectedColors: TEventColor[];
  filterEventsBySelectedColors: (colors: TEventColor) => void;
  filterEventsBySelectedUser: (userId: IUser["id"] | "all") => void;
  /**
   * Issue #208 — list of the user's Google Calendars, sourced from
   * `/api/calendar/calendars`. Empty until the first refresh fires (or
   * when running unauthenticated).
   */
  calendars: ICalendarInfo[];
  /**
   * Calendars whose events should pass the filter. Empty array means "no
   * calendar filter active" (all calendars pass), matching the same
   * convention `selectedColors` uses.
   */
  selectedCalendarIds: string[];
  /**
   * Toggle a calendar in/out of the active set. Mirrors the
   * color/user toggle ergonomics.
   */
  filterEventsBySelectedCalendars: (calendarId: string) => void;
  /**
   * Issue #208 Phase 3 — count of events hidden by each filter
   * dimension. For dimension D, this is the number of events that pass
   * every other dimension's filter but fail D's. When D has no active
   * filter, the count is necessarily 0, so consumers can use
   * `count > 0` as the render condition for a "N hidden" chip.
   */
  hiddenEventCounts: HiddenEventCounts;
  users: IUser[];
  events: IEvent[];
  addEvent: (event: IEvent) => void;
  updateEvent: (event: IEvent) => void;
  removeEvent: (eventId: string) => void;
  /**
   * Persist a new event to Google Calendar with an optimistic insert.
   * The local list is updated immediately with `optimistic` and reconciled
   * to the server's canonical event on success; the optimistic row is
   * removed on failure and the promise rejects so callers can toast.
   */
  createEvent: (optimistic: IEvent, input: CreateEventInput) => Promise<IEvent>;
  /**
   * Delete an event from Google Calendar with an optimistic UI remove.
   * Snapshots the prior list before removing and restores it on failure.
   * The promise rejects on failure so the caller can surface a toast.
   */
  deleteEvent: (eventId: string, calendarId: string) => Promise<void>;
  clearFilter: () => void;
  refreshEvents: () => Promise<void>;
  /**
   * Ensure events for the entire requested calendar year (Jan 1 – Dec 31)
   * are loaded into the provider's `loadedRange`. Used by the year view to
   * widen the default lazy-load window beyond -1 / +6 months.
   */
  loadEventsForYear: (year: number) => Promise<void>;
  /**
   * Look up the user's permission level for a given Google calendar id.
   * Returns `undefined` when the calendar list hasn't been fetched yet or
   * the id wasn't part of the most recent payload. Consumers (e.g.
   * `EventDetailModal` via #266) treat `undefined` as "unknown — render
   * mutating actions", since Google's server-side 403 still applies as
   * the backstop.
   */
  getAccessRole: (calendarId: string) => TCalendarAccessRole | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
  maxEventsPerDay: number;
  /**
   * Hour of day (0–23) the Day/Week time grids auto-scroll to on first
   * render so working-hours events are immediately visible. Sourced
   * from the user's `calendarWorkingHoursStart` setting (#288).
   */
  workingHoursStart: number;
  /**
   * Calendar view-transition duration in milliseconds, derived from the
   * user's `calendarTransitionSpeed` setting. `0` disables animation; the
   * `AnimatedSwap` short-circuit then matches the `prefers-reduced-motion`
   * code path. See `src/lib/calendar/transition-speed.ts`.
   */
  transitionDurationMs: number;
}

interface CalendarSettings {
  badgeVariant: "dot" | "colored";
  view: TCalendarView;
  agendaMode: boolean;
  agendaModeGroupBy: "date" | "color";
  weekStartDay: TWeekStartDay;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  badgeVariant: "colored",
  view: "month",
  agendaMode: false,
  agendaModeGroupBy: "date",
  weekStartDay: 0,
};

/**
 * Loose shape used during boot: localStorage may hold a pre-#150 payload
 * where `view` was the now-removed `"agenda"` literal, and/or a pre-#337
 * payload that carried `use24HourFormat` alongside the calendar-only
 * fields. Both are migrated on mount.
 */
type LegacyCalendarSettings = Omit<Partial<CalendarSettings>, "view"> & {
  view?: TCalendarView | "agenda";
  /**
   * Pre-#337 dual-source field. Retired in favour of
   * `UserSettings.timeFormat` flowing through `useUserSettings`. Stripped
   * from the persisted payload on first mount.
   */
  use24HourFormat?: boolean;
};

/**
 * Migrate legacy persisted state. Pre-#150, "agenda" was a peer view; it's
 * now a sub-toggle that only applies inside Day and Week. Treat any stored
 * "agenda" value as `view: "day", agendaMode: true` so existing users land
 * in the closest equivalent surface instead of an undefined view.
 */
function migrateLegacySettings(
  raw: LegacyCalendarSettings
): Partial<CalendarSettings> {
  if (raw.view === "agenda") {
    return { ...raw, view: "day", agendaMode: true };
  }
  return raw as Partial<CalendarSettings>;
}

export const CalendarContext = createContext({} as ICalendarContext);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
}

export function CalendarProvider({
  children,
  badge = "colored",
  view = "month",
  initialView,
  initialAgendaMode,
}: {
  children: React.ReactNode;
  view?: TCalendarView;
  badge?: "dot" | "colored";
  /**
   * One-shot view override that wins over the persisted localStorage value
   * for the initial mount, and is written back to storage so the user's
   * deep-linked choice survives a reload. Used by the production
   * `/calendar` page to honour `?view=` URL params (issue #238). Pass
   * `undefined` to keep the default (use stored value or fall back to
   * the `view` prop / `"month"`).
   */
  initialView?: TCalendarView;
  /**
   * Companion to `initialView` for the agenda sub-toggle, e.g. legacy
   * `?view=agenda` deep links resolve to `initialView="day"` +
   * `initialAgendaMode=true` (#150 + #238). Same override semantics.
   */
  initialAgendaMode?: boolean;
}) {
  // Use NextAuth session for authentication
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  // User-configurable data-loading settings (fetched from server when authed,
  // falls back to defaults otherwise). Powers auto-refresh interval, fetch-
  // window sizing for refreshEvents, and the app-wide `timeFormat` (#337).
  // `hasLoadedFromServer` flips to true only after the first successful
  // `/api/settings` fetch — the `weekStartDay` migration shim below uses it
  // to avoid acting on the in-memory default value during the first render
  // after sign-in.
  const {
    settings: userSettings,
    mutate: mutateUserSettings,
    hasLoadedFromServer: userSettingsLoaded,
  } = useUserSettings();
  const userTimeFormat: TTimeFormat = userSettings.timeFormat;
  const use24HourFormat = userTimeFormat === "24h";

  // Cast through unknown so the legacy `"agenda"` literal can flow through
  // the hook even though it's no longer part of TCalendarView (#150).
  const [rawSettings, setSettings] = useLocalStorage<LegacyCalendarSettings>(
    "calendar-settings",
    {
      ...DEFAULT_SETTINGS,
      badgeVariant: badge,
      view: view,
    } as unknown as LegacyCalendarSettings
  );
  const settings = migrateLegacySettings(rawSettings) as CalendarSettings;

  const rawView = rawSettings.view;

  const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
    settings.badgeVariant ?? DEFAULT_SETTINGS.badgeVariant
  );
  const [currentView, setCurrentViewState] = useState<TCalendarView>(
    initialView ?? settings.view ?? DEFAULT_SETTINGS.view
  );
  const [agendaMode, setAgendaModeState] = useState<boolean>(
    initialAgendaMode ?? settings.agendaMode ?? DEFAULT_SETTINGS.agendaMode
  );
  const [agendaModeGroupBy, setAgendaModeGroupByState] = useState<
    "date" | "color"
  >(settings.agendaModeGroupBy ?? DEFAULT_SETTINGS.agendaModeGroupBy);
  // Initialize from localStorage so we have a sensible value before the
  // server's UserSettings.weekStartDay arrives. Once authenticated, the
  // effect below promotes the server value to the source of truth and the
  // setter writes through to the API instead of localStorage (#338).
  const [weekStartDay, setWeekStartDayState] = useState<TWeekStartDay>(
    settings.weekStartDay ?? DEFAULT_SETTINGS.weekStartDay
  );

  // One-shot guard for the localStorage → server migration. Survives
  // remounts via localStorage, but a single React StrictMode double-mount
  // is also covered by the in-memory ref so we never PUT twice.
  const weekStartMigrationRef = useRef(false);

  // Single mount-only write that handles two concerns atomically:
  //
  //   1. **Legacy `view: "agenda"` migration (#150)** — pre-#150 the
  //      "agenda" view was a peer of day/week; it's now a sub-toggle.
  //      The first render after the upgrade rewrites the persisted
  //      payload so subsequent loads see the new shape directly.
  //   2. **URL deep-link override (#238)** — the production /calendar
  //      page reads `?view=...` and forwards it via `initialView` /
  //      `initialAgendaMode`. The override wins over the persisted
  //      value and is written through so the deep-linked choice
  //      survives a reload.
  //
  // Folding both into one `setSettings` call removes any ordering
  // dependency between separate effects: migration's `view: "day"` /
  // `agendaMode: true` is applied first, then the override fields (when
  // defined) replace it. A reordering refactor cannot break the
  // override.
  useEffect(() => {
    const needsMigration = rawView === "agenda";
    const needsOverride =
      initialView !== undefined || initialAgendaMode !== undefined;
    if (!needsMigration && !needsOverride) {
      return;
    }
    setSettings((prev) => {
      const migrated = migrateLegacySettings(prev) as Partial<CalendarSettings>;
      return {
        ...migrated,
        ...(initialView !== undefined ? { view: initialView } : {}),
        ...(initialAgendaMode !== undefined
          ? { agendaMode: initialAgendaMode }
          : {}),
      } as unknown as LegacyCalendarSettings;
    });
    // Mount-only: capturing the props/raw value once is intentional.
    // Subsequent URL changes (back/forward) reach the page component,
    // which remounts the provider with fresh props.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // #337 — One-time migration of the legacy `use24HourFormat` field from
  // the persisted `calendar-settings` payload to the DB-backed
  // `UserSettings.timeFormat`. Two concerns merged into one effect so
  // the strip happens at the same instant we know whether to push:
  //
  //   1. Unconditionally remove `use24HourFormat` from the persisted
  //      payload so the dual-source bug can never resurface.
  //   2. When the server's `timeFormat` is at the Prisma default ("12h")
  //      and the localStorage value disagrees (`true`/24h), push the
  //      localStorage value to the server. That's the only case where
  //      we can confidently disambiguate "user has been viewing 24h on
  //      the calendar but never opened the main Settings page" from
  //      "user explicitly chose 12h elsewhere" — and it's the case that
  //      preserves continuity for the largest cohort.
  //
  // Gated on `userSettingsLoaded` (`hasLoadedFromServer`) so the
  // strip-and-maybe-push happens only after `useUserSettings`' initial GET
  // has resolved at least once — not merely when `isLoading` is false,
  // which is also the case on the very first render before the GET starts.
  // Reading `userTimeFormat` in that pre-GET window would compare the
  // in-memory default ("12h") instead of the real server value and could
  // push a spurious PUT (the same race `hasLoadedFromServer` was added to
  // close for the #338 weekStartDay migration below). The `migrationRanRef`
  // guard makes the effect resilient to React Strict Mode's double-invoke
  // and any future dependency change that would re-trigger the body.
  const migrationRanRef = useRef(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAuthenticated && !userSettingsLoaded) return;
    if (migrationRanRef.current) return;

    const raw = window.localStorage.getItem("calendar-settings");
    if (!raw) {
      migrationRanRef.current = true;
      return;
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      migrationRanRef.current = true;
      return;
    }
    if (typeof parsed.use24HourFormat !== "boolean") {
      migrationRanRef.current = true;
      return;
    }
    const lsTimeFormat: TTimeFormat = parsed.use24HourFormat ? "24h" : "12h";
    delete parsed.use24HourFormat;
    window.localStorage.setItem("calendar-settings", JSON.stringify(parsed));
    migrationRanRef.current = true;

    if (isAuthenticated && userTimeFormat === "12h" && lsTimeFormat === "24h") {
      void mutateUserSettings({ timeFormat: lsTimeFormat }).catch((error) => {
        logger.error(error as Error, {
          context: "calendarProvider.timeFormatMigration",
        });
      });
    }
    // Re-runs are guarded by `migrationRanRef`; the effect intentionally
    // observes auth + GET resolution to know when it's safe to read the
    // server-side `userTimeFormat`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, userSettingsLoaded, userTimeFormat]);

  const [selectedDate, setSelectedDate] = useState(new Date());

  // Issue #208 — filter state is persisted per-profile. The active profile
  // id has two channels:
  //  • Same-tab switches (the common `ProfileSwitcher` dropdown case): the
  //    `useProfileOptional()` hook gives us the live id from React state, so
  //    `<ProfileProvider>` → `<CalendarProvider>` re-renders propagate
  //    immediately. `Optional` because some tests mount `CalendarProvider`
  //    without `ProfileProvider`; in that case we fall back to localStorage.
  //  • Cross-tab switches: same-tab `localStorage.setItem` calls do NOT
  //    fire `storage` events in the same tab (MDN spec), so we still need
  //    the `storage` listener as the cross-tab signal.
  const profileContext = useProfileOptional();
  const [activeProfileId, setActiveProfileId] = useState<string | null>(() => {
    if (profileContext?.activeProfile) return profileContext.activeProfile.id;
    return getActiveProfileId();
  });

  // Same-tab signal: `ProfileProvider` re-renders with the new
  // `activeProfile`, mirror it into our local state so the re-hydration
  // effect below kicks in.
  useEffect(() => {
    if (!profileContext) return;
    const id = profileContext.activeProfile?.id ?? null;
    if (id !== activeProfileId) {
      setActiveProfileId(id);
    }
  }, [profileContext, profileContext?.activeProfile?.id, activeProfileId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: StorageEvent) => {
      if (e.key === "activeProfileId") {
        setActiveProfileId(e.newValue);
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Read once at construction so the three filter-state initialisers below
  // share a single localStorage round-trip with the activeProfileId hook.
  // Wrapped in a lazy `useState` initialiser so `loadFilterState` (which
  // hits localStorage) doesn't run on every re-render; the seed is only
  // used by the three `useState` calls below.
  const [initialFilterState] = useState(() => loadFilterState(activeProfileId));
  const [selectedUserId, setSelectedUserIdState] = useState<
    IUser["id"] | "all"
  >(initialFilterState.selectedUserId);
  const [selectedColors, setSelectedColors] = useState<TEventColor[]>(
    initialFilterState.selectedColors
  );
  const [selectedCalendarIds, setSelectedCalendarIdsState] = useState<string[]>(
    initialFilterState.selectedCalendarIds
  );

  // Track the profile id whose filter state currently lives in
  // `selectedColors` / `selectedUserId` / `selectedCalendarIds`. Used both
  // to detect mid-session profile changes (so we can re-hydrate) AND to
  // gate `persistFilters`: if a user-driven filter change races with a
  // cross-tab profile switch, the in-memory state still reflects the
  // OLD profile, so we must skip the write rather than corrupt the new
  // profile's stored state.
  const hydratedProfileRef = useRef(activeProfileId);

  useEffect(() => {
    if (hydratedProfileRef.current === activeProfileId) return;
    const next = loadFilterState(activeProfileId);
    setSelectedColors(next.selectedColors);
    setSelectedUserIdState(next.selectedUserId);
    setSelectedCalendarIdsState(next.selectedCalendarIds);
    hydratedProfileRef.current = activeProfileId;
  }, [activeProfileId]);

  const [allEvents, setAllEvents] = useState<IEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<IEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colorMappings, setColorMappings] = useState<CalendarColorMapping[]>(
    () => {
      if (typeof window === "undefined") return [];
      return loadColorMappings();
    }
  );
  // Rich calendar metadata (id + summary + backgroundColor) used by the
  // CalendarFilterPanel's per-calendar dropdown (#208). Populated from the
  // same `/api/calendar/calendars` payload that produces `calendarIds`,
  // `accessRoles`, and `calendarMetadata` below.
  const [calendars, setCalendars] = useState<ICalendarInfo[]>([]);
  const [calendarIds, setCalendarIds] = useState<string[]>([]);
  // Per-calendar accessRole map used by `getAccessRole` so consumers can
  // gate mutating UI on read-only calendars (#266). Populated from the
  // same `/api/calendar/calendars` payload as `calendarIds`.
  const [accessRoles, setAccessRoles] = useState<
    Record<string, TCalendarAccessRole>
  >({});
  // Per-calendar metadata used by `transformGoogleEvent` to pick a
  // human-readable user attribution for shared-calendar events whose creator
  // / organizer have no `displayName` (#307 Bug B). Populated from the same
  // `/api/calendar/calendars` payload that produces `calendarIds`.
  const [calendarMetadata, setCalendarMetadata] = useState<CalendarMetadataMap>(
    () => new Map()
  );
  const [loadedRange, setLoadedRange] = useState<LoadedRange | null>(null);
  const isLoadingRangeRef = useRef(false);

  // Plain closure — React Compiler memoizes automatically (CLAUDE.md
  // forbids manual useCallback). The role map only changes when the
  // calendar list is fetched, so identity churn here is a non-issue.
  const getAccessRole = (calendarId: string): TCalendarAccessRole | undefined =>
    accessRoles[calendarId];

  const updateSettings = (newPartialSettings: Partial<CalendarSettings>) => {
    setSettings((prev) => ({
      ...prev,
      ...newPartialSettings,
    }));
  };

  const setBadgeVariant = (variant: "dot" | "colored") => {
    setBadgeVariantState(variant);
    updateSettings({ badgeVariant: variant });
  };

  const setView = (view: TCalendarView) => {
    setCurrentViewState(view);
    updateSettings({ view });
  };

  const setAgendaMode = (enabled: boolean) => {
    setAgendaModeState(enabled);
    updateSettings({ agendaMode: enabled });
  };

  const toggleTimeFormat = () => {
    // #337 — `timeFormat` is owned by `UserSettings`; route the toggle
    // through `mutateUserSettings` so the change persists DB-side and
    // every other in-tab consumer (the main Settings page) re-renders
    // immediately via the user-settings bus. Errors are swallowed: the
    // optimistic local update has already happened, and a toast lives
    // closer to the user's edit surface (the Settings form).
    void mutateUserSettings({
      timeFormat: use24HourFormat ? "12h" : "24h",
    }).catch((error) => {
      logger.error(error as Error, { context: "toggleTimeFormat" });
    });
  };

  const setAgendaModeGroupBy = (groupBy: "date" | "color") => {
    setAgendaModeGroupByState(groupBy);
    updateSettings({ agendaModeGroupBy: groupBy });
  };

  /**
   * Persist the chosen week-start day. Once authenticated, the source of
   * truth is `UserSettings.weekStartDay` on the server (#338), so the setter
   * PUTs to `/api/settings` and the next `useUserSettings` refresh reads it
   * back. We still mirror the value into localStorage so unauthenticated
   * surfaces (and the next paint while we wait for the server) stay in sync.
   *
   * On PUT failure we revert the optimistic state + localStorage update so
   * the UI doesn't drift from the persisted value, mirroring the rollback
   * pattern used by `createEvent` / `deleteEvent` in this provider.
   */
  const setWeekStartDay = (day: TWeekStartDay) => {
    const previousDay = weekStartDay;
    setWeekStartDayState(day);
    updateSettings({ weekStartDay: day });
    if (status === "authenticated") {
      void fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDay: day }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`PUT /api/settings ${response.status}`);
          }
        })
        .catch((error) => {
          // Revert optimistic update so the UI matches the persisted value.
          setWeekStartDayState(previousDay);
          updateSettings({ weekStartDay: previousDay });
          logger.error(error as Error, {
            context: "setWeekStartDay",
            weekStartDay: day,
          });
        });
    }
  };

  const persistFilters = (updates: {
    selectedColors?: TEventColor[];
    selectedUserId?: IUser["id"] | "all";
    selectedCalendarIds?: string[];
  }) => {
    // Skip writes during the brief window between an active-profile change
    // and the re-hydration effect catching up: in-memory `selected*` still
    // holds the OLD profile's values, so persisting them under the NEW
    // profile's key would corrupt that profile's stored state. The
    // user-driven action that triggered this call is intentionally
    // dropped — the new profile's hydrated state will overwrite anyway
    // on the next render.
    if (hydratedProfileRef.current !== activeProfileId) return;
    saveFilterState(activeProfileId, {
      selectedColors: updates.selectedColors ?? selectedColors,
      selectedUserId: updates.selectedUserId ?? selectedUserId,
      selectedCalendarIds: updates.selectedCalendarIds ?? selectedCalendarIds,
    });
  };

  // localStorage → server migration for `weekStartDay` (#338).
  //
  // Pre-#338, `weekStartDay` lived only in the per-browser `calendar-settings`
  // localStorage key. When a user with a non-default localStorage value
  // (Monday) signs in for the first time after the rollout, push it up to
  // the server exactly once so subsequent browsers see their preference.
  // The migration flag lives in its own localStorage key so it survives a
  // tab close before a future server-driven refactor.
  //
  // Gated on `userSettingsLoaded` so we only compare against the real
  // server value, not the in-memory default `userSettings.weekStartDay`
  // that ships before the first `/api/settings` GET resolves. Without this
  // guard the very first authenticated render fires a redundant PUT in
  // the case where the user already migrated on another browser.
  useEffect(() => {
    if (weekStartMigrationRef.current) return;
    if (status !== "authenticated") return;
    if (!userSettingsLoaded) return;
    if (typeof window === "undefined") return;

    const FLAG_KEY = "calendar-week-start-day-migrated";
    if (window.localStorage.getItem(FLAG_KEY) === "1") {
      weekStartMigrationRef.current = true;
      return;
    }

    const localValue = settings.weekStartDay ?? DEFAULT_SETTINGS.weekStartDay;
    const serverValue = userSettings.weekStartDay;

    if (localValue !== serverValue) {
      // The local value is the user's last explicit choice on this browser;
      // promote it to the server so other browsers + the main Settings page
      // see the same default.
      void fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weekStartDay: localValue }),
      }).catch((error) => {
        logger.error(error as Error, {
          context: "weekStartDayMigration",
        });
      });
    }

    window.localStorage.setItem(FLAG_KEY, "1");
    weekStartMigrationRef.current = true;
    // `settings.weekStartDay` is intentionally omitted: the effect is
    // mount-only after the flag is set, and reads the localStorage value
    // imperatively above. Including it would re-run the effect every time
    // the user toggles the radio (the early-return guard short-circuits,
    // but the dep is misleading).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, userSettingsLoaded, userSettings.weekStartDay]);

  // Once the server value is known and the migration has run, treat the
  // server as the source of truth: copy the server value into local state
  // whenever it changes. The `=== 1 ? 1 : 0` clamp mirrors the same
  // defensive guard in `src/app/settings/page.tsx`, in case
  // `useUserSettings`'s pick filter is ever bypassed.
  //
  // `weekStartDay` is intentionally NOT in the dep array: an optimistic
  // local update (from `setWeekStartDay`) must not retrigger this effect,
  // or it would immediately revert the optimistic flip back to the stale
  // server value held by `userSettings.weekStartDay`.
  useEffect(() => {
    if (status !== "authenticated") return;
    if (!weekStartMigrationRef.current) return;
    const safe: TWeekStartDay = userSettings.weekStartDay === 1 ? 1 : 0;
    setWeekStartDayState(safe);
  }, [status, userSettings.weekStartDay]);

  const filterEventsBySelectedColors = (color: TEventColor) => {
    const next = selectedColors.includes(color)
      ? selectedColors.filter((c) => c !== color)
      : [...selectedColors, color];
    setSelectedColors(next);
    persistFilters({ selectedColors: next });
  };

  const setSelectedUserId = (userId: IUser["id"] | "all") => {
    setSelectedUserIdState(userId);
    persistFilters({ selectedUserId: userId });
  };

  const filterEventsBySelectedUser = (userId: IUser["id"] | "all") => {
    setSelectedUserId(userId);
  };

  const filterEventsBySelectedCalendars = (calendarId: string) => {
    const next = selectedCalendarIds.includes(calendarId)
      ? selectedCalendarIds.filter((id) => id !== calendarId)
      : [...selectedCalendarIds, calendarId];
    setSelectedCalendarIdsState(next);
    persistFilters({ selectedCalendarIds: next });
  };

  const clearFilter = () => {
    setSelectedColors([]);
    setSelectedUserIdState("all");
    setSelectedCalendarIdsState([]);
    persistFilters({
      selectedColors: [],
      selectedUserId: "all",
      selectedCalendarIds: [],
    });
  };

  const addEvent = (event: IEvent) => {
    setAllEvents((prev) => [...prev, event]);
  };

  const updateEvent = (event: IEvent) => {
    setAllEvents((prev) => prev.map((e) => (e.id === event.id ? event : e)));
  };

  const removeEvent = (eventId: string) => {
    setAllEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  const createEvent = async (
    optimistic: IEvent,
    input: CreateEventInput
  ): Promise<IEvent> => {
    // Optimistic insert keyed on the optimistic id. If the request fails
    // we remove only that row, so a concurrent refreshEvents() can update
    // the rest of the list without us clobbering its result on rollback.
    setAllEvents((prev) => [...prev, optimistic]);

    try {
      const response = await fetch("/api/calendar/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: input.title,
          startDate: input.startDate,
          endDate: input.endDate,
          color: input.color,
          description: input.description,
          isAllDay: input.isAllDay,
          calendarId: input.calendarId,
        }),
      });

      if (!response.ok) {
        let message = "Failed to create event";
        try {
          const body = await response.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          // Some upstream proxies return non-JSON 502s; the generic message
          // is sufficient for the toast.
        }
        throw new Error(message);
      }

      const body = (await response.json()) as { event: GoogleCalendarEvent };
      // Reconcile through the in-memory colorMappings + calendarMetadata
      // state — refreshEvents keeps both current, and re-reading localStorage
      // here would race with that path on subsequent creates. The metadata
      // feeds the user-attribution fallback ladder for shared calendars
      // (#307 Bug B).
      const reconciled = transformGoogleEvent(
        body.event,
        colorMappings,
        calendarMetadata
      );

      // Replace the optimistic row with the server's canonical event in a
      // single setState so the list never flickers.
      setAllEvents((current) =>
        current.map((e) => (e.id === optimistic.id ? reconciled : e))
      );

      logger.event("CalendarEventCreated", {
        eventId: reconciled.id,
        calendarId: reconciled.calendarId,
      });

      return reconciled;
    } catch (error) {
      // Rollback: remove the optimistic row from whatever list is current,
      // preserving any concurrent refresh's writes.
      setAllEvents((current) => current.filter((e) => e.id !== optimistic.id));
      logger.error(error as Error, {
        context: "createEvent",
        calendarId: input.calendarId,
      });
      throw error;
    }
  };

  const deleteEvent = async (eventId: string, calendarId: string) => {
    // Snapshot the single event being removed so a concurrent
    // refreshEvents() can update the rest of the list without us clobbering
    // its result on rollback.
    let removed: IEvent | undefined;
    setAllEvents((prev) => {
      removed = prev.find((e) => e.id === eventId);
      return prev.filter((e) => e.id !== eventId);
    });

    try {
      const url = new URL(
        `/api/calendar/events/${encodeURIComponent(eventId)}`,
        window.location.origin
      );
      url.searchParams.set("calendarId", calendarId);

      const response = await fetch(url.toString(), { method: "DELETE" });

      if (!response.ok) {
        let message = "Failed to delete event";
        try {
          const body = await response.json();
          if (typeof body?.error === "string") message = body.error;
        } catch {
          // Some failures (e.g. 502 from a proxy) may not have a JSON body.
        }
        throw new Error(message);
      }

      logger.event("CalendarEventDeleted", { eventId, calendarId });
    } catch (error) {
      // Rollback by re-adding the single event into whatever list is
      // current — any concurrent refresh's writes are preserved.
      setAllEvents((current) => {
        if (!removed || current.some((e) => e.id === removed!.id)) {
          return current;
        }
        return [...current, removed];
      });
      logger.error(error as Error, {
        context: "deleteEvent",
        eventId,
        calendarId,
      });
      throw error;
    }
  };

  /**
   * Fetch events for a specific date range and merge with existing events
   */
  const fetchEventsForRange = async (
    timeMin: Date,
    timeMax: Date,
    calIds: string[],
    mappings: CalendarColorMapping[],
    metadata: CalendarMetadataMap
  ): Promise<IEvent[]> => {
    const url = new URL("/api/calendar/events", window.location.origin);
    url.searchParams.set("calendarIds", calIds.join(","));
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());

    const response = await fetch(url.toString());

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.requiresReauth) {
        logger.log("API requires re-authentication");
      }
      throw new Error(errorData.error || "Failed to fetch events");
    }

    const data = await response.json();
    const googleEvents: GoogleCalendarEvent[] = data.events || [];

    // Transform events using color mappings + per-calendar metadata so
    // shared-calendar events get a recognisable user attribution (#307).
    return googleEvents.map((event) =>
      transformGoogleEvent(event, mappings, metadata)
    );
  };

  /**
   * Fetch the user's calendar list. Returns the IDs (for downstream
   * `/api/calendar/events` queries), the rich `ICalendarInfo` list
   * (id + summary + backgroundColor — consumed by `CalendarFilterPanel`'s
   * per-calendar dropdown, #208), and a metadata map keyed by id (for
   * the `transformGoogleEvent` user-attribution fallback ladder, #307
   * Bug B).
   *
   * Side-effects: populates both `calendars` (filter panel) and
   * `accessRoles` (read-only delete gating, #266) from the same payload
   * so a single `/api/calendar/calendars` round-trip serves three
   * consumers.
   *
   * On API failure / zero-calendar accounts, returns `calendars: []` so
   * the filter panel renders its empty-state cleanly (avoids the
   * synthetic "Primary" row #318's review flagged), but returns
   * `ids: ["primary"]` so the events fetch URL stays valid for the
   * legacy single-calendar path.
   */
  const fetchCalendarList = async (): Promise<{
    ids: string[];
    metadata: CalendarMetadataMap;
    calendars: ICalendarInfo[];
  }> => {
    try {
      const response = await fetch("/api/calendar/calendars");
      if (!response.ok) {
        logger.log("Failed to fetch calendar list, using primary only");
        // Clear `accessRoles` alongside `calendars` so consumers don't see
        // a stale role map after the list itself goes empty (otherwise
        // `getAccessRole` would still hand out roles for calendars the
        // provider no longer considers current).
        setAccessRoles({});
        setCalendars([]);
        return { ids: ["primary"], metadata: new Map(), calendars: [] };
      }

      const data = (await response.json()) as CalendarsResponse;
      if (data.calendars && data.calendars.length > 0) {
        const ids = data.calendars.map((cal) => cal.id);
        const metadata = new Map<string, CalendarAttributionMetadata>(
          data.calendars.map((cal) => [
            cal.id,
            {
              summary: cal.summary,
              summaryOverride: cal.summaryOverride,
            },
          ])
        );
        const roles: Record<string, TCalendarAccessRole> = {};
        for (const cal of data.calendars) {
          roles[cal.id] = cal.accessRole;
        }
        setAccessRoles(roles);
        const calendarsList: ICalendarInfo[] = data.calendars.map((cal) => ({
          id: cal.id,
          summary: cal.summary ?? cal.id,
          backgroundColor: cal.backgroundColor ?? "",
        }));
        setCalendars(calendarsList);
        logger.log("Fetched calendar list", { count: ids.length });
        return { ids, metadata, calendars: calendarsList };
      }
    } catch {
      logger.log("Could not fetch calendar list, using primary only");
    }
    setAccessRoles({});
    setCalendars([]);
    return { ids: ["primary"], metadata: new Map(), calendars: [] };
  };

  // Refresh events from server-side API. React Compiler memoizes this and
  // the effect at the bottom of the body uses it via a ref, so the
  // `react-hooks/exhaustive-deps` warning that demands a banned
  // `useCallback` is a false positive (#271).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const refreshEvents = async () => {
    try {
      setIsLoading(true);

      // Check authentication via session
      if (status !== "authenticated" || !session?.user) {
        logger.log("Not authenticated, skipping event fetch");
        setAllEvents([]);
        setIsLoading(false);
        return;
      }

      // Check if session has a refresh token error
      if (session.error === "RefreshTokenError") {
        logger.log("Session has refresh token error, needs re-auth");
        setAllEvents([]);
        setIsLoading(false);
        return;
      }

      // Always re-fetch the calendar list on every refresh. This keeps
      // both the user-attribution metadata (#307 Bug B) and the per-
      // calendar accessRoles map (#266) fresh, so a permission change in
      // Google is reflected on the next refresh without restarting the
      // session. The same staleness reasoning drives the unconditional
      // color refresh below. `fetchCalendarList` also populates the rich
      // `calendars` list used by the filter panel (#208) as a side
      // effect.
      const list = await fetchCalendarList();
      const calIds = list.ids;
      const currentMetadata = list.metadata;
      setCalendarIds(calIds);
      setCalendarMetadata(currentMetadata);

      // Fetch the canonical color mappings from the server on every refresh.
      // localStorage is treated as a paint-fast warm cache, not the source of
      // truth — the server-derived mapping (per-user override on
      // `calendarList.list.backgroundColor`) is. Pre-#307 this was a
      // fetch-once-per-session cache that never noticed an override change in
      // Google Calendar nor reconciled across browsers; on every refresh we
      // now write through to localStorage so the next paint stays fast.
      let currentMappings = colorMappings;
      try {
        const colorResponse = await fetch("/api/calendar/colors");
        if (colorResponse.ok) {
          const colorData = await colorResponse.json();
          // Intentionally skip the write when the server returns no mappings:
          // an empty response could indicate a transient API hiccup or a
          // momentarily empty calendarList, and overwriting a warm cache with
          // [] would flash all events to the default blue. True
          // source-of-truth behaviour is deferred to the server-side
          // CalendarSettings persistence tracked as a follow-up to #307.
          if (colorData.colorMappings && colorData.colorMappings.length > 0) {
            currentMappings = colorData.colorMappings;
            saveColorMappings(currentMappings);
            setColorMappings(currentMappings);
            logger.log("Fetched color mappings during refresh", {
              count: currentMappings.length,
            });
          }
        }
      } catch {
        logger.log("Could not fetch colors during refresh");
      }

      // Calculate time range from user settings (defaults: -1 month, +6 months)
      const now = new Date();
      const timeMin = new Date(
        now.getFullYear(),
        now.getMonth() - userSettings.calendarFetchMonthsBehind,
        1
      );
      const timeMax = new Date(
        now.getFullYear(),
        now.getMonth() + userSettings.calendarFetchMonthsAhead + 1,
        0
      );

      // Fetch events from all calendars. If `fetchCalendarList` came back
      // empty (unauthenticated, API failure, or zero-calendar account),
      // fall back to `["primary"]` so the events fetch URL stays valid.
      const transformedEvents = await fetchEventsForRange(
        timeMin,
        timeMax,
        calIds,
        currentMappings,
        currentMetadata
      );

      setAllEvents(transformedEvents);
      setLoadedRange({ start: timeMin, end: timeMax });

      // Cache events in IndexedDB for offline/fast access
      const googleEvents: GoogleCalendarEvent[] = transformedEvents.map(
        (event) => ({
          id: event.id,
          summary: event.title,
          description: event.description,
          start: { dateTime: event.startDate },
          end: { dateTime: event.endDate },
          calendarId: event.calendarId || "primary",
        })
      );
      await eventCache.saveEvents(googleEvents);

      logger.log("Refreshed calendar events from API", {
        count: transformedEvents.length,
        calendarCount: calIds.length,
      });
    } catch (error) {
      logger.error(error as Error, { context: "refreshEvents" });

      // Try to load from cache on error
      try {
        const cachedEvents = await eventCache.getEvents();
        const transformedEvents = cachedEvents.map((event) =>
          transformGoogleEvent(event, colorMappings, calendarMetadata)
        );
        setAllEvents(transformedEvents);
        logger.log("Loaded events from cache", {
          count: transformedEvents.length,
        });
      } catch (cacheError) {
        logger.error(cacheError as Error, { context: "loadCachedEvents" });
      }
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Load additional events when navigating outside loaded range
   */
  const loadEventsForDate = async (date: Date) => {
    // Skip if not authenticated or already loading
    if (
      status !== "authenticated" ||
      !loadedRange ||
      isLoadingRangeRef.current
    ) {
      return;
    }

    const targetMonth = startOfMonth(date);
    const targetMonthEnd = endOfMonth(date);

    // Check if target month is within loaded range
    if (
      !isBefore(targetMonth, loadedRange.start) &&
      !isAfter(targetMonthEnd, loadedRange.end)
    ) {
      return; // Already loaded
    }

    isLoadingRangeRef.current = true;
    logger.log("Loading events for date outside loaded range", {
      date: date.toISOString(),
    });

    try {
      let newStart = loadedRange.start;
      let newEnd = loadedRange.end;

      // Fetch earlier events
      if (isBefore(targetMonth, loadedRange.start)) {
        const fetchEnd = loadedRange.start;
        const fetchStart = new Date(
          targetMonth.getFullYear(),
          targetMonth.getMonth() - 1,
          1
        );

        const newEvents = await fetchEventsForRange(
          fetchStart,
          fetchEnd,
          calendarIds.length > 0 ? calendarIds : ["primary"],
          colorMappings,
          calendarMetadata
        );

        setAllEvents((prev) => {
          // Merge and dedupe events
          const existingIds = new Set(prev.map((e) => e.id));
          const uniqueNewEvents = newEvents.filter(
            (e) => !existingIds.has(e.id)
          );
          return [...uniqueNewEvents, ...prev];
        });

        newStart = fetchStart;
      }

      // Fetch later events
      if (isAfter(targetMonthEnd, loadedRange.end)) {
        const fetchStart = loadedRange.end;
        const fetchEnd = new Date(
          targetMonthEnd.getFullYear(),
          targetMonthEnd.getMonth() + 2,
          0
        );

        const newEvents = await fetchEventsForRange(
          fetchStart,
          fetchEnd,
          calendarIds.length > 0 ? calendarIds : ["primary"],
          colorMappings,
          calendarMetadata
        );

        setAllEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const uniqueNewEvents = newEvents.filter(
            (e) => !existingIds.has(e.id)
          );
          return [...prev, ...uniqueNewEvents];
        });

        newEnd = fetchEnd;
      }

      setLoadedRange({ start: newStart, end: newEnd });
    } catch (error) {
      logger.error(error as Error, { context: "loadEventsForDate" });
    } finally {
      isLoadingRangeRef.current = false;
    }
  };

  /**
   * Ensure events for an entire calendar year are loaded.
   *
   * The default `refreshEvents` window is `-calendarFetchMonthsBehind` to
   * `+calendarFetchMonthsAhead` months from "now" — typically 7 months —
   * which leaves the year view sparsely populated outside that window.
   * This method widens `loadedRange` to cover Jan 1 – Dec 31 of the
   * requested year by fetching only the missing edges and merging them
   * into `allEvents`.
   */
  const loadEventsForYear = async (year: number) => {
    if (
      status !== "authenticated" ||
      !loadedRange ||
      isLoadingRangeRef.current
    ) {
      return;
    }

    const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    // Year already fully covered by loadedRange — nothing to do.
    if (
      !isBefore(yearStart, loadedRange.start) &&
      !isAfter(yearEnd, loadedRange.end)
    ) {
      return;
    }

    isLoadingRangeRef.current = true;
    logger.log("Loading events for full year", { year });

    try {
      const calIds = calendarIds.length > 0 ? calendarIds : ["primary"];

      // Advance `loadedRange` after each successful edge fetch rather
      // than batching both updates at the end. If the Dec edge throws
      // after the Jan edge has already merged its events into state,
      // the range pointer must reflect what's actually stored — else
      // a retry would needlessly re-fetch Jan and rely on the dedupe
      // guard to discard the duplicates.
      if (isBefore(yearStart, loadedRange.start)) {
        const newEvents = await fetchEventsForRange(
          yearStart,
          loadedRange.start,
          calIds,
          colorMappings,
          calendarMetadata
        );

        setAllEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const uniqueNewEvents = newEvents.filter(
            (e) => !existingIds.has(e.id)
          );
          return [...uniqueNewEvents, ...prev];
        });

        setLoadedRange((prev) => (prev ? { ...prev, start: yearStart } : prev));
      }

      if (isAfter(yearEnd, loadedRange.end)) {
        const newEvents = await fetchEventsForRange(
          loadedRange.end,
          yearEnd,
          calIds,
          colorMappings,
          calendarMetadata
        );

        setAllEvents((prev) => {
          const existingIds = new Set(prev.map((e) => e.id));
          const uniqueNewEvents = newEvents.filter(
            (e) => !existingIds.has(e.id)
          );
          return [...prev, ...uniqueNewEvents];
        });

        setLoadedRange((prev) => (prev ? { ...prev, end: yearEnd } : prev));
      }
    } catch (error) {
      logger.error(error as Error, { context: "loadEventsForYear" });
    } finally {
      isLoadingRangeRef.current = false;
    }
  };

  // Color mappings are initialized synchronously from localStorage in useState.
  // They are also refreshed from the API as part of refreshEvents.

  // Load cached events on mount, then refresh from API when authenticated
  useEffect(() => {
    const initializeEvents = async () => {
      try {
        // First, load cached events for immediate display. Metadata may be
        // empty on first paint (we haven't fetched the calendar list yet);
        // the ladder simply skips that rung and falls through to the next.
        const cachedEvents = await eventCache.getEvents();
        const transformedEvents = cachedEvents.map((event) =>
          transformGoogleEvent(event, colorMappings, calendarMetadata)
        );
        setAllEvents(transformedEvents);
        logger.log("Loaded events from cache on mount", {
          count: transformedEvents.length,
        });
      } catch (error) {
        logger.error(error as Error, { context: "loadCachedEventsOnMount" });
      } finally {
        setIsLoading(false);
      }

      // Then, refresh from API if authenticated
      if (status === "authenticated") {
        await refreshEvents();
      }
    };

    // Only initialize once session status is known
    if (status !== "loading") {
      initializeEvents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Keep a ref to the latest refreshEvents so the interval always calls the
  // current closure (avoids stale state from earlier effect runs).
  // React Compiler memoizes `refreshEvents` based on its captured deps so
  // the effect only re-runs when those underlying inputs actually change.
  const refreshEventsRef = useRef(refreshEvents);
  useEffect(() => {
    refreshEventsRef.current = refreshEvents;
  }, [refreshEvents]);

  // Auto-refresh events using the user-configurable interval
  useEffect(() => {
    // Only set up refresh interval if authenticated
    if (status !== "authenticated") {
      return;
    }

    const intervalMs = userSettings.calendarRefreshIntervalMinutes * 60 * 1000;

    const interval = setInterval(() => {
      refreshEventsRef.current();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [status, userSettings.calendarRefreshIntervalMinutes]);

  // Filter events. The three dimensions (user, color, calendar) intersect:
  // an event must pass every active filter to remain in `filteredEvents`.
  // An empty `selectedColors` / `selectedCalendarIds` means "no constraint
  // on that dimension" — same convention as `selectedUserId === "all"`.
  const [hiddenEventCounts, setHiddenEventCounts] =
    useState<HiddenEventCounts>(ZERO_HIDDEN_COUNTS);

  useEffect(() => {
    let filtered = allEvents;

    if (selectedUserId !== "all") {
      filtered = filtered.filter((event) => event.user.id === selectedUserId);
    }

    if (selectedColors.length > 0) {
      filtered = filtered.filter((event) =>
        selectedColors.includes(event.color)
      );
    }

    if (selectedCalendarIds.length > 0) {
      filtered = filtered.filter((event) =>
        selectedCalendarIds.includes(event.calendarId)
      );
    }

    setFilteredEvents(filtered);
    setHiddenEventCounts(
      computeHiddenEventCounts(allEvents, {
        selectedColors,
        selectedUserId,
        selectedCalendarIds,
      })
    );
  }, [allEvents, selectedUserId, selectedColors, selectedCalendarIds]);

  // Get unique users from events
  const users = allEvents.reduce((acc, event) => {
    if (!acc.find((u) => u.id === event.user.id)) {
      acc.push(event.user);
    }
    return acc;
  }, [] as IUser[]);

  const handleSetSelectedDate = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      // Trigger lazy loading for dates outside the loaded range
      loadEventsForDate(date);
    }
  };

  const value: ICalendarContext = {
    selectedDate,
    view: currentView,
    setView,
    agendaMode,
    setAgendaMode,
    agendaModeGroupBy,
    setAgendaModeGroupBy,
    use24HourFormat,
    toggleTimeFormat,
    weekStartDay,
    setWeekStartDay,
    setSelectedDate: handleSetSelectedDate,
    selectedUserId,
    setSelectedUserId,
    badgeVariant,
    setBadgeVariant,
    selectedColors,
    filterEventsBySelectedColors,
    filterEventsBySelectedUser,
    calendars,
    selectedCalendarIds,
    filterEventsBySelectedCalendars,
    hiddenEventCounts,
    users,
    events: filteredEvents,
    addEvent,
    updateEvent,
    removeEvent,
    createEvent,
    deleteEvent,
    clearFilter,
    refreshEvents,
    loadEventsForYear,
    getAccessRole,
    isLoading,
    isAuthenticated,
    // Clamp defensively so a rogue DB write of 0 or a negative number never
    // collapses every non-empty day into a bare "+N more" label.
    maxEventsPerDay: Math.max(1, userSettings.calendarMaxEventsPerDay),
    // Clamp to the valid 0–23 hour range so a malformed cached payload
    // can't push the grid scroll into negative or beyond-day territory
    // (the API validator already enforces this for fresh writes).
    workingHoursStart: Math.min(
      23,
      Math.max(0, Math.trunc(userSettings.calendarWorkingHoursStart))
    ),
    transitionDurationMs: resolveTransitionDurationMs(
      userSettings.calendarTransitionSpeed
    ),
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
