"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useUserSettings } from "@/hooks/useUserSettings";
import {
  type CalendarColorMapping,
  eventCache,
  loadColorMappings,
  saveColorMappings,
} from "@/lib/calendar-storage";
import { transformGoogleEvent } from "@/lib/calendar-transform";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
  TWeekStartDay,
} from "@/types/calendar";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  isLoading: boolean;
  isAuthenticated: boolean;
  maxEventsPerDay: number;
}

interface CalendarSettings {
  badgeVariant: "dot" | "colored";
  view: TCalendarView;
  use24HourFormat: boolean;
  agendaMode: boolean;
  agendaModeGroupBy: "date" | "color";
  weekStartDay: TWeekStartDay;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  badgeVariant: "colored",
  view: "month",
  use24HourFormat: true,
  agendaMode: false,
  agendaModeGroupBy: "date",
  weekStartDay: 0,
};

/**
 * Loose shape used during boot: localStorage may hold a pre-#150 payload
 * where `view` was the now-removed `"agenda"` literal.
 */
type LegacyCalendarSettings = Omit<Partial<CalendarSettings>, "view"> & {
  view?: TCalendarView | "agenda";
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
}: {
  children: React.ReactNode;
  view?: TCalendarView;
  badge?: "dot" | "colored";
}) {
  // Use NextAuth session for authentication
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";

  // User-configurable data-loading settings (fetched from server when authed,
  // falls back to defaults otherwise). Powers auto-refresh interval and
  // fetch-window sizing for refreshEvents.
  const { settings: userSettings } = useUserSettings();

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

  // Flush the migrated payload back to localStorage so the legacy value is
  // overwritten on the first render after a #150 upgrade. Subsequent loads
  // see the new shape directly and skip the migration branch.
  const rawView = rawSettings.view;
  useEffect(() => {
    if (rawView === "agenda") {
      setSettings(
        (prev) =>
          migrateLegacySettings(prev) as unknown as LegacyCalendarSettings
      );
    }
  }, [rawView, setSettings]);

  const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
    settings.badgeVariant ?? DEFAULT_SETTINGS.badgeVariant
  );
  const [currentView, setCurrentViewState] = useState<TCalendarView>(
    settings.view ?? DEFAULT_SETTINGS.view
  );
  const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
    settings.use24HourFormat ?? DEFAULT_SETTINGS.use24HourFormat
  );
  const [agendaMode, setAgendaModeState] = useState<boolean>(
    settings.agendaMode ?? DEFAULT_SETTINGS.agendaMode
  );
  const [agendaModeGroupBy, setAgendaModeGroupByState] = useState<
    "date" | "color"
  >(settings.agendaModeGroupBy ?? DEFAULT_SETTINGS.agendaModeGroupBy);
  const [weekStartDay, setWeekStartDayState] = useState<TWeekStartDay>(
    settings.weekStartDay ?? DEFAULT_SETTINGS.weekStartDay
  );

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">(
    "all"
  );
  const [selectedColors, setSelectedColors] = useState<TEventColor[]>([]);

  const [allEvents, setAllEvents] = useState<IEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<IEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colorMappings, setColorMappings] = useState<CalendarColorMapping[]>(
    () => {
      if (typeof window === "undefined") return [];
      return loadColorMappings();
    }
  );
  const [calendarIds, setCalendarIds] = useState<string[]>([]);
  const [loadedRange, setLoadedRange] = useState<LoadedRange | null>(null);
  const isLoadingRangeRef = useRef(false);

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
    setUse24HourFormatState(!use24HourFormat);
    updateSettings({ use24HourFormat: !use24HourFormat });
  };

  const setAgendaModeGroupBy = (groupBy: "date" | "color") => {
    setAgendaModeGroupByState(groupBy);
    updateSettings({ agendaModeGroupBy: groupBy });
  };

  const setWeekStartDay = (day: TWeekStartDay) => {
    setWeekStartDayState(day);
    updateSettings({ weekStartDay: day });
  };

  const filterEventsBySelectedColors = (color: TEventColor) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const filterEventsBySelectedUser = (userId: IUser["id"] | "all") => {
    setSelectedUserId(userId);
  };

  const clearFilter = () => {
    setSelectedColors([]);
    setSelectedUserId("all");
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
      // Reconcile through the in-memory colorMappings state — refreshEvents
      // keeps it current via saveColorMappings, and re-reading localStorage
      // here would race with that path on subsequent creates.
      const reconciled = transformGoogleEvent(body.event, colorMappings);

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
  const fetchEventsForRange = useCallback(
    async (
      timeMin: Date,
      timeMax: Date,
      calIds: string[],
      mappings: CalendarColorMapping[]
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

      // Transform events using color mappings
      return googleEvents.map((event) => transformGoogleEvent(event, mappings));
    },
    []
  );

  /**
   * Fetch calendar list and return calendar IDs
   */
  const fetchCalendarList = useCallback(async (): Promise<string[]> => {
    try {
      const response = await fetch("/api/calendar/calendars");
      if (!response.ok) {
        logger.log("Failed to fetch calendar list, using primary only");
        return ["primary"];
      }

      const data = await response.json();
      if (data.calendars && data.calendars.length > 0) {
        // Return IDs of all calendars (user can filter later)
        const ids = data.calendars.map(
          (cal: { id: string; selected?: boolean }) => cal.id
        );
        logger.log("Fetched calendar list", { count: ids.length });
        return ids;
      }
    } catch {
      logger.log("Could not fetch calendar list, using primary only");
    }
    return ["primary"];
  }, []);

  // Refresh events from server-side API
  const refreshEvents = useCallback(async () => {
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

      // Fetch calendar list first (if not already fetched)
      let calIds = calendarIds;
      if (calIds.length === 0) {
        calIds = await fetchCalendarList();
        setCalendarIds(calIds);
      }

      // Fetch current color mappings
      let currentMappings = colorMappings;
      if (currentMappings.length === 0) {
        try {
          const colorResponse = await fetch("/api/calendar/colors");
          if (colorResponse.ok) {
            const colorData = await colorResponse.json();
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

      // Fetch events from all calendars
      const transformedEvents = await fetchEventsForRange(
        timeMin,
        timeMax,
        calIds,
        currentMappings
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
          transformGoogleEvent(event, colorMappings)
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
  }, [
    status,
    session,
    calendarIds,
    colorMappings,
    fetchCalendarList,
    fetchEventsForRange,
    userSettings.calendarFetchMonthsAhead,
    userSettings.calendarFetchMonthsBehind,
  ]);

  /**
   * Load additional events when navigating outside loaded range
   */
  const loadEventsForDate = useCallback(
    async (date: Date) => {
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
            colorMappings
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
            colorMappings
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
    },
    [status, loadedRange, calendarIds, colorMappings, fetchEventsForRange]
  );

  // Color mappings are initialized synchronously from localStorage in useState.
  // They are also refreshed from the API as part of refreshEvents.

  // Load cached events on mount, then refresh from API when authenticated
  useEffect(() => {
    const initializeEvents = async () => {
      try {
        // First, load cached events for immediate display
        const cachedEvents = await eventCache.getEvents();
        const transformedEvents = cachedEvents.map((event) =>
          transformGoogleEvent(event, colorMappings)
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

  // Filter events
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

    setFilteredEvents(filtered);
  }, [allEvents, selectedUserId, selectedColors]);

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
    users,
    events: filteredEvents,
    addEvent,
    updateEvent,
    removeEvent,
    createEvent,
    deleteEvent,
    clearFilter,
    refreshEvents,
    isLoading,
    isAuthenticated,
    // Clamp defensively so a rogue DB write of 0 or a negative number never
    // collapses every non-empty day into a bare "+N more" label.
    maxEventsPerDay: Math.max(1, userSettings.calendarMaxEventsPerDay),
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
