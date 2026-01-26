"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  type CalendarColorMapping,
  eventCache,
  loadColorMappings,
  loadSettings,
  saveColorMappings,
} from "@/lib/calendar-storage";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { startOfMonth } from "date-fns";

export interface ICalendarContext {
  selectedDate: Date;
  view: TCalendarView;
  setView: (view: TCalendarView) => void;
  agendaModeGroupBy: "date" | "color";
  setAgendaModeGroupBy: (groupBy: "date" | "color") => void;
  use24HourFormat: boolean;
  toggleTimeFormat: () => void;
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
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface CalendarSettings {
  badgeVariant: "dot" | "colored";
  view: TCalendarView;
  use24HourFormat: boolean;
  agendaModeGroupBy: "date" | "color";
}

const DEFAULT_SETTINGS: CalendarSettings = {
  badgeVariant: "colored",
  view: "month",
  use24HourFormat: true,
  agendaModeGroupBy: "date",
};

export const CalendarContext = createContext({} as ICalendarContext);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
}

/**
 * Transform Google Calendar event to our IEvent format
 * Uses color mappings from Google Calendar API when available
 */
function transformGoogleEvent(
  googleEvent: GoogleCalendarEvent,
  colorMappings: CalendarColorMapping[]
): IEvent {
  const startDate =
    googleEvent.start.dateTime ||
    googleEvent.start.date ||
    new Date().toISOString();
  const endDate =
    googleEvent.end.dateTime ||
    googleEvent.end.date ||
    new Date().toISOString();

  // Priority 1: Look up by calendarId in color mappings (from Google Calendar API)
  const calendarMapping = colorMappings.find(
    (m) => m.calendarId === googleEvent.calendarId
  );
  if (calendarMapping) {
    return {
      id: googleEvent.id,
      startDate,
      endDate,
      title: googleEvent.summary || "Untitled Event",
      description: googleEvent.description || "",
      color: calendarMapping.tailwindColor,
      user: {
        id: googleEvent.creator?.email || "unknown",
        name: googleEvent.creator?.displayName || "Unknown",
        picturePath: null,
      },
    };
  }

  // Priority 2: Fall back to existing colorId mapping (legacy)
  const colorMap: Record<string, TEventColor> = {
    "1": "blue",
    "2": "green",
    "3": "purple",
    "4": "red",
    "5": "yellow",
    "6": "orange",
    "7": "blue",
    "8": "blue",
    "9": "blue",
    "10": "green",
    "11": "red",
  };

  if (googleEvent.colorId && colorMap[googleEvent.colorId]) {
    return {
      id: googleEvent.id,
      startDate,
      endDate,
      title: googleEvent.summary || "Untitled Event",
      description: googleEvent.description || "",
      color: colorMap[googleEvent.colorId],
      user: {
        id: googleEvent.creator?.email || "unknown",
        name: googleEvent.creator?.displayName || "Unknown",
        picturePath: null,
      },
    };
  }

  // Priority 3: Default to blue
  return {
    id: googleEvent.id,
    startDate,
    endDate,
    title: googleEvent.summary || "Untitled Event",
    description: googleEvent.description || "",
    color: "blue",
    user: {
      id: googleEvent.creator?.email || "unknown",
      name: googleEvent.creator?.displayName || "Unknown",
      picturePath: null,
    },
  };
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

  const [settings, setSettings] = useLocalStorage<CalendarSettings>(
    "calendar-settings",
    {
      ...DEFAULT_SETTINGS,
      badgeVariant: badge,
      view: view,
    }
  );

  const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
    settings.badgeVariant
  );
  const [currentView, setCurrentViewState] = useState<TCalendarView>(
    settings.view
  );
  const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
    settings.use24HourFormat
  );
  const [agendaModeGroupBy, setAgendaModeGroupByState] = useState<
    "date" | "color"
  >(settings.agendaModeGroupBy);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">(
    "all"
  );
  const [selectedColors, setSelectedColors] = useState<TEventColor[]>([]);

  const [allEvents, setAllEvents] = useState<IEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<IEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [colorMappings, setColorMappings] = useState<CalendarColorMapping[]>(
    []
  );

  const updateSettings = (newPartialSettings: Partial<CalendarSettings>) => {
    setSettings({
      ...settings,
      ...newPartialSettings,
    });
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

  // Refresh events from server-side API
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

      // Calculate time range for events
      const timeMin = startOfMonth(new Date()); // Start of current month
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);

      // Fetch events from server-side API
      const url = new URL("/api/calendar/events", window.location.origin);
      url.searchParams.set("calendarId", "primary");
      url.searchParams.set("timeMin", timeMin.toISOString());
      url.searchParams.set("timeMax", timeMax.toISOString());

      const response = await fetch(url.toString());

      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.requiresReauth) {
          logger.log("API requires re-authentication");
          // Session will be updated by NextAuth, which will trigger a re-render
        }
        throw new Error(errorData.error || "Failed to fetch events");
      }

      const data = await response.json();
      const googleEvents: GoogleCalendarEvent[] = (data.events || []).map(
        (event: GoogleCalendarEvent) => ({
          ...event,
          calendarId: "primary",
        })
      );

      // Transform events using color mappings
      const transformedEvents = googleEvents.map((event) =>
        transformGoogleEvent(event, colorMappings)
      );

      setAllEvents(transformedEvents);

      // Cache events in IndexedDB for offline/fast access
      await eventCache.saveEvents(googleEvents);

      logger.log("Refreshed calendar events from API", {
        count: transformedEvents.length,
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
  };

  // Load color mappings from localStorage on mount
  useEffect(() => {
    const mappings = loadColorMappings();
    setColorMappings(mappings);
    logger.log("Loaded color mappings on mount", { count: mappings.length });
  }, []);

  // Fetch calendar color mappings from API when authenticated
  useEffect(() => {
    const fetchColorMappings = async () => {
      if (status !== "authenticated") return;

      try {
        const response = await fetch("/api/calendar/colors");
        if (response.ok) {
          const data = await response.json();
          if (data.colorMappings && data.colorMappings.length > 0) {
            saveColorMappings(data.colorMappings);
            setColorMappings(data.colorMappings);
            logger.log("Fetched and cached calendar color mappings from API", {
              count: data.colorMappings.length,
            });
          }
        }
      } catch {
        // Silently fail - we'll use cached mappings or defaults
        logger.log("Could not fetch color mappings from API, using cached");
      }
    };

    fetchColorMappings();
  }, [status]);

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

  // Auto-refresh events based on settings
  useEffect(() => {
    // Only set up refresh interval if authenticated
    if (status !== "authenticated") {
      return;
    }

    const settings = loadSettings();
    const intervalMs = settings.refreshInterval * 60 * 1000;

    const interval = setInterval(() => {
      refreshEvents();
    }, intervalMs);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
    isLoading,
    isAuthenticated,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
