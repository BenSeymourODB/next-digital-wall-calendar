/**
 * Unit tests for Google Calendar API response Zod schemas.
 *
 * These schemas validate Google Calendar API payloads at the route-handler
 * boundary so a malformed wire response surfaces as a typed error rather than
 * an opaque mapping crash later in the pipeline. See issue #210.
 */
import { describe, expect, it } from "vitest";
import {
  GoogleApiErrorBodySchema,
  GoogleApiValidationError,
  GoogleCalendarListEntrySchema,
  GoogleCalendarListResponseSchema,
  GoogleEventSchema,
  GoogleEventsListResponseSchema,
  parseGoogleErrorBody,
  parseGoogleResponse,
} from "../google-calendar-schemas";

describe("GoogleEventSchema", () => {
  it("accepts a minimal event with only an id", () => {
    const result = GoogleEventSchema.safeParse({ id: "evt-1" });
    expect(result.success).toBe(true);
  });

  it("accepts the canonical mock event shape used by API tests", () => {
    const result = GoogleEventSchema.safeParse({
      id: "event-1",
      summary: "Meeting",
      start: { dateTime: "2024-03-15T10:00:00Z" },
      end: { dateTime: "2024-03-15T11:00:00Z" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts the enriched event shape with attendees and recurrence", () => {
    const result = GoogleEventSchema.safeParse({
      id: "evt-rich",
      summary: "Design review",
      start: { dateTime: "2026-05-01T14:00:00Z" },
      end: { dateTime: "2026-05-01T15:00:00Z" },
      status: "confirmed",
      location: "Room 1",
      htmlLink: "https://www.google.com/calendar/event?eid=abc",
      iCalUID: "evt-rich@google.com",
      etag: '"etag-xyz"',
      organizer: { email: "alice@example.com", displayName: "Alice" },
      attendees: [
        {
          email: "bob@example.com",
          displayName: "Bob",
          responseStatus: "accepted",
        },
      ],
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO"],
      eventType: "default",
    });
    expect(result.success).toBe(true);
  });

  it("preserves unknown fields so future Google API extensions don't drop data", () => {
    const result = GoogleEventSchema.safeParse({
      id: "evt-future",
      futureField: { nested: "value" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Loose object passthrough means the unknown key survives.
      expect((result.data as Record<string, unknown>).futureField).toEqual({
        nested: "value",
      });
    }
  });

  it("accepts all-day events with date but not dateTime", () => {
    const result = GoogleEventSchema.safeParse({
      id: "evt-allday",
      start: { date: "2024-03-15" },
      end: { date: "2024-03-16" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an event missing the required id", () => {
    const result = GoogleEventSchema.safeParse({
      summary: "No id",
      start: { dateTime: "2024-03-15T10:00:00Z" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects start.dateTime that is not a string", () => {
    const result = GoogleEventSchema.safeParse({
      id: "evt-bad",
      start: { dateTime: 12345 },
    });
    expect(result.success).toBe(false);
  });
});

describe("GoogleEventsListResponseSchema", () => {
  it("accepts an envelope with items array, summary, and timeZone", () => {
    const result = GoogleEventsListResponseSchema.safeParse({
      items: [{ id: "evt-1" }, { id: "evt-2" }],
      summary: "Primary Calendar",
      timeZone: "America/New_York",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an envelope with items: undefined (Google sends no key when empty)", () => {
    const result = GoogleEventsListResponseSchema.safeParse({
      items: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("accepts an envelope with no items field at all", () => {
    const result = GoogleEventsListResponseSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects an envelope where items is a string", () => {
    const result = GoogleEventsListResponseSchema.safeParse({
      items: "not-an-array",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an envelope where one item is malformed", () => {
    const result = GoogleEventsListResponseSchema.safeParse({
      items: [{ id: "evt-1" }, { summary: "missing id" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("GoogleCalendarListEntrySchema", () => {
  it("accepts a minimal entry with id and summary", () => {
    const result = GoogleCalendarListEntrySchema.safeParse({
      id: "minimal@group.calendar.google.com",
      summary: "Minimal Calendar",
    });
    expect(result.success).toBe(true);
  });

  it("accepts the canonical mock entry shape used by calendars route tests", () => {
    const result = GoogleCalendarListEntrySchema.safeParse({
      id: "primary",
      summary: "test@example.com",
      description: "Primary calendar",
      backgroundColor: "#4285f4",
      foregroundColor: "#ffffff",
      primary: true,
      selected: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an entry missing the required id", () => {
    const result = GoogleCalendarListEntrySchema.safeParse({
      summary: "no id",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an entry where backgroundColor is not a string", () => {
    const result = GoogleCalendarListEntrySchema.safeParse({
      id: "cal-1",
      summary: "Bad color",
      backgroundColor: 0xff0000,
    });
    expect(result.success).toBe(false);
  });
});

describe("GoogleCalendarListResponseSchema", () => {
  it("accepts an envelope with items: undefined", () => {
    const result = GoogleCalendarListResponseSchema.safeParse({
      items: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an envelope where one item is malformed", () => {
    const result = GoogleCalendarListResponseSchema.safeParse({
      items: [{ id: "cal-1", summary: "ok" }, { summary: "missing id" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("GoogleApiErrorBodySchema", () => {
  it("accepts the canonical Google error envelope", () => {
    const result = GoogleApiErrorBodySchema.safeParse({
      error: {
        code: 404,
        message: "Calendar not found",
        status: "NOT_FOUND",
        errors: [
          { message: "Not found", domain: "global", reason: "notFound" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body so the existing fallback behaviour still works", () => {
    const result = GoogleApiErrorBodySchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts a body where error.message is the only field", () => {
    const result = GoogleApiErrorBodySchema.safeParse({
      error: { message: "Forbidden" },
    });
    expect(result.success).toBe(true);
  });
});

describe("parseGoogleErrorBody", () => {
  // #386 item 1 — `GoogleApiErrorBodySchema` was added in PR #233 but no route
  // wired it in. `parseGoogleErrorBody` closes the success/error validation
  // asymmetry: it always returns a typed `GoogleApiErrorBody`, falling back to
  // `{}` so existing `?.error?.message ?? "..."` ladders keep working.

  it("returns the parsed body when it matches the canonical Google envelope", () => {
    const body = parseGoogleErrorBody({
      error: {
        code: 404,
        message: "Calendar not found",
        status: "NOT_FOUND",
      },
    });
    expect(body.error?.message).toBe("Calendar not found");
    expect(body.error?.code).toBe(404);
  });

  it("returns an empty body when input is null", () => {
    expect(parseGoogleErrorBody(null)).toEqual({});
  });

  it("returns an empty body when input is undefined", () => {
    expect(parseGoogleErrorBody(undefined)).toEqual({});
  });

  it("returns an empty body when input is a primitive", () => {
    expect(parseGoogleErrorBody("not an object")).toEqual({});
    expect(parseGoogleErrorBody(42)).toEqual({});
    expect(parseGoogleErrorBody(true)).toEqual({});
  });

  it("returns an empty body when input is an array", () => {
    expect(parseGoogleErrorBody(["a", "b"])).toEqual({});
  });

  it("returns an empty body when error is a string (wrong shape)", () => {
    // Some malformed proxies return `{ error: "not an object" }`. The schema
    // expects `error` to be an object envelope; on mismatch we want
    // `parseGoogleErrorBody` to fall back to `{}` rather than surface a typed
    // `error` field that doesn't match the documented shape.
    expect(parseGoogleErrorBody({ error: "not an object" })).toEqual({});
  });

  it("accepts the documented empty fallback shape", () => {
    expect(parseGoogleErrorBody({})).toEqual({});
  });

  it("returns the parsed body when only error.message is set", () => {
    const body = parseGoogleErrorBody({ error: { message: "Forbidden" } });
    expect(body.error?.message).toBe("Forbidden");
  });
});

describe("parseGoogleResponse", () => {
  it("returns parsed data on a valid payload", () => {
    const data = parseGoogleResponse(
      { id: "evt-1", summary: "ok" },
      GoogleEventSchema,
      { endpoint: "events.get" }
    );
    expect(data.id).toBe("evt-1");
  });

  it("throws GoogleApiValidationError on a malformed payload", () => {
    expect(() =>
      parseGoogleResponse({ summary: "no id" }, GoogleEventSchema, {
        endpoint: "events.get",
      })
    ).toThrow(GoogleApiValidationError);
  });

  it("attaches endpoint and zod issues to the thrown error", () => {
    let captured: GoogleApiValidationError | null = null;
    try {
      parseGoogleResponse(
        { items: "not-an-array" },
        GoogleEventsListResponseSchema,
        {
          endpoint: "events.list",
        }
      );
    } catch (error) {
      captured = error as GoogleApiValidationError;
    }
    expect(captured).toBeInstanceOf(GoogleApiValidationError);
    expect(captured?.endpoint).toBe("events.list");
    expect(captured?.issues.length).toBeGreaterThan(0);
  });
});
