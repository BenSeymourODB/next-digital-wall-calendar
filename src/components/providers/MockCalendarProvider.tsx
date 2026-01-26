"use client";

import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

// Re-export useCalendar from CalendarProvider for backward compatibility
export { useCalendar } from "@/components/providers/CalendarProvider";

interface MockCalendarProviderProps {
  children: React.ReactNode;
  /** Mock events to display */
  initialEvents?: IEvent[];
  /** Initial view mode */
  view?: TCalendarView;
  /** Initial badge variant */
  badge?: "dot" | "colored";
  /** Initial date to display */
  initialDate?: Date;
  /** Whether to show loading state */
  isLoading?: boolean;
  /** Use 24-hour time format */
  use24HourFormat?: boolean;
  /** Simulate loading delay in ms */
  loadingDelay?: number;
}

/**
 * MockCalendarProvider - A test-friendly version of CalendarProvider
 *
 * This provider bypasses the Google Calendar API and accepts mock events directly,
 * making it suitable for E2E testing with Playwright.
 *
 * @example
 * ```tsx
 * <MockCalendarProvider initialEvents={mockEvents}>
 *   <SimpleCalendar />
 * </MockCalendarProvider>
 * ```
 */
export function MockCalendarProvider({
  children,
  initialEvents = [],
  view = "month",
  badge = "colored",
  initialDate,
  isLoading: initialLoading = false,
  use24HourFormat: initial24Hour = true,
  loadingDelay = 0,
}: MockCalendarProviderProps) {
  const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
    badge
  );
  const [currentView, setCurrentViewState] = useState<TCalendarView>(view);
  const [use24HourFormat, setUse24HourFormatState] =
    useState<boolean>(initial24Hour);
  const [agendaModeGroupBy, setAgendaModeGroupByState] = useState<
    "date" | "color"
  >("date");

  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">(
    "all"
  );
  const [selectedColors, setSelectedColors] = useState<TEventColor[]>([]);

  const [allEvents, setAllEvents] = useState<IEvent[]>(initialEvents);
  const [isLoading, setIsLoading] = useState(
    initialLoading || loadingDelay > 0
  );

  // Simulate loading delay if specified
  useEffect(() => {
    if (loadingDelay > 0) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, loadingDelay);
      return () => clearTimeout(timer);
    }
  }, [loadingDelay]);

  const setBadgeVariant = (variant: "dot" | "colored") => {
    setBadgeVariantState(variant);
  };

  const setView = (view: TCalendarView) => {
    setCurrentViewState(view);
  };

  const toggleTimeFormat = () => {
    setUse24HourFormatState(!use24HourFormat);
  };

  const setAgendaModeGroupBy = (groupBy: "date" | "color") => {
    setAgendaModeGroupByState(groupBy);
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

  // Mock refresh - just returns current events
  const refreshEvents = async () => {
    if (loadingDelay > 0) {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, loadingDelay));
      setIsLoading(false);
    }
  };

  // Filter events using useMemo to avoid effect-based setState
  const filteredEvents = useMemo(() => {
    let filtered = allEvents;

    if (selectedUserId !== "all") {
      filtered = filtered.filter((event) => event.user.id === selectedUserId);
    }

    if (selectedColors.length > 0) {
      filtered = filtered.filter((event) =>
        selectedColors.includes(event.color)
      );
    }

    return filtered;
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
