import type { GoogleCalendarEvent } from "@/lib/google-calendar-mappers";
import { describe, expect, it } from "vitest";
import {
  type InternalCalendarFetchError,
  type PerCalendarFetchResult,
  aggregateCalendarResults,
  resolveAllFailStatus,
  toWireFetchError,
} from "../events-aggregate";

function event(id: string): GoogleCalendarEvent {
  return {
    id,
    calendarId: "cal",
    summary: id,
    start: { dateTime: "2024-01-01T00:00:00Z" },
    end: { dateTime: "2024-01-01T01:00:00Z" },
  } as GoogleCalendarEvent;
}

function ok(
  events: GoogleCalendarEvent[],
  extras: Partial<PerCalendarFetchResult> = {}
): PerCalendarFetchResult {
  return { events, ...extras };
}

function fail(
  calendarId: string,
  error: string,
  status: number,
  logged?: true
): PerCalendarFetchResult {
  const err: InternalCalendarFetchError = { calendarId, error, status };
  if (logged) err.logged = true;
  return { events: [], error: err };
}

describe("aggregateCalendarResults", () => {
  it("returns empty defaults when there are no results", () => {
    const agg = aggregateCalendarResults([]);
    expect(agg.events).toEqual([]);
    expect(agg.errors).toEqual([]);
    expect(agg.summary).toBeUndefined();
    expect(agg.timeZone).toBeUndefined();
  });

  it("concatenates events from successful results in input order", () => {
    const a = event("a");
    const b = event("b");
    const c = event("c");
    const agg = aggregateCalendarResults([ok([a, b]), ok([c])]);
    expect(agg.events).toEqual([a, b, c]);
    expect(agg.errors).toEqual([]);
  });

  it("uses summary/timeZone from the first result that has them", () => {
    const agg = aggregateCalendarResults([
      ok([event("a")], { summary: "work", timeZone: "UTC" }),
      ok([event("b")], { summary: "should-not-override", timeZone: "PST" }),
    ]);
    expect(agg.summary).toBe("work");
    expect(agg.timeZone).toBe("UTC");
  });

  it("treats the first result lacking a summary as a pass-through and uses the next", () => {
    const agg = aggregateCalendarResults([
      ok([event("a")]),
      ok([event("b")], { summary: "fallback", timeZone: "UTC" }),
    ]);
    expect(agg.summary).toBe("fallback");
    expect(agg.timeZone).toBe("UTC");
  });

  it("collects a non-401 error and preserves events from the others", () => {
    const a = event("a");
    const agg = aggregateCalendarResults([ok([a]), fail("cal-b", "boom", 500)]);
    expect(agg.events).toEqual([a]);
    expect(agg.errors).toEqual([
      { calendarId: "cal-b", error: "boom", status: 500 },
    ]);
  });

  it("collects multiple non-401 errors in input order", () => {
    const agg = aggregateCalendarResults([
      fail("cal-a", "a-down", 500),
      fail("cal-b", "b-down", 502),
    ]);
    expect(agg.errors.map((e) => e.calendarId)).toEqual(["cal-a", "cal-b"]);
    expect(agg.errors.map((e) => e.status)).toEqual([500, 502]);
  });

  it("preserves the `logged` flag on errors round-trip", () => {
    const agg = aggregateCalendarResults([
      fail("cal-a", "validation", 502, true),
      fail("cal-b", "transport", 500),
    ]);
    expect(agg.errors[0].logged).toBe(true);
    expect(agg.errors[1].logged).toBeUndefined();
  });

  // Regression pin (parallel-session feedback, comment 4785513589):
  // a `[non-401, 401]` fan-out today logs the non-401 envelope before the
  // 401 envelope. The aggregator MUST surface both errors in input order
  // so the handler can iterate and emit logs in the same sequence.
  it("returns 401 errors alongside non-401 errors in input order", () => {
    const agg = aggregateCalendarResults([
      fail("cal-a", "boom", 500),
      fail("cal-b", "auth", 401),
    ]);
    expect(agg.errors.map((e) => e.status)).toEqual([500, 401]);
    expect(agg.errors.map((e) => e.calendarId)).toEqual(["cal-a", "cal-b"]);
  });

  // The previous design had the aggregator early-exit on the first 401.
  // That would drop later results' events and any later errors. The
  // current contract is "strict data transform" — walk everything.
  it("keeps walking past a 401 so later results are not dropped", () => {
    const a = event("a");
    const b = event("b");
    const agg = aggregateCalendarResults([
      ok([a]),
      fail("cal-b", "auth", 401),
      ok([b], { summary: "should-not-be-summary" }), // first summary was undefined
    ]);
    expect(agg.events).toEqual([a, b]);
    expect(agg.errors).toEqual([
      { calendarId: "cal-b", error: "auth", status: 401 },
    ]);
    // The earlier successful result had no summary, so we fall through to
    // the third one — matches the existing `if (!summary && result.summary)`.
    expect(agg.summary).toBe("should-not-be-summary");
  });
});

describe("toWireFetchError", () => {
  it("strips the internal `logged` flag", () => {
    const wire = toWireFetchError({
      calendarId: "cal-a",
      error: "boom",
      status: 502,
      logged: true,
    });
    expect(wire).toEqual({ calendarId: "cal-a", error: "boom", status: 502 });
    expect("logged" in wire).toBe(false);
  });

  it("omits `status` when the internal error did not carry one", () => {
    const wire = toWireFetchError({ calendarId: "cal-a", error: "boom" });
    expect(wire).toEqual({ calendarId: "cal-a", error: "boom" });
    expect("status" in wire).toBe(false);
  });
});

describe("resolveAllFailStatus", () => {
  it("returns the shared status when every error agrees", () => {
    expect(
      resolveAllFailStatus([
        { calendarId: "a", error: "x", status: 500 },
        { calendarId: "b", error: "y", status: 500 },
      ])
    ).toBe(500);
  });

  it("collapses mixed statuses to 502", () => {
    expect(
      resolveAllFailStatus([
        { calendarId: "a", error: "x", status: 500 },
        { calendarId: "b", error: "y", status: 502 },
      ])
    ).toBe(502);
  });

  it("treats a missing status as 500 for the agreement check", () => {
    expect(
      resolveAllFailStatus([
        { calendarId: "a", error: "x" },
        { calendarId: "b", error: "y", status: 500 },
      ])
    ).toBe(500);
  });
});
