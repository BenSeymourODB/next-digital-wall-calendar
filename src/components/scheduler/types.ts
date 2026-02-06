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
 * Full schedule configuration containing sequences and time-specific rules.
 */
export interface ScheduleConfig {
  sequences: ScreenSequence[];
  timeSpecific: TimeSpecificNavigation[];
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
