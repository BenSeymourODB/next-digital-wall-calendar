"use client";

/**
 * User Interaction Detector Hook
 *
 * Detects user interactions (click, scroll, keydown, touchstart, wheel)
 * and pauses the scheduler for a configurable duration. Uses passive
 * event listeners for performance and debounces rapid interactions.
 */
import { useEffect, useRef, useState } from "react";

interface UseInteractionDetectorOptions {
  /** Duration in milliseconds to pause after user interaction */
  pauseDurationMs: number;
  /** Whether the detector is enabled */
  enabled: boolean;
}

interface UseInteractionDetectorResult {
  /** Whether the scheduler is currently paused due to user interaction */
  isPaused: boolean;
}

const INTERACTION_EVENTS = [
  "click",
  "scroll",
  "keydown",
  "touchstart",
  "wheel",
] as const;

/**
 * Hook that detects user interactions and returns a paused state.
 *
 * When the user interacts with the page (click, scroll, keydown, touchstart, wheel),
 * the hook sets isPaused to true immediately for the specified duration.
 * Subsequent interactions reset the resume timer.
 *
 * @param options - Configuration for pause duration and enabled state
 * @returns Object with isPaused boolean
 */
export function useInteractionDetector(
  options: UseInteractionDetectorOptions
): UseInteractionDetectorResult {
  const { pauseDurationMs, enabled } = options;
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      // Use a microtask to avoid synchronous setState in effect
      queueMicrotask(() => setIsPaused(false));
      return;
    }

    const handleInteraction = () => {
      // Pause immediately on interaction
      setIsPaused(true);

      // Clear any existing resume timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Set timeout to resume after pause duration
      timeoutRef.current = setTimeout(() => {
        setIsPaused(false);
        timeoutRef.current = null;
      }, pauseDurationMs);
    };

    // Add event listeners with passive option for performance
    for (const event of INTERACTION_EVENTS) {
      window.addEventListener(event, handleInteraction, { passive: true });
    }

    return () => {
      for (const event of INTERACTION_EVENTS) {
        window.removeEventListener(event, handleInteraction);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, pauseDurationMs]);

  return { isPaused };
}
