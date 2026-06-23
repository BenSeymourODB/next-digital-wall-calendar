/**
 * Tests for useEventCacheVisibilitySweep — #290 sub-task 2 trigger.
 */
import { eventCache } from "@/lib/event-cache";
import { logger } from "@/lib/logger";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEventCacheVisibilitySweep } from "../use-event-cache-visibility-sweep";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
    dependency: vi.fn(),
  },
}));

/**
 * jsdom's `document.visibilityState` is a getter on `Document.prototype`. Tests
 * need to flip it between renders, so install a configurable override and
 * restore it afterwards.
 */
function stubVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => value,
  });
}

const originalVisibilityDescriptor = Object.getOwnPropertyDescriptor(
  Document.prototype,
  "visibilityState"
);

describe("useEventCacheVisibilitySweep", () => {
  let sweepSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    sweepSpy = vi.spyOn(eventCache, "sweepExpired").mockResolvedValue(0);
  });

  afterEach(() => {
    sweepSpy.mockRestore();
    if (originalVisibilityDescriptor) {
      Object.defineProperty(
        Document.prototype,
        "visibilityState",
        originalVisibilityDescriptor
      );
    }
    vi.mocked(logger.error).mockClear();
  });

  it("sweeps once on mount when the document is already visible", () => {
    stubVisibilityState("visible");

    renderHook(() => useEventCacheVisibilitySweep());

    expect(sweepSpy).toHaveBeenCalledOnce();
  });

  it("does NOT sweep on mount when the document is hidden", () => {
    stubVisibilityState("hidden");

    renderHook(() => useEventCacheVisibilitySweep());

    // Hidden → visible transition will fire the listener; mount-time doesn't.
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("sweeps when visibility transitions to visible after being hidden", async () => {
    stubVisibilityState("hidden");
    renderHook(() => useEventCacheVisibilitySweep());

    // Simulate the tab coming back: flip the state, dispatch the event.
    stubVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sweepSpy).toHaveBeenCalledOnce();
  });

  it("does not sweep when visibility transitions to hidden", () => {
    stubVisibilityState("visible");
    renderHook(() => useEventCacheVisibilitySweep());
    // Clear the mount-time call so we can isolate the transition.
    sweepSpy.mockClear();

    stubVisibilityState("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    stubVisibilityState("visible");
    const { unmount } = renderHook(() => useEventCacheVisibilitySweep());
    sweepSpy.mockClear();

    unmount();

    // After unmount, a visibilitychange event must not fire the sweep.
    stubVisibilityState("visible");
    document.dispatchEvent(new Event("visibilitychange"));
    expect(sweepSpy).not.toHaveBeenCalled();
  });

  it("logs and swallows errors from the sweep — does not crash the host", async () => {
    sweepSpy.mockRejectedValueOnce(new Error("idb gone"));
    stubVisibilityState("visible");

    expect(() =>
      renderHook(() => useEventCacheVisibilitySweep())
    ).not.toThrow();

    // The error path is async; flush microtasks so the .catch() runs.
    await Promise.resolve();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalled();
    const [errArg] = vi.mocked(logger.error).mock.calls[0]!;
    expect((errArg as Error).message).toBe("idb gone");
  });
});
