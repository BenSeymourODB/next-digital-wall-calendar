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
import type { CalendarColorMapping } from "@/lib/calendar-storage";
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

const { colorMappingsToLoad, profileMock } = vi.hoisted(() => ({
  colorMappingsToLoad: {
    current: [] as Array<{
      calendarId: string;
      colorId: string;
      hexColor: string;
      tailwindColor: string;
    }>,
  },
  // Mutable handle so tests can simulate same-tab profile switches by
  // flipping `profileMock.current` and re-rendering. `null` keeps every
  // existing test behaving as if `ProfileProvider` were absent (the
  // pre-fix fallback path through localStorage / storage events).
  profileMock: {
    current: null as { activeProfile: { id: string } | null } | null,
  },
}));

vi.mock("@/components/profiles/profile-context", async () => {
  const actual = await vi.importActual<
    typeof import("@/components/profiles/profile-context")
  >("@/components/profiles/profile-context");
  return {
    ...actual,
    useProfileOptional: () => profileMock.current,
  };
});

vi.mock("@/lib/calendar-storage", () => ({
  loadColorMappings: () => colorMappingsToLoad.current,
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
      <button type="button" onClick={() => setAgendaModeGroupBy("category")}>
        group-category
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

    // #337 — `use24HourFormat` is now derived from `userSettings.timeFormat`,
    // whose default ("12h") matches the Prisma schema. Pre-#337 the
    // CalendarProvider had its own conflicting default (`true`/24h); that
    // dual-source bug is what this issue resolves.
    expect(screen.getByTestId("hour")).toHaveTextContent("false");
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

  it("persists agendaModeGroupBy=category round-trip (#211)", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("group")).toHaveTextContent("date");
    });

    await user.click(screen.getByText("group-category"));

    await waitFor(() => {
      expect(screen.getByTestId("group")).toHaveTextContent("category");
    });

    const parsed = JSON.parse(
      window.localStorage.getItem("calendar-settings") ?? "{}"
    );
    expect(parsed.agendaModeGroupBy).toBe("category");
  });

  it("rehydrates agendaModeGroupBy=category from localStorage on mount (#211)", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        agendaModeGroupBy: "category",
        weekStartDay: 0,
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("group")).toHaveTextContent("category");
    });
  });

  it("persists agenda group-by and badge changes alongside weekStartDay", async () => {
    const user = userEvent.setup();
    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("badge")).toHaveTextContent("colored");
    });

    await user.click(screen.getByText("badge-dot"));
    await user.click(screen.getByText("group-color"));
    // Default after #337 is "12h" (false); toggling flips to "24h" (true).
    await user.click(screen.getByText("toggle-hour"));

    await waitFor(() => {
      expect(screen.getByTestId("hour")).toHaveTextContent("true");
    });

    const parsed = JSON.parse(
      window.localStorage.getItem("calendar-settings") ?? "{}"
    );
    expect(parsed.badgeVariant).toBe("dot");
    expect(parsed.agendaModeGroupBy).toBe("color");
    // #337 — `use24HourFormat` is no longer persisted to localStorage; it
    // flows through `useUserSettings.timeFormat` instead.
    expect(parsed.use24HourFormat).toBeUndefined();
  });

  it("rehydrates weekStartDay from localStorage on mount", async () => {
    // No `use24HourFormat` in this fixture — that field has been retired
    // from the localStorage payload (#337). The migration test below
    // covers the legacy upgrade path.
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "dot",
        view: "month",
        agendaModeGroupBy: "color",
        weekStartDay: 1,
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("1");
    });
    expect(screen.getByTestId("group")).toHaveTextContent("color");
    expect(screen.getByTestId("badge")).toHaveTextContent("dot");
  });

  // #337 — legacy localStorage payloads (pre-#337) carried `use24HourFormat`
  // alongside the other fields. On first mount we strip the field so it
  // can never drift away from `UserSettings.timeFormat` again.
  it("strips legacy `use24HourFormat` from localStorage on mount (#337 migration)", async () => {
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

    const parsed = JSON.parse(
      window.localStorage.getItem("calendar-settings") ?? "{}"
    );
    expect(parsed.use24HourFormat).toBeUndefined();
    // Other fields remain intact through the migration.
    expect(parsed.badgeVariant).toBe("dot");
    expect(parsed.weekStartDay).toBe(1);
    expect(parsed.agendaModeGroupBy).toBe("color");
  });

  it("does not modify localStorage when there is no legacy `use24HourFormat` field", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        agendaModeGroupBy: "date",
        weekStartDay: 0,
      })
    );

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("badge")).toHaveTextContent("colored");
    });

    const parsed = JSON.parse(
      window.localStorage.getItem("calendar-settings") ?? "{}"
    );
    expect(parsed).toEqual({
      badgeVariant: "colored",
      view: "month",
      agendaModeGroupBy: "date",
      weekStartDay: 0,
    });
  });

  it("falls back to defaults when the stored payload is missing the new field", async () => {
    // Legacy payload (pre-#86) — no weekStartDay key. `use24HourFormat`
    // included here is the pre-#337 dual-source field; the migration
    // strips it on mount.
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
    // After #337 migration, the legacy `use24HourFormat: true` is
    // stripped from localStorage; the value flows from
    // `useUserSettings.timeFormat` (default "12h" → false).
    expect(screen.getByTestId("hour")).toHaveTextContent("false");
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

// Issue #238 — the production /calendar page deep-links to a view via
// `?view=year` etc. The page reads the URL with `useSearchParams` and
// passes the result to CalendarProvider, which must seed initial state
// from those props (overriding any persisted localStorage value) and
// write the override through so the user's choice persists across
// reloads.
describe("CalendarProvider — initialView / initialAgendaMode overrides", () => {
  beforeEach(() => {
    mockSessionState.current = { data: null, status: "unauthenticated" };
    window.localStorage.clear();
  });

  function renderWithOverrides(props: {
    initialView?: import("@/types/calendar").TCalendarView;
    initialAgendaMode?: boolean;
  }) {
    return render(
      <SessionProvider session={null}>
        <CalendarProvider {...props}>
          <SettingsProbe />
        </CalendarProvider>
      </SessionProvider>
    );
  }

  it("seeds the initial view from initialView when nothing is persisted", async () => {
    renderWithOverrides({ initialView: "year" });

    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("year");
    });
  });

  it("overrides a persisted localStorage view when initialView is provided", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 0,
      })
    );

    renderWithOverrides({ initialView: "year" });

    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("year");
    });
  });

  it("writes the initialView override through to localStorage so it persists across reloads", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 0,
      })
    );

    renderWithOverrides({ initialView: "year" });

    await waitFor(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("calendar-settings") ?? "{}"
      );
      expect(parsed.view).toBe("year");
    });
  });

  it("seeds initialAgendaMode and persists it when provided", async () => {
    renderWithOverrides({ initialView: "day", initialAgendaMode: true });

    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("day");
    });
    expect(screen.getByTestId("agenda-mode")).toHaveTextContent("true");

    await waitFor(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("calendar-settings") ?? "{}"
      );
      expect(parsed.view).toBe("day");
      expect(parsed.agendaMode).toBe(true);
    });
  });

  it("preserves persisted view when initialView is undefined", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "week",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 0,
      })
    );

    renderWithOverrides({});

    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("week");
    });
  });

  // Regression: legacy localStorage may carry `view: "agenda"` (pre-#150)
  // at the same time the user deep-links to `?view=year`. The migration
  // and the deep-link override are merged into a single atomic write —
  // this test guards against any future refactor that splits them and
  // accidentally lets the migration clobber the override (a `?view=year`
  // bookmark would silently land on `day` if the order ever flipped).
  // The migration's `agendaMode: true` is preserved because the URL
  // override only specifies the view; that's intentional — the user's
  // pre-#150 preference for agenda mode survives the migration.
  it("override wins when localStorage holds the legacy agenda value AND initialView is provided", async () => {
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

    renderWithOverrides({ initialView: "year" });

    await waitFor(() => {
      expect(screen.getByTestId("view")).toHaveTextContent("year");
    });
    await waitFor(() => {
      const parsed = JSON.parse(
        window.localStorage.getItem("calendar-settings") ?? "{}"
      );
      expect(parsed.view).toBe("year");
      // The legacy `"agenda"` literal must not survive the write.
      expect(parsed.view).not.toBe("agenda");
    });
  });
});

