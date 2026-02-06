"use client";

/**
 * Screen Scheduler Component
 *
 * Main component that wraps page content and provides automatic
 * screen rotation with floating navigation controls. Integrates
 * the screen scheduler hook, interaction detector, and navigation
 * controls into a cohesive component.
 */
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { NavigationControls } from "./navigation-controls";
import type { ScheduleConfig } from "./types";
import { useInteractionDetector } from "./use-interaction-detector";
import { useScreenScheduler } from "./use-screen-scheduler";

interface ScreenSchedulerProps {
  /** Schedule configuration for sequences and time-specific navigation */
  config: ScheduleConfig;
  /** Page content to render */
  children: ReactNode;
  /** Whether to automatically start the scheduler on mount */
  autoStart?: boolean;
}

const AUTO_HIDE_MS = 5000;

/**
 * Screen Scheduler wraps page content and provides automatic
 * screen rotation with floating navigation controls.
 *
 * Features:
 * - Automatic rotation through configured screen sequences
 * - Floating navigation controls (prev/pause/next) with auto-hide
 * - Pause on user interaction
 * - Page Visibility API integration
 * - Keyboard shortcuts (Left/Right/Space)
 */
export function ScreenScheduler({
  config,
  children,
  autoStart = false,
}: ScreenSchedulerProps) {
  const { state, controls } = useScreenScheduler(config);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get pause duration from first enabled sequence
  const enabledSequence = config.sequences.find(
    (s) => s.enabled && s.screens.length > 0
  );
  const pauseDurationMs = enabledSequence
    ? enabledSequence.pauseOnInteractionSeconds * 1000
    : 120000;

  const { isPaused: isInteractionPaused } = useInteractionDetector({
    pauseDurationMs,
    enabled: state.isActive,
  });

  // Pause scheduler when user interacts
  useEffect(() => {
    if (isInteractionPaused && state.isActive && !state.isPaused) {
      controls.pause();
    } else if (!isInteractionPaused && state.isActive && state.isPaused) {
      controls.resume();
    }
  }, [isInteractionPaused, state.isActive, state.isPaused, controls]);

  // Auto-start on mount if requested
  useEffect(() => {
    if (autoStart && !state.isActive && enabledSequence) {
      controls.start();
    }
  }, [autoStart, state.isActive, enabledSequence, controls]);

  // Auto-hide navigation controls after inactivity
  useEffect(() => {
    if (!state.isActive) return;

    const resetHideTimer = () => {
      setControlsVisible(true);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
      hideTimerRef.current = setTimeout(() => {
        setControlsVisible(false);
      }, AUTO_HIDE_MS);
    };

    // Start the initial hide timer
    resetHideTimer();

    const handleMouseMove = () => {
      resetHideTimer();
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [state.isActive]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!state.isActive) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowLeft":
          controls.navigateToPrevious();
          break;
        case "ArrowRight":
          controls.navigateToNext();
          break;
        case " ":
          e.preventDefault();
          if (state.isPaused) {
            controls.resume();
          } else {
            controls.pause();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state.isActive, state.isPaused, controls]);

  const totalScreens = enabledSequence ? enabledSequence.screens.length : 0;

  return (
    <>
      {children}
      {state.isActive && totalScreens > 0 && (
        <NavigationControls
          currentIndex={state.currentIndex}
          totalScreens={totalScreens}
          isPaused={state.isPaused}
          isVisible={controlsVisible}
          onPrevious={controls.navigateToPrevious}
          onNext={controls.navigateToNext}
          onTogglePause={() => {
            if (state.isPaused) {
              controls.resume();
            } else {
              controls.pause();
            }
          }}
        />
      )}
    </>
  );
}
