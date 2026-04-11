/**
 * Screen Rotation Scheduler Types
 *
 * Type definitions for the screen rotation and navigation scheduling system.
 */

/**
 * A sequence of screens to rotate through at regular intervals.
 */
export interface ScreenSequence {
  id: string;
  name: string;
  enabled: boolean;
  screens: string[]; // Page paths like "/calendar", "/recipe"
  intervalSeconds: number;
  pauseOnInteractionSeconds: number;
}

/**
 * A time-specific navigation rule that overrides sequence rotation.
 */
export interface TimeSpecificNavigation {
  id: string;
  enabled: boolean;
  screen: string;
  time: string; // "HH:MM" format
  durationMinutes: number;
  days?: number[]; // 0=Sun, 1=Mon, ..., 6=Sat; undefined means every day
}

/**
 * Transition animation type for page transitions.
 */
export type TransitionType = "slide" | "fade" | "slide-fade" | "none";

/**
 * Navigation direction for determining transition animation direction.
 */
export type TransitionDirection = "forward" | "backward";

/**
 * Configuration for animated page transitions between scheduler screens.
 */
export interface TransitionConfig {
  /** Animation type — 'none' disables transitions */
  type: TransitionType;
  /** Duration in milliseconds (200-1000ms range) */
  durationMs: number;
}

/**
 * Full schedule configuration containing sequences, time-specific rules,
 * and transition preferences.
 */
export interface ScheduleConfig {
  sequences: ScreenSequence[];
  timeSpecific: TimeSpecificNavigation[];
  transition?: TransitionConfig;
}

/**
 * Current state of the scheduler.
 */
export interface SchedulerState {
  isActive: boolean;
  isPaused: boolean;
  currentSequenceId: string | null;
  currentIndex: number;
  timeUntilNextNav: number;
  pausedUntil: Date | null;
  activeTimeSpecific: TimeSpecificNavigation | null;
  /** Direction of the last navigation (for transition animations) */
  transitionDirection: TransitionDirection;
}

/**
 * Control functions returned by the useScreenScheduler hook.
 */
export interface SchedulerControls {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  navigateToNext: () => void;
  navigateToPrevious: () => void;
}