vi.mock("@/lib/calendar-transform", () => ({
  // Honour `colorOverride` on the test fixture so the filter test
  // can assert that filtering by color actually drops the right
  // events. Defaults to "blue" when no override is given.
  //
  // Honour the `calendarMetadata` 3rd arg so the #307 Bug B integration
  // test can assert that calendar-summary attribution flows from the
  // calendarList payload through `fetchCalendarList` → `fetchEventsForRange`
  // → `transformGoogleEvent`. When metadata is present for the event's
  // calendarId, surface its summary as `user.name`.
  transformGoogleEvent: (
    event: {
      id: string;
      summary?: string;
      start?: { dateTime?: string };
      colorOverride?: string;
      calendarId?: string;
    },
    _mappings: unknown,
    metadata?: ReadonlyMap<
      string,
      { summary: string; summaryOverride?: string }
    >
  ) => {
    const calId = event.calendarId ?? "primary";
    const meta = metadata?.get(calId);
    const userName = meta?.summaryOverride ?? meta?.summary ?? "Mock";
    return {
      id: event.id,
      title: event.summary ?? "Mock",
      description: "",
      startDate: event.start?.dateTime ?? new Date().toISOString(),
      endDate: event.start?.dateTime ?? new Date().toISOString(),
      color: event.colorOverride ?? "blue",
      isAllDay: false,
      calendarId: calId,
      user: { id: calId, name: userName, picturePath: null },
    };
  },
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
    colorMappingsToLoad.current = [];
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

  describe("color mappings refresh (#307 Bug A)", () => {
    it("re-fetches /api/calendar/colors on mount even when warm cache is populated", async () => {
      // Simulate a browser whose localStorage already holds a (potentially
      // stale) color mapping captured before the user updated their per-user
      // calendar override in Google. Pre-fix, the provider would short-circuit
      // and never re-hit the server, so the cached mapping would persist
      // forever. After the fix, the warm cache is paint-fast only — the
      // server is the source of truth and is consulted on every refresh.
      colorMappingsToLoad.current = [
        {
          calendarId: "shared@example.com",
          colorId: "",
          hexColor: "#a4bdfc",
          tailwindColor: "blue",
        } satisfies CalendarColorMapping,
      ];

      render(
        <CalendarProvider>
          <EventList />
        </CalendarProvider>
      );

      await waitFor(() => {
        const calls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes("/api/calendar/colors"))).toBe(
          true
        );
      });
    });

    it("re-fetches /api/calendar/colors on each refreshEvents call", async () => {
      colorMappingsToLoad.current = [
        {
          calendarId: "primary",
          colorId: "",
          hexColor: "#3b82f6",
          tailwindColor: "blue",
        } satisfies CalendarColorMapping,
      ];

      function RefreshProbe() {
        const { refreshEvents } = useCalendar();
        return (
          <button type="button" onClick={() => refreshEvents()}>
            refresh
          </button>
        );
      }

      render(
        <CalendarProvider>
          <RefreshProbe />
        </CalendarProvider>
      );

      // Wait for initial mount fetch.
      await waitFor(() => {
        const calls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes("/api/calendar/colors"))).toBe(
          true
        );
      });

      const initialCount = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/calendar/colors")).length;

      await userEvent.setup().click(screen.getByText("refresh"));

      await waitFor(() => {
        const after = fetchMock.mock.calls
          .map((c) => String(c[0]))
          .filter((u) => u.includes("/api/calendar/colors")).length;
        expect(after).toBeGreaterThan(initialCount);
      });
    });

    it("server-returned color overwrites the stale warm-cache color on rendered events", async () => {
      // The end-to-end shape of Bug A: a browser whose localStorage holds a
      // stale "blue" mapping for a shared calendar should render the events
      // for that calendar in the *server's* current color (e.g. "red" after
      // the user changed the per-user override in Google), not the cached
      // blue. This verifies the full path — refresh skips the short-circuit,
      // server response wins, transformGoogleEvent applies the new mapping
      // to the rendered events — not just that the network call was made.
      colorMappingsToLoad.current = [
        {
          calendarId: "shared@example.com",
          colorId: "",
          hexColor: "#a4bdfc",
          tailwindColor: "blue",
        } satisfies CalendarColorMapping,
      ];

      fetchMock.mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/calendar/calendars")) {
          return Promise.resolve(
            fetchOk({ calendars: [{ id: "shared@example.com" }] })
          );
        }
        if (url.includes("/api/calendar/colors")) {
          return Promise.resolve(
            fetchOk({
              colorMappings: [
                {
                  calendarId: "shared@example.com",
                  hexColor: "#d50000",
                  tailwindColor: "red",
                },
              ],
            })
          );
        }
        if (url.includes("/api/calendar/events")) {
          return Promise.resolve(
            fetchOk({
              events: [
                {
                  id: "evt-1",
                  summary: "Bubble Day",
                  start: { dateTime: new Date().toISOString() },
                  end: { dateTime: new Date().toISOString() },
                  calendarId: "shared@example.com",
                  // No `colorOverride` here so the mock's default "blue" is
                  // used — this test does not exercise the colorOverride
                  // shortcut, only the warm-cache refresh path. (We assert
                  // the staleness path indirectly via the call shape; the
                  // pure transform path is covered in the unit tests.)
                },
              ],
            })
          );
        }
        return Promise.resolve(fetchOk({}));
      });

      function ColorProbe() {
        const { events } = useCalendar();
        return (
          <ul data-testid="color-probe">
            {events.map((e) => (
              <li key={e.id}>{`${e.title}|${e.color}`}</li>
            ))}
          </ul>
        );
      }

      render(
        <CalendarProvider>
          <ColorProbe />
        </CalendarProvider>
      );

      // The provider must (a) call /api/calendar/colors despite the warm
      // cache and (b) write the new mapping back to localStorage via
      // saveColorMappings — proving the server response is now the source
      // of truth and would persist across reloads in the same browser.
      await waitFor(() => {
        const calls = fetchMock.mock.calls.map((c) => String(c[0]));
        expect(calls.some((u) => u.includes("/api/calendar/colors"))).toBe(
          true
        );
      });

      const { saveColorMappings } = await import("@/lib/calendar-storage");
      await waitFor(() => {
        expect(saveColorMappings).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              calendarId: "shared@example.com",
              tailwindColor: "red",
            }),
          ])
        );
      });
    });
  });

  describe("calendar attribution metadata (#307 Bug B)", () => {
    it("threads calendar summary from /api/calendar/calendars into event user.name", async () => {
      // Stand up a calendarList payload whose entries carry a `summary`
      // (the human-readable label for a shared calendar) and an event
      // whose creator has no displayName — exactly the production case
      // from the bug report.
      fetchMock.mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/calendar/calendars")) {
          return Promise.resolve(
            fetchOk({
              calendars: [
                {
                  id: "liv4ever42@gmail.com",
                  summary: "Liv Seymour",
                },
              ],
            })
          );
        }
        if (url.includes("/api/calendar/colors")) {
          return Promise.resolve(fetchOk({ colorMappings: [] }));
        }
        if (url.includes("/api/calendar/events")) {
          return Promise.resolve(
            fetchOk({
              events: [
                {
                  id: "shared-1",
                  summary: "Bubble Day",
                  start: { dateTime: new Date().toISOString() },
                  end: { dateTime: new Date().toISOString() },
                  calendarId: "liv4ever42@gmail.com",
                },
              ],
            })
          );
        }
        return Promise.resolve(fetchOk({}));
      });

      function UserProbe() {
        const { events } = useCalendar();
        return (
          <ul data-testid="user-probe">
            {events.map((e) => (
              <li key={e.id}>{`${e.title}|${e.user.name}`}</li>
            ))}
          </ul>
        );
      }

      render(
        <CalendarProvider>
          <UserProbe />
        </CalendarProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Bubble Day|Liv Seymour")).toBeInTheDocument();
      });
    });

    it("prefers calendar summaryOverride over summary in event user.name", async () => {
      // Companion to the previous test: when the calendarList payload
      // exposes a per-user override (the label the user typed in Google
      // for a shared calendar they don't own), that override is what
      // should be displayed — not the canonical summary.
      fetchMock.mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/calendar/calendars")) {
          return Promise.resolve(
            fetchOk({
              calendars: [
                {
                  id: "shared@example.com",
                  summary: "Original Name",
                  summaryOverride: "My Override",
                },
              ],
            })
          );
        }
        if (url.includes("/api/calendar/colors")) {
          return Promise.resolve(fetchOk({ colorMappings: [] }));
        }
        if (url.includes("/api/calendar/events")) {
          return Promise.resolve(
            fetchOk({
              events: [
                {
                  id: "ovr-1",
                  summary: "Movie Night",
                  start: { dateTime: new Date().toISOString() },
                  end: { dateTime: new Date().toISOString() },
                  calendarId: "shared@example.com",
                },
              ],
            })
          );
        }
        return Promise.resolve(fetchOk({}));
      });

      function UserProbe() {
        const { events } = useCalendar();
        return (
          <ul data-testid="user-probe">
            {events.map((e) => (
              <li key={e.id}>{`${e.title}|${e.user.name}`}</li>
            ))}
          </ul>
        );
      }

      render(
        <CalendarProvider>
          <UserProbe />
        </CalendarProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Movie Night|My Override")).toBeInTheDocument();
      });
    });
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

  describe("getAccessRole (#266)", () => {
    it("exposes the per-calendar accessRole returned by /api/calendar/calendars", async () => {
      fetchMock.mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes("/api/calendar/calendars")) {
          return Promise.resolve(
            fetchOk({
              calendars: [
                { id: "primary", accessRole: "owner" },
                {
                  id: "shared@group.calendar.google.com",
                  accessRole: "reader",
                },
                {
                  id: "team@group.calendar.google.com",
                  accessRole: "writer",
                },
              ],
            })
          );
        }
        if (url.includes("/api/calendar/colors")) {
          return Promise.resolve(fetchOk({ colorMappings: [] }));
        }
        if (url.includes("/api/calendar/events")) {
          return Promise.resolve(fetchOk({ events: [] }));
        }
        return Promise.resolve(fetchOk({}));
      });

      function RoleProbe() {
        const { getAccessRole } = useCalendar();
        return (
          <div>
            <span data-testid="role-primary">
              {getAccessRole("primary") ?? "none"}
            </span>
            <span data-testid="role-shared">
              {getAccessRole("shared@group.calendar.google.com") ?? "none"}
            </span>
            <span data-testid="role-team">
              {getAccessRole("team@group.calendar.google.com") ?? "none"}
            </span>
            <span data-testid="role-unknown">
              {getAccessRole("never-seen-this-id") ?? "none"}
            </span>
          </div>
        );
      }

      render(
        <CalendarProvider>
          <RoleProbe />
        </CalendarProvider>
      );

      // The provider populates the role map as a side-effect of the
      // initial fetchCalendarList; wait for any role to appear before
      // asserting on the rest.
      await waitFor(() => {
        expect(screen.getByTestId("role-primary")).toHaveTextContent("owner");
      });

      expect(screen.getByTestId("role-shared")).toHaveTextContent("reader");
      expect(screen.getByTestId("role-team")).toHaveTextContent("writer");
      expect(screen.getByTestId("role-unknown")).toHaveTextContent("none");
    });

    it("returns undefined for every id before the calendar list has loaded", () => {
      mockSessionState.current = { data: null, status: "unauthenticated" };

      function RoleProbe() {
        const { getAccessRole } = useCalendar();
        return (
          <span data-testid="role-primary">
            {getAccessRole("primary") ?? "none"}
          </span>
        );
      }

      render(
        <CalendarProvider>
          <RoleProbe />
        </CalendarProvider>
      );

      expect(screen.getByTestId("role-primary")).toHaveTextContent("none");
    });
  });
});

