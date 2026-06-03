/**
 * Tests for use-interaction-detector.ts hook
 *
 * Tests user interaction detection and pause behavior.
 */
import { useRef } from "react";
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

  // Regression tests for issue #221, bug 2: a click on the scheduler's
  // own navigation controls used to be picked up by the window-level
  // interaction listener, immediately re-pausing the scheduler after
  // the user tried to manually unpause via the toggle button. The fix
  // lets callers pass an `ignoreRef` so that interactions originating
  // inside that subtree are skipped.
  describe("ignoreRef (#221, bug 2)", () => {
    it("ignores clicks whose target is inside the ignored subtree", () => {
      const ignored = document.createElement("div");
      const button = document.createElement("button");
      ignored.appendChild(button);
      document.body.appendChild(ignored);

      try {
        const { result } = renderHook(() => {
          const ref = useRef<HTMLDivElement>(ignored);
          return useInteractionDetector({
            pauseDurationMs: 2000,
            enabled: true,
            ignoreRef: ref,
          });
        });

        act(() => {
          button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(result.current.isPaused).toBe(false);
      } finally {
        document.body.removeChild(ignored);
      }
    });

    it("still pauses on clicks whose target is outside the ignored subtree", () => {
      const ignored = document.createElement("div");
      const outside = document.createElement("button");
      document.body.appendChild(ignored);
      document.body.appendChild(outside);

      try {
        const { result } = renderHook(() => {
          const ref = useRef<HTMLDivElement>(ignored);
          return useInteractionDetector({
            pauseDurationMs: 2000,
            enabled: true,
            ignoreRef: ref,
          });
        });

        act(() => {
          outside.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        });

        expect(result.current.isPaused).toBe(true);
      } finally {
        document.body.removeChild(ignored);
        document.body.removeChild(outside);
      }
    });

    it("ignores keydown events targeted at elements inside the ignored subtree", () => {
      const ignored = document.createElement("div");
      const input = document.createElement("input");
      ignored.appendChild(input);
      document.body.appendChild(ignored);

      try {
        const { result } = renderHook(() => {
          const ref = useRef<HTMLDivElement>(ignored);
          return useInteractionDetector({
            pauseDurationMs: 2000,
            enabled: true,
            ignoreRef: ref,
          });
        });

        act(() => {
          input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
        });

        expect(result.current.isPaused).toBe(false);
      } finally {
        document.body.removeChild(ignored);
      }
    });

    it("treats a null ignoreRef.current as no ignore filter", () => {
      const { result } = renderHook(() => {
        const ref = useRef<HTMLDivElement | null>(null);
        return useInteractionDetector({
          pauseDurationMs: 2000,
          enabled: true,
          ignoreRef: ref,
        });
      });

      act(() => {
        window.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      });

      expect(result.current.isPaused).toBe(true);
    });
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
