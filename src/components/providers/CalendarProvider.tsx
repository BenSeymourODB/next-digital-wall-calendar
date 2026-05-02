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

export interface ICalendarContext {
  selectedDate: Date;
  view: TCalendarView;
  setView: (view: TCalendarView) => void;
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
  clearFilter: () => void;
  refreshEvents: () => Promise<void>;
  /**
   * Ensure events for the entire requested calendar year (Jan 1 – Dec 31)
   * are loaded into the provider's `loadedRange`. Used by the year view to
   * widen the default lazy-load window beyond -1 / +6 months.
   */
  loadEventsForYear: (year: number) => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  maxEventsPerDay: number;
}

interface CalendarSettings {
  badgeVariant: "dot" | "colored";
  view: TCalendarView;
  use24HourFormat: boolean;
  agendaModeGroupBy: "date" | "color";
  weekStartDay: TWeekStartDay;
}

const DEFAULT_SETTINGS: CalendarSettings = {
  badgeVariant: "colored",
  view: "month",
  use24HourFormat: true,
  agendaModeGroupBy: "date",
  weekStartDay: 0,
};

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

  const [settings, setSettings] = useLocalStorage<CalendarSettings>(
    "calendar-settings",
    {
      ...DEFAULT_SETTINGS,
      badgeVariant: badge,
      view: view,
    }
  );

  const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
    settings.badgeVariant ?? DEFAULT_SETTINGS.badgeVariant
  );
  const [currentView, setCurrentViewState] = useState<TCalendarView>(
    settings.view ?? DEFAULT_SETTINGS.view
  );
  const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
    settings.use24HourFormat ?? DEFAULT_SETTINGS.use24HourFormat
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
  const loadEventsForYear = useCallback(
    async (year: number) => {
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
        let newStart = loadedRange.start;
        let newEnd = loadedRange.end;
        const calIds = calendarIds.length > 0 ? calendarIds : ["primary"];

        if (isBefore(yearStart, loadedRange.start)) {
          const newEvents = await fetchEventsForRange(
            yearStart,
            loadedRange.start,
            calIds,
            colorMappings
          );

          setAllEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const uniqueNewEvents = newEvents.filter(
              (e) => !existingIds.has(e.id)
            );
            return [...uniqueNewEvents, ...prev];
          });

          newStart = yearStart;
        }

        if (isAfter(yearEnd, loadedRange.end)) {
          const newEvents = await fetchEventsForRange(
            loadedRange.end,
            yearEnd,
            calIds,
            colorMappings
          );

          setAllEvents((prev) => {
            const existingIds = new Set(prev.map((e) => e.id));
            const uniqueNewEvents = newEvents.filter(
              (e) => !existingIds.has(e.id)
            );
            return [...prev, ...uniqueNewEvents];
          });

          newEnd = yearEnd;
        }

        setLoadedRange({ start: newStart, end: newEnd });
      } catch (error) {
        logger.error(error as Error, { context: "loadEventsForYear" });
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
    clearFilter,
    refreshEvents,
    loadEventsForYear,
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