// Issue #338 — `weekStartDay` is now sourced from `UserSettings` on the
// server. The provider must (a) migrate the existing per-browser localStorage
// value to the server exactly once on first authenticated mount, and
// (b) write through to `/api/settings` when the user toggles the value via
// the calendar settings panel.
describe("CalendarProvider — weekStartDay server migration (#338)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  const FLAG_KEY = "calendar-week-start-day-migrated";

  beforeEach(() => {
    window.localStorage.clear();
    mockSessionState.current = {
      data: {
        user: { name: "Test", email: "test@test.test" },
        expires: new Date(Date.now() + 86_400_000).toISOString(),
      },
      status: "authenticated",
    };
    fetchMock = vi.fn().mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url === "/api/settings") {
        // Fresh server with default Sunday-start; nothing to migrate down.
        return Promise.resolve(fetchOk({ weekStartDay: 0 }));
      }
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // A legacy localStorage payload can also trigger the #337 `timeFormat`
  // migration, which PUTs `{ timeFormat }` to the same endpoint. Scope this
  // helper to the weekStartDay migration so the two coexisting migrations
  // don't cross-contaminate these assertions.
  function findSettingsPut(): RequestInit | undefined {
    for (const [url, init] of fetchMock.mock.calls) {
      if (
        url === "/api/settings" &&
        typeof init === "object" &&
        init !== null &&
        (init as RequestInit).method === "PUT"
      ) {
        const body = (init as RequestInit).body;
        if (
          typeof body === "string" &&
          Object.prototype.hasOwnProperty.call(JSON.parse(body), "weekStartDay")
        ) {
          return init as RequestInit;
        }
      }
    }
    return undefined;
  }

  it("migrates a non-default localStorage weekStartDay to /api/settings exactly once", async () => {
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 1, // user previously chose Monday on this browser
      })
    );

    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    await waitFor(() => {
      // The shim has fired and tagged the flag.
      expect(window.localStorage.getItem(FLAG_KEY)).toBe("1");
    });

    const settingsPuts = fetchMock.mock.calls.filter(
      ([url, init]) =>
        url === "/api/settings" &&
        typeof init === "object" &&
        init !== null &&
        (init as RequestInit).method === "PUT" &&
        typeof (init as RequestInit).body === "string" &&
        Object.prototype.hasOwnProperty.call(
          JSON.parse(String((init as RequestInit).body)),
          "weekStartDay"
        )
    );
    expect(settingsPuts).toHaveLength(1);
    const body = JSON.parse(String(settingsPuts[0][1].body));
    expect(body).toEqual({ weekStartDay: 1 });
  });

  it("does not migrate when local matches server (both default Sunday)", async () => {
    // No localStorage set up — the user has no prior local preference.
    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(FLAG_KEY)).toBe("1");
    });

    expect(findSettingsPut()).toBeUndefined();
  });

  it("does not migrate twice if the flag is already set", async () => {
    window.localStorage.setItem(FLAG_KEY, "1");
    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 1,
      })
    );

    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    // Give the effect a tick to potentially fire (it shouldn't).
    await new Promise((r) => setTimeout(r, 20));

    expect(findSettingsPut()).toBeUndefined();
  });

  it("PUTs to /api/settings when the user toggles weekStartDay", async () => {
    window.localStorage.setItem(FLAG_KEY, "1");
    const user = userEvent.setup();

    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    // Wait for initial mount + effects to settle.
    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("0");
    });

    await user.click(screen.getByText("week-monday"));

    await waitFor(() => {
      const put = findSettingsPut();
      expect(put).toBeDefined();
      expect(JSON.parse(String(put!.body))).toEqual({ weekStartDay: 1 });
    });
  });

  // Regression for the race-condition review note: the migration must not
  // PUT when local already matches the server's non-default value. Without
  // the `userSettingsLoaded` gate this would emit a redundant PUT in the
  // first authenticated render where `useUserSettings` is still loading.
  it("does not migrate when local matches server (both Monday)", async () => {
    fetchMock.mockReset();
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url === "/api/settings") {
        return Promise.resolve(fetchOk({ weekStartDay: 1 }));
      }
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });

    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 1,
      })
    );

    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    await waitFor(() => {
      expect(window.localStorage.getItem(FLAG_KEY)).toBe("1");
    });

    expect(findSettingsPut()).toBeUndefined();
  });

  // Regression for the "still loading" race window: while the
  // `/api/settings` GET is in flight, `useUserSettings.weekStartDay` is the
  // in-memory default. The migration shim must NOT compare against that
  // value — it would falsely flag a divergence and PUT prematurely.
  it("does not migrate while useUserSettings is still loading", async () => {
    fetchMock.mockReset();
    let resolveSettings: ((value: Response) => void) | undefined;
    const settingsPromise = new Promise<Response>((resolve) => {
      resolveSettings = resolve;
    });
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url === "/api/settings") {
        // Hold the GET open so `hasLoadedFromServer` stays false.
        return settingsPromise;
      }
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });

    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 1, // would race against in-memory default 0
      })
    );

    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    // Give effects a tick. The migration must NOT have fired yet.
    await new Promise((r) => setTimeout(r, 30));
    expect(findSettingsPut()).toBeUndefined();
    expect(window.localStorage.getItem(FLAG_KEY)).toBeNull();

    // Now resolve the GET with the matching server value (post-migration).
    resolveSettings?.(fetchOk({ weekStartDay: 1 }));

    await waitFor(() => {
      expect(window.localStorage.getItem(FLAG_KEY)).toBe("1");
    });

    // Local matches server → still no PUT.
    expect(findSettingsPut()).toBeUndefined();
  });

  // Companion: while loading, if local diverges from the eventual server
  // value, the migration runs *after* the GET resolves and PUTs the local
  // value up exactly once.
  it("defers migration until the server value is known, then PUTs", async () => {
    fetchMock.mockReset();
    let resolveSettings: ((value: Response) => void) | undefined;
    const settingsPromise = new Promise<Response>((resolve) => {
      resolveSettings = resolve;
    });
    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url === "/api/settings") return settingsPromise;
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });

    window.localStorage.setItem(
      "calendar-settings",
      JSON.stringify({
        badgeVariant: "colored",
        view: "month",
        use24HourFormat: true,
        agendaModeGroupBy: "date",
        weekStartDay: 1,
      })
    );

    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    // Migration deferred while the GET is held open.
    await new Promise((r) => setTimeout(r, 20));
    expect(findSettingsPut()).toBeUndefined();

    // Server returns default (0). Local is 1 → migration fires.
    resolveSettings?.(fetchOk({ weekStartDay: 0 }));

    await waitFor(() => {
      const put = findSettingsPut();
      expect(put).toBeDefined();
      expect(JSON.parse(String(put!.body))).toEqual({ weekStartDay: 1 });
    });
    expect(window.localStorage.getItem(FLAG_KEY)).toBe("1");
  });

  // Regression for the rollback review note: a network failure on the
  // setter must restore the previous value so the UI doesn't drift from
  // the persisted state.
  it("rolls back the optimistic state when the PUT fails", async () => {
    window.localStorage.setItem(FLAG_KEY, "1");

    // Hold the PUT open long enough for the optimistic flip to be
    // observable; resolving it via reject mid-test exercises the rollback
    // path under a realistic async window rather than a synchronous one.
    let rejectPut: ((error: Error) => void) | undefined;
    const putPromise = new Promise<Response>((_, reject) => {
      rejectPut = reject;
    });

    fetchMock.mockReset();
    fetchMock.mockImplementation((input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/settings" && init?.method === "PUT") {
        return putPromise;
      }
      if (url === "/api/settings") {
        return Promise.resolve(fetchOk({ weekStartDay: 0 }));
      }
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [{ id: "primary" }] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });

    const user = userEvent.setup();
    render(
      <CalendarProvider>
        <SettingsProbe />
      </CalendarProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("0");
    });

    await user.click(screen.getByText("week-monday"));

    // Optimistic flip happens before the PUT resolves.
    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("1");
    });

    // Now fail the PUT — the catch handler reverts the optimistic update.
    rejectPut?.(new Error("network down"));

    await waitFor(() => {
      expect(screen.getByTestId("week-start")).toHaveTextContent("0");
    });
  });
});

