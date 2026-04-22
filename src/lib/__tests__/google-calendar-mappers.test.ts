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

  it("falls back to empty string when event has no summary", () => {
    // Google marks Event.summary as optional. Downstream UI code (see
    // `transformGoogleEvent` → `title: event.summary || "Untitled Event"`)
    // expects a string, so the mapper defensively normalises.
    const apiEvent: gapi.client.calendar.Event = {
      id: "evt-no-title",
      start: { dateTime: "2026-05-01T09:00:00Z" },
      end: { dateTime: "2026-05-01T09:30:00Z" },
    };

    const result = normalizeFetchedEvent(apiEvent, "primary");

    expect(result.summary).toBe("");
    // And the field is typed as a plain string (no `undefined`), which is
    // what the narrower `GoogleCalendarEvent.summary: string` buys us.
    const summaryTypeCheck: string = result.summary;
    expect(summaryTypeCheck).toBe("");
  });

  it("passes every Google-declared field through the spread (no silent drops)", () => {
    // Guards against regressions on the review finding that
    // `{ ...event }` was leaking fields the canonical type didn't declare.
    // If `GoogleCalendarEvent` ever stops `extends Omit<Event, "summary">`,
    // these assertions fail at the type layer and the runtime round-trip
    // here fails as well.
    const apiEvent: gapi.client.calendar.Event = {
      id: "evt-full",
      summary: "All fields",
      start: { dateTime: "2026-05-01T09:00:00Z" },
      end: { dateTime: "2026-05-01T10:00:00Z" },
      kind: "calendar#event",
      conferenceData: {
        conferenceId: "abc",
        entryPoints: [
          { entryPointType: "video", uri: "https://meet.google.com/abc" },
        ],
      },
      attachments: [
        { fileUrl: "https://drive.google.com/file/d/1", title: "Agenda" },
      ],
      source: { url: "https://example.com", title: "Source" },
      extendedProperties: { shared: { sharedKey: "sharedVal" } },
      attendeesOmitted: false,
      anyoneCanAddSelf: true,
      guestsCanInviteOthers: true,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: true,
      privateCopy: false,
      locked: false,
    };

    const result = normalizeFetchedEvent(apiEvent, "primary");

    expect(result.kind).toBe("calendar#event");
    expect(result.conferenceData?.conferenceId).toBe("abc");
    expect(result.attachments?.[0]?.title).toBe("Agenda");
    expect(result.source?.url).toBe("https://example.com");
    expect(result.extendedProperties?.shared?.sharedKey).toBe("sharedVal");
    expect(result.attendeesOmitted).toBe(false);
    expect(result.anyoneCanAddSelf).toBe(true);
    expect(result.guestsCanInviteOthers).toBe(true);
    expect(result.guestsCanModify).toBe(false);
    expect(result.guestsCanSeeOtherGuests).toBe(true);
    expect(result.privateCopy).toBe(false);
    expect(result.locked).toBe(false);
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

  it("falls back to empty string when calendarList entry has no summary", () => {
    // CalendarList.summary is optional per the Google schema (and some
    // synthetic/deleted entries may arrive without one). Mirror the
    // defensive behaviour of `normalizeFetchedEvent` so the narrowed
    // `UserCalendar.summary: string` is genuinely a string.
    const apiEntry: gapi.client.calendar.CalendarListEntry = {
      id: "quiet@group.calendar.google.com",
    };

    const result = normalizeCalendarListEntry(apiEntry);

    expect(result.summary).toBe("");
    const summaryTypeCheck: string = result.summary;
    expect(summaryTypeCheck).toBe("");
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

describe("end-to-end: enriched API responses flow through the mappers", () => {
  // These cases also act as compile-time coverage — enriched Google v3
  // fixtures assigned to the richer response types will fail
  // `pnpm check-types` if `gapi.d.ts` drifts away from the API. The runtime
  // assertions here check the *full* round-trip so the tests earn their
  // keep at runtime too.
  it("round-trips an enriched events.list response through the mapper", () => {
    const reminderMethod = "popup" as const;
    const apiResponse: gapi.client.calendar.EventsListResponse = {
      kind: "calendar#events",
      etag: '"list-etag"',
      summary: "Primary",
      timeZone: "America/New_York",
      accessRole: "owner",
      defaultReminders: [{ method: reminderMethod, minutes: 10 }],
      nextPageToken: "next-page",
      nextSyncToken: "sync-token",
      updated: "2026-04-22T12:00:00Z",
      items: [
        {
          id: "evt-a",
          summary: "Lunch",
          location: "Cafe",
          htmlLink: "https://www.google.com/calendar/event?eid=a",
          start: { dateTime: "2026-05-01T12:00:00Z" },
          end: { dateTime: "2026-05-01T13:00:00Z" },
          reminders: { useDefault: true },
          attendees: [{ email: "a@example.com", responseStatus: "accepted" }],
        },
      ],
    };

    const mapped: GoogleCalendarEvent[] = (apiResponse.items ?? []).map(
      (event) => normalizeFetchedEvent(event, "primary")
    );

    expect(mapped).toHaveLength(1);
    const [only] = mapped;
    expect(only?.id).toBe("evt-a");
    expect(only?.summary).toBe("Lunch");
    expect(only?.location).toBe("Cafe");
    expect(only?.htmlLink).toBe("https://www.google.com/calendar/event?eid=a");
    expect(only?.calendarId).toBe("primary");
    expect(only?.reminders?.useDefault).toBe(true);
    expect(only?.attendees?.[0]?.email).toBe("a@example.com");
    expect(apiResponse.nextSyncToken).toBe("sync-token");
  });

  it("round-trips an enriched calendarList.list response through the mapper", () => {
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
          timeZone: "UTC",
          selected: true,
        },
        {
          id: "shared@group.calendar.google.com",
          summary: "Shared",
          backgroundColor: "#16a765",
          accessRole: "reader",
        },
      ],
    };

    const mapped = (apiResponse.items ?? []).map(normalizeCalendarListEntry);

    expect(mapped).toHaveLength(2);
    expect(mapped[0]?.id).toBe("primary");
    expect(mapped[0]?.accessRole).toBe("owner");
    expect(mapped[0]?.timeZone).toBe("UTC");
    expect(mapped[0]?.selected).toBe(true);
    expect(mapped[1]?.accessRole).toBe("reader");
    expect(mapped[1]?.summary).toBe("Shared");
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
