"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";
import { eventCache, loadAccounts, loadSettings } from "@/lib/calendar-storage";
import {
  type GoogleCalendarEvent,
  fetchEventsFromMultipleCalendars,
} from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import type React from "react";
import { createContext, useContext, useEffect, useState } from "react";

interface ICalendarContext {
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
  removeEvent: (eventId: number) => void;
  clearFilter: () => void;
  refreshEvents: () => Promise<void>;
  isLoading: boolean;
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

const CalendarContext = createContext({} as ICalendarContext);

export function useCalendar() {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error("useCalendar must be used within CalendarProvider");
  }
  return context;
}

/**
 * Transform Google Calendar event to our IEvent format
 */
function transformGoogleEvent(
  googleEvent: GoogleCalendarEvent,
  eventId: number
): IEvent {
  // Map Google Calendar color IDs to our color system
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

  const startDate =
    googleEvent.start.dateTime ||
    googleEvent.start.date ||
    new Date().toISOString();
  const endDate =
    googleEvent.end.dateTime ||
    googleEvent.end.date ||
    new Date().toISOString();

  return {
    id: eventId,
    startDate,
    endDate,
    title: googleEvent.summary || "Untitled Event",
    description: googleEvent.description || "",
    color: colorMap[googleEvent.colorId || "1"] || "blue",
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

  const removeEvent = (eventId: number) => {
    setAllEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  // Refresh events from Google Calendar
  const refreshEvents = async () => {
    try {
      setIsLoading(true);
      const accounts = loadAccounts();

      if (accounts.length === 0) {
        logger.log("No calendar accounts configured");
        setAllEvents([]);
        setIsLoading(false);
        return;
      }

      // Fetch events for the next 6 months
      const timeMin = new Date();
      const timeMax = new Date();
      timeMax.setMonth(timeMax.getMonth() + 6);

      const allCalendarIds = accounts.flatMap((account) => account.calendarIds);
      const googleEvents = await fetchEventsFromMultipleCalendars(
        allCalendarIds,
        timeMin,
        timeMax
      );

      // Transform events
      const transformedEvents = googleEvents.map((event, index) =>
        transformGoogleEvent(event, index + 1)
      );

      setAllEvents(transformedEvents);

      // Cache events
      await eventCache.saveEvents(googleEvents);

      logger.log("Refreshed calendar events", {
        count: transformedEvents.length,
      });
    } catch (error) {
      logger.error(error as Error, { context: "refreshEvents" });

      // Try to load from cache
      try {
        const cachedEvents = await eventCache.getEvents();
        const transformedEvents = cachedEvents.map((event, index) =>
          transformGoogleEvent(event, index + 1)
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

  // Load cached events on mount
  useEffect(() => {
    const loadCachedEvents = async () => {
      try {
        const cachedEvents = await eventCache.getEvents();
        const transformedEvents = cachedEvents.map((event, index) =>
          transformGoogleEvent(event, index + 1)
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
    };

    loadCachedEvents();
  }, []);

  // Auto-refresh events based on settings
  useEffect(() => {
    const settings = loadSettings();
    const intervalMs = settings.refreshInterval * 60 * 1000;

    const interval = setInterval(() => {
      refreshEvents();
    }, intervalMs);

    return () => clearInterval(interval);
  }, []);

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
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
