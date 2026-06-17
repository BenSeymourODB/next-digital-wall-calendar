/**
 * Tests for the user-settings cross-surface bus (#337).
 *
 * The bus lets every `useUserSettings` consumer in the same tab observe
 * mutations made elsewhere on the page (e.g. the main Settings page and
 * `CalendarSettingsPanel` no longer drift apart).
 */
import {
  emitUserSettingsChange,
  subscribeUserSettings,
} from "@/lib/user-settings-bus";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("user-settings-bus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("invokes a subscriber with the dispatched partial", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeUserSettings(handler);

    emitUserSettingsChange({ timeFormat: "24h" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ timeFormat: "24h" });

    unsubscribe();
  });

  it("delivers the same emission to every subscriber", () => {
    const a = vi.fn();
    const b = vi.fn();
    const unsubA = subscribeUserSettings(a);
    const unsubB = subscribeUserSettings(b);

    emitUserSettingsChange({ timeFormat: "12h" });

    expect(a).toHaveBeenCalledWith({ timeFormat: "12h" });
    expect(b).toHaveBeenCalledWith({ timeFormat: "12h" });

    unsubA();
    unsubB();
  });

  it("stops invoking a handler after its unsubscribe runs", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeUserSettings(handler);

    unsubscribe();
    emitUserSettingsChange({ timeFormat: "24h" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("is a no-op when emitted on the server (no window)", () => {
    const original = globalThis.window;
    // Simulate a server render where `window` is undefined.
    // @ts-expect-error — intentional removal for the test
    delete globalThis.window;

    expect(() => emitUserSettingsChange({ timeFormat: "12h" })).not.toThrow();

    globalThis.window = original;
  });

  it("returns a no-op unsubscribe when subscribed on the server", () => {
    const original = globalThis.window;
    // @ts-expect-error — intentional removal for the test
    delete globalThis.window;

    const handler = vi.fn();
    const unsubscribe = subscribeUserSettings(handler);
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();

    globalThis.window = original;
  });

  /**
   * Regression coverage for #419. Before tightening, `UserSettingsBusPayload`
   * was a hand-maintained subset that omitted `weekStartDay`,
   * `calendarWorkingHoursStart`, and `calendarTransitionSpeed`. The values
   * still flowed through `CustomEvent.detail` at runtime (and were silently
   * discarded by `pickCalendarFields`), but the *type* claimed they were
   * not part of the bus contract — leaving `Partial<UserSettingsData>`
   * call sites to widen structurally.
   *
   * The real regression gate is `pnpm check-types`: the literals below
   * fail TS excess-property checking if `UserSettingsBusPayload` ever
   * drifts back to a narrower subset. The runtime `expect` assertions
   * are belt-and-braces — `CustomEvent` carries any payload regardless
   * of type, so they catch only the orthogonal case where the bus
   * starts mutating its payload (which would be a different regression).
   */
  it("round-trips weekStartDay / calendarWorkingHoursStart / calendarTransitionSpeed", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeUserSettings(handler);

    emitUserSettingsChange({
      weekStartDay: 1,
      calendarWorkingHoursStart: 8,
      calendarTransitionSpeed: "slow",
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({
      weekStartDay: 1,
      calendarWorkingHoursStart: 8,
      calendarTransitionSpeed: "slow",
    });

    unsubscribe();
  });
});
