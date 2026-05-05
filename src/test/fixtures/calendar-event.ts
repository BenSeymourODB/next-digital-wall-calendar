/**
 * Shared `IEvent` test fixture.
 *
 * Six near-duplicate `createMockEvent` helpers across the test suite all
 * defaulted to the same literal id (`"test-event-1"` or `"evt"`), which silently
 * produced React-key collisions in any test that rendered multiple events
 * without explicit ids. Issue #222 item 4 calls out the fix: sequenced/unique
 * ids per call. This module provides one shared helper.
 *
 * Tests that need a stable, deterministic id should still pass `id` via
 * `overrides` (or call `resetMockEventIds()` from `beforeEach`).
 */
import type { IEvent } from "@/types/calendar";

let mockEventCounter = 0;

/**
 * Reset the auto-incrementing id counter back to zero. Use in `beforeEach`
 * if a test depends on deterministic default ids across runs.
 */
export function resetMockEventIds(): void {
  mockEventCounter = 0;
}

/**
 * Build an `IEvent` for tests. Each call without an explicit `id` gets a
 * unique default (`mock-event-1`, `mock-event-2`, …) so multi-event renders
 * never collide on React keys.
 */
export function createMockEvent(overrides: Partial<IEvent> = {}): IEvent {
  mockEventCounter += 1;
  return {
    id: `mock-event-${mockEventCounter}`,
    title: "Test Event",
    startDate: new Date().toISOString(),
    endDate: new Date().toISOString(),
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: {
      id: "user-1",
      name: "Test User",
      picturePath: null,
    },
    ...overrides,
  };
}
