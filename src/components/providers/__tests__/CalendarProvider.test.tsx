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
    view,
    setView,
    agendaMode,
    setAgendaMode,
  } = useCalendar();

  return (
    <div>
      <span data-testid="badge">{badgeVariant}</span>
      <span data-testid="hour">{String(use24HourFormat)}</span>
      <span data-testid="group">{agendaModeGroupBy}</span>
      <span data-testid="week-start">{String(weekStartDay)}</span>
      <span data-testid="view">{view}</span>
      <span data-testid="agenda-mode">{String(agendaMode)}</span>
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
      <button type="button" onClick={() => setView("week")}>
        view-week
      </button>
      <button type="button" onClick={() => setAgendaMode(true)}>
        agenda-on
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

  // Issue #150 — agendaMode is now a sub-toggle, not a top-level view.
  it("defaults agendaMode to false on first load", async () => {
    renderProvider();
    await waitFor(() => {
      expect(screen.getByTestId("agenda-mode")).toHaveTextContent("false");
    });
  });

  it("persists agendaMode toggles to localStorage", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("agenda-mode")).toHaveTextContent("false");
    });

    await user.click(screen.getByText("agenda-on"));

    await waitFor(() => {
      expect(screen.getByTestId("agenda-mode")).toHaveTextContent("true");
    });

    const parsed = JSON.parse(
      window.localStorage.getItem("calendar-settings") ?? "{}"
    );
    expect(parsed.agendaMode).toBe(true);
  });

  it("migrates legacy view='agenda' in localStorage to view='day' + agendaMode=true", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "agenda",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 0,
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("day");
    });
    expect(screen.getByTestId("agenda-mode")).toHaveTextContent("true");
  });

  it("rewrites the migrated payload back to localStorage so the legacy value is removed", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "agenda",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 0,
      })
    );

    const user = userEvent.setup();
    renderProvider();

    // Trigger any persisted update so the migrated payload is flushed.
    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("day");
    });
    await user.click(screen.getByText("badge-dot"));

    await waitFor(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("calendar-settings") ?? "{}"
      );
      expect(parsed.view).toBe("day");
      expect(parsed.agendaMode).toBe(true);
    });
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

  describe("loadEventsForYear (#117)", () => {
    function YearProbe({ year }: { year: number }) {
      const { loadEventsForYear } = useCalendar();
      return (
        <button onClick={() => loadEventsForYear(year)} type="button">
          load-year-{year}
        </button>
      );
    }

    /**
     * Helper: pull every `/api/calendar/events` URL the provider has called
     * since render, in order. Lets the assertions reason about which
     * timeMin/timeMax windows were actually requested.
     */
    function eventFetches() {
      return fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/calendar/events"));
    }

    it("extends the loaded range to cover Jan 1 – Dec 31 of the requested year", async () => {
      const targetYear = new Date().getFullYear() + 5;

      render(
        <CalendarProvider>
          <YearProbe year={targetYear} />
        </CalendarProvider>
      );

      // Wait for the initial -1mo / +6mo range to load before exercising
      // the year loader; the loader is a no-op until `loadedRange` is set.
      await waitFor(() => {
        expect(eventFetches().length).toBeGreaterThan(0);
      });
      const beforeCount = eventFetches().length;

      await userEvent
        .setup()
        .click(screen.getByText(`load-year-${targetYear}`));

      // The loader fetches the missing edges, so we expect at least one
      // additional /events request whose [timeMin, timeMax] straddles
      // either Jan 1 or Dec 31 of the target year.
      await waitFor(() => {
        const afterFetches = eventFetches();
        expect(afterFetches.length).toBeGreaterThan(beforeCount);

        const yearStart = new Date(targetYear, 0, 1).getTime();
        const yearEnd = new Date(targetYear, 11, 31).getTime();

        const newFetches = afterFetches.slice(beforeCount);
        const ranges = newFetches.map((u) => {
          const params = new URLSearchParams(u.split("?")[1] ?? "");
          return {
            min: new Date(params.get("timeMin") ?? "").getTime(),
            max: new Date(params.get("timeMax") ?? "").getTime(),
          };
        });

        const coversJan = ranges.some(
          (r) => r.min <= yearStart && r.max >= yearStart
        );
        const coversDec = ranges.some(
          (r) => r.min <= yearEnd && r.max >= yearEnd
        );
        expect(coversJan).toBe(true);
        expect(coversDec).toBe(true);
      });
    });

    it("is a no-op when the requested year is already fully loaded", async () => {
      // `loadEventsForYear` is called twice for the same year. The second
      // call must not issue any new /events requests because the first
      // call already widened `loadedRange` to cover Jan 1 – Dec 31.
      //
      // targetYear is currentYear + 5: yearStart and yearEnd are both
      // after the default refresh window's end, so only the Dec edge
      // fires — exactly one new /events request per first call.
      const targetYear = new Date().getFullYear() + 5;

      render(
        <CalendarProvider>
          <YearProbe year={targetYear} />
        </CalendarProvider>
      );

      // Wait until the initial -1mo/+6mo refresh has made its single
      // /events call AND any associated state updates have flushed.
      await waitFor(() => {
        expect(eventFetches().length).toBe(1);
      });

      const user = userEvent.setup();
      await user.click(screen.getByText(`load-year-${targetYear}`));

      // The Dec-edge fetch is the sole new /events call. waitFor only
      // returns once the awaited fetchEventsForRange has resolved AND
      // the finally block (which clears `isLoadingRangeRef`) has run,
      // because all of that happens in a single microtask burst once
      // the mock's promise resolves. No artificial sleep needed.
      await waitFor(() => {
        expect(eventFetches().length).toBe(2);
      });

      // Second click: year is now fully covered. The loader should
      // return early at the "already covered" guard with no new fetch.
      await user.click(screen.getByText(`load-year-${targetYear}`));

      // Stability assertion: poll for the duration of waitFor's default
      // window (~1s) and fail if the count ever moves past 2.
      await waitFor(
        () => {
          expect(eventFetches().length).toBe(2);
        },
        { timeout: 200, interval: 25 }
      );
    });

    it("does nothing when called before the initial range is loaded", async () => {
      // Before the first refreshEvents finishes, `loadedRange` is null.
      // The loader must guard against that to avoid fetching with NaN
      // timeMin/timeMax.
      mockSessionState.current = {
        data: null,
        status: "unauthenticated",
      };

      render(
        <CalendarProvider>
          <YearProbe year={2099} />
        </CalendarProvider>
      );

      await userEvent.setup().click(screen.getByText("load-year-2099"));

      // Unauthenticated path never sets loadedRange, so the loader
      // must not call fetch.
      const eventCalls = eventFetches();
      expect(eventCalls.length).toBe(0);
    });

    it("advances loadedRange for the successful edge when the second edge fetch fails", async () => {
      // If the Jan-edge fetch succeeds but the Dec-edge fetch then throws,
      // a retry must NOT re-fetch the Jan edge (the events are already
      // merged into state). The range pointer must be advanced after each
      // successful fetch, not batched at the end.
      //
      // The current year is picked deliberately: with the default refresh
      // window of -1mo / +6mo around `now`, only the current year has
      // both yearStart (Jan 1) before loadedRange.start AND yearEnd
      // (Dec 31) after loadedRange.end, so both edge branches fire.
      const targetYear = new Date().getFullYear();

      render(
        <CalendarProvider>
          <YearProbe year={targetYear} />
        </CalendarProvider>
      );

      // Wait for the initial -1mo / +6mo range to land.
      await waitFor(() => {
        expect(eventFetches().length).toBeGreaterThan(0);
      });

      const user = userEvent.setup();

      // First click: Jan edge succeeds, Dec edge rejects. The provider
      // swallows the rejection (logged via logger.error) but should
      // already have advanced loadedRange.start to yearStart.
      let postClickEventCalls = 0;
      fetchMock.mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/calendar/calendars")) {
          return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
        }
        if (url.includes("/api/calendar/colors")) {
          return Promise.resolve(fetchOk({ colorMappings: [] }));
        }
        if (url.includes("/api/calendar/events")) {
          postClickEventCalls++;
          if (postClickEventCalls === 2) {
            return Promise.reject(new Error("simulated network blip"));
          }
          return Promise.resolve(fetchOk({ events: [] }));
        }
        return Promise.resolve(fetchOk({}));
      });

      await user.click(screen.getByText(`load-year-${targetYear}`));

      // Wait for both edge attempts to have been made.
      await waitFor(() => {
        expect(postClickEventCalls).toBeGreaterThanOrEqual(2);
      });

      // Restore happy fetchMock for the retry.
      let secondClickEventCalls = 0;
      fetchMock.mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/calendar/calendars")) {
          return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
        }
        if (url.includes("/api/calendar/colors")) {
          return Promise.resolve(fetchOk({ colorMappings: [] }));
        }
        if (url.includes("/api/calendar/events")) {
          secondClickEventCalls++;
          return Promise.resolve(fetchOk({ events: [] }));
        }
        return Promise.resolve(fetchOk({}));
      });

      await user.click(screen.getByText(`load-year-${targetYear}`));

      // The retry must hit the Dec edge ONLY — not the Jan edge.
      // (If the partial-failure bug were present, both edges would
      // refire because `setLoadedRange` was never called after the
      // partial success.)
      await waitFor(() => {
        expect(secondClickEventCalls).toBe(1);
      });

      // Sanity: confirm the retry's single fetch covers Dec, not Jan.
      const yearEndTs = new Date(targetYear, 11, 31).getTime();
      const calls = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/calendar/events"));
      const lastUrl = calls[calls.length - 1] ?? "";
      const params = new URLSearchParams(lastUrl.split("?")[1] ?? "");
      const tMax = new Date(params.get("timeMax") ?? "").getTime();
      expect(tMax).toBeGreaterThanOrEqual(yearEndTs);
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

  describe("deleteEvent (#115)", () => {
    function DeleteProbe({
      eventId,
      calendarId,
      onError,
    }: {
      eventId: string;
      calendarId: string;
      onError?: (err: Error) => void;
    }) {
      const { events, deleteEvent } = useCalendar();
      return (
        <div>
          <ul data-testid="delete-probe-events">
            {events.map((e) => (
              <li key={e.id}>{e.title}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={async () => {
              try {
                await deleteEvent(eventId, calendarId);
              } catch (err) {
                onError?.(err as Error);
              }
            }}
          >
            delete
          </button>
        </div>
      );
    }

    function seedFetch(deleteResponse: Response | (() => Promise<Response>)) {
      fetchMock.mockImplementation(
        (input: string | URL, init?: RequestInit) => {
          const url = String(input);
          if (
            init?.method === "DELETE" &&
            url.includes("/api/calendar/events/")
          ) {
            return typeof deleteResponse === "function"
              ? deleteResponse()
              : Promise.resolve(deleteResponse);
          }
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
                  baseEvent("evt-1", new Date().toISOString()),
                  baseEvent("evt-2", new Date().toISOString()),
                ],
              })
            );
          }
          return Promise.resolve(fetchOk({}));
        }
      );
    }

    it("optimistically removes the event and calls DELETE with the calendar id", async () => {
      seedFetch({
        ok: true,
        status: 204,
        json: async () => ({}),
      } as unknown as Response);

      render(
        <CalendarProvider>
          <DeleteProbe eventId="evt-1" calendarId="primary" />
        </CalendarProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("evt-1")).toBeInTheDocument();
        expect(screen.getByText("evt-2")).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText("delete"));

      await waitFor(() => {
        expect(screen.queryByText("evt-1")).not.toBeInTheDocument();
        expect(screen.getByText("evt-2")).toBeInTheDocument();
      });

      const deleteCall = fetchMock.mock.calls.find(
        ([, init]) => init?.method === "DELETE"
      );
      expect(deleteCall).toBeDefined();
      expect(String(deleteCall![0])).toContain(
        "/api/calendar/events/evt-1?calendarId=primary"
      );
    });

    it("rolls back the optimistic remove and rethrows when the API rejects", async () => {
      seedFetch({
        ok: false,
        status: 500,
        json: async () => ({ error: "Failed to delete calendar event" }),
      } as unknown as Response);

      const onError = vi.fn();

      render(
        <CalendarProvider>
          <DeleteProbe eventId="evt-1" calendarId="primary" onError={onError} />
        </CalendarProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("evt-1")).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText("delete"));

      await waitFor(() => {
        expect(onError).toHaveBeenCalledTimes(1);
      });

      // The event is back in the list because the optimistic remove rolled back.
      expect(screen.getByText("evt-1")).toBeInTheDocument();
      expect(screen.getByText("evt-2")).toBeInTheDocument();
    });

    it("treats a 204 from the API as success even when no body is returned", async () => {
      seedFetch({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error("body should not be parsed for 204");
        },
      } as unknown as Response);

      render(
        <CalendarProvider>
          <DeleteProbe eventId="evt-2" calendarId="primary" />
        </CalendarProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("evt-2")).toBeInTheDocument();
      });

      await userEvent.setup().click(screen.getByText("delete"));

      await waitFor(() => {
        expect(screen.queryByText("evt-2")).not.toBeInTheDocument();
        expect(screen.getByText("evt-1")).toBeInTheDocument();
      });
    });

    it("rollback after failure preserves any concurrent additions to the list", async () => {
      // Hold the DELETE response open so we can mutate the list mid-flight.
      let rejectDelete: ((reason: Error) => void) | undefined;
      const deletePromise = new Promise<Response>((_, reject) => {
        rejectDelete = (err) => reject(err);
      });

      function ConcurrentProbe() {
        const { events, deleteEvent, addEvent } = useCalendar();
        return (
          <div>
            <ul data-testid="concurrent-events">
              {events.map((e) => (
                <li key={e.id}>{e.title}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => {
                // Don't await — the request is held by the test.
                deleteEvent("evt-1", "primary").catch(() => {
                  /* expected */
                });
              }}
            >
              start-delete
            </button>
            <button
              type="button"
              onClick={() =>
                // Simulate a refresh landing while delete is in-flight.
                addEvent({
                  id: "fresh-evt",
                  title: "fresh-evt",
                  startDate: new Date().toISOString(),
                  endDate: new Date().toISOString(),
                  color: "blue",
                  description: "",
                  isAllDay: false,
                  calendarId: "primary",
                  user: { id: "u1", name: "Alice", picturePath: null },
                })
              }
            >
              add-fresh
            </button>
          </div>
        );
      }

      seedFetch(() => deletePromise);

      render(
        <CalendarProvider>
          <ConcurrentProbe />
        </CalendarProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("evt-1")).toBeInTheDocument();
        expect(screen.getByText("evt-2")).toBeInTheDocument();
      });

      const user = userEvent.setup();
      await user.click(screen.getByText("start-delete"));

      // evt-1 vanishes optimistically while DELETE is held open.
      await waitFor(() => {
        expect(screen.queryByText("evt-1")).not.toBeInTheDocument();
      });

      // A "refresh" lands while the DELETE is in-flight.
      await user.click(screen.getByText("add-fresh"));
      await waitFor(() => {
        expect(screen.getByText("fresh-evt")).toBeInTheDocument();
      });

      // Now fail the DELETE — rollback must restore evt-1 *without*
      // dropping the fresh event the concurrent update added.
      rejectDelete?.(new Error("boom"));

      await waitFor(() => {
        expect(screen.getByText("evt-1")).toBeInTheDocument();
      });
      expect(screen.getByText("fresh-evt")).toBeInTheDocument();
      expect(screen.getByText("evt-2")).toBeInTheDocument();
    });
  });
});
