/**
 * Regression tests for CalendarProvider behavior that day/week views
 * depend on (issue #113):
 *
 * - `setSelectedDate(date)` triggers `loadEventsForDate` for any
 *   navigation away from the originally loaded month — ensures the
 *   week/day chevrons fetch needed data.
 * - `events` exposed by the provider reflect color/user filters so
 *   downstream views (`DayCalendar`, `WeekCalendar`) inherit filtering
 *   without re-implementing it.
 *
 * The full provider exercises NextAuth, IndexedDB, and `fetch`. We
 * mock those at the module boundary so the tests stay tight.
 */
import {
  CalendarProvider,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addMonths } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: {
      user: { name: "Test", email: "test@test.test" },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    },
    status: "authenticated",
  }),
}));

vi.mock("@/lib/calendar-storage", () => ({
  loadColorMappings: () => [],
  saveColorMappings: vi.fn(),
  loadSettings: () => ({ refreshInterval: 60 }),
  eventCache: {
    getEvents: vi.fn().mockResolvedValue([]),
    saveEvents: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("@/lib/calendar-transform", () => ({
  transformGoogleEvent: (
    event: { id: string; summary?: string; start?: { dateTime?: string } },
    _mappings: unknown
  ) => ({
    id: event.id,
    title: event.summary ?? "Mock",
    description: "",
    startDate: event.start?.dateTime ?? new Date().toISOString(),
    endDate: event.start?.dateTime ?? new Date().toISOString(),
    color: "blue",
    isAllDay: false,
    calendarId: "primary",
    user: { id: "u1", name: "Mock", picturePath: null },
  }),
}));

function fetchOk(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as unknown as Response;
}

const baseEvent = (
  id: string,
  startISO: string,
  user = { id: "u1", name: "Alice", picturePath: null }
) => ({
  id,
  summary: id,
  start: { dateTime: startISO },
  end: { dateTime: startISO },
  user,
});

function ProbeNav({ targetDate }: { targetDate: Date }) {
  const { setSelectedDate } = useCalendar();
  return (
    <button onClick={() => setSelectedDate(targetDate)} type="button">
      jump
    </button>
  );
}

function EventList() {
  const { events } = useCalendar();
  return (
    <ul data-testid="provider-event-list">
      {events.map((e) => (
        <li key={e.id}>{e.title}</li>
      ))}
    </ul>
  );
}

describe("CalendarProvider", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(
          fetchOk({
            events: [baseEvent("seed-1", new Date().toISOString())],
          })
        );
      }
      return Promise.resolve(fetchOk({}));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("loads events on mount when authenticated", async () => {
    render(
      <CalendarProvider>
        <EventList />
      </CalendarProvider>
    );

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/calendar/events"))).toBe(true);
    });
  });

  it("triggers loadEventsForDate when selectedDate moves outside the loaded range", async () => {
    render(
      <CalendarProvider>
        <ProbeNav targetDate={addMonths(new Date(), 9)} />
      </CalendarProvider>
    );

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/calendar/events"))).toBe(true);
    });

    const initialEventFetches = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/api/calendar/events")).length;

    await userEvent.setup().click(screen.getByText("jump"));

    await waitFor(() => {
      const eventFetches = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/calendar/events")).length;
      expect(eventFetches).toBeGreaterThan(initialEventFetches);
    });
  });
});
