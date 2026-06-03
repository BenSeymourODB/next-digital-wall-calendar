/**
 * Isolated unit tests for the pure helpers exported from `AgendaCalendar`.
 *
 * Background: PR #144 introduced search and color-grouping behaviour but
 * exercised the helpers only through `AgendaCalendar`'s rendering tests, which
 * left edge cases (mutation, undefined description/user, sort stability) un-
 * asserted. Issue #222 items 1 and 2 cover this gap.
 */
import type { IEvent, TEventColor } from "@/types/calendar";
import { describe, expect, it } from "vitest";
import {
  filterEventsBySearch,
  groupEventsByColor,
  sortEventsByStartTime,
} from "../AgendaCalendar";

const baseUser = { id: "user-1", name: "Test User", picturePath: null };

function makeEvent(overrides: Partial<IEvent> & { id: string }): IEvent {
  return {
    title: "Untitled",
    startDate: "2026-05-03T10:00:00.000Z",
    endDate: "2026-05-03T11:00:00.000Z",
    color: "blue",
    description: "",
    isAllDay: false,
    calendarId: "primary",
    user: baseUser,
    ...overrides,
  };
}

describe("filterEventsBySearch", () => {
  const events: IEvent[] = [
    makeEvent({
      id: "e1",
      title: "Dentist Appointment",
      description: "Annual cleaning",
      user: { id: "u-emma", name: "Emma", picturePath: null },
    }),
    makeEvent({
      id: "e2",
      title: "Soccer Practice",
      description: "Bring water bottle",
      user: { id: "u-dad", name: "Dad", picturePath: null },
    }),
    makeEvent({
      id: "e3",
      title: "Birthday Party",
      description: "Grandma's 70th",
      user: { id: "u-grandma", name: "Grandma", picturePath: null },
    }),
  ];

  it("returns the input unchanged when the query is empty", () => {
    expect(filterEventsBySearch(events, "")).toEqual(events);
  });

  it("returns the input unchanged when the query is only whitespace", () => {
    expect(filterEventsBySearch(events, "   \t\n")).toEqual(events);
  });

  it("matches against the title (case-insensitive)", () => {
    const result = filterEventsBySearch(events, "soccer");
    expect(result.map((e) => e.id)).toEqual(["e2"]);
  });

  it("matches against the description", () => {
    const result = filterEventsBySearch(events, "water");
    expect(result.map((e) => e.id)).toEqual(["e2"]);
  });

  it("matches against the attendee (user) name", () => {
    const result = filterEventsBySearch(events, "emma");
    expect(result.map((e) => e.id)).toEqual(["e1"]);
  });

  it("trims whitespace around the query before matching", () => {
    const result = filterEventsBySearch(events, "   DENTIST   ");
    expect(result.map((e) => e.id)).toEqual(["e1"]);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterEventsBySearch(events, "nothing-matches-this")).toEqual([]);
  });

  it("treats an undefined description as the empty string (does not match against the literal 'undefined')", () => {
    // Stresses the `event.description ?? ""` branch in the haystack: if `??`
    // were dropped, the haystack would contain the string "undefined" and a
    // search for "undefined" would match — which it must not.
    const sparse: IEvent[] = [
      makeEvent({
        id: "sparse",
        title: "Walk Dog",
        description: undefined as unknown as string,
      }),
    ];
    expect(filterEventsBySearch(sparse, "undefined")).toEqual([]);
    // And the title-match path still works alongside the undefined description.
    expect(filterEventsBySearch(sparse, "walk").map((e) => e.id)).toEqual([
      "sparse",
    ]);
  });

  it("does not match an undefined description against a query that would have hit the description value", () => {
    const sparse: IEvent[] = [
      makeEvent({
        id: "sparse",
        title: "Generic Title",
        description: undefined as unknown as string,
      }),
    ];
    // "annual" only ever appears in description text in this suite — proves
    // the description-?? branch is fully short-circuited when undefined.
    expect(filterEventsBySearch(sparse, "annual")).toEqual([]);
  });

  it("does not throw when an event has an undefined user", () => {
    const sparse: IEvent[] = [
      makeEvent({
        id: "no-user",
        title: "Solo Run",
        user: undefined as unknown as IEvent["user"],
      }),
    ];
    expect(filterEventsBySearch(sparse, "solo").map((e) => e.id)).toEqual([
      "no-user",
    ]);
  });

  it("does not mutate the input array", () => {
    const snapshot = events.map((e) => e.id);
    filterEventsBySearch(events, "soccer");
    expect(events.map((e) => e.id)).toEqual(snapshot);
  });

  it("preserves the original input order when matches are interleaved with non-matches", () => {
    // Pick a query that hits e1 and e3 but skips e2, so the assertion can
    // only pass if matched events keep their relative input order.
    const interleaved: IEvent[] = [
      makeEvent({ id: "match-first", title: "Birthday Bash", description: "" }),
      makeEvent({
        id: "skip-middle",
        title: "Soccer Practice",
        description: "",
      }),
      makeEvent({ id: "match-last", title: "Birthday Cake", description: "" }),
    ];
    const result = filterEventsBySearch(interleaved, "birthday");
    expect(result.map((e) => e.id)).toEqual(["match-first", "match-last"]);
  });

  it("treats matches as substring matches, not whole-word", () => {
    const result = filterEventsBySearch(events, "tist");
    expect(result.map((e) => e.id)).toEqual(["e1"]);
  });
});

