/**
 * Schedule Storage
 *
 * Handles localStorage persistence for schedule configuration.
 * Provides load and save functions with error handling and
 * fallback to defaults when stored data is invalid.
 */
import type { ScheduleConfig } from "@/components/scheduler/types";
import { DEFAULT_SCHEDULE_CONFIG } from "./schedule-config";

/**
 * The localStorage key used to persist schedule configuration.
 */
export const SCHEDULE_STORAGE_KEY = "screen-scheduler-config";

/**
 * Load the schedule configuration from localStorage.
 * Returns the default configuration if no valid data is found.
 *
 * @returns The stored ScheduleConfig or the default config
 */
export function loadScheduleConfig(): ScheduleConfig {
  if (typeof window === "undefined") {
    return DEFAULT_SCHEDULE_CONFIG;
  }

  try {
    const stored = window.localStorage.getItem(SCHEDULE_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SCHEDULE_CONFIG;
    }

    const parsed = JSON.parse(stored) as ScheduleConfig;

    // Basic validation: must have sequences and timeSpecific arrays
    if (
      !Array.isArray(parsed.sequences) ||
      !Array.isArray(parsed.timeSpecific)
    ) {
      return DEFAULT_SCHEDULE_CONFIG;
    }

    return parsed;
  } catch {
    return DEFAULT_SCHEDULE_CONFIG;
  }
}

/**
 * Save the schedule configuration to localStorage.
 *
 * @param config - The ScheduleConfig to persist
 */
export function saveScheduleConfig(config: ScheduleConfig): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage quota exceeded or other localStorage error
    // Silently fail - the app continues to work with in-memory config
  }
}
