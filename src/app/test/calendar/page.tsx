"use client";

import { AgendaCalendar } from "@/components/calendar/AgendaCalendar";
import { SimpleCalendar } from "@/components/calendar/SimpleCalendar";
import { ViewSwitcher } from "@/components/calendar/ViewSwitcher";
import {
  MockCalendarProvider,
  useCalendar,
} from "@/components/providers/MockCalendarProvider";
import { Button } from "@/components/ui/button";
import type { IEvent, TEventColor } from "@/types/calendar";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Helper to create dates relative to today for consistent test data
 */
function getRelativeDate(
  daysFromToday: number,
  hours = 9,
  minutes = 0
): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

/**
 * Create a mock event with defaults
 */
function createMockEvent(overrides: Partial<IEvent> & { id: string }): IEvent {
  return {
    title: "Test Event",
    startDate: getRelativeDate(0, 10, 0),
    endDate: getRelativeDate(0, 11, 0),
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
 * Mock event sets for different test scenarios
 */
const mockEventSets: Record<string, IEvent[]> = {
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
        ["blue", "green", "red", "yellow", "purple", "orange"] as TEventColor[]
      )[i % 6],
    })
  ),

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

/**
 * Calendar display component that renders based on current view
 */
function CalendarDisplay() {
  const { view } = useCalendar();

  return (
    <div data-testid="calendar-display">
      {view === "month" && <SimpleCalendar />}
      {view === "agenda" && <AgendaCalendar />}
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
  const view = (searchParams.get("view") as "month" | "agenda") || "month";
  const loading = searchParams.get("loading") === "true";
  const loadingDelay = parseInt(searchParams.get("loadingDelay") || "0", 10);
  const showControls = searchParams.get("controls") !== "false";
  const use24Hour = searchParams.get("24hour") !== "false";

  // Get events for the specified set
  const events = mockEventSets[eventSet] || mockEventSets.default;

  return (
    <MockCalendarProvider
      initialEvents={events}
      view={view}
      isLoading={loading}
      loadingDelay={loadingDelay}
      use24HourFormat={use24Hour}
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

        <div className="mb-4">
          <ViewSwitcher />
        </div>

        <CalendarDisplay />
      </div>
    </MockCalendarProvider>
  );
}

/**
 * Test page for E2E testing of calendar components
 *
 * URL Parameters:
 * - events: Event set to use (default, empty, single, colors, overflow, family)
 * - view: Initial view (month, agenda)
 * - loading: Show loading state (true/false)
 * - loadingDelay: Simulate loading delay in ms
 * - controls: Show test controls (true/false)
 * - 24hour: Use 24-hour format (true/false)
 *
 * Examples:
 * - /test/calendar - Default events, month view
 * - /test/calendar?events=empty - Empty state
 * - /test/calendar?events=colors&view=agenda - Color test in agenda view
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