describe("sortEventsByStartTime", () => {
  it("returns events in ascending start-time order", () => {
    const events: IEvent[] = [
      makeEvent({ id: "later", startDate: "2026-05-03T15:00:00.000Z" }),
      makeEvent({ id: "earlier", startDate: "2026-05-03T09:00:00.000Z" }),
      makeEvent({ id: "middle", startDate: "2026-05-03T12:00:00.000Z" }),
    ];

    expect(sortEventsByStartTime(events).map((e) => e.id)).toEqual([
      "earlier",
      "middle",
      "later",
    ]);
  });

  it("returns a new array (does not mutate the input)", () => {
    const events: IEvent[] = [
      makeEvent({ id: "b", startDate: "2026-05-03T15:00:00.000Z" }),
      makeEvent({ id: "a", startDate: "2026-05-03T09:00:00.000Z" }),
    ];
    const before = events.map((e) => e.id);

    const result = sortEventsByStartTime(events);

    expect(result).not.toBe(events);
    expect(events.map((e) => e.id)).toEqual(before);
  });

  it("interleaves same-time and different-time events deterministically", () => {
    // ES2019 makes Array.prototype.sort stable, so this test exercises the
    // useful semantic: same-time events keep input order while different-time
    // events fall into ascending order around them.
    const events: IEvent[] = [
      makeEvent({ id: "tie-a", startDate: "2026-05-03T09:00:00.000Z" }),
      makeEvent({ id: "later", startDate: "2026-05-03T15:00:00.000Z" }),
      makeEvent({ id: "tie-b", startDate: "2026-05-03T09:00:00.000Z" }),
      makeEvent({ id: "earliest", startDate: "2026-05-03T08:00:00.000Z" }),
      makeEvent({ id: "tie-c", startDate: "2026-05-03T09:00:00.000Z" }),
    ];

    expect(sortEventsByStartTime(events).map((e) => e.id)).toEqual([
      "earliest",
      "tie-a",
      "tie-b",
      "tie-c",
      "later",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(sortEventsByStartTime([])).toEqual([]);
  });
});

describe("groupEventsByColor", () => {
  it("buckets events under their color key (and sorts within each bucket)", () => {
    // `b2` is earlier than `b1`, so the assertion can only pass if the bucket
    // is sorted ascending by start time — making this test independently
    // self-checking even before the dedicated regression below.
    const events: IEvent[] = [
      makeEvent({
        id: "b1",
        color: "blue",
        startDate: "2026-05-03T15:00:00.000Z",
      }),
      makeEvent({ id: "r1", color: "red" }),
      makeEvent({
        id: "b2",
        color: "blue",
        startDate: "2026-05-03T09:00:00.000Z",
      }),
    ];

    const groups = groupEventsByColor(events);

    expect(groups.get("blue")?.map((e) => e.id)).toEqual(["b2", "b1"]);
    expect(groups.get("red")?.map((e) => e.id)).toEqual(["r1"]);
  });

  it("only includes colors that are actually present (no eager initialisation)", () => {
    const events: IEvent[] = [
      makeEvent({ id: "g", color: "green" }),
      makeEvent({ id: "p", color: "purple" }),
    ];

    const groups = groupEventsByColor(events);

    expect(Array.from(groups.keys()).sort()).toEqual(["green", "purple"]);
    const allColors: TEventColor[] = [
      "blue",
      "green",
      "red",
      "yellow",
      "purple",
      "orange",
    ];
    for (const color of allColors) {
      if (color === "green" || color === "purple") continue;
      expect(groups.has(color)).toBe(false);
    }
  });

  it("sorts events within each color group by ascending start time (regression for #222 item 2)", () => {
    const events: IEvent[] = [
      makeEvent({
        id: "b-late",
        color: "blue",
        startDate: "2026-05-03T15:00:00.000Z",
      }),
      makeEvent({
        id: "b-early",
        color: "blue",
        startDate: "2026-05-03T09:00:00.000Z",
      }),
      makeEvent({
        id: "b-mid",
        color: "blue",
        startDate: "2026-05-03T12:00:00.000Z",
      }),
      makeEvent({
        id: "r-late",
        color: "red",
        startDate: "2026-05-03T20:00:00.000Z",
      }),
      makeEvent({
        id: "r-early",
        color: "red",
        startDate: "2026-05-03T08:00:00.000Z",
      }),
    ];

    const groups = groupEventsByColor(events);

    expect(groups.get("blue")?.map((e) => e.id)).toEqual([
      "b-early",
      "b-mid",
      "b-late",
    ]);
    expect(groups.get("red")?.map((e) => e.id)).toEqual(["r-early", "r-late"]);
  });

  it("returns an empty Map for empty input", () => {
    expect(groupEventsByColor([]).size).toBe(0);
  });

  it("handles a single event without errors", () => {
    const groups = groupEventsByColor([
      makeEvent({ id: "only", color: "yellow" }),
    ]);
    expect(Array.from(groups.keys())).toEqual(["yellow"]);
    expect(groups.get("yellow")).toHaveLength(1);
  });

  it("does not mutate the input array order", () => {
    const events: IEvent[] = [
      makeEvent({
        id: "later",
        color: "blue",
        startDate: "2026-05-03T15:00:00.000Z",
      }),
      makeEvent({
        id: "earlier",
        color: "blue",
        startDate: "2026-05-03T09:00:00.000Z",
      }),
    ];
    const inputSnapshot = events.map((e) => e.id);

    groupEventsByColor(events);

    expect(events.map((e) => e.id)).toEqual(inputSnapshot);
  });
});
