/**
 * Schedule Configuration Defaults
 *
 * Provides default schedule configuration and factory functions
 * for creating new sequences and time-specific navigation rules.
 */
import type {
  ScheduleConfig,
  ScreenSequence,
  TimeSpecificNavigation,
  TransitionConfig,
} from "@/components/scheduler/types";

/** Default scheduler timing values (matching Prisma UserSettings defaults) */
export const SCHEDULER_DEFAULTS = {
  intervalSeconds: 10,
  pauseOnInteractionSeconds: 30,
} as const;

/** Default transition configuration */
export const DEFAULT_TRANSITION_CONFIG: TransitionConfig = {
  type: "slide",
  durationMs: 400,
} as const;

/** Optional overrides for scheduler timing, typically from user settings */
export interface SchedulerTimingOverrides {
  intervalSeconds?: number;
  pauseOnInteractionSeconds?: number;
}

/**
 * Create a new ScreenSequence with default values.
 * Optionally accepts timing overrides from user settings.
 *
 * @param overrides - Optional interval/pause values from user settings
 * @returns A new ScreenSequence with a unique ID and sensible defaults
 */
export function createDefaultSequence(
  overrides?: SchedulerTimingOverrides
): ScreenSequence {
  return {
    id: `seq-${crypto.randomUUID()}`,
    name: "New Sequence",
    enabled: true,
    screens: ["/calendar"],
    intervalSeconds:
      overrides?.intervalSeconds ?? SCHEDULER_DEFAULTS.intervalSeconds,
    pauseOnInteractionSeconds:
      overrides?.pauseOnInteractionSeconds ??
      SCHEDULER_DEFAULTS.pauseOnInteractionSeconds,
  };
}

/**
 * Create a new TimeSpecificNavigation with default values.
 *
 * @returns A new TimeSpecificNavigation with a unique ID and sensible defaults
 */
export function createDefaultTimeSpecific(): TimeSpecificNavigation {
  return {
    id: `ts-${crypto.randomUUID()}`,
    enabled: true,
    screen: "/calendar",
    time: "12:00",
    durationMinutes: 30,
  };
}

/**
 * Default schedule configuration with a basic rotation sequence.
 * Optionally accepts timing overrides from user settings.
 */
export function createDefaultScheduleConfig(
  overrides?: SchedulerTimingOverrides
): ScheduleConfig {
  return {
    sequences: [
      {
        id: "default-seq",
        name: "Main Rotation",
        enabled: true,
        screens: ["/calendar", "/tasks"],
        intervalSeconds:
          overrides?.intervalSeconds ?? SCHEDULER_DEFAULTS.intervalSeconds,
        pauseOnInteractionSeconds:
          overrides?.pauseOnInteractionSeconds ??
          SCHEDULER_DEFAULTS.pauseOnInteractionSeconds,
      },
    ],
    timeSpecific: [],
    transition: { ...DEFAULT_TRANSITION_CONFIG },
  };
}

/**
 * Default schedule configuration with a basic rotation sequence.
 * @deprecated Use createDefaultScheduleConfig() for user-configurable defaults
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig =
  createDefaultScheduleConfig();
