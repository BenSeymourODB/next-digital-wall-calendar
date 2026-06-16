import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import { makeCalendarContext } from "@/test/fixtures/calendar-context";
import { createMockEvent } from "@/test/fixtures/calendar-event";
import type { IEvent, TEventColor } from "@/types/calendar";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YearCalendar, bucketEventColorsByDayKey } from "../YearCalendar";

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return makeCalendarContext({
    view: "year",
    selectedDate: new Date(2026, 3, 15),
    ...overrides,
  });
}

function renderWithContext(contextOverrides: Partial<ICalendarContext> = {}) {
  const contextValue = createMockContext(contextOverrides);
  return {
    ...render(
      <CalendarContext.Provider value={contextValue}>
        <YearCalendar />
      </CalendarContext.Provider>
    ),
    contextValue,
  };
}

describe("YearCalendar", () => {
  describe("Header", () => {
    it("renders the year title for the selected date", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      expect(
        screen.getByRole("heading", { name: /2026/, level: 2 })
      ).toBeInTheDocument();
    });

    it("shows the full-year date range Jan 1 – Dec 31", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      expect(screen.getByTestId("year-calendar-date-range")).toHaveTextContent(
        "Jan 1, 2026 – Dec 31, 2026"
      );
    });

    it("displays total event count for the year", () => {
      // Each fixture event is bounded entirely within its intended year so
      // the overlap-based count (#203 bug 2) is deterministic. The
      // "other-year" event must end inside 2025 — leaving its endDate at
      // the createMockEvent default ("now") would let it correctly overlap
      // into 2026 and inflate the count.
      const events = [
        createMockEvent({
          id: "e1",
          startDate: new Date(2026, 0, 5, 9).toISOString(),
          endDate: new Date(2026, 0, 5, 10).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          startDate: new Date(2026, 5, 10, 9).toISOString(),
          endDate: new Date(2026, 5, 10, 10).toISOString(),
        }),
        createMockEvent({
          id: "e3",
          startDate: new Date(2026, 11, 20, 9).toISOString(),
          endDate: new Date(2026, 11, 20, 10).toISOString(),
        }),
        createMockEvent({
          id: "e-other-year",
          startDate: new Date(2025, 6, 4, 9).toISOString(),
          endDate: new Date(2025, 6, 4, 10).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "3 events"
      );
    });

    it("uses singular 'event' for a count of 1", () => {
      const events = [
        createMockEvent({
          id: "e1",
          startDate: new Date(2026, 0, 5, 9).toISOString(),
          endDate: new Date(2026, 0, 5, 10).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });
  });

  describe("Year navigation", () => {
    it("navigates to January 1 of the previous year (#203 bug 4)", async () => {
      // Starting from April 15 — month/day must not bleed into the target
      // year. Issue #203 specifies prev/next-year nav lands on Jan 1.
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByTestId("year-calendar-prev-year"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2025);
      expect(calledWith.getMonth()).toBe(0);
      expect(calledWith.getDate()).toBe(1);
    });

    it("navigates to January 1 of the next year (#203 bug 4)", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByTestId("year-calendar-next-year"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2027);
      expect(calledWith.getMonth()).toBe(0);
      expect(calledWith.getDate()).toBe(1);
    });

    it("disables the Today button when viewing the current year", () => {
      const today = new Date();
      renderWithContext({ selectedDate: today });

      expect(screen.getByTestId("year-calendar-today-btn")).toBeDisabled();
    });

    it("enables the Today button when viewing a different year", () => {
      renderWithContext({ selectedDate: new Date(2000, 0, 1) });

      expect(screen.getByTestId("year-calendar-today-btn")).toBeEnabled();
    });

    it("jumps to today when the Today button is clicked", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2000, 0, 1),
      });

      await user.click(screen.getByTestId("year-calendar-today-btn"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(new Date().getFullYear());
    });
  });

  describe("Month grid", () => {
    it("renders all 12 months", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      const monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      monthNames.forEach((name) => {
        expect(
          screen.getByRole("button", { name: new RegExp(`^${name}$`) })
        ).toBeInTheDocument();
      });
    });

    it("renders 12 month panels with the expected test ids", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      for (let i = 0; i < 12; i++) {
        expect(
          screen.getByTestId(`year-calendar-month-${i}`)
        ).toBeInTheDocument();
      }
    });

    it("shows Sunday-first weekday labels in each month", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });

      const january = screen.getByTestId("year-calendar-month-0");
      const labels = within(january).getAllByTestId("year-calendar-dow-label");
      expect(labels.map((el) => el.textContent)).toEqual([
        "S",
        "M",
        "T",
        "W",
        "T",
        "F",
        "S",
      ]);
    });
  });

  describe("Event dot indicators", () => {
    it("renders a dot for a day that has an event", () => {
      const events = [
        createMockEvent({
          id: "e1",
          color: "blue",
          startDate: new Date(2026, 0, 5, 10, 0).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).getAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(1);
    });

    it("renders one dot per unique color on a day with multiple events", () => {
      const events = [
        createMockEvent({
          id: "e1",
          color: "blue",
          startDate: new Date(2026, 0, 5, 10, 0).toISOString(),
        }),
        createMockEvent({
          id: "e2",
          color: "green",
          startDate: new Date(2026, 0, 5, 12, 0).toISOString(),
        }),
        createMockEvent({
          id: "e3",
          color: "blue",
          startDate: new Date(2026, 0, 5, 14, 0).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).getAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(2);
    });

    it("renders no dots for a day with no events", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15), events: [] });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).queryAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(0);
    });

    it("caps the visible dots at 3 per day", () => {
      const events: IEvent[] = (
        ["blue", "green", "red", "yellow", "purple"] as TEventColor[]
      ).map((color, i) =>
        createMockEvent({
          id: `e${i}`,
          color,
          startDate: new Date(2026, 0, 5, 10 + i, 0).toISOString(),
        })
      );

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).getAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(3);
    });

    it("does not count events from a different year", () => {
      const events = [
        createMockEvent({
          id: "wrong-year",
          color: "blue",
          startDate: new Date(2025, 0, 5, 10, 0).toISOString(),
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 3, 15), events });

      const dayCell = screen.getByTestId("year-calendar-day-2026-01-05");
      const dots = within(dayCell).queryAllByTestId("year-calendar-dot");
      expect(dots).toHaveLength(0);
    });
  });

  describe("Day interaction", () => {
    it("clicking a day navigates to that date and switches to month view", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByTestId("year-calendar-day-2026-06-15"));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2026);
      expect(calledWith.getMonth()).toBe(5);
      expect(calledWith.getDate()).toBe(15);

      expect(contextValue.setView).toHaveBeenCalledWith("month");
    });

    it("clicking a month name navigates to its first day in month view", async () => {
      const user = userEvent.setup();
      const { contextValue } = renderWithContext({
        selectedDate: new Date(2026, 3, 15),
      });

      await user.click(screen.getByRole("button", { name: /^September$/ }));

      expect(contextValue.setSelectedDate).toHaveBeenCalledTimes(1);
      const calledWith = (
        contextValue.setSelectedDate as ReturnType<typeof vi.fn>
      ).mock.calls[0][0] as Date;
      expect(calledWith.getFullYear()).toBe(2026);
      expect(calledWith.getMonth()).toBe(8);
      expect(calledWith.getDate()).toBe(1);
      expect(contextValue.setView).toHaveBeenCalledWith("month");
    });

    it("highlights today when the current year is displayed", () => {
      const today = new Date();
      renderWithContext({ selectedDate: today });

      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, "0");
      const d = String(today.getDate()).padStart(2, "0");
      const todayCell = screen.getByTestId(`year-calendar-day-${y}-${m}-${d}`);
      expect(todayCell).toHaveAttribute("data-today", "true");
    });
  });

  describe("Loading state", () => {
    it("shows a loading message when isLoading is true", () => {
      renderWithContext({ isLoading: true });
      expect(screen.getByText(/loading events/i)).toBeInTheDocument();
    });
  });

  describe("Full-year event loading (#117)", () => {
    it("requests the selected year's events on mount", () => {
      const loadEventsForYear = vi.fn();
      renderWithContext({
        selectedDate: new Date(2030, 5, 10),
        loadEventsForYear,
      });

      expect(loadEventsForYear).toHaveBeenCalledWith(2030);
    });

    it("requests events for the new year when selectedDate's year changes", () => {
      const loadEventsForYear = vi.fn();
      const initialContext = createMockContext({
        selectedDate: new Date(2030, 5, 10),
        loadEventsForYear,
      });

      const { rerender } = render(
        <CalendarContext.Provider value={initialContext}>
          <YearCalendar />
        </CalendarContext.Provider>
      );

      expect(loadEventsForYear).toHaveBeenLastCalledWith(2030);

      // Year changes — provider should be asked to widen the loaded
      // range to cover the new year.
      const updatedContext = createMockContext({
        ...initialContext,
        selectedDate: new Date(2031, 0, 1),
        loadEventsForYear,
      });

      rerender(
        <CalendarContext.Provider value={updatedContext}>
          <YearCalendar />
        </CalendarContext.Provider>
      );

      expect(loadEventsForYear).toHaveBeenLastCalledWith(2031);
      expect(loadEventsForYear).toHaveBeenCalledTimes(2);
    });

    it("does not re-request the same year when selectedDate changes within it", () => {
      const loadEventsForYear = vi.fn();
      const initialContext = createMockContext({
        selectedDate: new Date(2030, 0, 5),
        loadEventsForYear,
      });

      const { rerender } = render(
        <CalendarContext.Provider value={initialContext}>
          <YearCalendar />
        </CalendarContext.Provider>
      );

      expect(loadEventsForYear).toHaveBeenCalledTimes(1);

      // Same year, different month — the provider already covers
      // Jan 1–Dec 31, so re-fetching is wasteful.
      const updatedContext = createMockContext({
        ...initialContext,
        selectedDate: new Date(2030, 8, 20),
        loadEventsForYear,
      });

      rerender(
        <CalendarContext.Provider value={updatedContext}>
          <YearCalendar />
        </CalendarContext.Provider>
      );

      expect(loadEventsForYear).toHaveBeenCalledTimes(1);
    });
  });

  describe("bucketEventColorsByDayKey (#203 bug 3)", () => {
    it("returns a map keyed by local YYYY-MM-DD with deduped colors per day", () => {
      const events = [
        createMockEvent({
          id: "a",
          color: "blue",
          startDate: new Date(2026, 0, 5, 9).toISOString(),
        }),
        createMockEvent({
          id: "b",
          color: "blue",
          startDate: new Date(2026, 0, 5, 14).toISOString(),
        }),
        createMockEvent({
          id: "c",
          color: "green",
          startDate: new Date(2026, 0, 5, 16).toISOString(),
        }),
        createMockEvent({
          id: "d",
          color: "red",
          startDate: new Date(2026, 5, 12, 10).toISOString(),
        }),
      ];

      const map = bucketEventColorsByDayKey(events);

      expect(map.get("2026-01-05")).toEqual(new Set(["blue", "green"]));
      expect(map.get("2026-06-12")).toEqual(new Set(["red"]));
      expect(map.get("2026-03-30")).toBeUndefined();
    });

    it("treats bare YYYY-MM-DD startDates as the local calendar day", () => {
      // Same defensive parsing the dot-rendering path uses (#203 bug 1) —
      // bare-date startDates must bucket on the local day, not UTC.
      const events = [
        createMockEvent({
          id: "all-day",
          color: "purple",
          startDate: "2026-06-15",
          endDate: "2026-06-15",
          isAllDay: true,
        }),
      ];

      const map = bucketEventColorsByDayKey(events);

      expect(map.get("2026-06-15")).toEqual(new Set(["purple"]));
      expect(map.get("2026-06-14")).toBeUndefined();
    });
  });

  describe("Multi-year yearEventCount overlap (#203 bug 2)", () => {
    it("counts an event spanning Dec → Jan in both years", () => {
      // The previous filter checked `isSameYear(event.startDate, selectedDate)`
      // and so missed Dec 2025 → Jan 2026 events when viewing 2026.
      // The fix delegates to getEventsForYear, which uses overlap logic.
      const overlappingEvent = createMockEvent({
        id: "yearend",
        startDate: new Date(2025, 11, 30, 18, 0).toISOString(),
        endDate: new Date(2026, 0, 2, 12, 0).toISOString(),
      });

      const { rerender } = render(
        <CalendarContext.Provider
          value={createMockContext({
            selectedDate: new Date(2026, 5, 15),
            events: [overlappingEvent],
          })}
        >
          <YearCalendar />
        </CalendarContext.Provider>
      );

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "1 event"
      );

      rerender(
        <CalendarContext.Provider
          value={createMockContext({
            selectedDate: new Date(2025, 5, 15),
            events: [overlappingEvent],
          })}
        >
          <YearCalendar />
        </CalendarContext.Provider>
      );

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "1 event"
      );
    });
  });

  describe("Bare-date count/dot parity (#375)", () => {
    it("counts a bare-date Jan-1 event in the year header to match the dot", () => {
      // Before #375 was fixed: the dot path used `parseEventStartLocal`
      // (treats bare YYYY-MM-DD as the local calendar day) while the count
      // path called `getEventsForYear`, which used `parseISO` (treats it as
      // UTC midnight). In negative-offset zones, the count silently
      // undercounted bare-date Jan-1 events while the dot still rendered.
      // After the fix both paths share `parseEventStart`, so the count must
      // equal the rendered-dot count for the exact scenario from #375.
      const events = [
        createMockEvent({
          id: "bare-jan-1",
          color: "blue",
          startDate: "2026-01-01",
          endDate: "2026-01-01",
          isAllDay: true,
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 0, 1), events });

      expect(screen.getByTestId("year-calendar-event-count")).toHaveTextContent(
        "1 event"
      );

      const janCell = screen.getByTestId("year-calendar-day-2026-01-01");
      expect(within(janCell).getAllByTestId("year-calendar-dot")).toHaveLength(
        1
      );
    });
  });

  describe("All-day timezone correctness (#203 bug 1)", () => {
    it("renders the dot on the calendar-local day for an all-day bare-date startDate", () => {
      // All-day events from non-canonical sources may carry a bare YYYY-MM-DD
      // string (the canonical Google → IEvent transformer appends T00:00:00,
      // but the year grid must not depend on that). `new Date("2026-06-15")`
      // is parsed as UTC midnight, which slips to 2026-06-14 in negative-
      // offset zones. The grid must treat the bare date as the local calendar
      // day so the dot renders on 2026-06-15 regardless of harness TZ.
      const events = [
        createMockEvent({
          id: "all-day-bare",
          color: "blue",
          startDate: "2026-06-15",
          endDate: "2026-06-15",
          isAllDay: true,
        }),
      ];

      renderWithContext({ selectedDate: new Date(2026, 5, 15), events });

      const correctCell = screen.getByTestId("year-calendar-day-2026-06-15");
      expect(
        within(correctCell).getAllByTestId("year-calendar-dot")
      ).toHaveLength(1);

      const previousCell = screen.getByTestId("year-calendar-day-2026-06-14");
      expect(
        within(previousCell).queryAllByTestId("year-calendar-dot")
      ).toHaveLength(0);
    });
  });

  describe("Slide animation on year navigation (#207)", () => {
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
          <YearCalendar />
        </CalendarContext.Provider>
      );
    }

    it("wraps the months grid in an AnimatedSwap container", () => {
      renderWithContext({ selectedDate: new Date(2026, 3, 15) });
      expect(screen.getByTestId("animated-swap")).toBeInTheDocument();
    });

    it("slides the outgoing months grid left on next-year", () => {
      const baseCtx = { selectedDate: new Date(2026, 3, 15) };
      const { rerender } = renderWithContext(baseCtx);

      rerenderOn(new Date(2027, 3, 15), baseCtx, rerender);

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.transform).toBe("translateX(-100%)");
    });

    it("slides the outgoing months grid right on prev-year", () => {
      const baseCtx = { selectedDate: new Date(2026, 3, 15) };
      const { rerender } = renderWithContext(baseCtx);

      rerenderOn(new Date(2025, 3, 15), baseCtx, rerender);

      const outgoing = screen.getByTestId("animated-swap-outgoing");
      expect(outgoing.style.transform).toBe("translateX(100%)");
    });

    it("does not animate when selectedDate moves within the same year", () => {
      const baseCtx = { selectedDate: new Date(2026, 1, 1) };
      const { rerender } = renderWithContext(baseCtx);

      rerenderOn(new Date(2026, 11, 1), baseCtx, rerender);

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
    });

    it("renders no outgoing snapshot when prefers-reduced-motion is set", () => {
      installMatchMediaMock(true);

      const baseCtx = { selectedDate: new Date(2026, 3, 15) };
      const { rerender } = renderWithContext(baseCtx);
      rerenderOn(new Date(2027, 3, 15), baseCtx, rerender);

      expect(
        screen.queryByTestId("animated-swap-outgoing")
      ).not.toBeInTheDocument();
    });
  });
});
