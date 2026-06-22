import { DEFAULT_DATE_FORMAT } from "@/lib/format-date";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDateFormat } from "../useDateFormat";

const mockUseSession = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({
  useSession: mockUseSession,
}));

describe("useDateFormat", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns the default format and a working formatter when unauthenticated", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    const { result } = renderHook(() => useDateFormat());

    expect(result.current.dateFormat).toBe(DEFAULT_DATE_FORMAT);
    // Local construction so the assertion is TZ-safe.
    expect(result.current.format(new Date(2026, 0, 7))).toBe("01/07/2026");
  });

  it("reflects the user's dateFormat once the server fetch resolves", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ dateFormat: "YYYY-MM-DD" }),
    } as Response);

    const { result } = renderHook(() => useDateFormat());

    await waitFor(() => {
      expect(result.current.dateFormat).toBe("YYYY-MM-DD");
    });
    expect(result.current.format(new Date(2026, 0, 7))).toBe("2026-01-07");
  });

  it("falls back to the default format when the helper sees garbage from the server", async () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "u1" } },
      status: "authenticated",
    });
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      // `pickCalendarFields` rejects unknown values, so the hook should
      // keep returning the default rather than threading "garbage"
      // through to `formatUserDate`.
      json: async () => ({ dateFormat: "garbage" }),
    } as Response);

    const { result } = renderHook(() => useDateFormat());

    // Wait one tick to let the GET resolve, then assert the default still stands.
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    expect(result.current.dateFormat).toBe(DEFAULT_DATE_FORMAT);
    expect(result.current.format(new Date(2026, 0, 7))).toBe("01/07/2026");
  });
});
