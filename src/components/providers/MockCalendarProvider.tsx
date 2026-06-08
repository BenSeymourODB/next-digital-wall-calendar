"use client";

import {
  CalendarContext,
  type CreateEventInput,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { computeHiddenEventCounts } from "@/lib/calendar-filter-counts";
import { TRANSITION_SPEED_TO_MS } from "@/lib/calendar/transition-speed";
import type {
  ICalendarInfo,
  IEvent,
  IUser,
  TAgendaGroupBy,
  TCalendarAccessRole,
  TCalendarView,
  TEventColor,
  TWeekStartDay,
} from "@/types/calendar";
import type React from "react";
import { useEffect, useState } from "react";

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
  /** Which day the visible calendar week starts on (0 = Sunday, 1 = Monday) */
  weekStartDay?: TWeekStartDay;
  /** Initial agenda-mode group-by */
  agendaModeGroupBy?: TAgendaGroupBy;
  /** Initial agenda-mode toggle (only meaningful for day/week views). */
  agendaMode?: boolean;
  /** Simulate loading delay in ms */
  loadingDelay?: number;
  /** Whether user is authenticated (for testing) */
  isAuthenticated?: boolean;
  /** Max events rendered per day cell before the "+N more" overflow */
  maxEventsPerDay?: number;
  /**
   * Mock calendar list, used by the per-calendar filter (issue #208).
   * Defaults to a single `primary` entry so existing tests don't need
   * to wire it up.
   */
  calendars?: ICalendarInfo[];
  /** Initial per-calendar filter selection. Empty = no calendar filter. */
  initialSelectedCalendarIds?: string[];
  /**
   * Optional per-calendar access roles, used by the read-only delete-button
   * gating (#266). Keys are calendar IDs (matching `IEvent.calendarId`),
   * values are Google `accessRole` literals. Calendars not in this map
   * resolve to `undefined`, which the modal treats as "writable" by default.
   */
  accessRolesByCalendarId?: Record<string, TCalendarAccessRole>;
  /** Hour (0–23) the Day/Week grids auto-scroll to on first render. */
  workingHoursStart?: number;
  /** View-transition duration in ms; mirrors `userSettings.calendarTransitionSpeed`. */
  transitionDurationMs?: number;
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
  weekStartDay: initialWeekStartDay = 0,
  agendaModeGroupBy: initialAgendaGroupBy = "date",
  agendaMode: initialAgendaMode = false,
  loadingDelay = 0,
  isAuthenticated = true,
  maxEventsPerDay = 3,
  calendars: initialCalendars = [
    { id: "primary", summary: "Primary", backgroundColor: "" },
  ],
  initialSelectedCalendarIds = [],
  accessRolesByCalendarId = {},
  workingHoursStart = 7,
  transitionDurationMs = TRANSITION_SPEED_TO_MS.normal,
}: MockCalendarProviderProps) {
  const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
    badge
  );
  const [currentView, setCurrentViewState] = useState<TCalendarView>(view);
  const [use24HourFormat, setUse24HourFormatState] =
    useState<boolean>(initial24Hour);
  const [agendaModeGroupBy, setAgendaModeGroupByState] =
    useState<TAgendaGroupBy>(initialAgendaGroupBy);
  const [agendaMode, setAgendaModeState] = useState<boolean>(initialAgendaMode);
  const [weekStartDay, setWeekStartDayState] =
    useState<TWeekStartDay>(initialWeekStartDay);

  const [selectedDate, setSelectedDate] = useState(initialDate || new Date());
  const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">(
    "all"
  );
  const [selectedColors, setSelectedColors] = useState<TEventColor[]>([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>(
    initialSelectedCalendarIds
  );
  const [calendars] = useState<ICalendarInfo[]>(initialCalendars);

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

  const setAgendaModeGroupBy = (groupBy: TAgendaGroupBy) => {
    setAgendaModeGroupByState(groupBy);
  };

  const setAgendaMode = (enabled: boolean) => {
    setAgendaModeState(enabled);
  };

  const setWeekStartDay = (day: TWeekStartDay) => {
    setWeekStartDayState(day);
  };

  const filterEventsBySelectedColors = (color: TEventColor) => {
    setSelectedColors((prev) =>
      prev.includes(color) ? prev.filter((c) => c !== color) : [...prev, color]
    );
  };

  const filterEventsBySelectedUser = (userId: IUser["id"] | "all") => {
    setSelectedUserId(userId);
  };

  const filterEventsBySelectedCalendars = (calendarId: string) => {
    setSelectedCalendarIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const clearFilter = () => {
    setSelectedColors([]);
    setSelectedUserId("all");
    setSelectedCalendarIds([]);
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

  // Mock createEvent: hermetic local insert that resolves with the
  // optimistic event so AddEventButton's happy path works in E2E without
  // mocking fetch. Tests that need failure behaviour should override this
  // in their own provider wrapper.
  const createEvent = async (
    optimistic: IEvent,
    _input: CreateEventInput
  ): Promise<IEvent> => {
    setAllEvents((prev) => [...prev, optimistic]);
    return optimistic;
  };

  // Mock deleteEvent matches the real provider's optimistic-remove signature
  // but skips the network call so tests can drive UI flows without mocking
  // fetch. Tests that care about failure behavior should override this in
  // their own provider wrapper.
  const deleteEvent = async (eventId: string, _calendarId: string) => {
    setAllEvents((prev) => prev.filter((e) => e.id !== eventId));
  };

  // Mock editEvent (#265): hermetic local merge so UI flows resolve without
  // mocking fetch. Tests that need failure behaviour should override this
  // in their own provider wrapper.
  const editEvent = async (
    eventId: string,
    _calendarId: string,
    input: CreateEventInput
  ): Promise<IEvent> => {
    let updated: IEvent | undefined;
    setAllEvents((prev) =>
      prev.map((e) => {
        if (e.id !== eventId) return e;
        updated = {
          ...e,
          title: input.title,
          description: input.description,
          color: input.color,
          isAllDay: input.isAllDay,
          startDate: input.startDate,
          endDate: input.endDate,
        };
        return updated;
      })
    );
    if (!updated) {
      throw new Error(`Event ${eventId} not found in mock list`);
    }
    return updated;
  };

  // Mock refresh - just returns current events
  const refreshEvents = async () => {
    if (loadingDelay > 0) {
      setIsLoading(true);
      await new Promise((resolve) => setTimeout(resolve, loadingDelay));
      setIsLoading(false);
    }
  };

  // No-op: the mock provider holds a static fixture, so widening the
  // year window doesn't need to fetch anything.
  const loadEventsForYear = async () => {};

  const getAccessRole = (calendarId: string) =>
    accessRolesByCalendarId[calendarId];

  // Plain render-time derivation of filtered events + hidden counts. Manual
  // memoization is banned (CLAUDE.md / React Compiler), but a state+effect
  // bounce here is also overkill — the React Compiler will memoize the
  // derivation automatically when the inputs are stable.
  let filtered = allEvents;
  if (selectedUserId !== "all") {
    filtered = filtered.filter((event) => event.user.id === selectedUserId);
  }
  if (selectedColors.length > 0) {
    filtered = filtered.filter((event) => selectedColors.includes(event.color));
  }
  if (selectedCalendarIds.length > 0) {
    filtered = filtered.filter((event) =>
      selectedCalendarIds.includes(event.calendarId)
    );
  }
  const filteredEvents = filtered;
  const hiddenEventCounts = computeHiddenEventCounts(allEvents, {
    selectedColors,
    selectedUserId,
    selectedCalendarIds,
  });

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
    editEvent,
    deleteEvent,
    clearFilter,
    refreshEvents,
    loadEventsForYear,
    getAccessRole,
    isLoading,
    isAuthenticated,
    maxEventsPerDay,
    workingHoursStart,
    transitionDurationMs,
  };

  return (
    <CalendarContext.Provider value={value}>
      {children}
    </CalendarContext.Provider>
  );
}
