/**
 * Tests for useUserSettings hook
 * Following TDD - tests written before implementation
 */
import { emitUserSettingsChange } from "@/lib/user-settings-bus";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_USER_CALENDAR_SETTINGS,
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
      timeFormat: "24h" as const,
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
    expect(result.current.settings).toEqual(mockSettings);
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
