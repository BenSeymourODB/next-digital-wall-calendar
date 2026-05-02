/**
 * Tests for CalendarProvider:
 *
 * 1. Settings state added in #86 (Calendar settings panel) — exercises the
 *    LocalStorage-persisted settings against an unauthenticated session so
 *    the network-backed code paths stay dormant.
 * 2. Issue #113 regression — `setSelectedDate` triggers `loadEventsForDate`
 *    and color/user filters propagate to downstream views.
 *
 * The full provider exercises NextAuth, IndexedDB, and `fetch`. We mock
 * those at the module boundary so the tests stay tight. A swappable
 * `mockSessionState` lets each describe block toggle the auth state it
 * needs without re-mocking next-auth per file.
 */
import {
  CalendarProvider,
  useCalendar,
} from "@/components/providers/CalendarProvider";
import { SessionProvider } from "next-auth/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { addMonths } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockSessionState: { current: { data: unknown; status: string } } = {
  current: { data: null, status: "unauthenticated" },
};

vi.mock("next-auth/react", async () => {
  const actual =
    await vi.importActual<typeof import("next-auth/react")>("next-auth/react");
  return {
    ...actual,
    useSession: () => mockSessionState.current,
  };
});

vi.mock("@/lib/calendar-storage", () => ({
  loadColorMappings: () => [],
  saveColorMappings: vi.fn(),
  loadSettings: () => ({ refreshInterval: 60 }),
  eventCache: {
    getEvents: vi.fn().mockResolvedValue([]),
    saveEvents: vi.fn().mockResolvedValue(undefined),
  },
}));

function SettingsProbe() {
  const {
    badgeVariant,
    setBadgeVariant,
    use24HourFormat,
    toggleTimeFormat,
    agendaModeGroupBy,
    setAgendaModeGroupBy,
    weekStartDay,
    setWeekStartDay,
  } = useCalendar();

  return (
    <div>
      <span data-testid="badge">{badgeVariant}</span>
      <span data-testid="hour">{String(use24HourFormat)}</span>
      <span data-testid="group">{agendaModeGroupBy}</span>
      <span data-testid="week-start">{String(weekStartDay)}</span>
      <button type="button" onClick={() => setBadgeVariant("dot")}>
        badge-dot
      </button>
      <button type="button" onClick={toggleTimeFormat}>
        toggle-hour
      </button>
      <button type="button" onClick={() => setAgendaModeGroupBy("color")}>
        group-color
      </button>
      <button type="button" onClick={() => setWeekStartDay(1)}>
        week-monday
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SessionProvider session={null}>
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    </SessionProvider>
  );
}

describe("CalendarProvider — settings state", () => {
  beforeEach(() => {
    mockSessionState.current = { data: null, status: "unauthenticated" };
    window.localStorage.clear();
  });

  it("exposes default settings when nothing is persisted", async () => {
    renderProvider();

    // CalendarProvider schedules an async cache-read on mount; wait for it
    // to settle so later tests don't race against the act() warning.
    await waitFor(() => {
      expect(screen.getByTestId("badge")).toHaveTextContent("colored");
    });

    expect(screen.getByTestId("hour")).toHaveTextContent("true");
    expect(screen.getByTestId("group")).toHaveTextContent("date");
    // 0 = Sunday per product requirement
    expect(screen.getByTestId("week-start")).toHaveTextContent("0");
  });

  it("persists weekStartDay changes to localStorage", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("0");
    });

    await user.click(screen.getByText("week-monday"));

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("1");
    });

    const stored = window.localStorage.getItem("calendar-settings");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.weekStartDay).toBe(1);
  });

  it("persists agenda group-by and badge changes alongside weekStartDay", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("badge")).toHaveTextContent("colored");
    });

    await user.click(screen.getByText("badge-dot"));
    await user.click(screen.getByText("group-color"));
    await user.click(screen.getByText("toggle-hour"));

    await waitFor(() => {
      expect(screen.getByTestId("hour")).toHaveTextContent("false");
    });

    const parsed = JSON.parse(
      window.localStorage.getItem("calendar-settings") ?? "{}"
    );
    expect(parsed.badgeVariant).toBe("dot");
    expect(parsed.agendaModeGroupBy).toBe("color");
    expect(parsed.use24HourFormat).toBe(false);
  });

  it("rehydrates weekStartDay from localStorage on mount", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "dot",
        view: "month",
        use24HourFormat: false,
        agendaModeGroupBy: "color",
        weekStartDay: 1,
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("group")).toHaveTextContent("color");
    expect(screen.getByTestId("hour")).toHaveTextContent("false");
    expect(screen.getByTestId("badge")).toHaveTextContent("dot");
  });

  it("falls back to defaults when the stored payload is missing the new field", async () => {
    // Legacy payload (pre-#86) — no weekStartDay key
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("0");
    });
    expect(screen.getByTestId("group")).toHaveTextContent("date");
    expect(screen.getByTestId("hour")).toHaveTextContent("true");
    expect(screen.getByTestId("badge")).toHaveTextContent("colored");
  });
});