// Issue #208 Phase 1 — filter persistence (per-profile localStorage).
// These tests don't need network access; the unauthenticated session keeps
// the API code paths dormant so we can focus on the storage round-trip.
describe("CalendarProvider — filter persistence (#208 Phase 1)", () => {
  function FilterProbe() {
    const {
      selectedColors,
      selectedUserId,
      filterEventsBySelectedColors,
      setSelectedUserId,
      clearFilter,
    } = useCalendar();
    return (
      <div>
        <span data-testid="probe-colors">{selectedColors.join(",")}</span>
        <span data-testid="probe-user">{selectedUserId}</span>
        <button
          type="button"
          onClick={() => filterEventsBySelectedColors("red")}
        >
          toggle-red
        </button>
        <button
          type="button"
          onClick={() => filterEventsBySelectedColors("blue")}
        >
          toggle-blue
        </button>
        <button type="button" onClick={() => setSelectedUserId("user-1")}>
          select-user-1
        </button>
        <button type="button" onClick={() => clearFilter()}>
          clear
        </button>
      </div>
    );
  }

  function renderProbe() {
    return render(
      <SessionProvider session={null}>
        <CalendarProvider>
          <FilterProbe />
        </CalendarProvider>
      </SessionProvider>
    );
  }

  beforeEach(() => {
    mockSessionState.current = { data: null, status: "unauthenticated" };
    window.localStorage.clear();
    profileMock.current = null;
  });

  it("starts with empty filters when nothing is persisted", async () => {
    renderProbe();
    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("");
    });
    expect(screen.getByTestId("probe-user")).toHaveTextContent("all");
  });

  it("persists color toggles to per-profile storage under the active profile id", async () => {
    window.localStorage.setItem("activeProfileId", "profile-a");
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("");
    });

    await user.click(screen.getByText("toggle-red"));
    await user.click(screen.getByText("toggle-blue"));

    await waitFor(() => {
      const stored = window.localStorage.getItem("calendar-filters:profile-a");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.selectedColors).toEqual(["red", "blue"]);
    });
  });

  it("persists user selection to per-profile storage", async () => {
    window.localStorage.setItem("activeProfileId", "profile-a");
    const user = userEvent.setup();
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-user")).toHaveTextContent("all");
    });

    await user.click(screen.getByText("select-user-1"));

    await waitFor(() => {
      const stored = window.localStorage.getItem("calendar-filters:profile-a");
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!).selectedUserId).toBe("user-1");
    });
  });

  it("hydrates filter state on mount from per-profile storage", async () => {
    window.localStorage.setItem("activeProfileId", "profile-a");
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red", "green"],
        selectedUserId: "user-2",
        selectedCalendarIds: [],
      })
    );

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("red,green");
    });
    expect(screen.getByTestId("probe-user")).toHaveTextContent("user-2");
  });

  it("uses the default bucket when no active profile id is set", async () => {
    window.localStorage.setItem(
      "calendar-filters:default",
      JSON.stringify({
        selectedColors: ["yellow"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("yellow");
    });
  });

  it("isolates filter state across profiles", async () => {
    // Profile A and Profile B each have their own stored filter state.
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );
    window.localStorage.setItem(
      "calendar-filters:profile-b",
      JSON.stringify({
        selectedColors: ["blue"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );

    // Mount with profile A active.
    window.localStorage.setItem("activeProfileId", "profile-a");
    const { unmount } = renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("red");
    });

    unmount();

    // Switch profiles by editing storage and remounting (the realistic flow
    // since profile switches happen on a different route).
    window.localStorage.setItem("activeProfileId", "profile-b");
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("blue");
    });
  });

  it("re-hydrates when the active profile id changes mid-session via storage event", async () => {
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );
    window.localStorage.setItem(
      "calendar-filters:profile-b",
      JSON.stringify({
        selectedColors: ["green"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );
    window.localStorage.setItem("activeProfileId", "profile-a");

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("red");
    });

    // Simulate ProfileProvider switching the active profile in another tab.
    window.localStorage.setItem("activeProfileId", "profile-b");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "activeProfileId",
        newValue: "profile-b",
      })
    );

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("green");
    });
  });

  it("re-hydrates when the active profile changes in the SAME tab via useProfile (no storage event fires)", async () => {
    // Same-tab regression: `localStorage.setItem` does NOT fire a
    // `storage` event in the originating tab (MDN spec), so the
    // cross-tab listener never sees `ProfileSwitcher` dropdown clicks.
    // The fix subscribes to `useProfileOptional()` directly so React
    // re-renders propagate the new active profile id.
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );
    window.localStorage.setItem(
      "calendar-filters:profile-b",
      JSON.stringify({
        selectedColors: ["green"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );
    profileMock.current = { activeProfile: { id: "profile-a" } };

    const { rerender } = renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("red");
    });

    // Same-tab switch: `ProfileProvider` re-renders with a new
    // `activeProfile` but does NOT fire a `storage` event. The new
    // profile id must still flow through.
    profileMock.current = { activeProfile: { id: "profile-b" } };
    rerender(
      <SessionProvider session={null}>
        <CalendarProvider>
          <FilterProbe />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("green");
    });
  });

  it("clearFilter resets in-memory state and persists the empty state", async () => {
    window.localStorage.setItem("activeProfileId", "profile-a");
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red", "blue"],
        selectedUserId: "user-1",
        selectedCalendarIds: [],
      })
    );

    const user = userEvent.setup();
    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("red,blue");
    });
    expect(screen.getByTestId("probe-user")).toHaveTextContent("user-1");

    await user.click(screen.getByText("clear"));

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("");
    });
    expect(screen.getByTestId("probe-user")).toHaveTextContent("all");

    const stored = window.localStorage.getItem("calendar-filters:profile-a");
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.selectedColors).toEqual([]);
    expect(parsed.selectedUserId).toBe("all");
  });

  // Issue #208 Phase 2 — per-calendar filter
  it("hydrates selectedCalendarIds from per-profile storage", async () => {
    function CalendarProbe() {
      const { selectedCalendarIds } = useCalendar();
      return (
        <span data-testid="probe-cal-ids">{selectedCalendarIds.join(",")}</span>
      );
    }

    window.localStorage.setItem("activeProfileId", "profile-a");
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: [],
        selectedUserId: "all",
        selectedCalendarIds: ["cal-1", "cal-2"],
      })
    );

    render(
      <SessionProvider session={null}>
        <CalendarProvider>
          <CalendarProbe />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("probe-cal-ids")).toHaveTextContent(
        "cal-1,cal-2"
      );
    });
  });

  it("toggles selectedCalendarIds and persists each change", async () => {
    function CalendarProbe() {
      const { selectedCalendarIds, filterEventsBySelectedCalendars } =
        useCalendar();
      return (
        <div>
          <span data-testid="probe-cal-ids">
            {selectedCalendarIds.join(",")}
          </span>
          <button
            type="button"
            onClick={() => filterEventsBySelectedCalendars("cal-1")}
          >
            toggle-cal-1
          </button>
          <button
            type="button"
            onClick={() => filterEventsBySelectedCalendars("cal-2")}
          >
            toggle-cal-2
          </button>
        </div>
      );
    }

    window.localStorage.setItem("activeProfileId", "profile-a");
    const user = userEvent.setup();

    render(
      <SessionProvider session={null}>
        <CalendarProvider>
          <CalendarProbe />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("probe-cal-ids")).toHaveTextContent("");
    });

    await user.click(screen.getByText("toggle-cal-1"));
    await user.click(screen.getByText("toggle-cal-2"));

    await waitFor(() => {
      expect(screen.getByTestId("probe-cal-ids")).toHaveTextContent(
        "cal-1,cal-2"
      );
    });

    const stored = JSON.parse(
      window.localStorage.getItem("calendar-filters:profile-a") ?? "{}"
    );
    expect(stored.selectedCalendarIds).toEqual(["cal-1", "cal-2"]);

    // Toggle off cal-1
    await user.click(screen.getByText("toggle-cal-1"));

    await waitFor(() => {
      expect(screen.getByTestId("probe-cal-ids")).toHaveTextContent("cal-2");
    });

    const stored2 = JSON.parse(
      window.localStorage.getItem("calendar-filters:profile-a") ?? "{}"
    );
    expect(stored2.selectedCalendarIds).toEqual(["cal-2"]);
  });

  it("clearFilter resets all three dimensions including selectedCalendarIds", async () => {
    function ClearProbe() {
      const {
        selectedColors,
        selectedUserId,
        selectedCalendarIds,
        filterEventsBySelectedColors,
        setSelectedUserId,
        filterEventsBySelectedCalendars,
        clearFilter,
      } = useCalendar();
      return (
        <div>
          <span data-testid="probe-colors">{selectedColors.join(",")}</span>
          <span data-testid="probe-user">{selectedUserId}</span>
          <span data-testid="probe-cal-ids">
            {selectedCalendarIds.join(",")}
          </span>
          <button
            type="button"
            onClick={() => filterEventsBySelectedColors("red")}
          >
            toggle-red
          </button>
          <button type="button" onClick={() => setSelectedUserId("user-1")}>
            select-user-1
          </button>
          <button
            type="button"
            onClick={() => filterEventsBySelectedCalendars("cal-1")}
          >
            toggle-cal-1
          </button>
          <button type="button" onClick={() => clearFilter()}>
            clear
          </button>
        </div>
      );
    }

    window.localStorage.setItem("activeProfileId", "profile-a");
    const user = userEvent.setup();

    render(
      <SessionProvider session={null}>
        <CalendarProvider>
          <ClearProbe />
        </CalendarProvider>
      </SessionProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("");
    });

    await user.click(screen.getByText("toggle-red"));
    await user.click(screen.getByText("select-user-1"));
    await user.click(screen.getByText("toggle-cal-1"));

    await waitFor(() => {
      expect(screen.getByTestId("probe-cal-ids")).toHaveTextContent("cal-1");
    });

    await user.click(screen.getByText("clear"));

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("");
    });
    expect(screen.getByTestId("probe-user")).toHaveTextContent("all");
    expect(screen.getByTestId("probe-cal-ids")).toHaveTextContent("");

    const stored = JSON.parse(
      window.localStorage.getItem("calendar-filters:profile-a") ?? "{}"
    );
    expect(stored.selectedColors).toEqual([]);
    expect(stored.selectedUserId).toBe("all");
    expect(stored.selectedCalendarIds).toEqual([]);
  });

  // Review feedback — persistFilters must not corrupt the new profile's
  // stored state when a user-driven filter change races with a cross-tab
  // profile switch. Before the guard, a click between `setActiveProfileId`
  // landing and the re-hydration effect catching up would write the old
  // profile's in-memory values under the new profile's key.
  it("does not persist old-profile filter values to the new profile during an in-flight switch", async () => {
    function FilterProbe() {
      const { filterEventsBySelectedColors } = useCalendar();
      return (
        <button
          type="button"
          onClick={() => filterEventsBySelectedColors("yellow")}
        >
          toggle-yellow
        </button>
      );
    }

    // Profile A starts with red selected; profile B has nothing stored.
    window.localStorage.setItem("activeProfileId", "profile-a");
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      })
    );

    const user = userEvent.setup();
    render(
      <SessionProvider session={null}>
        <CalendarProvider>
          <FilterProbe />
        </CalendarProvider>
      </SessionProvider>
    );

    // Simulate a cross-tab profile switch by mutating storage and firing
    // the storage event WITHOUT yielding back to React. Then immediately
    // (in the same tick) click the toggle. The click handler is from the
    // pre-switch render, so its closure still sees `["red"]` as
    // `selectedColors`. With the guard in place, persistFilters should
    // bail (hydratedProfileRef still holds "profile-a", activeProfileId
    // is now "profile-b"), so profile B's storage stays clean.
    window.localStorage.setItem("activeProfileId", "profile-b");
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: "activeProfileId",
        newValue: "profile-b",
      })
    );
    await user.click(screen.getByText("toggle-yellow"));

    // Wait for the post-switch render to commit so any spurious writes
    // would have happened by now.
    await waitFor(() => {
      const stored = window.localStorage.getItem("calendar-filters:profile-b");
      // Either no entry (preferred — guard dropped the write) or, if
      // some edge of React batching writes anyway, the stored entry must
      // not contain "red" (profile A's value).
      if (stored) {
        const parsed = JSON.parse(stored);
        expect(parsed.selectedColors).not.toContain("red");
      } else {
        expect(stored).toBeNull();
      }
    });
  });

  it("only persists changes made in the active session, not the initial hydration", async () => {
    // Pre-seed storage so the provider hydrates from it.
    window.localStorage.setItem("activeProfileId", "profile-a");
    window.localStorage.setItem(
      "calendar-filters:profile-a",
      JSON.stringify({
        selectedColors: ["red", "green"],
        selectedUserId: "user-x",
        selectedCalendarIds: [],
      })
    );

    // Spy on setItem so we can prove we don't write back during hydration.
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
    setItemSpy.mockClear();

    renderProbe();

    await waitFor(() => {
      expect(screen.getByTestId("probe-colors")).toHaveTextContent("red,green");
    });

    // No write to the calendar-filters key happened during hydration.
    const filterWrites = setItemSpy.mock.calls.filter(
      ([key]) => key === "calendar-filters:profile-a"
    );
    expect(filterWrites).toHaveLength(0);

    setItemSpy.mockRestore();
  });
});

