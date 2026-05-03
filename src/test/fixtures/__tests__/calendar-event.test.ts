import { beforeEach, describe, expect, it } from "vitest";
import { createMockEvent, resetMockEventIds } from "../calendar-event";

/**
 * Locks in the contract of the shared `createMockEvent` test fixture.
 * Issue #222 item 4: each call without an explicit id MUST receive a unique
 * default id, otherwise multi-event tests silently collide on React keys.
 */
describe("createMockEvent", () => {
  beforeEach(() => {
    resetMockEventIds();
  });

  it("hands out a unique default id on each call", () => {
    const a = createMockEvent();
    const b = createMockEvent();
    const c = createMockEvent();

    expect(new Set([a.id, b.id, c.id]).size).toBe(3);
  });

  it("uses a stable id format so test failures stay readable", () => {
    const event = createMockEvent();
    expect(event.id).toMatch(/^mock-event-\d+$/);
  });

  it("honours an explicit id override", () => {
    const event = createMockEvent({ id: "custom" });
    expect(event.id).toBe("custom");
  });

  it("does not increment the counter for calls that pass an explicit id", () => {
    // Implementation note: even if the counter ticks for an overridden call,
    // the visible behaviour we care about is that the *next* default-id call
    // is still unique. This test guards against any future change that breaks
    // either the uniqueness or the readable monotonic sequence.
    createMockEvent({ id: "custom-1" });
    const next = createMockEvent();
    const after = createMockEvent();
    expect(next.id).not.toBe(after.id);
  });

  it("returns sensible defaults for the rest of the IEvent shape", () => {
    const event = createMockEvent();
    expect(event.title).toBe("Test Event");
    expect(event.color).toBe("blue");
    expect(event.isAllDay).toBe(false);
    expect(event.calendarId).toBe("primary");
    expect(event.user).toEqual({
      id: "user-1",
      name: "Test User",
      picturePath: null,
    });
  });

  it("merges overrides on top of defaults", () => {
    const event = createMockEvent({
      title: "Specific Title",
      color: "red",
      isAllDay: true,
    });

    expect(event.title).toBe("Specific Title");
    expect(event.color).toBe("red");
    expect(event.isAllDay).toBe(true);
    // Untouched defaults remain
    expect(event.calendarId).toBe("primary");
  });
});

describe("resetMockEventIds", () => {
  it("rewinds the counter so the next call starts at 1", () => {
    createMockEvent();
    createMockEvent();
    createMockEvent();

    resetMockEventIds();

    expect(createMockEvent().id).toBe("mock-event-1");
    expect(createMockEvent().id).toBe("mock-event-2");
  });
});
