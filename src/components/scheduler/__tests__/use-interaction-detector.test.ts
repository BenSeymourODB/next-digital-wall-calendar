/**
 * Tests for use-interaction-detector.ts hook
 *
 * Tests user interaction detection and pause behavior.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInteractionDetector } from "../use-interaction-detector";

describe("useInteractionDetector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts not paused", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );
    expect(result.current.isPaused).toBe(false);
  });

  it("becomes paused on click event", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("becomes paused on keydown event", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("becomes paused on scroll event", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new Event("scroll", { bubbles: true }));
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("becomes paused on touchstart event", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("becomes paused on wheel event", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new WheelEvent("wheel", { bubbles: true }));
    });

    expect(result.current.isPaused).toBe(true);
  });

  it("returns to not paused after timeout", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(result.current.isPaused).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.isPaused).toBe(false);
  });

  it("resets timeout on subsequent interactions", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    act(() => {
      window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(result.current.isPaused).toBe(true);

    // Advance 1500ms (not yet expired)
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.isPaused).toBe(true);

    // Another interaction resets the timer
    act(() => {
      window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    // Advance another 1500ms - original timer would have expired, but reset kept it paused
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(result.current.isPaused).toBe(true);

    // Advance remaining 500ms
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.isPaused).toBe(false);
  });

  it("does not pause when disabled", () => {
    const { result } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: false })
    );

    act(() => {
      window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(result.current.isPaused).toBe(false);
  });

  it("cleans up event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

    const { unmount } = renderHook(() =>
      useInteractionDetector({ pauseDurationMs: 2000, enabled: true })
    );

    unmount();

    const removedEvents = removeEventListenerSpy.mock.calls.map(
      (call) => call[0]
    );
    expect(removedEvents).toContain("click");
    expect(removedEvents).toContain("keydown");
    expect(removedEvents).toContain("scroll");
    expect(removedEvents).toContain("touchstart");
    expect(removedEvents).toContain("wheel");

    removeEventListenerSpy.mockRestore();
  });
});
