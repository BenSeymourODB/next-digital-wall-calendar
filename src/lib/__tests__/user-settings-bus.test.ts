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
});
