"use client";

/**
 * Screen Scheduler Component
 *
 * Main component that wraps page content and provides automatic
 * screen rotation with floating navigation controls. Integrates
 * the screen scheduler hook, interaction detector, and navigation
 * controls into a cohesive component.
 */
import { DEFAULT_TRANSITION_CONFIG } from "@/lib/scheduler/schedule-config";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { NavigationControls } from "./navigation-controls";
import { SchedulerStatusIndicator } from "./scheduler-status-indicator";
import { ScreenTransition } from "./screen-transition";
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
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Get pause duration from first enabled sequence
  const enabledSequence = config.sequences.find(
    (s) => s.enabled && s.screens.length > 0
  );
  const pauseDurationMs = enabledSequence
    ? enabledSequence.pauseOnInteractionSeconds * 1000
    : 120000;

  // Interaction detector runs unconditionally; externalPaused is threaded into hook
  const { isPaused: isInteractionPaused } = useInteractionDetector({
    pauseDurationMs,
    enabled: true,
  });

  const { state, controls } = useScreenScheduler(config, isInteractionPaused);
  const pathname = usePathname();

  const totalScreens = enabledSequence ? enabledSequence.screens.length : 0;
  const transitionConfig = config.transition ?? DEFAULT_TRANSITION_CONFIG;
  const effectivelyPaused = state.isPaused || isInteractionPaused;
  const isRotating =
    state.isActive && !effectivelyPaused && !state.activeTimeSpecific;
  const intervalSeconds = enabledSequence?.intervalSeconds ?? 0;

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
          if (effectivelyPaused) {
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
  }, [state.isActive, effectivelyPaused, controls]);

  return (
    <>
      <ScreenTransition
        pathname={pathname}
        direction={state.transitionDirection}
        transition={transitionConfig}
      >
        {children}
      </ScreenTransition>
      {state.isActive && totalScreens > 0 && (
        <>
          <NavigationControls
            currentIndex={state.currentIndex}
            totalScreens={totalScreens}
            isPaused={effectivelyPaused}
            isVisible={controlsVisible}
            onPrevious={controls.navigateToPrevious}
            onNext={controls.navigateToNext}
            onTogglePause={() => {
              if (effectivelyPaused) {
                controls.resume();
              } else {
                controls.pause();
              }
            }}
          />
          <SchedulerStatusIndicator
            isRotating={isRotating}
            isPaused={effectivelyPaused}
            timeUntilNextNav={state.timeUntilNextNav}
            intervalSeconds={intervalSeconds}
          />
        </>
      )}
    </>
  );
}
