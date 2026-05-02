/**
 * Integration tests for the view-mode fade wiring (#87).
 *
 * Verifies that when the calendar's `view` toggles between Month and Agenda,
 * the AnimatedSwap wrapper renders both view containers simultaneously while
 * the fade is in flight, then collapses to just the new view after the
 * duration elapses, and skips animation under prefers-reduced-motion.
 *
 * Mirrors the integration the production calendar page wires up — the same
 * AnimatedSwap call lives in `src/app/calendar/page.tsx` and
 * `src/app/test/calendar/page.tsx`.
 */
import { AnimatedSwap } from "@/components/calendar/animated-swap";
import {
  CalendarContext,
  type ICalendarContext,
} from "@/components/providers/CalendarProvider";
import type { IUser, TCalendarView, TEventColor } from "@/types/calendar";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const VIEW_FADE_DURATION_MS = 250;

function createMockContext(
  overrides: Partial<ICalendarContext> = {}
): ICalendarContext {
  return {
    selectedDate: new Date(),
    view: "month" as TCalendarView,
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
    events: [],
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
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

function CalendarSurface({ view }: { view: TCalendarView }) {
  return (
    <AnimatedSwap
      swapKey={view}
      type="fade"
      direction="forward"
      durationMs={VIEW_FADE_DURATION_MS}
    >
      {view === "month" ? (
        <div data-testid="month-surface">Month surface</div>
      ) : (
        <div data-testid="agenda-surface">Agenda surface</div>
      )}
    </AnimatedSwap>
  );
}

function renderCalendarSurface(view: TCalendarView) {
  const context = createMockContext({ view });
  return render(
    <CalendarContext.Provider value={context}>
      <CalendarSurface view={view} />
    </CalendarContext.Provider>
  );
}

const mockMatchMedia = vi.fn().mockImplementation((query: string) => ({
  matches: false,
  media: query,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

beforeEach(() => {
  vi.useFakeTimers();
  window.matchMedia = mockMatchMedia;
});

afterEach(() => {
  vi.useRealTimers();
  mockMatchMedia.mockClear();
});

describe("Calendar view-mode animation (integration)", () => {
  it("renders both Month and Agenda surfaces simultaneously while the fade is in flight", () => {
    const { rerender } = renderCalendarSurface("month");
    expect(screen.getByTestId("month-surface")).toBeInTheDocument();
    expect(screen.queryByTestId("agenda-surface")).not.toBeInTheDocument();

    rerender(
      <CalendarContext.Provider value={createMockContext({ view: "agenda" })}>
        <CalendarSurface view="agenda" />
      </CalendarContext.Provider>
    );

    // The animation snapshot keeps the Month surface alive while Agenda
    // fades in. Both must be in the DOM mid-transition.
    expect(screen.getByTestId("month-surface")).toBeInTheDocument();
    expect(screen.getByTestId("agenda-surface")).toBeInTheDocument();
  });

  it("settles to only the Agenda surface after the fade completes", () => {
    const { rerender } = renderCalendarSurface("month");

    rerender(
      <CalendarContext.Provider value={createMockContext({ view: "agenda" })}>
        <CalendarSurface view="agenda" />
      </CalendarContext.Provider>
    );

    act(() => {
      vi.advanceTimersByTime(VIEW_FADE_DURATION_MS);
    });

    expect(screen.queryByTestId("month-surface")).not.toBeInTheDocument();
    expect(screen.getByTestId("agenda-surface")).toBeInTheDocument();
  });

  it("swaps instantly under prefers-reduced-motion (no simultaneous render)", () => {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: query === "(prefers-reduced-motion: reduce)",
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const { rerender } = renderCalendarSurface("month");

    rerender(
      <CalendarContext.Provider value={createMockContext({ view: "agenda" })}>
        <CalendarSurface view="agenda" />
      </CalendarContext.Provider>
    );

    expect(screen.queryByTestId("month-surface")).not.toBeInTheDocument();
    expect(screen.getByTestId("agenda-surface")).toBeInTheDocument();
  });
});
