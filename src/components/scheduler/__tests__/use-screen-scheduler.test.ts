/**
 * Tests for use-screen-scheduler.ts hook
 *
 * Tests core scheduler logic including sequence rotation,
 * time-specific navigation, and control functions.
 */
import type { ScheduleConfig } from "@/components/scheduler/types";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useScreenScheduler } from "../use-screen-scheduler";

// Mock next/navigation
const mockPush = vi.fn();
const mockPathname = vi.fn(() => "/calendar");

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => mockPathname(),
}));

const defaultConfig: ScheduleConfig = {
  sequences: [
    {
      id: "seq-1",
      name: "Main Rotation",
      enabled: true,
      screens: ["/calendar", "/recipe", "/tasks"],
      intervalSeconds: 60,
      pauseOnInteractionSeconds: 120,
    },
  ],
  timeSpecific: [],
};

const disabledConfig: ScheduleConfig = {
  sequences: [
    {
      id: "seq-disabled",
      name: "Disabled",
      enabled: false,
      screens: ["/calendar", "/recipe"],
      intervalSeconds: 60,
      pauseOnInteractionSeconds: 120,
    },
  ],
  timeSpecific: [],
};

const emptyConfig: ScheduleConfig = {
  sequences: [],
  timeSpecific: [],
};

