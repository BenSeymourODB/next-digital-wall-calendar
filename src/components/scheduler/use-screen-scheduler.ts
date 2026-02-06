"use client";

/**
 * Screen Scheduler Hook
 *
 * Core scheduler logic that manages screen rotation sequences,
 * time-specific navigation, and Page Visibility API integration.
 * Uses Next.js router for navigation between pages.
 */
import { isActiveDay, isTimeMatch } from "@/lib/scheduler/time-utils";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type {
  ScheduleConfig,
  SchedulerControls,
  SchedulerState,
  ScreenSequence,
  TimeSpecificNavigation,
} from "./types";

interface UseScreenSchedulerResult {
  state: SchedulerState;
  controls: SchedulerControls;
}

/**
 * Find the first enabled sequence in the configuration.
 */
function findEnabledSequence(
  config: ScheduleConfig
): ScreenSequence | undefined {
  return config.sequences.find((seq) => seq.enabled && seq.screens.length > 0);
}

/**
 * Find the index of a path within a sequence's screen list.
 * Returns 0 if the path is not found.
 */
function findScreenIndex(sequence: ScreenSequence, pathname: string): number {
  const index = sequence.screens.indexOf(pathname);
  return index >= 0 ? index : 0;
}

/**
 * Check if any time-specific navigation should be active right now.
 */
function findActiveTimeSpecific(
  timeSpecific: TimeSpecificNavigation[],
  now: Date
): TimeSpecificNavigation | null {
  for (const ts of timeSpecific) {
    if (!ts.enabled) continue;
    if (!isActiveDay(ts.days, now.getDay())) continue;
    if (isTimeMatch(now, ts.time)) {
      return ts;
    }
  }
  return null;
}

/**
 * Hook providing core screen scheduler logic.
 *
 * Manages automatic screen rotation, time-specific navigation,
 * pause/resume controls, and Page Visibility API integration.
 *
 * @param config - The schedule configuration
 * @returns Object with scheduler state and control functions
 */
export function useScreenScheduler(
  config: ScheduleConfig
): UseScreenSchedulerResult {
  const router = useRouter();
  const pathname = usePathname();

  const enabledSequence = findEnabledSequence(config);

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentSequenceId, setCurrentSequenceId] = useState<string | null>(
    null
  );
  const [currentIndex, setCurrentIndex] = useState(() => {
    if (enabledSequence) {
      return findScreenIndex(enabledSequence, pathname);
    }
    return 0;
  });
  const [timeUntilNextNav, setTimeUntilNextNav] = useState(0);
  const [activeTimeSpecific, setActiveTimeSpecific] =
    useState<TimeSpecificNavigation | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef = useRef(true);

  // Get the currently active sequence
  const activeSequence = config.sequences.find(
    (seq) => seq.id === currentSequenceId
  );

  // --- Control functions ---

  const start = () => {
    if (!enabledSequence) return;
    setIsActive(true);
    setCurrentSequenceId(enabledSequence.id);
    setCurrentIndex(findScreenIndex(enabledSequence, pathname));
    setTimeUntilNextNav(enabledSequence.intervalSeconds);
  };

  const stop = () => {
    setIsActive(false);
    setIsPaused(false);
    setCurrentSequenceId(null);
    setActiveTimeSpecific(null);
    setTimeUntilNextNav(0);
  };

  const pause = () => {
    if (isActive) {
      setIsPaused(true);
    }
  };

  const resume = () => {
    setIsPaused(false);
  };

  const navigateToNext = () => {
    if (!isActive || !activeSequence) return;
    const screens = activeSequence.screens;
    const nextIndex = (currentIndex + 1) % screens.length;
    setCurrentIndex(nextIndex);
    router.push(screens[nextIndex]);
    setTimeUntilNextNav(activeSequence.intervalSeconds);
  };

  const navigateToPrevious = () => {
    if (!isActive || !activeSequence) return;
    const screens = activeSequence.screens;
    const prevIndex = (currentIndex - 1 + screens.length) % screens.length;
    setCurrentIndex(prevIndex);
    router.push(screens[prevIndex]);
    setTimeUntilNextNav(activeSequence.intervalSeconds);
  };

  // --- Auto-rotation interval ---

  useEffect(() => {
    if (!isActive || isPaused || !activeSequence || !isVisibleRef.current) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      return;
    }

    // If a time-specific navigation is active, skip sequence rotation
    if (activeTimeSpecific) {
      return;
    }

    const intervalSecs = activeSequence.intervalSeconds;

    // Countdown timer (every second) — starts at full interval
    let countdown = intervalSecs;
    countdownRef.current = setInterval(() => {
      countdown -= 1;
      if (countdown < 0) countdown = intervalSecs;
      setTimeUntilNextNav(countdown);
    }, 1000);

    // Navigation interval
    intervalRef.current = setInterval(() => {
      const screens = activeSequence.screens;
      setCurrentIndex((prev) => {
        const nextIndex = (prev + 1) % screens.length;
        router.push(screens[nextIndex]);
        return nextIndex;
      });
    }, activeSequence.intervalSeconds * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [isActive, isPaused, activeSequence, activeTimeSpecific, router]);

  // --- Time-specific navigation check (every 60 seconds) ---

  useEffect(() => {
    if (!isActive) {
      if (timeCheckRef.current) {
        clearInterval(timeCheckRef.current);
        timeCheckRef.current = null;
      }
      return;
    }

    const checkTimeSpecific = () => {
      const now = new Date();
      const active = findActiveTimeSpecific(config.timeSpecific, now);

      if (active && active.id !== activeTimeSpecific?.id) {
        setActiveTimeSpecific(active);
        router.push(active.screen);
      } else if (!active && activeTimeSpecific) {
        // Time-specific navigation ended, resume sequence
        setActiveTimeSpecific(null);
      }
    };

    // Check immediately and then every 60 seconds
    timeCheckRef.current = setInterval(checkTimeSpecific, 60000);

    return () => {
      if (timeCheckRef.current) {
        clearInterval(timeCheckRef.current);
        timeCheckRef.current = null;
      }
    };
  }, [isActive, config.timeSpecific, activeTimeSpecific, router]);

  // --- Page Visibility API ---

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const state: SchedulerState = {
    isActive,
    isPaused,
    currentSequenceId,
    currentIndex,
    timeUntilNextNav,
    pausedUntil: null,
    activeTimeSpecific,
  };

  const controls: SchedulerControls = {
    start,
    stop,
    pause,
    resume,
    navigateToNext,
    navigateToPrevious,
  };

  return { state, controls };
}
