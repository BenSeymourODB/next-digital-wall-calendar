/**
 * Tests for schedule-config.ts
 *
 * Tests default configuration and factory functions.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCHEDULE_CONFIG,
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
    expect(seq.intervalSeconds).toBeGreaterThanOrEqual(10);
    expect(seq.intervalSeconds).toBeLessThanOrEqual(300);
    expect(seq.pauseOnInteractionSeconds).toBeGreaterThanOrEqual(30);
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

  it("has default interval of 60 seconds", () => {
    const seq = createDefaultSequence();
    expect(seq.intervalSeconds).toBe(60);
  });

  it("has default pause on interaction of 120 seconds", () => {
    const seq = createDefaultSequence();
    expect(seq.pauseOnInteractionSeconds).toBe(120);
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

  it("is enabled by default", () => {
    const nav = createDefaultTimeSpecific();
    expect(nav.enabled).toBe(true);
  });
});
