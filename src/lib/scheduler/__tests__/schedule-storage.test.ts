/**
 * Tests for schedule-storage.ts
 *
 * Tests localStorage persistence for schedule configuration.
 */
import type { ScheduleConfig } from "@/components/scheduler/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SCHEDULE_CONFIG } from "../schedule-config";
import {
  SCHEDULE_STORAGE_KEY,
  loadScheduleConfig,
  saveScheduleConfig,
} from "../schedule-storage";

describe("schedule-storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe("loadScheduleConfig", () => {
    it("returns default config when localStorage is empty", () => {
      const config = loadScheduleConfig();
      expect(config).toEqual(DEFAULT_SCHEDULE_CONFIG);
    });

    it("returns default config when localStorage has invalid JSON", () => {
      localStorage.setItem(SCHEDULE_STORAGE_KEY, "not-valid-json");
      const config = loadScheduleConfig();
      expect(config).toEqual(DEFAULT_SCHEDULE_CONFIG);
    });

    it("returns stored config when valid data exists", () => {
      const customConfig: ScheduleConfig = {
        sequences: [
          {
            id: "custom-seq",
            name: "Custom Sequence",
            enabled: true,
            screens: ["/custom"],
            intervalSeconds: 30,
            pauseOnInteractionSeconds: 60,
          },
        ],
        timeSpecific: [],
      };
      localStorage.setItem(SCHEDULE_STORAGE_KEY, JSON.stringify(customConfig));
      const config = loadScheduleConfig();
      expect(config).toEqual(customConfig);
    });
  });

  describe("saveScheduleConfig", () => {
    it("saves config to localStorage", () => {
      const config: ScheduleConfig = {
        sequences: [
          {
            id: "test-seq",
            name: "Test",
            enabled: true,
            screens: ["/test"],
            intervalSeconds: 45,
            pauseOnInteractionSeconds: 90,
          },
        ],
        timeSpecific: [],
      };
      saveScheduleConfig(config);
      const stored = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      expect(stored).not.toBeNull();
      expect(JSON.parse(stored!)).toEqual(config);
    });

    it("overwrites existing config", () => {
      const config1: ScheduleConfig = {
        sequences: [],
        timeSpecific: [],
      };
      const config2: ScheduleConfig = {
        sequences: [
          {
            id: "new-seq",
            name: "New",
            enabled: false,
            screens: ["/new"],
            intervalSeconds: 10,
            pauseOnInteractionSeconds: 30,
          },
        ],
        timeSpecific: [],
      };
      saveScheduleConfig(config1);
      saveScheduleConfig(config2);
      const stored = localStorage.getItem(SCHEDULE_STORAGE_KEY);
      expect(JSON.parse(stored!)).toEqual(config2);
    });
  });

  describe("round-trip", () => {
    it("save then load returns the same config", () => {
      const config: ScheduleConfig = {
        sequences: [
          {
            id: "round-trip-seq",
            name: "Round Trip",
            enabled: true,
            screens: ["/calendar", "/recipe", "/tasks"],
            intervalSeconds: 60,
            pauseOnInteractionSeconds: 120,
          },
        ],
        timeSpecific: [
          {
            id: "round-trip-nav",
            enabled: true,
            screen: "/recipe",
            time: "17:30",
            durationMinutes: 30,
            days: [1, 2, 3, 4, 5],
          },
        ],
      };
      saveScheduleConfig(config);
      const loaded = loadScheduleConfig();
      expect(loaded).toEqual(config);
    });
  });
});
