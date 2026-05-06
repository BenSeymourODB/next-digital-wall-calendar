import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { createMockEvent } from "@/test/fixtures/calendar-event";
import type {
  IEvent,
  IUser,
  TCalendarView,
  TEventColor,
} from "@/types/calendar";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalogClockView } from "../AnalogClockView";

// next-themes mock — `mockTheme` is mutated per-test to drive the
// emphasis-toggle visibility branch in AnalogClockView. Mock has to be
// declared before the SUT import so it is hoisted by vitest's mock loader.
let mockTheme: string = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({
    theme: mockTheme,
    setTheme: vi.fn(),
    resolvedTheme: mockTheme === "system" ? "light" : mockTheme,
  }),
}));

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "clock" as TCalendarView,
    setView: vi.fn(),
    agendaMode: false,
    setAgendaMode: vi.fn(),
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
    createEvent: vi.fn().mockImplementation((event) => Promise.resolve(event)),
    deleteEvent: vi.fn().mockResolvedValue(undefined),
    clearFilter: vi.fn(),
    refreshEvents: vi.fn(),
    loadEventsForYear: vi.fn(),
    isLoading: false,
    isAuthenticated: true,
    maxEventsPerDay: 3,
    weekStartDay: 0,
    setWeekStartDay: vi.fn(),
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
  // Lock the system clock so the `new Date()` inside the component and the
  // dates synthesised in each test share a single reference instant. Without
  // this, a test running across midnight would compute `today` on one calendar
  // day and the all-day window on the next, breaking the [start, end) check.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));
    mockTheme = "light";
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

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

  describe("event click opens EventDetailModal", () => {
    function makeTimedEvent(): IEvent {
      // Choose a time guaranteed to fall in the current 12-hour AM/PM period
      const start = new Date();
      start.setMinutes(start.getMinutes() + 5);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);

      return createMockEvent({
        id: "timed",
        title: "Project Demo",
        description: "Show the new dashboard",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isAllDay: false,
      });
    }

    function makeAllDayEvent(): IEvent {
      const today = new Date();
      const start = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      );
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return createMockEvent({
        id: "school-holiday",
        title: "School Holiday",
        description: "No school today",
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        isAllDay: true,
      });
    }

    it("opens the modal with event details when an arc is clicked", () => {
      renderView({ events: [makeTimedEvent()] });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("event-arc-group-timed"));

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveTextContent("Project Demo");
      expect(screen.getByTestId("event-detail-description")).toHaveTextContent(
        "Show the new dashboard"
      );
    });

    it("opens the modal when Enter is pressed on a focused arc", () => {
      renderView({ events: [makeTimedEvent()] });
      const arc = screen.getByTestId("event-arc-group-timed");
      fireEvent.keyDown(arc, { key: "Enter" });
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("renders all-day items as buttons (a11y)", () => {
      renderView({ events: [makeAllDayEvent()] });
      const item = screen.getByTestId(
        "analog-clock-all-day-school-holiday-button"
      );
      expect(item.tagName).toBe("BUTTON");
    });

    it("opens the modal when an all-day item is clicked", () => {
      renderView({ events: [makeAllDayEvent()] });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByTestId("analog-clock-all-day-school-holiday-button")
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByRole("dialog")).toHaveTextContent("School Holiday");
    });

    it("closes the modal via the dialog's close button", () => {
      renderView({ events: [makeTimedEvent()] });

      fireEvent.click(screen.getByTestId("event-arc-group-timed"));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: /close/i }));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("Wall-Projector emphasis toggle (#319)", () => {
    const TOGGLE_TESTID = "analog-clock-emphasis-toggle";
    const STORAGE_KEY = "calendar_clock_face_emphasis";

    it("hides the emphasis toggle when theme is light", () => {
      mockTheme = "light";
      renderView();
      expect(screen.queryByTestId(TOGGLE_TESTID)).not.toBeInTheDocument();
    });

    it("hides the emphasis toggle when theme is dark", () => {
      mockTheme = "dark";
      renderView();
      expect(screen.queryByTestId(TOGGLE_TESTID)).not.toBeInTheDocument();
    });

    it("shows the emphasis toggle when theme is wall-projector", () => {
      mockTheme = "wall-projector";
      renderView();
      expect(screen.getByTestId(TOGGLE_TESTID)).toBeInTheDocument();
    });

    it("does not wrap the clock in a light scope by default", () => {
      mockTheme = "wall-projector";
      renderView();
      const wrapper = screen.getByTestId("analog-clock-wrapper");
      expect(wrapper.querySelector('[data-theme-scope="light"]')).toBeNull();
    });

    it("wraps the clock in [data-theme-scope=light] when toggled on", () => {
      mockTheme = "wall-projector";
      renderView();

      fireEvent.click(screen.getByTestId(TOGGLE_TESTID));

      const wrapper = screen.getByTestId("analog-clock-wrapper");
      expect(
        wrapper.querySelector('[data-theme-scope="light"]')
      ).not.toBeNull();
    });

    it("removes the light scope wrap when toggled off again", () => {
      mockTheme = "wall-projector";
      renderView();

      fireEvent.click(screen.getByTestId(TOGGLE_TESTID));
      fireEvent.click(screen.getByTestId(TOGGLE_TESTID));

      const wrapper = screen.getByTestId("analog-clock-wrapper");
      expect(wrapper.querySelector('[data-theme-scope="light"]')).toBeNull();
    });

    it("persists the toggle state to localStorage", () => {
      mockTheme = "wall-projector";
      renderView();

      fireEvent.click(screen.getByTestId(TOGGLE_TESTID));

      expect(window.localStorage.getItem(STORAGE_KEY)).toBe("true");
    });

    it("restores the toggle state from localStorage on remount", () => {
      window.localStorage.setItem("calendar_clock_face_emphasis", "true");
      mockTheme = "wall-projector";
      renderView();

      const wrapper = screen.getByTestId("analog-clock-wrapper");
      expect(
        wrapper.querySelector('[data-theme-scope="light"]')
      ).not.toBeNull();
    });

    it("uses the toggle to flip the SVG into a light scope only — the surrounding view stays dark", () => {
      mockTheme = "wall-projector";
      renderView();
      fireEvent.click(screen.getByTestId(TOGGLE_TESTID));

      // The aside containing all-day events is a sibling of the clock wrapper,
      // outside the ThemeScope, so the dark page chrome is preserved.
      const aside = screen.getByTestId("analog-clock-all-day-aside");
      expect(aside.closest('[data-theme-scope="light"]')).toBeNull();
    });
  });
});
