/**
 * Google Calendar event transformation utilities
 *
 * Transforms Google Calendar API events into the internal IEvent format.
 * Handles:
 * - All-day event detection (via start.date vs start.dateTime)
 * - Timezone-safe date parsing (appends T00:00:00 to date-only strings)
 * - Calendar color mapping (from Google Calendar API color mappings)
 * - CalendarId preservation for cache round-tripping
 */
import type { CalendarColorMapping } from "@/lib/calendar-storage";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import type { IEvent, TEventColor } from "@/types/calendar";

/**
 * Transform a Google Calendar event to our IEvent format.
 * Uses color mappings from Google Calendar API when available.
 *
 * Key behaviors:
 * - Sets isAllDay based on presence of start.date (vs start.dateTime)
 * - Appends T00:00:00 to date-only strings to force local time interpretation
 * - Preserves calendarId from the Google event for cache round-tripping
 * - Maps colors via calendarId lookup, then colorId fallback, then default blue
 */
export function transformGoogleEvent(
  googleEvent: GoogleCalendarEvent,
  colorMappings: CalendarColorMapping[]
): IEvent {
  // Determine if this is an all-day event based on Google API convention:
  // All-day events use start.date (e.g., "2026-01-05")
  // Timed events use start.dateTime (e.g., "2026-01-05T10:00:00-05:00")
  const isAllDay = !googleEvent.start.dateTime && !!googleEvent.start.date;

  // For date-only strings (all-day events), append T00:00:00 to force
  // local time interpretation. Without this, new Date("2026-01-05")
  // is interpreted as UTC midnight, which shifts to the previous day
  // in negative-offset timezones.
  const startDate = googleEvent.start.dateTime
    ? googleEvent.start.dateTime
    : googleEvent.start.date
      ? `${googleEvent.start.date}T00:00:00`
      : new Date().toISOString();

  const endDate = googleEvent.end.dateTime
    ? googleEvent.end.dateTime
    : googleEvent.end.date
      ? `${googleEvent.end.date}T00:00:00`
      : new Date().toISOString();

  const calendarId = googleEvent.calendarId;

  const user = {
    id: googleEvent.creator?.email || "unknown",
    name: googleEvent.creator?.displayName || "Unknown",
    picturePath: null,
  };

  const baseEvent = {
    id: googleEvent.id,
    startDate,
    endDate,
    title: googleEvent.summary || "Untitled Event",
    description: googleEvent.description || "",
    user,
    isAllDay,
    calendarId,
  };

  // Priority 1: Look up by calendarId in color mappings (from Google Calendar API)
  const calendarMapping = colorMappings.find(
    (m) => m.calendarId === googleEvent.calendarId
  );
  if (calendarMapping) {
    return {
      ...baseEvent,
      color: calendarMapping.tailwindColor,
    };
  }

  // Priority 2: Fall back to existing colorId mapping (legacy)
  const colorMap: Record<string, TEventColor> = {
    "1": "blue",
    "2": "green",
    "3": "purple",
    "4": "red",
    "5": "yellow",
    "6": "orange",
    "7": "blue",
    "8": "blue",
    "9": "blue",
    "10": "green",
    "11": "red",
  };

  if (googleEvent.colorId && colorMap[googleEvent.colorId]) {
    return {
      ...baseEvent,
      color: colorMap[googleEvent.colorId],
    };
  }

  // Priority 3: Default to blue
  return {
    ...baseEvent,
    color: "blue",
  };
}
