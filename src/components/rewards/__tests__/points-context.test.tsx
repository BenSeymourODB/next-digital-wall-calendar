/**
 * Tests for PointsContext / PointsProvider / usePoints.
 *
 * The provider takes `profileId` as a prop (no internal coupling to
 * ProfileProvider) so tests don't need to set up a profile context.
 * Whoever mounts the provider is responsible for forwarding the
 * active profile id.
 */
import { type ReactNode } from "react";
import { act, render, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PointsProvider, usePoints } from "../points-context";

const mockFetch = vi.fn();
global.fetch = mockFetch;

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

function makeWrapper(profileId: string | null) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <PointsProvider profileId={profileId}>{children}</PointsProvider>;
  };
}

describe("usePoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it("throws when used outside the provider", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => usePoints())).toThrow(
      "usePoints must be used within PointsProvider"
    );

    consoleSpy.mockRestore();
  });

  it("starts disabled with zero points and never fetches when profileId is null", async () => {
    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper(null),
    });

    expect(result.current.totalPoints).toBe(0);
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.profileId).toBeNull();

    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches points on mount when profileId is provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalPoints: 1250, enabled: true }),
    });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/points?profileId=profile-1");
    });

    await waitFor(() => {
      expect(result.current.totalPoints).toBe(1250);
      expect(result.current.isEnabled).toBe(true);
    });
  });

  it("reports enabled=false and zero points when the API says rewards are disabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ totalPoints: 0, enabled: false }),
    });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => {
      expect(result.current.isEnabled).toBe(false);
      expect(result.current.totalPoints).toBe(0);
    });
  });

  it("falls back to disabled when the GET fails", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(result.current.isEnabled).toBe(false);
    expect(result.current.totalPoints).toBe(0);
  });

  it("awardPoints POSTs the payload and updates totalPoints from the response", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 50, enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            newTotal: 60,
            alreadyAwarded: false,
          }),
      });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => expect(result.current.totalPoints).toBe(50));

    let awardResult: { newTotal: number; alreadyAwarded: boolean } | undefined;
    await act(async () => {
      awardResult = await result.current.awardPoints(10, "task_completed", {
        taskId: "task-abc",
        taskTitle: "Buy milk",
      });
    });

    expect(mockFetch).toHaveBeenLastCalledWith("/api/points/award", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        profileId: "profile-1",
        points: 10,
        reason: "task_completed",
        taskId: "task-abc",
        taskTitle: "Buy milk",
      }),
    });
    expect(awardResult).toEqual({ newTotal: 60, alreadyAwarded: false });
    expect(result.current.totalPoints).toBe(60);
  });

  it("does not increment totalPoints when alreadyAwarded is true (idempotent)", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 75, enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            newTotal: 75,
            alreadyAwarded: true,
          }),
      });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => expect(result.current.totalPoints).toBe(75));

    let awardResult: { newTotal: number; alreadyAwarded: boolean } | undefined;
    await act(async () => {
      awardResult = await result.current.awardPoints(10, "task_completed", {
        taskId: "task-abc",
      });
    });

    expect(awardResult?.alreadyAwarded).toBe(true);
    expect(result.current.totalPoints).toBe(75);
  });

  it("throws and leaves totalPoints unchanged when the award POST fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 50, enabled: true }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => expect(result.current.totalPoints).toBe(50));

    await act(async () => {
      await expect(
        result.current.awardPoints(10, "task_completed", { taskId: "task-x" })
      ).rejects.toThrow("Failed to award points");
    });

    expect(result.current.totalPoints).toBe(50);
  });

  it("rejects awardPoints when no active profile is set", async () => {
    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper(null),
    });

    await act(async () => {
      await expect(
        result.current.awardPoints(10, "task_completed", { taskId: "task-x" })
      ).rejects.toThrow("No active profile");
    });
  });

  it("refreshPoints re-fetches and updates state", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 50, enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 80, enabled: true }),
      });

    const { result } = renderHook(() => usePoints(), {
      wrapper: makeWrapper("profile-1"),
    });

    await waitFor(() => expect(result.current.totalPoints).toBe(50));

    await act(async () => {
      await result.current.refreshPoints();
    });

    expect(result.current.totalPoints).toBe(80);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when profileId changes", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 50, enabled: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ totalPoints: 200, enabled: true }),
      });

    function Probe() {
      const { totalPoints } = usePoints();
      return <div data-testid="total">{totalPoints}</div>;
    }

    const { rerender, getByTestId } = render(
      <PointsProvider profileId="profile-1">
        <Probe />
      </PointsProvider>
    );

    await waitFor(() => {
      expect(getByTestId("total").textContent).toBe("50");
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/points?profileId=profile-1");

    rerender(
      <PointsProvider profileId="profile-2">
        <Probe />
      </PointsProvider>
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/points?profileId=profile-2");
      expect(getByTestId("total").textContent).toBe("200");
    });
  });
});
