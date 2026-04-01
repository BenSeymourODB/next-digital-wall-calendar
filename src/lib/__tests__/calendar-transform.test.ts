import type { CalendarColorMapping } from "@/lib/calendar-storage";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { describe, expect, it } from "vitest";
import { transformGoogleEvent } from "../calendar-transform";

/**
 * Regression tests for calendar event transformation.
 *
 * Covers:
 * - Bug 1: All-day event detection uses isAllDay flag from Google API
 * - Bug 3: All-day event timezone parsing (date-only strings as local time)
 * - Bug 5: CalendarId preservation and color mapping
 */

// Helper to create a minimal Google Calendar event
function createGoogleEvent(
  overrides: Partial<GoogleCalendarEvent> = {}
): GoogleCalendarEvent {
  return {
    id: "test-event-1",
    summary: "Test Event",
    start: { dateTime: "2026-01-15T10:00:00-05:00" },
    end: { dateTime: "2026-01-15T11:00:00-05:00" },
    calendarId: "primary",
    ...overrides,
  };
}

describe("transformGoogleEvent", () => {
  describe("Bug 1: All-day event detection", () => {
    it("sets isAllDay=true when Google event uses start.date (not dateTime)", () => {
      const googleEvent = createGoogleEvent({
        start: { date: "2026-01-15" },
        end: { date: "2026-01-16" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.isAllDay).toBe(true);
    });

    it("sets isAllDay=false when Google event uses start.dateTime", () => {
      const googleEvent = createGoogleEvent({
        start: { dateTime: "2026-01-15T10:00:00-05:00" },
        end: { dateTime: "2026-01-15T11:00:00-05:00" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.isAllDay).toBe(false);
    });

    it("sets isAllDay=false for multi-day timed events (not all-day)", () => {
      // A multi-day event with specific times is NOT all-day
      const googleEvent = createGoogleEvent({
        start: { dateTime: "2026-01-15T00:00:00-05:00" },
        end: { dateTime: "2026-01-17T00:00:00-05:00" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.isAllDay).toBe(false);
    });

    it("sets isAllDay=true for multi-day all-day events", () => {
      // Multi-day all-day events use start.date
      const googleEvent = createGoogleEvent({
        start: { date: "2026-01-15" },
        end: { date: "2026-01-18" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.isAllDay).toBe(true);
    });
  });

  describe("Bug 3: All-day event timezone parsing", () => {
    it("appends T00:00:00 to date-only start strings for local time interpretation", () => {
      const googleEvent = createGoogleEvent({
        start: { date: "2026-01-15" },
        end: { date: "2026-01-16" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.startDate).toBe("2026-01-15T00:00:00");
    });

    it("appends T00:00:00 to date-only end strings for local time interpretation", () => {
      const googleEvent = createGoogleEvent({
        start: { date: "2026-01-15" },
        end: { date: "2026-01-16" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.endDate).toBe("2026-01-16T00:00:00");
    });

    it("preserves dateTime strings as-is (no T00:00:00 appending)", () => {
      const googleEvent = createGoogleEvent({
        start: { dateTime: "2026-01-15T14:30:00-05:00" },
        end: { dateTime: "2026-01-15T15:30:00-05:00" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.startDate).toBe("2026-01-15T14:30:00-05:00");
      expect(result.endDate).toBe("2026-01-15T15:30:00-05:00");
    });

    it("parsed date-only string with T00:00:00 is interpreted as local midnight", () => {
      const googleEvent = createGoogleEvent({
        start: { date: "2026-01-15" },
        end: { date: "2026-01-16" },
      });

      const result = transformGoogleEvent(googleEvent, []);

      // "2026-01-15T00:00:00" should be local midnight on Jan 15
      const parsed = new Date(result.startDate);
      expect(parsed.getDate()).toBe(15);
      expect(parsed.getMonth()).toBe(0); // January
      expect(parsed.getFullYear()).toBe(2026);
      expect(parsed.getHours()).toBe(0);
      expect(parsed.getMinutes()).toBe(0);
    });
  });

  describe("Bug 5: CalendarId preservation", () => {
    it("preserves calendarId from the Google event", () => {
      const googleEvent = createGoogleEvent({
        calendarId: "family@group.calendar.google.com",
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.calendarId).toBe("family@group.calendar.google.com");
    });

    it("preserves primary calendarId", () => {
      const googleEvent = createGoogleEvent({
        calendarId: "primary",
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.calendarId).toBe("primary");
    });
  });

  describe("Color mapping", () => {
    it("uses calendarId-based color mapping when available", () => {
      const mappings: CalendarColorMapping[] = [
        {
          calendarId: "family@group.calendar.google.com",
          colorId: "",
          hexColor: "#16a765",
          tailwindColor: "green",
        },
      ];

      const googleEvent = createGoogleEvent({
        calendarId: "family@group.calendar.google.com",
      });

      const result = transformGoogleEvent(googleEvent, mappings);

      expect(result.color).toBe("green");
    });

    it("falls back to colorId mapping when no calendarId match", () => {
      const googleEvent = createGoogleEvent({
        calendarId: "unknown-calendar",
        colorId: "4", // Maps to "red" in the legacy color map
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.color).toBe("red");
    });

    it("defaults to blue when no color mapping matches", () => {
      const googleEvent = createGoogleEvent({
        calendarId: "unknown-calendar",
      });

      const result = transformGoogleEvent(googleEvent, []);

      expect(result.color).toBe("blue");
    });

    it("prioritizes calendarId mapping over colorId mapping", () => {
      const mappings: CalendarColorMapping[] = [
        {
          calendarId: "primary",
          colorId: "",
          hexColor: "#d50000",
          tailwindColor: "red",
        },
      ];

      const googleEvent = createGoogleEvent({
        calendarId: "primary",
        colorId: "2", // Would map to "green" via colorId
      });

      const result = transformGoogleEvent(googleEvent, mappings);

      // Should use calendarId mapping (red), not colorId mapping (green)
      expect(result.color).toBe("red");
    });

    it("applies correct colors from empty mappings array", () => {
      const googleEvent = createGoogleEvent({
        calendarId: "primary",
      });

      const result = transformGoogleEvent(googleEvent, []);

      // With empty mappings, should default to blue
      expect(result.color).toBe("blue");
    });
  });

  describe("Basic field mapping", () => {
    it("maps summary to title", () => {
      const googleEvent = createGoogleEvent({ summary: "My Meeting" });
      const result = transformGoogleEvent(googleEvent, []);
      expect(result.title).toBe("My Meeting");
    });

    it("uses 'Untitled Event' when summary is missing", () => {
      const googleEvent = createGoogleEvent({ summary: "" });
      const result = transformGoogleEvent(googleEvent, []);
      expect(result.title).toBe("Untitled Event");
    });

    it("maps description correctly", () => {
      const googleEvent = createGoogleEvent({
        description: "Meeting notes",
      });
      const result = transformGoogleEvent(googleEvent, []);
      expect(result.description).toBe("Meeting notes");
    });

    it("uses empty string when description is missing", () => {
      const googleEvent = createGoogleEvent({ description: undefined });
      const result = transformGoogleEvent(googleEvent, []);
      expect(result.description).toBe("");
    });

    it("maps creator email to user.id", () => {
      const googleEvent = createGoogleEvent({
        creator: { email: "user@example.com", displayName: "User" },
      });
      const result = transformGoogleEvent(googleEvent, []);
      expect(result.user.id).toBe("user@example.com");
      expect(result.user.name).toBe("User");
    });
  });
});
