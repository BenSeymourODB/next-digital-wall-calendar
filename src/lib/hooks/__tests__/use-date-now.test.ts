/**
 * Tests for use-date-now hook.
 *
 * Covers the wall-display midnight-rollover requirement: subscribers
 * should re-render when the day changes without any user interaction.
 */
import { act, renderHook } from "@testing-library/react";
import { startOfDay } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetUseDateNowForTests,
  useDateNow,
  useTodayStartOfDay,
} from "../use-date-now";

describe("useDateNow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T23:50:00"));
    __resetUseDateNowForTests();
  });

  afterEach(() => {
    __resetUseDateNowForTests();
    vi.useRealTimers();
  });

  it("returns the current date on mount", () => {
    const { result } = renderHook(() => useDateNow());
    expect(result.current.toISOString()).toBe(
      new Date("2026-05-02T23:50:00").toISOString()
    );
  });

  it("updates to the new day after the local midnight tick fires", () => {
    const { result } = renderHook(() => useDateNow());
    const before = result.current;

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    });

    const after = result.current;
    expect(after).not.toBe(before);
    expect(after.getDate()).toBe(3);
    expect(after.getMonth()).toBe(4);
  });

  it("notifies multiple subscribers on a single midnight tick", () => {
    const renderA = vi.fn(() => useDateNow());
    const renderB = vi.fn(() => useDateNow());
    const { result: a } = renderHook(renderA);
    const { result: b } = renderHook(renderB);

    const initialACalls = renderA.mock.calls.length;
    const initialBCalls = renderB.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    });

    expect(a.current.getDate()).toBe(3);
    expect(b.current.getDate()).toBe(3);
    expect(a.current).toBe(b.current);
    expect(renderA.mock.calls.length).toBeGreaterThan(initialACalls);
    expect(renderB.mock.calls.length).toBeGreaterThan(initialBCalls);
  });

  it("re-schedules the next midnight after a tick fires", () => {
    const { result } = renderHook(() => useDateNow());

    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 1000);
    });
    expect(result.current.getDate()).toBe(3);

    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });
    expect(result.current.getDate()).toBe(4);
  });

  it("uses a single shared timer across many subscribers", () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    setTimeoutSpy.mockClear();

    const hooks = Array.from({ length: 5 }, () =>
      renderHook(() => useDateNow())
    );
    expect(hooks).toHaveLength(5);

    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it("clears the timer when the last subscriber unmounts", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount: u1 } = renderHook(() => useDateNow());
    const { unmount: u2 } = renderHook(() => useDateNow());
    clearTimeoutSpy.mockClear();

    u1();
    expect(clearTimeoutSpy).not.toHaveBeenCalled();

    u2();
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
    clearTimeoutSpy.mockRestore();
  });

  it("re-schedules on remount after a full unmount", () => {
    const { unmount } = renderHook(() => useDateNow());
    unmount();

    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    setTimeoutSpy.mockClear();
    renderHook(() => useDateNow());
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });
});

describe("useTodayStartOfDay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-02T14:30:00"));
    __resetUseDateNowForTests();
  });

  afterEach(() => {
    __resetUseDateNowForTests();
    vi.useRealTimers();
  });

  it("returns startOfDay for the current date", () => {
    const { result } = renderHook(() => useTodayStartOfDay());
    expect(result.current.getTime()).toBe(
      startOfDay(new Date("2026-05-02T14:30:00")).getTime()
    );
    expect(result.current.getHours()).toBe(0);
    expect(result.current.getMinutes()).toBe(0);
    expect(result.current.getSeconds()).toBe(0);
  });

  it("rolls forward to the next day's startOfDay after midnight", () => {
    const { result } = renderHook(() => useTodayStartOfDay());

    act(() => {
      vi.advanceTimersByTime(9 * 60 * 60 * 1000 + 31 * 60 * 1000);
    });

    expect(result.current.getDate()).toBe(3);
    expect(result.current.getHours()).toBe(0);
  });
});
