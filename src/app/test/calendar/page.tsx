"use client";

import { AnalogClockView } from "@/components/calendar/AnalogClockView";
import { CalendarFilterPanel } from "@/components/calendar/CalendarFilterPanel";
import { CalendarSettingsPanel } from "@/components/calendar/CalendarSettingsPanel";
import { DayCalendar } from "@/components/calendar/DayCalendar";
import { MiniCalendarSidebar } from "@/components/calendar/MiniCalendarSidebar";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import { WeekCalendar } from "@/components/calendar/WeekCalendar";
import { YearCalendar } from "@/components/calendar/YearCalendar";
import { AnimatedSwap } from "@/components/calendar/animated-swap";
import {
  MockCalendarProvider,
  useCalendar,
} from "@/components/providers/MockCalendarProvider";
import { Button } from "@/components/ui/button";
import type {
  IEvent,
  TCalendarAccessRole,
  TCalendarView,
  TEventColor,
  TWeekStartDay,
} from "@/types/calendar";
import { type ReactNode, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Create a mock event. Every caller in `mockEventSets` overrides
 * `startDate`/`endDate`, so the defaults below are placeholders only —
 * if a caller omits them they should treat the values as undefined
 * behaviour rather than rely on a particular date.
 */
function createMockEvent(
  overrides: Partial<IEvent> & Pick<IEvent, "id" | "startDate" | "endDate">
): IEvent {
  return {
    title: "Test Event",
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

/**
 * Mock event sets for different test scenarios.
 *
 * Built from an `anchor` Date so the page can be pinned to a specific
 * "today" via the `?anchor=YYYY-MM-DD` URL param (E2E determinism, e.g.
 * issue #234 boundary cases). When no anchor is provided callers should
 * pass `new Date()` to preserve the original behaviour.
 */
function buildMockEventSets(anchor: Date): Record<string, IEvent[]> {
  const getRelativeDate = (
    daysFromToday: number,
    hours = 9,
    minutes = 0
  ): string => {
    const date = new Date(anchor);
    date.setDate(date.getDate() + daysFromToday);
    date.setHours(hours, minutes, 0, 0);
    return date.toISOString();
  };

  return {
    // Default: Rich set of events across multiple days
    default: [
      // Today's events
      createMockEvent({
        id: "today-1",
        title: "Morning Standup",
        startDate: getRelativeDate(0, 9, 0),
        endDate: getRelativeDate(0, 9, 30),
        color: "blue",
        description: "Daily team standup meeting",
      }),
      createMockEvent({
        id: "today-2",
        title: "Project Review",
        startDate: getRelativeDate(0, 14, 0),
        endDate: getRelativeDate(0, 15, 0),
        color: "green",
      }),
      createMockEvent({
        id: "today-3",
        title: "Team Lunch",
        startDate: getRelativeDate(0, 12, 0),
        endDate: getRelativeDate(0, 13, 0),
        color: "yellow",
      }),
      createMockEvent({
        id: "today-4",
        title: "One-on-One",
        startDate: getRelativeDate(0, 16, 0),
        endDate: getRelativeDate(0, 16, 30),
        color: "purple",
      }),

      // Tomorrow
      createMockEvent({
        id: "tomorrow-1",
        title: "Client Call",
        startDate: getRelativeDate(1, 10, 0),
        endDate: getRelativeDate(1, 11, 0),
        color: "red",
        description: "Important client meeting",
      }),
      createMockEvent({
        id: "tomorrow-2",
        title: "Code Review",
        startDate: getRelativeDate(1, 14, 0),
        endDate: getRelativeDate(1, 15, 0),
        color: "blue",
      }),

      // Day 2
      createMockEvent({
        id: "day2-1",
        title: "Workshop",
        startDate: getRelativeDate(2, 9, 0),
        endDate: getRelativeDate(2, 12, 0),
        color: "orange",
      }),

      // Day 3 - Multiple events for overflow testing
      createMockEvent({
        id: "day3-1",
        title: "Planning Meeting",
        startDate: getRelativeDate(3, 9, 0),
        endDate: getRelativeDate(3, 10, 0),
        color: "blue",
      }),
      createMockEvent({
        id: "day3-2",
        title: "Design Review",
        startDate: getRelativeDate(3, 11, 0),
        endDate: getRelativeDate(3, 12, 0),
        color: "purple",
      }),
      createMockEvent({
        id: "day3-3",
        title: "Tech Sync",
        startDate: getRelativeDate(3, 14, 0),
        endDate: getRelativeDate(3, 15, 0),
        color: "green",
      }),
      createMockEvent({
        id: "day3-4",
        title: "Retrospective",
        startDate: getRelativeDate(3, 16, 0),
        endDate: getRelativeDate(3, 17, 0),
        color: "yellow",
      }),
      createMockEvent({
        id: "day3-5",
        title: "Team Social",
        startDate: getRelativeDate(3, 18, 0),
        endDate: getRelativeDate(3, 19, 0),
        color: "orange",
      }),

      // Week ahead
      createMockEvent({
        id: "day5-1",
        title: "Demo Day",
        startDate: getRelativeDate(5, 14, 0),
        endDate: getRelativeDate(5, 16, 0),
        color: "red",
      }),
      createMockEvent({
        id: "day6-1",
        title: "Training Session",
        startDate: getRelativeDate(6, 10, 0),
        endDate: getRelativeDate(6, 12, 0),
        color: "blue",
      }),
    ],

    // Single event on a read-only calendar (accessRole="reader"). Paired with
    // `?events=read-only` so the E2E suite can assert that EventDetailModal
    // hides the delete button for reader-access calendars (#266).
    "read-only": [
      createMockEvent({
        id: "ro-1",
        title: "Read Only Event",
        calendarId: "shared-readonly",
        startDate: getRelativeDate(0, 10, 0),
        endDate: getRelativeDate(0, 11, 0),
        color: "purple",
      }),
    ],

    // Single event on a freeBusyReader calendar. Covers the stricter
    // accessRole branch of the delete-gating path in its own E2E lane (#266).
    "free-busy": [
      createMockEvent({
        id: "fb-1",
        title: "Free Busy Event",
        calendarId: "freebusy-cal",
        startDate: getRelativeDate(0, 10, 0),
        endDate: getRelativeDate(0, 11, 0),
        color: "purple",
      }),
    ],

    // Empty state
    empty: [],

    // Single event
    single: [
      createMockEvent({
        id: "single-1",
        title: "Single Event",
        startDate: getRelativeDate(0, 10, 0),
        endDate: getRelativeDate(0, 11, 0),
        color: "blue",
      }),
    ],

    // Color test - one of each color
    colors: (
      ["blue", "green", "red", "yellow", "purple", "orange"] as TEventColor[]
    ).map((color, index) =>
      createMockEvent({
        id: `color-${color}`,
        title: `${color.charAt(0).toUpperCase() + color.slice(1)} Event`,
        startDate: getRelativeDate(0, 9 + index, 0),
        endDate: getRelativeDate(0, 10 + index, 0),
        color,
      })
    ),

    // Overflow test - many events on one day
    overflow: Array.from({ length: 10 }, (_, i) =>
      createMockEvent({
        id: `overflow-${i}`,
        title: `Event ${i + 1}`,
        startDate: getRelativeDate(0, 8 + i, 0),
        endDate: getRelativeDate(0, 9 + i, 0),
        color: (
          [
            "blue",
            "green",
            "red",
            "yellow",
            "purple",
            "orange",
          ] as TEventColor[]
        )[i % 6],
      })
    ),

    // Multi-day event scenario for week-view spanning bars
    multiDay: [
      createMockEvent({
        id: "trip",
        title: "Family Trip",
        startDate: getRelativeDate(1, 0, 0),
        endDate: getRelativeDate(4, 23, 59),
        color: "purple",
      }),
      createMockEvent({
        id: "all-day-holiday",
        title: "Holiday",
        startDate: getRelativeDate(0, 0, 0),
        endDate: getRelativeDate(0, 23, 59),
        color: "red",
        isAllDay: true,
      }),
      createMockEvent({
        id: "morning-meeting",
        title: "Morning Standup",
        startDate: getRelativeDate(0, 9, 0),
        endDate: getRelativeDate(0, 9, 30),
        color: "blue",
      }),
    ],

    // Family calendar scenario
    family: [
      createMockEvent({
        id: "family-1",
        title: "Work Meeting",
        startDate: getRelativeDate(0, 9, 0),
        endDate: getRelativeDate(0, 10, 0),
        color: "blue",
        user: { id: "parent-1", name: "Mom", picturePath: null },
      }),
      createMockEvent({
        id: "family-2",
        title: "Grocery Shopping",
        startDate: getRelativeDate(1, 17, 0),
        endDate: getRelativeDate(1, 18, 0),
        color: "green",
        user: { id: "parent-1", name: "Mom", picturePath: null },
      }),
      createMockEvent({
        id: "family-3",
        title: "Soccer Practice",
        startDate: getRelativeDate(0, 16, 0),
        endDate: getRelativeDate(0, 17, 30),
        color: "green",
        user: { id: "kid-1", name: "Emma", picturePath: null },
      }),
      createMockEvent({
        id: "family-4",
        title: "Piano Lesson",
        startDate: getRelativeDate(2, 15, 0),
        endDate: getRelativeDate(2, 16, 0),
        color: "purple",
        user: { id: "kid-1", name: "Emma", picturePath: null },
      }),
      createMockEvent({
        id: "family-5",
        title: "Art Class",
        startDate: getRelativeDate(1, 15, 30),
        endDate: getRelativeDate(1, 17, 0),
        color: "yellow",
        user: { id: "kid-2", name: "Jack", picturePath: null },
      }),
      createMockEvent({
        id: "family-6",
        title: "Family Dinner",
        startDate: getRelativeDate(0, 18, 0),
        endDate: getRelativeDate(0, 19, 30),
        color: "yellow",
        description: "Grandma's house",
        user: { id: "family", name: "Family", picturePath: null },
      }),
      createMockEvent({
        id: "family-7",
        title: "Birthday Party",
        startDate: getRelativeDate(3, 14, 0),
        endDate: getRelativeDate(3, 17, 0),
        color: "red",
        description: "Tommy's birthday at the park",
        user: { id: "kid-2", name: "Jack", picturePath: null },
      }),
    ],
  };
}

/**
 * Mirrors the production CalendarView render tree. When `?view=agenda` is
 * passed, TestCalendarContent maps it to view="day" + agendaMode=true, so
 * DayCalendar renders its AgendaList surface — exactly what production does.
 * AgendaCalendar (the pre-#150 legacy component) is no longer mounted here;
 * its search-UX tests still live in AgendaCalendar.test.tsx and cover the
 * component directly. Removal of AgendaCalendar belongs to issue #264.
 */
function CalendarDisplay() {
  const { view, agendaMode, transitionDurationMs } = useCalendar();

  // Compose a swap key that switches the animation when the user toggles
  // agenda mode within day/week, so the grid <-> agenda transition gets
  // the same fade treatment as a primary view change (#150 + #87).
  const swapKey =
    (view === "day" || view === "week") && agendaMode ? `${view}:agenda` : view;

  return (
    <div data-testid="calendar-display">
      <AnimatedSwap
        swapKey={swapKey}
        type="fade"
        direction="forward"
        durationMs={transitionDurationMs}
      >
        <>
          {view === "day" && <DayCalendar />}
          {view === "week" && <WeekCalendar />}
          {view === "month" && <SimpleCalendar />}
          {view === "year" && <YearCalendar />}
          {view === "clock" && <AnalogClockView />}
        </>
      </AnimatedSwap>
    </div>
  );
}

/**
 * Layout that mirrors the production /calendar page: the mini-calendar sidebar
 * is hidden when the active view is month (where it duplicates the main grid)
 * and shown on day, week, year, and agenda views. See issue #146.
 */
function SidebarAwareLayout({ children }: { children: ReactNode }) {
  const { view } = useCalendar();

  if (view === "month") {
    return <div className="grid gap-4">{children}</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      {children}
      <MiniCalendarSidebar />
    </div>
  );
}

/**
 * Test controls for interacting with the calendar during testing
 */
function TestControls() {
  const { setSelectedDate, toggleTimeFormat, use24HourFormat, clearFilter } =
    useCalendar();

  const goToNextMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    setSelectedDate(date);
  };

  const goToPrevMonth = () => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    setSelectedDate(date);
  };

  return (
    <div
      className="mb-4 flex flex-wrap gap-2 border-b border-gray-200 pb-4"
      data-testid="test-controls"
    >
      <Button
        variant="outline"
        size="sm"
        onClick={goToPrevMonth}
        data-testid="go-prev-month"
      >
        Previous Month
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSelectedDate(new Date())}
        data-testid="go-today"
      >
        Today
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={goToNextMonth}
        data-testid="go-next-month"
      >
        Next Month
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={toggleTimeFormat}
        data-testid="toggle-time-format"
      >
        {use24HourFormat ? "Switch to 12h" : "Switch to 24h"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={clearFilter}
        data-testid="clear-filters"
      >
        Clear Filters
      </Button>
    </div>
  );
}

/**
 * Inner component that reads search params
 */
function TestCalendarContent() {
  const searchParams = useSearchParams();

  // Get test configuration from URL params
  const eventSet = searchParams.get("events") || "default";
  const rawView = searchParams.get("view") ?? "month";
  // `?view=agenda` maps to day + agendaMode=true, mirroring how production
  // surfaces agenda mode (DayCalendar renders AgendaList when agendaMode=true).
  // This replaces the old behavior of mounting the legacy AgendaCalendar
  // component (removed from this page by issue #287; component removal is #264).
  const isAgendaAlias = rawView === "agenda";
  const view: TCalendarView = isAgendaAlias
    ? "day"
    : (rawView as TCalendarView);
  const agendaModeParam =
    isAgendaAlias || searchParams.get("agendaMode") === "true";
  const loading = searchParams.get("loading") === "true";
  const loadingDelay = parseInt(searchParams.get("loadingDelay") || "0", 10);
  const showControls = searchParams.get("controls") !== "false";
  const use24Hour = searchParams.get("24hour") !== "false";
  const showSidebar = searchParams.get("sidebar") === "true";
  const showFilters = searchParams.get("filters") === "true";
  // `?weekStartDay=N` flips the mock provider to a non-default week
  // start so E2E specs can exercise weekStartDay-aware behaviour
  // (Home/End, grid layout, range headers) without needing a logged-in
  // user with the setting persisted. Today `TWeekStartDay = 0 | 1`, so
  // only `0` and `1` are accepted; if that type ever widens (e.g. 6 for
  // Saturday-first) extend the validator below in the same change so
  // unknown values aren't silently coerced to Sunday-first.
  const weekStartDayRaw = Number(searchParams.get("weekStartDay") ?? "0");
  const weekStartDayParam: TWeekStartDay = weekStartDayRaw === 1 ? 1 : 0;
  // `?transitionMs=N` lets E2E specs drive the calendar transition speed
  // (issue #283). Defaults match production "normal"; pass `0` to verify
  // the off-path swap.
  const transitionMsParam = searchParams.get("transitionMs");
  const parsedTransitionMs =
    transitionMsParam !== null ? parseInt(transitionMsParam, 10) : NaN;
  const transitionDurationMs =
    Number.isFinite(parsedTransitionMs) && parsedTransitionMs >= 0
      ? parsedTransitionMs
      : undefined;

  // Optional `?anchor=YYYY-MM-DD` pins the relative event timestamps to a
  // deterministic "today" and also seeds `MockCalendarProvider`'s
  // `initialDate`, so the calendar lands on the same day. Falling back to
  // `new Date()` preserves the original behaviour for E2E specs and manual
  // exploration that don't need date determinism.
  const anchorParam = searchParams.get("anchor");
  const parsedAnchor = anchorParam ? new Date(anchorParam) : null;
  const anchor =
    parsedAnchor && !isNaN(parsedAnchor.getTime()) ? parsedAnchor : new Date();
  const mockEventSets = buildMockEventSets(anchor);

  // Get events for the specified set
  const events = mockEventSets[eventSet] || mockEventSets.default;

  // Seed accessRoles for the read-only test sets so EventDetailModal's
  // delete-gating logic (#266) is exercisable without a real Google OAuth
  // session. Other event sets get no access-role map and fall through to the
  // permissive default.
  const accessRolesByCalendarId:
    | Record<string, TCalendarAccessRole>
    | undefined =
    eventSet === "read-only"
      ? { "shared-readonly": "reader" }
      : eventSet === "free-busy"
        ? { "freebusy-cal": "freeBusyReader" }
        : undefined;

  return (
    <MockCalendarProvider
      initialEvents={events}
      initialDate={anchorParam ? anchor : undefined}
      view={view}
      agendaMode={agendaModeParam}
      isLoading={loading}
      loadingDelay={loadingDelay}
      use24HourFormat={use24Hour}
      weekStartDay={weekStartDayParam}
      transitionDurationMs={transitionDurationMs}
      accessRolesByCalendarId={accessRolesByCalendarId}
    >
      <div className="container mx-auto max-w-6xl p-4" data-testid="test-page">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">
          Calendar Test Page
        </h1>

        <div className="mb-4 rounded bg-gray-100 p-2 text-sm text-gray-600">
          <strong>Test Config:</strong> events={eventSet}, view={view}, loading=
          {String(loading)}, 24hour={String(use24Hour)}
        </div>

        {showControls && <TestControls />}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <ViewSwitcher />
            <CalendarSettingsPanel />
          </div>
          {showFilters ? <CalendarFilterPanel /> : null}
        </div>

        {showSidebar ? (
          <SidebarAwareLayout>
            <CalendarDisplay />
          </SidebarAwareLayout>
        ) : (
          <CalendarDisplay />
        )}
      </div>
    </MockCalendarProvider>
  );
}

/**
 * Test page for E2E testing of calendar components
 *
 * URL Parameters:
 * - events: Event set to use (default, empty, single, colors, overflow, family)
 * - view: Initial view (month, day, week, year, clock). `agenda` is accepted
 *   as an alias for `day` + agendaMode=true, mirroring production behavior
 *   (issue #287). The legacy standalone AgendaCalendar is no longer mounted
 *   here; its removal belongs to issue #264.
 * - loading: Show loading state (true/false)
 * - loadingDelay: Simulate loading delay in ms
 * - controls: Show test controls (true/false)
 * - 24hour: Use 24-hour format (true/false)
 * - sidebar: Show the mini-calendar sidebar (true/false)
 * - filters: Show the calendar filter panel (true/false)
 * - anchor: Pin relative event timestamps to a fixed date (YYYY-MM-DD).
 *   Defaults to the wall-clock "today". Useful for deterministic E2E
 *   coverage of date-dependent code paths (e.g. issue #234 boundary).
 *
 * Examples:
 * - /test/calendar - Default events, month view
 * - /test/calendar?events=empty - Empty state
 * - /test/calendar?events=colors&view=agenda - Color test in agenda view (DayCalendar + agendaMode)
 * - /test/calendar?events=family - Family calendar scenario
 * - /test/calendar?loading=true&loadingDelay=2000 - Loading state for 2 seconds
 */
export default function TestCalendarPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-4">Loading test page...</div>
      }
    >
      <TestCalendarContent />
    </Suspense>
  );
}
