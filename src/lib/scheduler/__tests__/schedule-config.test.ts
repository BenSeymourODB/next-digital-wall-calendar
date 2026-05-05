/**
 * Tests for schedule-config.ts
 *
 * Tests default configuration and factory functions.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE_CONFIG,
  DEFAULT_TRANSITION_CONFIG,
  SCHEDULER_DEFAULTS,
  createDefaultScheduleConfig,
  createDefaultSequence,
  createDefaultTimeSpecific,
} from "../schedule-config";

describe("DEFAULT_SCHEDULE_CONFIG", () => {
  it("has sequences array", () => {
    expect(Array.isArray(DEFAULT_SCHEDULE_CONFIG.sequences)).toBe(true);
  });

  it("has timeSpecific array", () => {
    expect(Array.isArray(DEFAULT_SCHEDULE_CONFIG.timeSpecific)).toBe(true);
  });

  it("has at least one default sequence", () => {
    expect(DEFAULT_SCHEDULE_CONFIG.sequences.length).toBeGreaterThanOrEqual(1);
  });

  it("default sequence has expected properties", () => {
    const seq = DEFAULT_SCHEDULE_CONFIG.sequences[0];
    expect(seq).toHaveProperty("id");
    expect(seq).toHaveProperty("name");
    expect(seq).toHaveProperty("enabled");
    expect(seq).toHaveProperty("screens");
    expect(seq).toHaveProperty("intervalSeconds");
    expect(seq).toHaveProperty("pauseOnInteractionSeconds");
    expect(Array.isArray(seq.screens)).toBe(true);
    expect(seq.screens.length).toBeGreaterThan(0);
  });

  it("default sequence has reasonable interval defaults", () => {
    const seq = DEFAULT_SCHEDULE_CONFIG.sequences[0];
    expect(seq.intervalSeconds).toBeGreaterThanOrEqual(5);
    expect(seq.intervalSeconds).toBeLessThanOrEqual(300);
    expect(seq.pauseOnInteractionSeconds).toBeGreaterThanOrEqual(10);
  });
});

describe("createDefaultSequence", () => {
  it("returns a valid ScreenSequence", () => {
    const seq = createDefaultSequence();
    expect(seq.id).toBeDefined();
    expect(typeof seq.id).toBe("string");
    expect(seq.id.length).toBeGreaterThan(0);
    expect(seq.name).toBeDefined();
    expect(seq.enabled).toBe(true);
    expect(Array.isArray(seq.screens)).toBe(true);
    expect(typeof seq.intervalSeconds).toBe("number");
    expect(typeof seq.pauseOnInteractionSeconds).toBe("number");
  });

  it("returns unique ids on multiple calls", () => {
    const seq1 = createDefaultSequence();
    const seq2 = createDefaultSequence();
    expect(seq1.id).not.toBe(seq2.id);
  });

  // Regression: issue #221 bug 5 — earlier implementations relied on a
  // module-level mutable `idCounter` that risked collisions across SSR
  // hydration boundaries and test runs. `crypto.randomUUID()` is now used,
  // and any future regression to a counter would surface here.
  it("regression (issue #221, bug 5): produces distinct ids across many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 64; i += 1) {
      ids.add(createDefaultSequence().id);
    }
    expect(ids.size).toBe(64);
  });

  it("uses SCHEDULER_DEFAULTS when no overrides provided", () => {
    const seq = createDefaultSequence();
    expect(seq.intervalSeconds).toBe(SCHEDULER_DEFAULTS.intervalSeconds);
    expect(seq.pauseOnInteractionSeconds).toBe(
      SCHEDULER_DEFAULTS.pauseOnInteractionSeconds
    );
  });

  it("accepts timing overrides from user settings", () => {
    const seq = createDefaultSequence({
      intervalSeconds: 45,
      pauseOnInteractionSeconds: 90,
    });
    expect(seq.intervalSeconds).toBe(45);
    expect(seq.pauseOnInteractionSeconds).toBe(90);
  });

  it("allows partial overrides", () => {
    const seq = createDefaultSequence({ intervalSeconds: 20 });
    expect(seq.intervalSeconds).toBe(20);
    expect(seq.pauseOnInteractionSeconds).toBe(
      SCHEDULER_DEFAULTS.pauseOnInteractionSeconds
    );
  });
});

describe("createDefaultScheduleConfig", () => {
  it("returns config with SCHEDULER_DEFAULTS when no overrides", () => {
    const config = createDefaultScheduleConfig();
    expect(config.sequences[0].intervalSeconds).toBe(
      SCHEDULER_DEFAULTS.intervalSeconds
    );
    expect(config.sequences[0].pauseOnInteractionSeconds).toBe(
      SCHEDULER_DEFAULTS.pauseOnInteractionSeconds
    );
  });

  it("accepts timing overrides", () => {
    const config = createDefaultScheduleConfig({
      intervalSeconds: 60,
      pauseOnInteractionSeconds: 120,
    });
    expect(config.sequences[0].intervalSeconds).toBe(60);
    expect(config.sequences[0].pauseOnInteractionSeconds).toBe(120);
  });
});

describe("createDefaultTimeSpecific", () => {
  it("returns a valid TimeSpecificNavigation", () => {
    const nav = createDefaultTimeSpecific();
    expect(nav.id).toBeDefined();
    expect(typeof nav.id).toBe("string");
    expect(nav.id.length).toBeGreaterThan(0);
    expect(typeof nav.enabled).toBe("boolean");
    expect(typeof nav.screen).toBe("string");
    expect(nav.time).toMatch(/^\d{2}:\d{2}$/);
    expect(typeof nav.durationMinutes).toBe("number");
    expect(nav.durationMinutes).toBeGreaterThan(0);
  });

  it("returns unique ids on multiple calls", () => {
    const nav1 = createDefaultTimeSpecific();
    const nav2 = createDefaultTimeSpecific();
    expect(nav1.id).not.toBe(nav2.id);
  });

  // Regression: issue #221 bug 5 — see `createDefaultSequence`'s matching
  // regression above. Same root cause, different factory.
  it("regression (issue #221, bug 5): produces distinct ids across many calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 64; i += 1) {
      ids.add(createDefaultTimeSpecific().id);
    }
    expect(ids.size).toBe(64);
  });

  it("is enabled by default", () => {
    const nav = createDefaultTimeSpecific();
    expect(nav.enabled).toBe(true);
  });
});

describe("DEFAULT_TRANSITION_CONFIG", () => {
  it("has slide as default type", () => {
    expect(DEFAULT_TRANSITION_CONFIG.type).toBe("slide");
  });

  it("has 400ms as default duration", () => {
    expect(DEFAULT_TRANSITION_CONFIG.durationMs).toBe(400);
  });
});

describe("ScheduleConfig transition field", () => {
  it("DEFAULT_SCHEDULE_CONFIG includes transition config", () => {
    expect(DEFAULT_SCHEDULE_CONFIG.transition).toBeDefined();
    expect(DEFAULT_SCHEDULE_CONFIG.transition).toEqual(
      DEFAULT_TRANSITION_CONFIG
    );
  });

  it("createDefaultScheduleConfig includes transition config", () => {
    const config = createDefaultScheduleConfig();
    expect(config.transition).toEqual(DEFAULT_TRANSITION_CONFIG);
  });

  it("createDefaultScheduleConfig transition is a separate copy", () => {
    const config1 = createDefaultScheduleConfig();
    const config2 = createDefaultScheduleConfig();
    expect(config1.transition).not.toBe(config2.transition);
    expect(config1.transition).toEqual(config2.transition);
  });
});
