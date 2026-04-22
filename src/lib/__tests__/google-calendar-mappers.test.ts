/**
 * Unit tests for Google Calendar API response mappers.
 *
 * These tests exercise the pure mappers that translate raw Google Calendar API
 * responses into the app's `GoogleCalendarEvent` and `UserCalendar` shapes.
 *
 * They serve as regression guards for two concerns:
 *  1. Extended optional fields surfaced by the richer `gapi.d.ts` types are
 *     preserved through the mappers (issue #76).
 *  2. Comments/semantics around `fetchCalendarColorMappings` stay stable (#77).
 */
import type { CalendarColorMapping } from "@/lib/calendar-storage";
import {
  type GoogleCalendarEvent,
  type UserCalendar,
  normalizeCalendarListEntry,
  normalizeFetchedEvent,
} from "@/lib/google-calendar";
import { describe, expect, it } from "vitest";

describe("normalizeFetchedEvent", () => {
  it("preserves required fields and stamps calendarId", () => {
    const apiEvent: gapi.client.calendar.Event = {
      id: "evt-1",
      summary: "Standup",
      start: { dateTime: "2026-05-01T09:00:00-04:00" },
      end: { dateTime: "2026-05-01T09:30:00-04:00" },
    };

    const result = normalizeFetchedEvent(apiEvent, "primary");

    expect(result.id).toBe("evt-1");
    expect(result.summary).toBe("Standup");
    expect(result.calendarId).toBe("primary");
    expect(result.start.dateTime).toBe("2026-05-01T09:00:00-04:00");
    expect(result.end.dateTime).toBe("2026-05-01T09:30:00-04:00");
  });

  it("passes through extended optional fields from Google Calendar v3", () => {
    const apiEvent: gapi.client.calendar.Event = {
      id: "evt-rich",
      summary: "Board meeting",
      description: "Quarterly review",
      start: { dateTime: "2026-05-01T14:00:00Z", timeZone: "UTC" },
      end: { dateTime: "2026-05-01T15:00:00Z", timeZone: "UTC" },
      status: "confirmed",
      location: "HQ Conference Room A",
      htmlLink: "https://www.google.com/calendar/event?eid=abc",
      iCalUID: "evt-rich@google.com",
      etag: '"etag-123"',
      created: "2026-04-20T12:00:00Z",
      updated: "2026-04-21T08:00:00Z",
      transparency: "opaque",
      visibility: "default",
      eventType: "default",
      hangoutLink: "https://meet.google.com/abc-defg-hij",
      colorId: "4",
      creator: { email: "alice@example.com", displayName: "Alice" },
      organizer: { email: "alice@example.com", displayName: "Alice" },
      attendees: [
        {
          email: "bob@example.com",
          displayName: "Bob",
          responseStatus: "accepted",
        },
      ],
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
    };

    const result = normalizeFetchedEvent(apiEvent, "team@example.com");

    expect(result.calendarId).toBe("team@example.com");
    expect(result.status).toBe("confirmed");
    expect(result.location).toBe("HQ Conference Room A");
    expect(result.htmlLink).toBe(
      "https://www.google.com/calendar/event?eid=abc"
    );
    expect(result.iCalUID).toBe("evt-rich@google.com");
    expect(result.etag).toBe('"etag-123"');
    expect(result.created).toBe("2026-04-20T12:00:00Z");
    expect(result.updated).toBe("2026-04-21T08:00:00Z");
    expect(result.transparency).toBe("opaque");
    expect(result.visibility).toBe("default");
    expect(result.eventType).toBe("default");
    expect(result.hangoutLink).toBe("https://meet.google.com/abc-defg-hij");
    expect(result.organizer?.email).toBe("alice@example.com");
    expect(result.attendees).toHaveLength(1);
    expect(result.attendees?.[0]?.responseStatus).toBe("accepted");
    expect(result.recurrence).toEqual(["RRULE:FREQ=WEEKLY;BYDAY=MO"]);
  });

  it("handles recurring-event instance fields (recurringEventId + originalStartTime)", () => {
    const apiEvent: gapi.client.calendar.Event = {
      id: "evt-instance_20260501T140000Z",
      summary: "Weekly sync (moved)",
      start: { dateTime: "2026-05-01T15:00:00Z" },
      end: { dateTime: "2026-05-01T16:00:00Z" },
      recurringEventId: "evt-parent",
      originalStartTime: { dateTime: "2026-05-01T14:00:00Z" },
    };

    const result = normalizeFetchedEvent(apiEvent, "primary");

    expect(result.recurringEventId).toBe("evt-parent");
    expect(result.originalStartTime?.dateTime).toBe("2026-05-01T14:00:00Z");
  });

  it("accepts all-day events (date-only start/end with no dateTime)", () => {
    const apiEvent: gapi.client.calendar.Event = {
      id: "evt-allday",
      summary: "Holiday",
      start: { date: "2026-12-25" },
      end: { date: "2026-12-26" },
    };

    const result = normalizeFetchedEvent(
      apiEvent,
      "holidays@group.v.calendar.google.com"
    );

    expect(result.start.date).toBe("2026-12-25");
    expect(result.start.dateTime).toBeUndefined();
    expect(result.end.date).toBe("2026-12-26");
  });
});

