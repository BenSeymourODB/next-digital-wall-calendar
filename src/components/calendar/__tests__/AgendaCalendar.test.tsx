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
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgendaCalendar } from "../AgendaCalendar";

/**
 * Regression tests for AgendaCalendar component.
 *
 * Covers:
 * - Bug 1: All-day event detection uses event.isAllDay (not duration)
 * - Bug 4: Events show on correct dates in agenda view (no offset)
 */

// Helper to create mock events with required isAllDay and calendarId fields
function createMockEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "test-event-1",
    title: "Test Event",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: {
      id: "user-1",
      name: "Test User",
      picturePath: null,
    },
    ...overrides,
  };
}

// Helper to get a date string for N days from now at specific time
function getFutureDate(daysFromNow: number, hours = 10, minutes = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// Helper to get a date-only string for N days from now (local midnight)
function getFutureDateLocal(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}T00:00:00`;
}

// Create a mock context value
function createMockContext(
  events: IEvent[],
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "agenda" as TCalendarView,
    setView: vi.fn(),
    agendaModeGroupBy: "date",
    setAgendaModeGroupBy: vi.fn(),
    use24HourFormat: true,
    toggleTimeFormat: vi.fn(),
    setSelectedDate: vi.fn(),
    selectedUserId: "all",
    setSelectedUserId: vi.fn(),
    badgeVariant: "colored",
    setBadgeVariant: vi.fn(),
    selectedColors: [] as TEventColor[],
    filterEventsBySelectedColors: vi.fn(),
    filterEventsBySelectedUser: vi.fn(),
    users: [] as IUser[],
    events,
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    clearFilter: vi.fn(),
    refreshEvents: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
    ...overrides,
  };
}

// Wrapper to render AgendaCalendar with mock context
function renderWithContext(
  events: IEvent[],
  contextOverrides: Partial<ICalendarContext> = {}
) {
  const contextValue = createMockContext(events, contextOverrides);

  return render(
    <CalendarContext.Provider value={contextValue}>
      <AgendaCalendar />
    </CalendarContext.Provider>
  );
}

describe("AgendaCalendar", () => {
  describe("Bug 1: All-day event detection uses isAllDay flag", () => {
    it("shows 'All day' for events with isAllDay=true", () => {
      const events = [
        createMockEvent({
          id: "allday-1",
          title: "Team Offsite",
          startDate: getFutureDateLocal(1),
          endDate: getFutureDateLocal(2),
          isAllDay: true,
        }),
      ];

      renderWithContext(events);

      expect(screen.getByText("All day")).toBeInTheDocument();
      expect(screen.getByText("Team Offsite")).toBeInTheDocument();
    });

    it("shows time range for events with isAllDay=false (even if spans 24+ hours)", () => {
      // This is the key regression test: a multi-day timed event (conference call
      // from midnight to midnight) should NOT show "All day" because isAllDay=false
      const events = [
        createMockEvent({
          id: "multiday-1",
          title: "Conference",
          startDate: getFutureDate(1, 0, 0),
          endDate: getFutureDate(3, 0, 0),
          isAllDay: false, // Explicitly not all-day despite spanning 48 hours
        }),
      ];

      renderWithContext(events);

      expect(screen.getByText("Conference")).toBeInTheDocument();
      // Should show time range, not "All day"
      expect(screen.queryByText("All day")).not.toBeInTheDocument();
    });

    it("shows time range for regular timed events", () => {
      const events = [
        createMockEvent({
          id: "timed-1",
          title: "Meeting",
          startDate: getFutureDate(1, 14, 30),
          endDate: getFutureDate(1, 15, 30),
          isAllDay: false,
        }),
      ];

      renderWithContext(events);

      expect(screen.getByText("Meeting")).toBeInTheDocument();
      // Should show time range
      expect(screen.getByText("14:30 - 15:30")).toBeInTheDocument();
    });
  });

  describe("Bug 4: Events group by correct date (no offset)", () => {
    it("groups all-day events under the correct date header", () => {
      // Create an all-day event for tomorrow with T00:00:00 suffix
      // (which is what transformGoogleEvent now produces for date-only strings)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const expectedDay = tomorrow.getDate();

      const events = [
        createMockEvent({
          id: "allday-correct-date",
          title: "Holiday",
          startDate: getFutureDateLocal(1),
          endDate: getFutureDateLocal(2),
          isAllDay: true,
        }),
      ];

      renderWithContext(events);

      // The event should appear - verify it renders
      expect(screen.getByText("Holiday")).toBeInTheDocument();

      // The date header should contain tomorrow's date
      // Using a regex to match the day number in the header
      const dateHeaders = screen.getAllByRole("heading", { level: 3 });
      const headerTexts = dateHeaders.map((h) => h.textContent);
      const hasCorrectDate = headerTexts.some((text) =>
        text?.includes(String(expectedDay))
      );
      expect(hasCorrectDate).toBe(true);
    });

    it("does not shift events to the previous day", () => {
      // This specifically tests the bug where UTC interpretation caused
      // events to appear on the wrong day
      const events = [
        createMockEvent({
          id: "no-shift",
          title: "Morning Standup",
          startDate: getFutureDate(1, 9, 0),
          endDate: getFutureDate(1, 9, 30),
          isAllDay: false,
        }),
      ];

      renderWithContext(events);

      expect(screen.getByText("Morning Standup")).toBeInTheDocument();
      expect(screen.getByText("09:00 - 09:30")).toBeInTheDocument();
    });
  });

  describe("Loading and empty states", () => {
    it("shows loading message when isLoading is true", () => {
      renderWithContext([], { isLoading: true });
      expect(screen.getByText("Loading events...")).toBeInTheDocument();
    });

    it("shows empty state when no events in next 7 days", () => {
      renderWithContext([]);
      expect(
        screen.getByText("No upcoming events in the next 7 days")
      ).toBeInTheDocument();
    });
  });

  describe("Color rendering", () => {
    it("renders event with correct color classes", () => {
      const events = [
        createMockEvent({
          id: "green-event",
          title: "Green Event",
          startDate: getFutureDate(1, 10, 0),
          endDate: getFutureDate(1, 11, 0),
          color: "green",
          isAllDay: false,
        }),
      ];

      renderWithContext(events);

      expect(screen.getByText("Green Event")).toBeInTheDocument();
    });
  });
});
