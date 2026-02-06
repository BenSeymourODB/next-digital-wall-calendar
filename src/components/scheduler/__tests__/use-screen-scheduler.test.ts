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
  });
});
