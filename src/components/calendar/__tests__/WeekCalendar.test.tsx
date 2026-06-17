import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { WEEK_STARTS_ON, getShortWeekdayLabels } from "@/lib/calendar-helpers";
import { __resetUseDateNowForTests } from "@/lib/hooks/use-date-now";
import { makeCalendarContext } from "@/test/fixtures/calendar-context";
import { createMockEvent } from "@/test/fixtures/calendar-event";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  addDays,
  endOfWeek,
  format,
  isSameWeek,
  startOfWeek,
  subWeeks,
} from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WeekCalendar } from "../WeekCalendar";

/**
 * Tests for WeekCalendar component.
 *
 * Covers:
 * - Header: week range and event count
 * - Today button (enabled outside current week)
 * - Prev/next navigation
 * - 7-day grid with weekday headers and day numbers
 * - Event rendering per day, including all-day and "+X more" overflow
 * - Loading state
 */

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return makeCalendarContext({
    view: "week",
    ...overrides,
  });
}

function renderWithContext(overrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(overrides);
  return {
    ...render(
      <CalendarContext.Provider value={contextValue}>
        <WeekCalendar />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

/**
 * Date at midday inside the currently-selected date's week.
 * Using midday avoids DST/timezone edge cases for the Monday/Sunday boundaries.
 */
function midday(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  return d;
}

describe("WeekCalendar", () => {
  describe("Header", () => {
    it("renders a week range spanning the selected week", () => {
      const selectedDate = new Date(2026, 3, 15); // Wed Apr 15 2026
      renderWithContext({ selectedDate });

      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const weekEnd = endOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      const expected = `${format(weekStart, "MMM d, yyyy")} – ${format(weekEnd, "MMM d, yyyy")}`;
      expect(screen.getByTestId("week-calendar-range")).toHaveTextContent(
        expected
      );
    });

    it("shows event count across the week", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      const events = [
        createMockEvent({
          id: "e1",
          startDate: midday(addDays(weekStart, 0)).toISOString(),
          endDate: midday(addDays(weekStart, 0)).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          startDate: midday(addDays(weekStart, 3)).toISOString(),
          endDate: midday(addDays(weekStart, 3)).toISOString(),
        }),
        createMockEvent({
          id: "outside",
          // Event well outside the week should not count
          startDate: midday(subWeeks(weekStart, 4)).toISOString(),
          endDate: midday(subWeeks(weekStart, 4)).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate, events });

      expect(screen.getByTestId("week-calendar-event-count")).toHaveTextContent(
        "2 events"
      );
    });

    it("uses singular 'event' label for a single event", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "solo",
            startDate: midday(addDays(weekStart, 2)).toISOString(),
            endDate: midday(addDays(weekStart, 2)).toISOString(),
          }),
        ],
      });

      expect(screen.getByTestId("week-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });
  });

  describe("Today button", () => {
    it("is disabled when viewing the current week", () => {
      renderWithContext({ selectedDate: new Date() });
      expect(screen.getByTestId("week-calendar-today-btn")).toBeDisabled();
    });

    it("is enabled and calls setSelectedDate when viewing a different week", async () => {
      const pastDate = subWeeks(new Date(), 3);
      const { contextValue } = renderWithContext({ selectedDate: pastDate });

      const btn = screen.getByTestId("week-calendar-today-btn");
      expect(btn).toBeEnabled();

      await userEvent.setup().click(btn);

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(
        isSameWeek(called, new Date(), { weekStartsOn: WEEK_STARTS_ON })
      ).toBe(true);
    });
  });

  describe("current-week predicate respects weekStartDay", () => {
    // Regression: #352. WeekCalendar.isCurrentWeek must use the user's
    // weekStartDay so the Today button toggles enabled/disabled on the
    // Sun→Mon (or Sat→Sun) boundary, not on a hard-coded WEEK_STARTS_ON.
    //
    // `useTodayStartOfDay` caches the day at module load, so each test
    // resets the cache after `vi.setSystemTime` to pull the fake clock —
    // same pattern as `midnight-rollover.test.tsx`.
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      __resetUseDateNowForTests();
      vi.useRealTimers();
    });

    it("disables Today when today and selectedDate share a Monday-first week but not a Sunday-first one", () => {
      // Today = Sun Apr 19 2026, selectedDate = Fri Apr 17 2026.
      // - Sunday-first: today ∈ [Sun Apr 19 – Sat Apr 25]; selectedDate ∈ [Sun Apr 12 – Sat Apr 18] → different weeks.
      // - Monday-first: today ∈ [Mon Apr 13 – Sun Apr 19]; selectedDate ∈ same week → same week.
      vi.setSystemTime(new Date(2026, 3, 19, 12, 0, 0));
      __resetUseDateNowForTests();
      const selectedDate = new Date(2026, 3, 17, 12, 0, 0);

      renderWithContext({ selectedDate, weekStartDay: 1 });

      expect(screen.getByTestId("week-calendar-today-btn")).toBeDisabled();
    });

    it("enables Today when today and selectedDate share a Sunday-first week but fall in different Monday-first weeks", () => {
      // Today = Sat Apr 18 2026, selectedDate = Sun Apr 12 2026.
      // - Sunday-first: today ∈ [Sun Apr 12 – Sat Apr 18]; selectedDate ∈ same week → same week.
      // - Monday-first: today ∈ [Mon Apr 13 – Sun Apr 19]; selectedDate ∈ [Mon Apr 6 – Sun Apr 12] → different weeks.
      vi.setSystemTime(new Date(2026, 3, 18, 12, 0, 0));
      __resetUseDateNowForTests();
      const selectedDate = new Date(2026, 3, 12, 12, 0, 0);

      renderWithContext({ selectedDate, weekStartDay: 1 });

      expect(screen.getByTestId("week-calendar-today-btn")).toBeEnabled();
    });
  });

  describe("Navigation", () => {
    it("navigates to previous week", async () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const { contextValue } = renderWithContext({ selectedDate });

      await userEvent.setup().click(screen.getByTestId("week-calendar-prev"));

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(
        isSameWeek(called, subWeeks(selectedDate, 1), {
          weekStartsOn: WEEK_STARTS_ON,
        })
      ).toBe(true);
    });

    it("navigates to next week", async () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const { contextValue } = renderWithContext({ selectedDate });

      await userEvent.setup().click(screen.getByTestId("week-calendar-next"));

      const called = (contextValue.setSelectedDate as ReturnType<typeof vi.fn>)
        .mock.calls[0][0] as Date;
      expect(
        isSameWeek(called, addDays(selectedDate, 7), {
          weekStartsOn: WEEK_STARTS_ON,
        })
      ).toBe(true);
    });
  });

  describe("Weekday grid", () => {
    it("renders 7 day columns with weekday labels in WEEK_STARTS_ON order", () => {
      renderWithContext();
      for (const label of getShortWeekdayLabels(WEEK_STARTS_ON)) {
        expect(
          screen.getAllByText(label, { exact: true }).length
        ).toBeGreaterThan(0);
      }
    });

    it("highlights today's column when viewing the current week", () => {
      renderWithContext({ selectedDate: new Date() });
      const todayCell = screen.getByTestId("week-calendar-today-cell");
      expect(todayCell).toBeInTheDocument();
    });

    it("flips the rendered week to Monday-first when weekStartDay=1", () => {
      // Wed Apr 15 2026.
      // - Sunday-first: range Apr 12 (Sun) – Apr 18 (Sat); first column = Apr 12.
      // - Monday-first: range Apr 13 (Mon) – Apr 19 (Sun); first column = Apr 13.
      const selectedDate = new Date(2026, 3, 15);

      renderWithContext({ selectedDate, weekStartDay: 1 });

      expect(screen.getByTestId("week-calendar-range")).toHaveTextContent(
        "Apr 13, 2026 – Apr 19, 2026"
      );
      // First weekday header is "Mon" not "Sun".
      expect(
        screen.getAllByText("Mon", { exact: true }).length
      ).toBeGreaterThan(0);
      // The Apr 13 (Mon) column exists; the Apr 12 (Sun) column does not.
      expect(
        screen.getByTestId("week-calendar-day-col-2026-04-13")
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId("week-calendar-day-col-2026-04-12")
      ).not.toBeInTheDocument();
    });
  });

  describe("Events per day", () => {
    it("renders events on the correct day", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day2 = addDays(weekStart, 2);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "m1",
            title: "Standup",
            startDate: midday(day2).toISOString(),
            endDate: midday(day2).toISOString(),
          }),
        ],
      });

      expect(screen.getByText("Standup")).toBeInTheDocument();
    });

    it("renders all timed events on a busy day in side-by-side columns", () => {
      // Time-grid layout positions events absolutely, so there is no
      // "+X more" overflow — overlapping events stack into adjacent
      // sub-columns within the day cell. This replaces the row-list
      // overflow assertion that was removed when WeekCalendar moved
      // from a stacked list to a time grid.
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 1);

      const events = Array.from({ length: 5 }, (_, i) => {
        const start = new Date(day);
        start.setHours(10 + i, 0, 0, 0);
        const end = new Date(day);
        end.setHours(11 + i, 0, 0, 0);
        return createMockEvent({
          id: `m-${i}`,
          title: `Event ${i + 1}`,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        });
      });

      renderWithContext({ selectedDate, events });

      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Event ${i}`)).toBeInTheDocument();
      }
    });

    it("shows all-day events with an 'All day' label", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "allday-1",
            title: "Holiday",
            startDate: midday(addDays(weekStart, 3)).toISOString(),
            endDate: midday(addDays(weekStart, 3)).toISOString(),
            isAllDay: true,
          }),
        ],
      });

      expect(screen.getByText("Holiday")).toBeInTheDocument();
    });
  });

  describe("Loading state", () => {
    it("shows loading indicator when isLoading is true", () => {
      renderWithContext({ isLoading: true });
      expect(screen.getByText("Loading events...")).toBeInTheDocument();
    });
  });

  describe("Time grid", () => {
    it("positions a timed event at the correct top within its day column", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 2);
      const start = new Date(day);
      start.setHours(9, 0, 0, 0);
      const end = new Date(day);
      end.setHours(10, 0, 0, 0);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "morning",
            title: "Morning",
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }),
        ],
      });

      const event = screen.getByTestId("week-calendar-event");
      const style = event.getAttribute("style") || "";
      expect(style).toMatch(/top:\s*37\.5%/);
      expect(style).toMatch(/height:\s*4\.16/);
    });

    it("renders the now line for today", () => {
      renderWithContext({ selectedDate: new Date() });
      expect(screen.getByTestId("week-calendar-now-line")).toBeInTheDocument();
    });

    it("does not render the now line for a past or future week", () => {
      renderWithContext({ selectedDate: subWeeks(new Date(), 4) });
      expect(
        screen.queryByTestId("week-calendar-now-line")
      ).not.toBeInTheDocument();
    });

    // Regression: #234 — event count and timed events must include events that
    // start on the last day of the visible week (Saturday with WEEK_STARTS_ON = 0).
    it("renders timed events that start on the last day of the week", () => {
      const selectedDate = midday(new Date(2026, 4, 2)); // Sat May 2, 2026
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const saturday = addDays(weekStart, 6);

      const start = new Date(saturday);
      start.setHours(14, 0, 0, 0);
      const end = new Date(saturday);
      end.setHours(15, 0, 0, 0);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "sat-afternoon",
            title: "Project Review",
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }),
        ],
      });

      expect(screen.getByTestId("week-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
      expect(screen.getByText("Project Review")).toBeInTheDocument();
    });
  });

  describe("Initial scroll position (#214, #288)", () => {
    // HOUR_HEIGHT_PX = 40; working hours start at 07:00 by default.
    // Expected scrollTop: 7 * 40 = 280
    it("auto-scrolls the time grid to ~7am on mount", () => {
      renderWithContext({ selectedDate: new Date() });
      const grid = screen.getByTestId("week-calendar-grid-scroll");
      expect(grid.scrollTop).toBe(280);
    });

    // Issue #288: the start hour is now configurable per user.
    it("honours a non-default workingHoursStart from context (early shift)", () => {
      renderWithContext({
        selectedDate: new Date(),
        workingHoursStart: 5,
      });
      const grid = screen.getByTestId("week-calendar-grid-scroll");
      expect(grid.scrollTop).toBe(5 * 40);
    });

    it("honours a non-default workingHoursStart from context (night owl)", () => {
      renderWithContext({
        selectedDate: new Date(),
        workingHoursStart: 14,
      });
      const grid = screen.getByTestId("week-calendar-grid-scroll");
      expect(grid.scrollTop).toBe(14 * 40);
    });

    it("does not render the grid (and thus does not scroll) in agenda mode", () => {
      renderWithContext({ selectedDate: new Date(), agendaMode: true });
      expect(
        screen.queryByTestId("week-calendar-grid-scroll")
      ).not.toBeInTheDocument();
    });

    // The grid lives in a sub-component (WeekGridView) so it unmounts/
    // remounts when agendaMode toggles. The scroll-on-mount effect uses
    // an empty dep array, which preserves user scroll between regular
    // re-renders while still resetting to 7am on each fresh re-entry
    // from agenda mode.
    it("re-scrolls to 7am after toggling agenda off and back to grid", () => {
      const selectedDate = new Date();
      const contextValue = {
        selectedDate,
        agendaMode: false,
      } satisfies Partial<ICalendarContext>;
      const { rerender } = render(
        <CalendarContext.Provider value={createMockContext(contextValue)}>
          <WeekCalendar />
        </CalendarContext.Provider>
      );

      const initialGrid = screen.getByTestId("week-calendar-grid-scroll");
      expect(initialGrid.scrollTop).toBe(280);
      // Simulate the user scrolling somewhere else.
      initialGrid.scrollTop = 0;
      expect(initialGrid.scrollTop).toBe(0);

      // Toggle agenda on — grid unmounts.
      rerender(
        <CalendarContext.Provider
          value={createMockContext({ ...contextValue, agendaMode: true })}
        >
          <WeekCalendar />
        </CalendarContext.Provider>
      );
      expect(
        screen.queryByTestId("week-calendar-grid-scroll")
      ).not.toBeInTheDocument();

      // Toggle agenda off — grid remounts; effect re-fires; back to 280.
      rerender(
        <CalendarContext.Provider
          value={createMockContext({ ...contextValue, agendaMode: false })}
        >
          <WeekCalendar />
        </CalendarContext.Provider>
      );
      const remountedGrid = screen.getByTestId("week-calendar-grid-scroll");
      expect(remountedGrid.scrollTop).toBe(280);
    });
  });

  describe("Multi-day spanning bars", () => {
    it("renders a single bar for an event spanning multiple days", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "trip",
            title: "Family Trip",
            startDate: addDays(weekStart, 1).toISOString(),
            endDate: addDays(weekStart, 4).toISOString(),
          }),
        ],
      });

      const bars = screen.getAllByTestId("week-calendar-multi-day-bar");
      expect(bars).toHaveLength(1);
      expect(bars[0]).toHaveTextContent("Family Trip");
    });

    it("treats all-day events as multi-day bars", () => {
      const selectedDate = midday(new Date(2026, 3, 15));
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const day = addDays(weekStart, 3);

      renderWithContext({
        selectedDate,
        events: [
          createMockEvent({
            id: "holiday",
            title: "Holiday",
            startDate: day.toISOString(),
            endDate: day.toISOString(),
            isAllDay: true,
          }),
        ],
      });

      const bars = screen.getAllByTestId("week-calendar-multi-day-bar");
      expect(bars).toHaveLength(1);
      expect(bars[0]).toHaveTextContent("Holiday");
    });

    it("does not render the multi-day row when no spanning events exist", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15), events: [] });
      expect(
        screen.queryByTestId("week-calendar-multi-day-row")
      ).not.toBeInTheDocument();
    });
  });

  // Issue #150 — agendaMode replaces the time-grid with a chronological list
  // grouped by day for the selected week.
  describe("Agenda mode", () => {
    it("renders the time grid when agendaMode is false", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });
      // The role=grid wrapper is the week time-grid.
      expect(
        screen.getByRole("grid", { name: /week of/i })
      ).toBeInTheDocument();
      expect(screen.queryByTestId("agenda-list")).not.toBeInTheDocument();
    });

    it("renders the agenda list when agendaMode is true", () => {
      const selectedDate = new Date(2026, 3, 15); // Wed Apr 15 2026
      const weekStart = startOfWeek(selectedDate, {
        weekStartsOn: WEEK_STARTS_ON,
      });
      const eventDate = addDays(weekStart, 1); // Within the week
      const start = new Date(eventDate);
      start.setHours(10, 0, 0, 0);
      const end = new Date(eventDate);
      end.setHours(11, 0, 0, 0);

      renderWithContext({
        agendaMode: true,
        selectedDate,
        events: [
          createMockEvent({
            id: "wed-event",
            title: "WeekEvent",
            startDate: start.toISOString(),
            endDate: end.toISOString(),
          }),
        ],
      });

      expect(
        screen.queryByRole("grid", { name: /week of/i })
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("agenda-list")).toBeInTheDocument();
      expect(screen.getByText("WeekEvent")).toBeInTheDocument();
    });

    it("keeps the week range header + prev/next navigation visible in agenda mode", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({ agendaMode: true });
      expect(screen.getByTestId("week-calendar-range")).toBeInTheDocument();

      await user.click(screen.getByTestId("week-calendar-next"));
      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
    });
  });

  describe("Slide animation on week navigation (#207)", () => {
    function installMatchMediaMock(reducedMotion: boolean) {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: reducedMotion && query === "(prefers-reduced-motion: reduce)",
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }

    beforeEach(() => {
      installMatchMediaMock(false);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function rerenderOn(
      selectedDate: Date,
      ctx: Partial<ICalendarContext>,
      rerender: ReturnType<typeof renderWithContext>["rerender"]
    ) {
      rerender(
        <CalendarContext.Provider
          value={{ ...createMockContext(ctx), selectedDate }}
        >
          <WeekCalendar />
        </CalendarContext.Provider>
      );
    }

    it("wraps the week body in an AnimatedSwap container", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });
      expect(screen.getByTestId("animated-swap")).toBeInTheDocument();
    });

    it("slides the outgoing body left (translateX(-100%)) on next-week", () => {
      const initial = new Date(2026, 3, 15);
      const baseCtx = { selectedDate: initial };
      const { rerender } = renderWithContext(baseCtx);

      rerenderOn(addDays(initial, 7), baseCtx, rerender);

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.transform).toBe("translateX(-100%)");
    });

    it("slides the outgoing body right (translateX(100%)) on prev-week", () => {
      const initial = new Date(2026, 3, 15);
      const baseCtx = { selectedDate: initial };
      const { rerender } = renderWithContext(baseCtx);

      rerenderOn(subWeeks(initial, 1), baseCtx, rerender);

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.transform).toBe("translateX(100%)");
    });

    it("does not animate when selectedDate moves within the same week", () => {
      // Mon → Wed in the same week: weekStart unchanged, no slide.
      const monday = new Date(2026, 3, 13); // Apr 13 2026 (Mon)
      const wednesday = new Date(2026, 3, 15);
      const baseCtx = { selectedDate: monday };
      const { rerender } = renderWithContext(baseCtx);

      rerenderOn(wednesday, baseCtx, rerender);

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
    });

    it("renders no outgoing snapshot when prefers-reduced-motion is set", () => {
      installMatchMediaMock(true);

      const initial = new Date(2026, 3, 15);
      const baseCtx = { selectedDate: initial };
      const { rerender } = renderWithContext(baseCtx);
      rerenderOn(addDays(initial, 7), baseCtx, rerender);

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
    });
  });
});
