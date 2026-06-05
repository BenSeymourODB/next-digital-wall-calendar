import { useWritableCalendars } from "@/hooks/useWritableCalendars";
import { useSession } from "next-auth/react";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const ALL_CALENDARS = [
  {
    id: "primary",
    summary: "you@example.com",
    backgroundColor: "#4285f4",
    foregroundColor: "#ffffff",
    primary: true,
    selected: true,
    accessRole: "owner",
  },
  {
    id: "family@group.calendar.google.com",
    summary: "Family",
    backgroundColor: "#7986cb",
    foregroundColor: "#ffffff",
    primary: false,
    selected: true,
    accessRole: "writer",
  },
  {
    id: "holidays@group.v.calendar.google.com",
    summary: "Holidays",
    backgroundColor: "#33b679",
    foregroundColor: "#ffffff",
    primary: false,
    selected: false,
    accessRole: "reader",
  },
  {
    id: "freebusy@group.calendar.google.com",
    summary: "Busy-only",
    backgroundColor: "#fbbc04",
    foregroundColor: "#000000",
    primary: false,
    selected: false,
    accessRole: "freeBusyReader",
  },
];

describe("useWritableCalendars", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    vi.mocked(useSession).mockReturnValue({
      data: { user: { name: "Test" } },
      status: "authenticated",
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>);
  });

  it("returns empty list and isLoading=false when unauthenticated (no fetch)", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    } as unknown as ReturnType<typeof useSession>);

    const { result } = renderHook(() => useWritableCalendars());

    expect(result.current.calendars).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("filters to writer/owner roles only", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ calendars: ALL_CALENDARS }),
    });

    const { result } = renderHook(() => useWritableCalendars());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.calendars.map((c) => c.id)).toEqual([
      "primary",
      "family@group.calendar.google.com",
    ]);
  });

  it("orders the primary calendar first, then alphabetised by summary", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          calendars: [
            { ...ALL_CALENDARS[1], id: "z-cal", summary: "Z Calendar" },
            { ...ALL_CALENDARS[1], id: "a-cal", summary: "A Calendar" },
            ALL_CALENDARS[0], // primary
            { ...ALL_CALENDARS[1], id: "m-cal", summary: "M Calendar" },
          ],
        }),
    });

    const { result } = renderHook(() => useWritableCalendars());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.calendars.map((c) => c.id)).toEqual([
      "primary",
      "a-cal",
      "m-cal",
      "z-cal",
    ]);
  });

  it("returns empty list when API errors out", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "boom" }),
    });

    const { result } = renderHook(() => useWritableCalendars());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.calendars).toEqual([]);
  });

  it("returns empty list when fetch rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network down"));

    const { result } = renderHook(() => useWritableCalendars());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.calendars).toEqual([]);
  });
});
