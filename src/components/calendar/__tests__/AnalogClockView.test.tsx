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
import { AnalogClockView } from "../AnalogClockView";

function createMockEvent(overrides: Partial<IEvent> = {}): IEvent {
  return {
    id: "evt",
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

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "clock" as TCalendarView,
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
    events: [] as IEvent[],
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

function renderView(overrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(overrides);
  return render(
    <CalendarContext.Provider value={contextValue}>
      <AnalogClockView />
    </CalendarContext.Provider>
  );
}

describe("AnalogClockView", () => {
  it("renders the analog clock SVG", () => {
    renderView();
    expect(screen.getByTestId("analog-clock-view")).toBeInTheDocument();
    expect(screen.getByTestId("analog-clock")).toBeInTheDocument();
  });

  it("passes events from CalendarProvider through to the clock as raw events", () => {
    // Use a fixed reference time the clock will pick up; we control the
    // current 12-hour period bounds by patching Date via a fixed event.
    const now = new Date();
    const inPeriod = new Date(now);
    // Choose a time guaranteed to fall in the current 12-hour AM/PM period
    inPeriod.setMinutes(inPeriod.getMinutes() + 5);
    const inPeriodEnd = new Date(inPeriod);
    inPeriodEnd.setMinutes(inPeriodEnd.getMinutes() + 30);

    renderView({
      events: [
        createMockEvent({
          id: "timed",
          title: "🟢 Meeting",
          startDate: inPeriod.toISOString(),
          endDate: inPeriodEnd.toISOString(),
          isAllDay: false,
        }),
      ],
    });

    expect(screen.getByTestId("event-arc-timed")).toBeInTheDocument();
  });

  it("lists today's all-day events separately from the clock arcs", () => {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    renderView({
      selectedDate: today,
      events: [
        createMockEvent({
          id: "all-day-1",
          title: "School Holiday",
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          isAllDay: true,
        }),
      ],
    });

    const allDayList = screen.getByTestId("analog-clock-all-day-list");
    expect(allDayList).toBeInTheDocument();
    expect(allDayList).toHaveTextContent("School Holiday");
  });

  it("renders an empty-state message when there are no all-day events for today", () => {
    renderView({ events: [] });
    expect(
      screen.getByTestId("analog-clock-all-day-empty")
    ).toBeInTheDocument();
  });

  it("does not include all-day events as event arcs", () => {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate()
    );
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    renderView({
      events: [
        createMockEvent({
          id: "all-day-only",
          title: "Holiday",
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          isAllDay: true,
        }),
      ],
    });

    expect(
      screen.queryByTestId("event-arc-all-day-only")
    ).not.toBeInTheDocument();
  });
});
