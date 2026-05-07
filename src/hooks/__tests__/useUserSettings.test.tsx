/**
 * Tests for useUserSettings hook
 * Following TDD - tests written before implementation
 */
import { renderHook, waitFor } from "@testing-library/react";
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
      weekStartDay: 1,
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
});
