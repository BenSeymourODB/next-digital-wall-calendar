import { describe, expect, it } from "vitest";
import { parseCalendarEventsGetParams } from "../events-get-params";

const ENDPOINT = "https://example.com/api/calendar/events";

function urlFor(query: string): URL {
  return new URL(query ? `${ENDPOINT}?${query}` : ENDPOINT);
}

describe("parseCalendarEventsGetParams", () => {
  describe("calendarIds", () => {
    it("defaults to ['primary'] when neither calendarId nor calendarIds is set", () => {
      const params = parseCalendarEventsGetParams(urlFor(""));
      expect(params.calendarIds).toEqual(["primary"]);
    });

    it("uses the single calendarId when only calendarId is set", () => {
      const params = parseCalendarEventsGetParams(urlFor("calendarId=work"));
      expect(params.calendarIds).toEqual(["work"]);
    });

    it("splits calendarIds on commas", () => {
      const params = parseCalendarEventsGetParams(urlFor("calendarIds=a,b,c"));
      expect(params.calendarIds).toEqual(["a", "b", "c"]);
    });

    it("prefers calendarIds over calendarId when both are set", () => {
      const params = parseCalendarEventsGetParams(
        urlFor("calendarIds=a,b&calendarId=ignored")
      );
      expect(params.calendarIds).toEqual(["a", "b"]);
    });
  });

  describe("timeMin / timeMax", () => {
    it("defaults timeMin to a valid ISO datetime", () => {
      const params = parseCalendarEventsGetParams(urlFor(""));
      expect(Number.isNaN(Date.parse(params.timeMin))).toBe(false);
    });

    it("passes through an explicit timeMin", () => {
      const params = parseCalendarEventsGetParams(
        urlFor("timeMin=2024-01-01T00%3A00%3A00Z")
      );
      expect(params.timeMin).toBe("2024-01-01T00:00:00Z");
    });

    it("returns null timeMax when not provided", () => {
      const params = parseCalendarEventsGetParams(urlFor(""));
      expect(params.timeMax).toBeNull();
    });

    it("passes through an explicit timeMax", () => {
      const params = parseCalendarEventsGetParams(
        urlFor("timeMax=2024-02-01T00%3A00%3A00Z")
      );
      expect(params.timeMax).toBe("2024-02-01T00:00:00Z");
    });
  });

  describe("maxResults", () => {
    it("defaults to '250' (string)", () => {
      const params = parseCalendarEventsGetParams(urlFor(""));
      expect(params.maxResults).toBe("250");
    });

    it("passes through an explicit value as a string", () => {
      const params = parseCalendarEventsGetParams(urlFor("maxResults=10"));
      // Preserved as a string — `fetchEventsFromCalendar` writes it straight
      // to `URLSearchParams.set` which calls `String()` regardless.
      expect(params.maxResults).toBe("10");
    });
  });

  describe("singleEvents", () => {
    it("defaults to true", () => {
      const params = parseCalendarEventsGetParams(urlFor(""));
      expect(params.singleEvents).toBe(true);
    });

    it("flips to false only when the literal string 'false' is passed", () => {
      expect(
        parseCalendarEventsGetParams(urlFor("singleEvents=false")).singleEvents
      ).toBe(false);
    });

    it("stays true for 'true'", () => {
      expect(
        parseCalendarEventsGetParams(urlFor("singleEvents=true")).singleEvents
      ).toBe(true);
    });

    it("stays true for any other value (matches the existing handler)", () => {
      // The current handler uses `searchParams.get("singleEvents") !== "false"`,
      // so anything that isn't the literal string "false" leaves singleEvents on.
      expect(
        parseCalendarEventsGetParams(urlFor("singleEvents=no")).singleEvents
      ).toBe(true);
    });
  });
});