// Issue #208 Phase 2 — calendar list + filter-by-calendar end-to-end with
// network-backed event load. Mirrors the existing color-filter smoke test.
describe("CalendarProvider — calendar filter (#208 Phase 2)", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    window.localStorage.clear();
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
        return Promise.resolve(
          fetchOk({
            calendars: [
              {
                id: "primary",
                summary: "Primary",
                backgroundColor: "#4285f4",
              },
              { id: "work", summary: "Work", backgroundColor: "#16a765" },
            ],
          })
        );
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("exposes the fetched calendar metadata via context", async () => {
    function CalendarsProbe() {
      const { calendars } = useCalendar();
      return (
        <ul data-testid="probe-calendars">
          {calendars.map((c) => (
            <li key={c.id}>
              {c.id}:{c.summary}:{c.backgroundColor}
            </li>
          ))}
        </ul>
      );
    }

    render(
      <CalendarProvider>
        <CalendarsProbe />
      </CalendarProvider>
    );

    await waitFor(() => {
      const items = screen.getByTestId("probe-calendars").textContent ?? "";
      expect(items).toContain("primary:Primary:#4285f4");
      expect(items).toContain("work:Work:#16a765");
    });
  });

  // Issue #208 Phase 2 review feedback — fetchCalendarList no longer
  // injects a synthetic "primary" entry, so the panel UI's empty state
  // can render correctly for unauthenticated/zero-calendar accounts.
  it("does not surface a synthetic 'primary' calendar when the API returns no calendars", async () => {
    function CalendarsProbe() {
      const { calendars } = useCalendar();
      return <span data-testid="probe-calendars-len">{calendars.length}</span>;
    }

    fetchMock.mockImplementation((input: string | URL) => {
      const url = String(input);
      if (url.includes("/api/calendar/calendars")) {
        return Promise.resolve(fetchOk({ calendars: [] }));
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(fetchOk({ events: [] }));
      }
      return Promise.resolve(fetchOk({}));
    });

    render(
      <CalendarProvider>
        <CalendarsProbe />
      </CalendarProvider>
    );

    // Wait for the events fetch (proves the refresh ran end-to-end), then
    // assert the calendar list stays empty rather than getting a synthetic
    // entry that would render as a real selectable row in the filter UI.
    await waitFor(() => {
      const eventCalls = fetchMock.mock.calls
        .map((c) => String(c[0]))
        .filter((u) => u.includes("/api/calendar/events"));
      expect(eventCalls.length).toBeGreaterThan(0);
    });
    expect(screen.getByTestId("probe-calendars-len")).toHaveTextContent("0");

    // Even though calendars is empty, the events fetch URL still falls
    // back to the primary calendar so we don't end up with no events at
    // all when the calendar list comes back empty.
    const eventUrl = fetchMock.mock.calls
      .map((c) => String(c[0]))
      .find((u) => u.includes("/api/calendar/events"));
    expect(eventUrl).toContain("calendarIds=primary");
  });

  it("filters events by selectedCalendarIds and intersects with color filter", async () => {
    function CalendarFilterProbe() {
      const { events, filterEventsBySelectedCalendars } = useCalendar();
      return (
        <div>
          <button
            type="button"
            onClick={() => filterEventsBySelectedCalendars("work")}
          >
            only-work
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
        return Promise.resolve(
          fetchOk({
            calendars: [
              { id: "primary", summary: "Primary" },
              { id: "work", summary: "Work" },
            ],
          })
        );
      }
      if (url.includes("/api/calendar/colors")) {
        return Promise.resolve(fetchOk({ colorMappings: [] }));
      }
      if (url.includes("/api/calendar/events")) {
        return Promise.resolve(
          fetchOk({
            events: [
              {
                id: "primary-evt",
                summary: "Primary Event",
                start: { dateTime: new Date().toISOString() },
                end: { dateTime: new Date().toISOString() },
              },
            ],
          })
        );
      }
      return Promise.resolve(fetchOk({}));
    });

    render(
      <CalendarProvider>
        <CalendarFilterProbe />
      </CalendarProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("Primary Event")).toBeInTheDocument();
    });

    // Selecting only "work" should drop the primary event since the mock
    // transformer assigns calendarId: "primary".
    await userEvent.setup().click(screen.getByText("only-work"));

    await waitFor(() => {
      expect(screen.queryByText("Primary Event")).not.toBeInTheDocument();
    });
  });
});
