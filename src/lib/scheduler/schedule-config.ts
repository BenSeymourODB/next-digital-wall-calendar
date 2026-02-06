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
} from "@/components/scheduler/types";

let idCounter = 0;

/**
 * Generate a unique ID for schedule items.
 * Uses a combination of timestamp and counter to ensure uniqueness.
 */
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/**
 * Create a new ScreenSequence with default values.
 *
 * @returns A new ScreenSequence with a unique ID and sensible defaults
 */
export function createDefaultSequence(): ScreenSequence {
  return {
    id: generateId("seq"),
    name: "New Sequence",
    enabled: true,
    screens: ["/calendar"],
    intervalSeconds: 60,
    pauseOnInteractionSeconds: 120,
  };
}

/**
 * Create a new TimeSpecificNavigation with default values.
 *
 * @returns A new TimeSpecificNavigation with a unique ID and sensible defaults
 */
export function createDefaultTimeSpecific(): TimeSpecificNavigation {
  return {
    id: generateId("ts"),
    enabled: true,
    screen: "/calendar",
    time: "12:00",
    durationMinutes: 30,
  };
}

/**
 * Default schedule configuration with a basic rotation sequence.
 */
export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  sequences: [
    {
      id: "default-seq",
      name: "Main Rotation",
      enabled: true,
      screens: ["/calendar", "/tasks"],
      intervalSeconds: 60,
      pauseOnInteractionSeconds: 120,
    },
  ],
  timeSpecific: [],
};