describe("useScreenScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockPathname.mockReturnValue("/calendar");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialization", () => {
    it("starts inactive when no sequences are enabled", () => {
      const { result } = renderHook(() => useScreenScheduler(disabledConfig));
      expect(result.current.state.isActive).toBe(false);
    });

    it("starts inactive with empty config", () => {
      const { result } = renderHook(() => useScreenScheduler(emptyConfig));
      expect(result.current.state.isActive).toBe(false);
    });

    it("starts not paused", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));
      expect(result.current.state.isPaused).toBe(false);
    });

    it("sets currentIndex based on current pathname", () => {
      mockPathname.mockReturnValue("/recipe");
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));
      expect(result.current.state.currentIndex).toBe(1);
    });
  });

  describe("start and stop", () => {
    it("can start the scheduler", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      expect(result.current.state.isActive).toBe(true);
      expect(result.current.state.currentSequenceId).toBe("seq-1");
    });

    it("can stop the scheduler", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });
      expect(result.current.state.isActive).toBe(true);

      act(() => {
        result.current.controls.stop();
      });
      expect(result.current.state.isActive).toBe(false);
    });
  });

  describe("pause and resume", () => {
    it("can pause the scheduler", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.pause();
      });

      expect(result.current.state.isPaused).toBe(true);
    });

    it("can resume the scheduler", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.pause();
      });
      expect(result.current.state.isPaused).toBe(true);

      act(() => {
        result.current.controls.resume();
      });
      expect(result.current.state.isPaused).toBe(false);
    });
  });

  describe("navigation", () => {
    it("navigateToNext cycles through screens", () => {
      mockPathname.mockReturnValue("/calendar");
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.navigateToNext();
      });
      expect(mockPush).toHaveBeenCalledWith("/recipe");

      act(() => {
        result.current.controls.navigateToNext();
      });
      expect(mockPush).toHaveBeenCalledWith("/tasks");

      act(() => {
        result.current.controls.navigateToNext();
      });
      expect(mockPush).toHaveBeenCalledWith("/calendar");
    });

    it("navigateToPrevious cycles through screens backwards", () => {
      mockPathname.mockReturnValue("/calendar");
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.navigateToPrevious();
      });
      expect(mockPush).toHaveBeenCalledWith("/tasks");

      act(() => {
        result.current.controls.navigateToPrevious();
      });
      expect(mockPush).toHaveBeenCalledWith("/recipe");
    });

    it("does not navigate when not active", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.navigateToNext();
      });
      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("time-specific navigation", () => {
    it("triggers time-specific navigation at correct time", () => {
      const configWithTimeSpecific: ScheduleConfig = {
        sequences: [
          {
            id: "seq-1",
            name: "Main",
            enabled: true,
            screens: ["/calendar", "/tasks"],
            intervalSeconds: 60,
            pauseOnInteractionSeconds: 120,
          },
        ],
        timeSpecific: [
          {
            id: "ts-1",
            enabled: true,
            screen: "/recipe",
            time: "17:30",
            durationMinutes: 30,
          },
        ],
      };

      // Set current time to 17:30
      vi.setSystemTime(new Date(2024, 2, 15, 17, 30, 0));

      const { result } = renderHook(() =>
        useScreenScheduler(configWithTimeSpecific)
      );

      act(() => {
        result.current.controls.start();
      });

      // Advance 60 seconds to trigger time check
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(result.current.state.activeTimeSpecific).not.toBeNull();
      expect(result.current.state.activeTimeSpecific?.id).toBe("ts-1");
    });
  });

  describe("auto-rotation", () => {
    it("auto-navigates after interval when active and not paused", () => {
      mockPathname.mockReturnValue("/calendar");
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      // Advance by the interval (60 seconds)
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(mockPush).toHaveBeenCalledWith("/recipe");
    });

    it("does not auto-navigate when paused", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.pause();
      });

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("does not auto-navigate when externalPaused is true", () => {
      const { result } = renderHook(() =>
        useScreenScheduler(defaultConfig, true)
      );

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(mockPush).not.toHaveBeenCalled();
    });

    it("manual pause works independently of externalPaused", () => {
      const { result, rerender } = renderHook(
        ({ config, ext }) => useScreenScheduler(config, ext),
        { initialProps: { config: defaultConfig, ext: false } }
      );

      act(() => {
        result.current.controls.start();
      });

      // Manual pause
      act(() => {
        result.current.controls.pause();
      });
      expect(result.current.state.isPaused).toBe(true);

      // Externally unpaused — manual pause should still hold
      rerender({ config: defaultConfig, ext: false });
      expect(result.current.state.isPaused).toBe(true);

      // Manual resume
      act(() => {
        result.current.controls.resume();
      });
      expect(result.current.state.isPaused).toBe(false);
    });
  });

  describe("transition direction", () => {
    it("defaults to forward direction", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));
      expect(result.current.state.transitionDirection).toBe("forward");
    });

    it("sets direction to forward on navigateToNext", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.navigateToNext();
      });

      expect(result.current.state.transitionDirection).toBe("forward");
    });

    it("sets direction to backward on navigateToPrevious", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.navigateToPrevious();
      });

      expect(result.current.state.transitionDirection).toBe("backward");
    });

    it("sets direction to forward on auto-rotation", () => {
      mockPathname.mockReturnValue("/calendar");
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      // Navigate backward first to change direction
      act(() => {
        result.current.controls.start();
      });
      act(() => {
        result.current.controls.navigateToPrevious();
      });
      expect(result.current.state.transitionDirection).toBe("backward");

      // Auto-rotation should reset to forward
      act(() => {
        vi.advanceTimersByTime(60000);
      });

      expect(result.current.state.transitionDirection).toBe("forward");
    });
  });

  describe("edge cases", () => {
    it("single-screen sequence wraps to same index on navigateToNext", () => {
      const singleScreenConfig: ScheduleConfig = {
        sequences: [
          {
            id: "seq-single",
            name: "Single",
            enabled: true,
            screens: ["/calendar"],
            intervalSeconds: 60,
            pauseOnInteractionSeconds: 120,
          },
        ],
        timeSpecific: [],
      };
      mockPathname.mockReturnValue("/calendar");
      const { result } = renderHook(() =>
        useScreenScheduler(singleScreenConfig)
      );

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.navigateToNext();
      });

      expect(result.current.state.currentIndex).toBe(0);
      expect(mockPush).toHaveBeenCalledWith("/calendar");
    });

    it("pause when already paused is idempotent", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });

      act(() => {
        result.current.controls.pause();
      });
      expect(result.current.state.isPaused).toBe(true);

      act(() => {
        result.current.controls.pause();
      });
      expect(result.current.state.isPaused).toBe(true);
    });

    it("resume when already resumed is idempotent", () => {
      const { result } = renderHook(() => useScreenScheduler(defaultConfig));

      act(() => {
        result.current.controls.start();
      });
      expect(result.current.state.isPaused).toBe(false);

      act(() => {
        result.current.controls.resume();
      });
      expect(result.current.state.isPaused).toBe(false);
    });
  });

  // Regression: issue #221 bug 4 — previously the time-specific check was
  // gated behind the first 60-second tick of `setInterval`, so a scheduler
  // started inside an active window stayed in sequence-rotation mode for up
  // to a minute. The hook now schedules an immediate `setTimeout(..., 0)`
  // alongside the 60s interval; this test pins that contract.
  describe("regression: time-specific check runs immediately (issue #221, bug 4)", () => {
    it("activates the matching time-specific entry on the next microtask, not after 60s", () => {
      const configWithTimeSpecific: ScheduleConfig = {
        sequences: [
          {
            id: "seq-1",
            name: "Main",
            enabled: true,
            screens: ["/calendar", "/tasks"],
            intervalSeconds: 60,
            pauseOnInteractionSeconds: 120,
          },
        ],
        timeSpecific: [
          {
            id: "ts-1",
            enabled: true,
            screen: "/recipe",
            time: "08:00",
            durationMinutes: 30,
          },
        ],
      };

      // Boot the scheduler INSIDE the active window for ts-1.
      vi.setSystemTime(new Date(2024, 2, 15, 8, 0, 0));

      const { result } = renderHook(() =>
        useScreenScheduler(configWithTimeSpecific)
      );

      act(() => {
        result.current.controls.start();
      });

      // Just one tick of fake time — well below the 60s interval — must be
      // enough for the immediate check to fire.
      act(() => {
        vi.advanceTimersByTime(0);
      });

      expect(result.current.state.activeTimeSpecific?.id).toBe("ts-1");
    });
  });

  // Regression: issue #221 bug 6 — earlier the countdown ran on its own
  // 1-second interval while auto-rotation ran on its own N-second interval,
  // so the two clocks drifted (and the displayed "time until next" was
  // incorrect after long uptimes). Both are now driven by a single 1-second
  // tick; this test pins the lock-step behaviour across multiple intervals.
  describe("regression: countdown stays in lock-step with rotation (issue #221, bug 6)", () => {
    it("decrements every second and resets cleanly on each rotation", () => {
      mockPathname.mockReturnValue("/calendar");
      const shortConfig: ScheduleConfig = {
        sequences: [
          {
            id: "seq-1",
            name: "Main",
            enabled: true,
            screens: ["/calendar", "/recipe", "/tasks"],
            intervalSeconds: 5,
            pauseOnInteractionSeconds: 120,
          },
        ],
        timeSpecific: [],
      };

      const { result } = renderHook(() => useScreenScheduler(shortConfig));

      act(() => {
        result.current.controls.start();
      });
      expect(result.current.state.timeUntilNextNav).toBe(5);

      // After one tick the countdown is strictly less than 5 — i.e. it is
      // actually decrementing rather than being reset by a separate timer.
      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(result.current.state.timeUntilNextNav).toBeLessThan(5);
      expect(result.current.state.timeUntilNextNav).toBeGreaterThanOrEqual(3);

      // Cross the first interval boundary. Rotation must fire AND the
      // countdown must reset to the configured `intervalSeconds` (5),
      // proving both clocks share the same source of truth.
      act(() => {
        vi.advanceTimersByTime(5000);
      });
      expect(mockPush).toHaveBeenLastCalledWith("/recipe");
      expect(result.current.state.timeUntilNextNav).toBe(5);

      // Two more full intervals must rotate exactly two more times, with
      // the countdown landing back on 5 at the end. A drifting countdown
      // would diverge from the rotation by tens of seconds across many
      // cycles; this assertion catches even single-tick drift early.
      const pushesAfterFirst = mockPush.mock.calls.length;
      act(() => {
        vi.advanceTimersByTime(10000);
      });
      expect(mockPush.mock.calls.length).toBe(pushesAfterFirst + 2);
      expect(result.current.state.timeUntilNextNav).toBe(5);
    });
  });
});