describe("normalizeCalendarListEntry", () => {
  it("maps the base fields consumed by the app", () => {
    const apiEntry: gapi.client.calendar.CalendarListEntry = {
      id: "family@group.calendar.google.com",
      summary: "Family",
      description: "Family events",
      backgroundColor: "#16a765",
      foregroundColor: "#ffffff",
      primary: false,
    };

    const result = normalizeCalendarListEntry(apiEntry);

    expect(result).toEqual<UserCalendar>({
      id: "family@group.calendar.google.com",
      summary: "Family",
      description: "Family events",
      backgroundColor: "#16a765",
      foregroundColor: "#ffffff",
      primary: false,
      colorId: undefined,
      timeZone: undefined,
      summaryOverride: undefined,
      selected: undefined,
      accessRole: undefined,
    });
  });

  it("preserves extended CalendarList fields surfaced by the richer types", () => {
    const apiEntry: gapi.client.calendar.CalendarListEntry = {
      id: "primary",
      summary: "alice@example.com",
      backgroundColor: "#3b82f6",
      foregroundColor: "#000000",
      primary: true,
      colorId: "10",
      timeZone: "America/New_York",
      summaryOverride: "My Calendar",
      selected: true,
      accessRole: "owner",
    };

    const result = normalizeCalendarListEntry(apiEntry);

    expect(result.colorId).toBe("10");
    expect(result.timeZone).toBe("America/New_York");
    expect(result.summaryOverride).toBe("My Calendar");
    expect(result.selected).toBe(true);
    expect(result.accessRole).toBe("owner");
  });
});

describe("type-level coverage: GoogleCalendarEvent is assignable from raw API responses", () => {
  // These assignments are effectively compile-time assertions. They fail
  // `pnpm check-types` if the extended fields on the canonical type drift
  // out of sync with the shapes accepted by `normalizeFetchedEvent`.
  it("accepts a realistic enriched Google Calendar v3 event payload", () => {
    const apiResponse: gapi.client.calendar.EventsListResponse = {
      kind: "calendar#events",
      etag: '"list-etag"',
      summary: "Primary",
      timeZone: "America/New_York",
      accessRole: "owner",
      defaultReminders: [{ method: "popup", minutes: 10 }],
      nextPageToken: "next-page",
      nextSyncToken: "sync-token",
      updated: "2026-04-22T12:00:00Z",
      items: [
        {
          id: "evt-a",
          summary: "Lunch",
          start: { dateTime: "2026-05-01T12:00:00Z" },
          end: { dateTime: "2026-05-01T13:00:00Z" },
          reminders: { useDefault: true },
        },
      ],
    };

    expect(apiResponse.items?.[0]?.id).toBe("evt-a");
    expect(apiResponse.nextPageToken).toBe("next-page");
    expect(apiResponse.defaultReminders?.[0]?.method).toBe("popup");

    const mapped: GoogleCalendarEvent[] = (apiResponse.items ?? []).map(
      (event) => normalizeFetchedEvent(event, "primary")
    );

    expect(mapped).toHaveLength(1);
    expect(mapped[0]?.id).toBe("evt-a");
  });

  it("accepts a realistic enriched CalendarList response payload", () => {
    const apiResponse: gapi.client.calendar.CalendarListListResponse = {
      kind: "calendar#calendarList",
      etag: '"etag"',
      nextPageToken: "p2",
      nextSyncToken: "s2",
      items: [
        {
          id: "primary",
          summary: "alice@example.com",
          backgroundColor: "#3b82f6",
          foregroundColor: "#000000",
          primary: true,
          accessRole: "owner",
        },
      ],
    };

    const mapped = (apiResponse.items ?? []).map(normalizeCalendarListEntry);
    expect(mapped[0]?.accessRole).toBe("owner");
  });
});

describe("color mapping semantics (#77 regression)", () => {
  // This test pins down the expected post-#77 invariant: calendar-level
  // color mappings deliberately leave `colorId` empty because that field is
  // scoped to event-level colorIds, which calendarList items do not carry.
  it("builds a CalendarColorMapping with an intentionally-empty colorId", () => {
    const entry = normalizeCalendarListEntry({
      id: "fam@group.calendar.google.com",
      summary: "Family",
      backgroundColor: "#16a765",
      foregroundColor: "#ffffff",
    });

    const mapping: CalendarColorMapping = {
      calendarId: entry.id,
      colorId: "",
      hexColor: entry.backgroundColor ?? "#3b82f6",
      tailwindColor: "green",
    };

    expect(mapping.colorId).toBe("");
    expect(mapping.calendarId).toBe("fam@group.calendar.google.com");
  });
});
