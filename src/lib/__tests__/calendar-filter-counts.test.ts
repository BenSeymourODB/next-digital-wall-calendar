import {
  ZERO_HIDDEN_COUNTS,
  computeHiddenEventCounts,
} from "@/lib/calendar-filter-counts";
import type { IEvent, IUser, TEventColor } from "@/types/calendar";
import { describe, expect, it } from "vitest";

function user(id: string): IUser {
  return { id, name: id, picturePath: null };
}

function event(
  id: string,
  color: TEventColor,
  userId: string,
  calendarId: string
): IEvent {
  return {
    id,
    title: id,
    description: "",
    startDate: "2026-05-04T00:00:00Z",
    endDate: "2026-05-04T01:00:00Z",
    color,
    isAllDay: false,
    calendarId,
    user: user(userId),
  };
}

describe("calendar-filter-counts", () => {
  const events: IEvent[] = [
    event("e1", "red", "alice", "primary"),
    event("e2", "blue", "alice", "primary"),
    event("e3", "red", "bob", "work"),
    event("e4", "green", "bob", "primary"),
  ];

  describe("ZERO_HIDDEN_COUNTS", () => {
    it("is a structural zero for all three dimensions", () => {
      expect(ZERO_HIDDEN_COUNTS).toEqual({ color: 0, user: 0, calendar: 0 });
    });
  });

  describe("computeHiddenEventCounts", () => {
    it("returns all zeros when no dimension has an active filter", () => {
      expect(
        computeHiddenEventCounts(events, {
          selectedColors: [],
          selectedUserId: "all",
          selectedCalendarIds: [],
        })
      ).toEqual({ color: 0, user: 0, calendar: 0 });
    });

    it("returns all zeros for an empty event list", () => {
      expect(
        computeHiddenEventCounts([], {
          selectedColors: ["red"],
          selectedUserId: "alice",
          selectedCalendarIds: ["primary"],
        })
      ).toEqual({ color: 0, user: 0, calendar: 0 });
    });

    it("counts events hidden by an active color filter", () => {
      // Filter: only red events. e2 (blue) and e4 (green) are hidden by color.
      const counts = computeHiddenEventCounts(events, {
        selectedColors: ["red"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      });
      expect(counts.color).toBe(2);
      expect(counts.user).toBe(0);
      expect(counts.calendar).toBe(0);
    });

    it("counts events hidden by an active user filter", () => {
      // Filter: only alice's events. e3 + e4 (bob) are hidden by user.
      const counts = computeHiddenEventCounts(events, {
        selectedColors: [],
        selectedUserId: "alice",
        selectedCalendarIds: [],
      });
      expect(counts.user).toBe(2);
      expect(counts.color).toBe(0);
      expect(counts.calendar).toBe(0);
    });

    it("counts events hidden by an active calendar filter", () => {
      // Filter: only "work" calendar. e1, e2, e4 are hidden by calendar.
      const counts = computeHiddenEventCounts(events, {
        selectedColors: [],
        selectedUserId: "all",
        selectedCalendarIds: ["work"],
      });
      expect(counts.calendar).toBe(3);
      expect(counts.color).toBe(0);
      expect(counts.user).toBe(0);
    });

    it("only counts events that pass the OTHER dimensions when one filter is active alongside another", () => {
      // Filter: red AND alice. Without intersect: passing (color=red) → e1, e3.
      // hiddenByUser: events that pass color (red) and calendar (no filter)
      //   but fail user (alice) → e3.
      // hiddenByColor: events that pass user (alice) and calendar (no filter)
      //   but fail color (red) → e2.
      const counts = computeHiddenEventCounts(events, {
        selectedColors: ["red"],
        selectedUserId: "alice",
        selectedCalendarIds: [],
      });
      expect(counts.user).toBe(1);
      expect(counts.color).toBe(1);
      expect(counts.calendar).toBe(0);
    });

    it("counts hidden events independently across all three dimensions", () => {
      // Filter: red, alice, primary. Without intersect: red events: e1, e3.
      //   alice events: e1, e2. primary events: e1, e2, e4.
      // hiddenByColor: pass user (alice) and calendar (primary), fail color
      //   (not red) → e2.
      // hiddenByUser: pass color (red) and calendar (primary), fail user
      //   (not alice) → none (e3 fails calendar).
      // hiddenByCalendar: pass color (red) and user (alice), fail calendar
      //   (not primary) → none (e3 fails user).
      const counts = computeHiddenEventCounts(events, {
        selectedColors: ["red"],
        selectedUserId: "alice",
        selectedCalendarIds: ["primary"],
      });
      expect(counts.color).toBe(1);
      expect(counts.user).toBe(0);
      expect(counts.calendar).toBe(0);
    });

    it("treats multi-value color and calendar filters as inclusive", () => {
      // Filter: red OR blue colors → e4 (green) hidden by color.
      const counts = computeHiddenEventCounts(events, {
        selectedColors: ["red", "blue"],
        selectedUserId: "all",
        selectedCalendarIds: [],
      });
      expect(counts.color).toBe(1);
    });
  });
});
