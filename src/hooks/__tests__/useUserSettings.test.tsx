/**
 * Tests for useUserSettings hook
 * Following TDD - tests written before implementation
 */
import {
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_USER_CALENDAR_SETTINGS,
  isTimeFormat,
  useUserSettings,
} from "../useUserSettings";

const mockUseSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

describe("useUserSettings", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns defaults and loading=false when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings).toEqual(DEFAULT_USER_CALENDAR_SETTINGS);
    expect(result.current.isLoading).toBe(false);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns defaults while session is loading and does not fetch", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });

    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings).toEqual(DEFAULT_USER_CALENDAR_SETTINGS);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fetches /api/settings once when authenticated and returns server values", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    const mockSettings = {
      calendarRefreshIntervalMinutes: 30,
      calendarFetchMonthsAhead: 4,
      calendarFetchMonthsBehind: 2,
      calendarMaxEventsPerDay: 5,
      defaultZoomLevel: 1.5,
      timeFormat: "24h" as const,
      weekStartDay: 1,
      calendarWorkingHoursStart: 9,
    };
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => mockSettings,
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith("/api/settings");
    // Server payload merges over defaults, so fields the server omitted
    // (here: calendarTransitionSpeed) come from DEFAULT_USER_CALENDAR_SETTINGS.
    expect(result.current.settings).toEqual({
      ...DEFAULT_USER_CALENDAR_SETTINGS,
      ...mockSettings,
    });
  });

  it("surfaces defaultZoomLevel from /api/settings", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ defaultZoomLevel: 1.75 }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.defaultZoomLevel).toBe(1.75);
  });

  it("ignores non-numeric defaultZoomLevel and keeps the default", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ defaultZoomLevel: "1.5" }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.defaultZoomLevel).toBe(
      DEFAULT_USER_CALENDAR_SETTINGS.defaultZoomLevel
    );
  });

  it("ignores non-finite defaultZoomLevel (NaN, Infinity) and keeps the default", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ defaultZoomLevel: Number.NaN }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.defaultZoomLevel).toBe(
      DEFAULT_USER_CALENDAR_SETTINGS.defaultZoomLevel
    );
    expect(Number.isFinite(result.current.settings.defaultZoomLevel)).toBe(
      true
    );
  });

  it("falls back to defaults when the API returns an error", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "boom" }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual(DEFAULT_USER_CALENDAR_SETTINGS);
  });

  it("falls back to defaults when fetch rejects", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual(DEFAULT_USER_CALENDAR_SETTINGS);
  });

  it("does not update state after unmount while fetch is in-flight", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    // Fetch that never resolves during the test window — we unmount before it does.
    let resolveFetch: (value: Response) => void = () => {};
    vi.mocked(global.fetch).mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const { unmount } = renderHook(() => useUserSettings());
    unmount();

    // Now resolve the in-flight fetch — any setState here would be on an
    // unmounted instance, which React logs via console.error.
    resolveFetch({
      ok: true,
      json: async () => ({ calendarMaxEventsPerDay: 4 }),
    } as Response);
    await new Promise((r) => setTimeout(r, 0));

    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining("unmounted component")
    );
    consoleError.mockRestore();
  });

  it("surfaces calendarTransitionSpeed when the server provides it", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ calendarTransitionSpeed: "fast" }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.calendarTransitionSpeed).toBe("fast");
  });

  it("falls back to the default speed when the server omits it", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ calendarMaxEventsPerDay: 7 }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.calendarTransitionSpeed).toBe(
      DEFAULT_USER_CALENDAR_SETTINGS.calendarTransitionSpeed
    );
  });

  it("rejects garbage calendarTransitionSpeed values from the server", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ calendarTransitionSpeed: "ludicrous" }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Unknown value should not propagate; default stands.
    expect(result.current.settings.calendarTransitionSpeed).toBe(
      DEFAULT_USER_CALENDAR_SETTINGS.calendarTransitionSpeed
    );
  });

  it("surfaces dateFormat when the server provides a documented value", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ dateFormat: "DD/MM/YYYY" }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.dateFormat).toBe("DD/MM/YYYY");
  });

  it("rejects unknown dateFormat values and keeps the default", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ dateFormat: "YYYY/MM/DD" }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.dateFormat).toBe(
      DEFAULT_USER_CALENDAR_SETTINGS.dateFormat
    );
  });

  it("propagates a dateFormat bus event to a second hook instance", async () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });
    const { result } = renderHook(() => useUserSettings());

    act(() => {
      emitUserSettingsChange({ dateFormat: "YYYY-MM-DD" });
    });

    await waitFor(() => {
      expect(result.current.settings.dateFormat).toBe("YYYY-MM-DD");
    });
  });

  it("merges partial server values over defaults", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ calendarMaxEventsPerDay: 7 }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings).toEqual({
      ...DEFAULT_USER_CALENDAR_SETTINGS,
      calendarMaxEventsPerDay: 7,
    });
  });

  it("exposes weekStartDay with default 0 when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useUserSettings());

    expect(result.current.settings.weekStartDay).toBe(0);
  });

  it("returns server-side weekStartDay when authenticated", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ weekStartDay: 1 }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.weekStartDay).toBe(1);
  });

  it("ignores out-of-range weekStartDay from the server (defensive)", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      // A rogue value (e.g. from a manually-edited DB row) should not
      // poison the helper's `weekStartsOn` parameter.
      json: async () => ({ weekStartDay: 5 }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.weekStartDay).toBe(0);
  });

  it("picks calendarWorkingHoursStart from server response", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ calendarWorkingHoursStart: 5 }),
    } as Response);

    const { result } = renderHook(() => useUserSettings());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.settings.calendarWorkingHoursStart).toBe(5);
  });

  it.each([
    ["string", "9"],
    ["float", 7.5],
    ["negative", -1],
    ["above range", 24],
    ["null", null],
  ])(
    "ignores invalid calendarWorkingHoursStart (%s) from a malformed response",
    async (_label, value) => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ calendarWorkingHoursStart: value }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.settings.calendarWorkingHoursStart).toBe(
        DEFAULT_USER_CALENDAR_SETTINGS.calendarWorkingHoursStart
      );
    }
  );

  // #337 — `timeFormat` is the single source of truth replacing the
  // standalone `CalendarProvider.use24HourFormat` localStorage key.
  describe("timeFormat (#337)", () => {
    it("defaults timeFormat to 12h when nothing has been fetched", () => {
      mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

      const { result } = renderHook(() => useUserSettings());

      expect(result.current.settings.timeFormat).toBe("12h");
    });

    it("returns the server timeFormat when authenticated", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ timeFormat: "24h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("24h");
      });
    });

    it("ignores invalid timeFormat values from the server", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ timeFormat: "garbage" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.settings.timeFormat).toBe("12h");
    });
  });

  describe("mutate (#337)", () => {
    it("PUTs the partial to /api/settings and updates state on success", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      // Initial GET — server returns 12h
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("12h");
      });

      // PUT response
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "24h" }),
      } as Response);

      await act(async () => {
        await result.current.mutate({ timeFormat: "24h" });
      });

      expect(global.fetch).toHaveBeenCalledWith("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeFormat: "24h" }),
      });
      expect(result.current.settings.timeFormat).toBe("24h");
    });

    it("rejects when the server PUT fails and does not update state", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("12h");
      });

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "boom" }),
      } as Response);

      await expect(
        act(async () => {
          await result.current.mutate({ timeFormat: "24h" });
        })
      ).rejects.toThrow();

      expect(result.current.settings.timeFormat).toBe("12h");
    });

    it("skips the network PUT when unauthenticated but still updates local state and emits to the bus", async () => {
      mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

      const { result: writer } = renderHook(() => useUserSettings());
      const { result: reader } = renderHook(() => useUserSettings());

      await act(async () => {
        await writer.current.mutate({ timeFormat: "24h" });
      });

      expect(global.fetch).not.toHaveBeenCalled();
      expect(writer.current.settings.timeFormat).toBe("24h");
      // Bus delivery still propagates to other in-tab consumers.
      expect(reader.current.settings.timeFormat).toBe("24h");
    });

    it("emits a bus event so other in-tab consumers see the change", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result: writer } = renderHook(() => useUserSettings());
      const { result: reader } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(writer.current.settings.timeFormat).toBe("12h");
      });

      // PUT response for writer
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "24h" }),
      } as Response);

      await act(async () => {
        await writer.current.mutate({ timeFormat: "24h" });
      });

      // Reader's local state must reflect the writer's mutation without
      // having issued its own GET.
      expect(reader.current.settings.timeFormat).toBe("24h");
    });
  });

  describe("GET-vs-mutate race (#337)", () => {
    it("ignores a GET response that resolves AFTER a mutate to avoid clobbering the optimistic write", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      // Initial GET response is held until the test releases it.
      let resolveGet: (value: Response) => void = () => {};
      vi.mocked(global.fetch).mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            resolveGet = resolve;
          })
      );

      const { result } = renderHook(() => useUserSettings());

      // Mutate to "24h" while the initial GET is still in-flight.
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "24h" }),
      } as Response);
      await act(async () => {
        await result.current.mutate({ timeFormat: "24h" });
      });
      expect(result.current.settings.timeFormat).toBe("24h");

      // Now release the original GET — its (stale) "12h" response must
      // NOT overwrite the optimistic write.
      await act(async () => {
        resolveGet({
          ok: true,
          json: async () => ({ timeFormat: "12h" }),
        } as Response);
        await new Promise((r) => setTimeout(r, 0));
      });

      expect(result.current.settings.timeFormat).toBe("24h");
    });

    it("rolls back optimistic state when the PUT fails", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      // Initial GET — server says 12h.
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());
      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("12h");
      });

      // PUT fails after we've optimistically applied "24h".
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "boom" }),
      } as Response);

      await expect(
        act(async () => {
          await result.current.mutate({ timeFormat: "24h" });
        })
      ).rejects.toThrow();

      // Local state is rolled back to the pre-mutate value.
      expect(result.current.settings.timeFormat).toBe("12h");
    });
  });

  describe("same-key rollback race (#420)", () => {
    it("does not roll back when the current state no longer matches this mutate's optimistic value", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      // Initial GET — server says 12h.
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());
      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("12h");
      });

      // A: kick off a mutate to "24h" with a PUT that will be rejected later.
      let rejectA: (reason?: unknown) => void = () => {};
      const aPromise = new Promise<Response>((_resolve, reject) => {
        rejectA = reject;
      });
      vi.mocked(global.fetch).mockImplementationOnce(() => aPromise);

      let aMutate: Promise<void> | undefined;
      await act(async () => {
        aMutate = result.current.mutate({ timeFormat: "24h" }).catch(() => {});
        // Let the optimistic setSettings + bus emit run.
        await Promise.resolve();
      });
      expect(result.current.settings.timeFormat).toBe("24h");

      // Simulate B's success — a later same-key bus event overrides to "12h",
      // standing in for a parallel `mutate({ timeFormat: "12h" })` whose PUT
      // resolved before A's.
      await act(async () => {
        emitUserSettingsChange({ timeFormat: "12h" });
      });
      expect(result.current.settings.timeFormat).toBe("12h");

      // Subscribe AFTER B's emit so we only observe whether A's rollback
      // path re-emits the stale snapshot.
      const busHandler = vi.fn();
      const unsubscribe = subscribeUserSettings(busHandler);

      // Reject A — the catch should compare the current state ("12h") to
      // this call's optimistic value ("24h"). They differ, so the rollback
      // and emit should be suppressed.
      await act(async () => {
        rejectA(new Error("boom"));
        await aMutate;
      });

      expect(busHandler).not.toHaveBeenCalled();
      expect(result.current.settings.timeFormat).toBe("12h");

      unsubscribe();
    });
  });

  describe("bus subscription (#337)", () => {
    it("updates state when a bus event arrives from another consumer", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("12h");
      });

      act(() => {
        emitUserSettingsChange({ timeFormat: "24h" });
      });

      expect(result.current.settings.timeFormat).toBe("24h");
    });

    it("ignores irrelevant fields on bus events without crashing", async () => {
      mockUseSession.mockReturnValue({
        data: { user: { id: "u1" } },
        status: "authenticated",
      });
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ timeFormat: "12h" }),
      } as Response);

      const { result } = renderHook(() => useUserSettings());

      await waitFor(() => {
        expect(result.current.settings.timeFormat).toBe("12h");
      });

      // theme isn't picked up by useUserSettings; the event must still be
      // safely handled (no crash, no unrelated state churn).
      expect(() =>
        act(() => emitUserSettingsChange({ theme: "dark" }))
      ).not.toThrow();
      expect(result.current.settings.timeFormat).toBe("12h");
    });
  });
});

describe("isTimeFormat", () => {
  it("accepts the two valid literal values", () => {
    expect(isTimeFormat("12h")).toBe(true);
    expect(isTimeFormat("24h")).toBe(true);
  });

  it("rejects similar-looking strings outside the allow-list", () => {
    expect(isTimeFormat("13h")).toBe(false);
    expect(isTimeFormat("12H")).toBe(false);
    expect(isTimeFormat("12")).toBe(false);
    expect(isTimeFormat("")).toBe(false);
  });

  it("rejects non-string inputs", () => {
    expect(isTimeFormat(null)).toBe(false);
    expect(isTimeFormat(undefined)).toBe(false);
    expect(isTimeFormat(12)).toBe(false);
    expect(isTimeFormat({})).toBe(false);
  });
});