vi.mock("@/lib/calendar-transform", () => ({
  // Honour `colorOverride` on the test fixture so the filter test
  // can assert that filtering by color actually drops the right
  // events. Defaults to "blue" when no override is given.
  transformGoogleEvent: (
    event: {
      id: string;
      summary?: string;
      start?: { dateTime?: string };
      colorOverride?: string;
    },
    _mappings: unknown
  ) => ({
    id: event.id,
    title: event.summary ?? "Mock",
    description: "",
    startDate: event.start?.dateTime ?? new Date().toISOString(),
    endDate: event.start?.dateTime ?? new Date().toISOString(),
    color: event.colorOverride ?? "blue",
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
    mockSessionState.current = {
      data: {
        user: { name: "Test", email: "test@test.test" },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      },
      status: "authenticated",
    };
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

  it("triggers loadEventsForDate with timeMin/timeMax for the navigation target", async () => {
    const target = addMonths(new Date(), 9);

    render(
      <CalendarProvider>
        <ProbeNav targetDate={target} />
      </CalendarProvider>
    );

    await waitFor(() => {
      const calls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(calls.some((u) => u.includes("/api/calendar/events"))).toBe(true);
    });

    const initialEventCalls = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes("/api/calendar/events")).length;

    await userEvent.setup().click(screen.getByText("jump"));

    await waitFor(() => {
      const eventCalls = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/calendar/events"));
      expect(eventCalls.length).toBeGreaterThan(initialEventCalls);

      // The most recent fetch must include the target month in its
      // timeMin/timeMax — confirms the provider isn't just spamming
      // the same range.
      const lastUrl = eventCalls.at(-1) ?? "";
      const params = new URLSearchParams(lastUrl.split("?")[1] ?? "");
      const timeMin = params.get("timeMin") ?? "";
      const timeMax = params.get("timeMax") ?? "";
      expect(timeMin).toMatch(/^\d{4}-\d{2}-\d{2}/);
      expect(timeMax).toMatch(/^\d{4}-\d{2}-\d{2}/);

      const tMin = new Date(timeMin).getTime();
      const tMax = new Date(timeMax).getTime();
      expect(tMin).toBeLessThanOrEqual(target.getTime());
      expect(tMax).toBeGreaterThanOrEqual(target.getTime());
    });
  });

  it("filters events by selectedColors", async () => {
    function ColorProbe() {
      const { events, filterEventsBySelectedColors } = useCalendar();
      return (
        <div>
          <button
            type="button"
            onClick={() => filterEventsBySelectedColors("blue")}
          >
            filter-blue
          </button>
          <ul data-testid="probe-events">
            {events.map((e) => (
              <li key={e.id}>{e.title}</li>
            ))}
          </ul>
        </div>
      );
    }

    fetchMock.mockImplementation((input: string | URL) => {
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
            events: [
              {
                id: "blue-event",
                summary: "Blue Event",
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date().toISOString() },
                colorOverride: "blue",
              },
              {
                id: "red-event",
                summary: "Red Event",
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date().toISOString() },
                colorOverride: "red",
              },
            ],
          })
        );
      }
      return Promise.resolve(fetchOk({}));
    });

    render(
      <CalendarProvider>
        <ColorProbe />
      </CalendarProvider>
    );

    // Both events render initially.
    await waitFor(() => {
      expect(screen.getByText("Blue Event")).toBeInTheDocument();
      expect(screen.getByText("Red Event")).toBeInTheDocument();
    });

    // Activate the blue filter.
    await userEvent.setup().click(screen.getByText("filter-blue"));

    // Red drops, blue stays.
    await waitFor(() => {
      expect(screen.getByText("Blue Event")).toBeInTheDocument();
      expect(screen.queryByText("Red Event")).not.toBeInTheDocument();
    });
  });

  describe("createEvent (#116)", () => {
    /**
     * Probe that exposes `createEvent` and the current event list. Tests
     * drive a click → see the optimistic row appear → assert reconciliation
     * (or rollback) when the mocked fetch settles.
     */
    function CreateEventProbe({
      optimisticId,
      onResolve,
      onError,
    }: {
      optimisticId: string;
      onResolve?: (id: string) => void;
      onError?: (err: Error) => void;
    }) {
      const { createEvent, events } = useCalendar();

      return (
        <div>
          <ul data-testid="probe-events">
            {events.map((e) => (
              <li key={e.id} data-testid={`probe-evt-${e.id}`}>
                {e.id}:{e.title}
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => {
              createEvent(
                {
                  id: optimisticId,
                  title: "New event",
                  description: "",
                  color: "blue",
                  isAllDay: false,
                  startDate: "2026-05-01T14:00:00.000Z",
                  endDate: "2026-05-01T15:00:00.000Z",
                  user: { id: "local", name: "You", picturePath: null },
                  calendarId: "primary",
                },
                {
                  title: "New event",
                  description: "",
                  color: "blue",
                  isAllDay: false,
                  startDate: "2026-05-01T14:00:00.000Z",
                  endDate: "2026-05-01T15:00:00.000Z",
                  calendarId: "primary",
                }
              )
                .then((created) => onResolve?.(created.id))
                .catch((err: Error) => onError?.(err));
            }}
          >
            create
          </button>
        </div>
      );
    }

    it("inserts the optimistic event and reconciles to the server's id on success", async () => {
      // Override the default fetch mock so POST /api/calendar/events returns
      // a canonical Google id; the seed GET still returns nothing relevant.
      fetchMock.mockImplementation(
        (input: string | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("/api/calendar/events") && init?.method === "POST") {
            return Promise.resolve(
              fetchOk({
                event: {
                  id: "google-id-1",
                  summary: "New event",
                  start: { dateTime: "2026-05-01T14:00:00.000Z" },
                  end: { dateTime: "2026-05-01T15:00:00.000Z" },
                  calendarId: "primary",
                },
              })
            );
          }
          if (url.includes("/api/calendar/calendars")) {
            return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
          }
          if (url.includes("/api/calendar/colors")) {
            return Promise.resolve(fetchOk({ colorMappings: [] }));
          }
          return Promise.resolve(fetchOk({ events: [] }));
        }
      );

      const onResolve = vi.fn();

      render(
        <CalendarProvider>
          <CreateEventProbe optimisticId="opt-1" onResolve={onResolve} />
        </CalendarProvider>
      );

      await userEvent.setup().click(screen.getByText("create"));

      // Optimistic row should be replaced by the canonical row keyed on the
      // server's id. There must be no point at which both rows are visible.
      await waitFor(() => {
        expect(screen.getByTestId("probe-evt-google-id-1")).toBeInTheDocument();
      });
      expect(screen.queryByTestId("probe-evt-opt-1")).not.toBeInTheDocument();

      // Promise resolves with the reconciled event id.
      await waitFor(() => {
        expect(onResolve).toHaveBeenCalledWith("google-id-1");
      });
    });

    it("rolls back the optimistic row when the request fails", async () => {
      fetchMock.mockImplementation(
        (input: string | URL, init?: RequestInit) => {
          const url = String(input);
          if (url.includes("/api/calendar/events") && init?.method === "POST") {
            return Promise.resolve({
              ok: false,
              status: 403,
              json: async () => ({ error: "Permission denied" }),
            } as unknown as Response);
          }
          if (url.includes("/api/calendar/calendars")) {
            return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
          }
          if (url.includes("/api/calendar/colors")) {
            return Promise.resolve(fetchOk({ colorMappings: [] }));
          }
          return Promise.resolve(fetchOk({ events: [] }));
        }
      );

      const onError = vi.fn();

      render(
        <CalendarProvider>
          <CreateEventProbe optimisticId="opt-2" onError={onError} />
        </CalendarProvider>
      );

      await userEvent.setup().click(screen.getByText("create"));

      // The optimistic row briefly appears, then disappears once the POST
      // resolves with 403. We assert the end state plus the rejected promise.
      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(screen.queryByTestId("probe-evt-opt-2")).not.toBeInTheDocument();
      expect(onError.mock.calls[0][0].message).toBe("Permission denied");
    });
  });
});
