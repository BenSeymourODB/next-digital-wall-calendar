/**
 * Pure mappers and canonical domain types for Google Calendar API responses.
 *
 * This module is deliberately **universal**: it has no dependencies on
 * `window`, `gapi` at runtime, or any browser global, so both Next.js route
 * handlers in `src/app/api/calendar/**` and client components can import from
 * it safely.
 *
 * Keep this module free of side effects and do not import anything that
 * references browser-only globals.
 */
import type { TCalendarAccessRole } from "@/types/calendar";

/**
 * Returns true when the access role permits write actions (create, update,
 * delete). `undefined` is treated as permissive so a not-yet-loaded calendar
 * list doesn't silently disable UI for owner/writer calendars — Google's
 * server-side 403 remains the safety net for race conditions (#266).
 */
export function canWriteToCalendar(
  role: TCalendarAccessRole | undefined
): boolean {
  return role === undefined || role === "owner" || role === "writer";
}

/**
 * Canonical shape of a Google Calendar event inside the app.
 *
 * Extends `Omit<gapi.client.calendar.Event, "summary">` so every field on the
 * raw Google event schema is carried through the `{ ...event }` spread in
 * `normalizeFetchedEvent` without any silent widening. `summary` is narrowed
 * to a required `string` because the mapper applies a `?? ""` fallback,
 * which matches what downstream UI code expects.
 */
export interface GoogleCalendarEvent extends Omit<
  gapi.client.calendar.Event,
  "summary"
> {
  /** Narrowed to `string` — `normalizeFetchedEvent` guarantees an empty string rather than `undefined`. */
  summary: string;
  /** The calendar this event was fetched from. Not a Google-API field. */
  calendarId: string;
}

/**
 * Shape returned by `fetchUserCalendars` — mirrors the fields we pluck off
 * `gapi.client.calendar.CalendarListEntry` and narrows `summary` to a
 * required string (with an empty-string fallback supplied by the mapper).
 */
export interface UserCalendar {
  id: string;
  /** Narrowed to `string` — `normalizeCalendarListEntry` guarantees an empty string rather than `undefined`. */
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  /** Calendar-level colorId from the calendarList resource (not event-level). */
  colorId?: string;
  timeZone?: string;
  summaryOverride?: string;
  selected?: boolean;
  accessRole?: TCalendarAccessRole;
}

/**
 * Normalise a raw Google Calendar API event into our {@link GoogleCalendarEvent}
 * shape, stamping the source `calendarId` so cached events can be looked up by
 * calendar later.
 *
 * Applies a `summary ?? ""` fallback because the Google API marks
 * `Event.summary` as optional but our UI code (`transformGoogleEvent`) expects
 * a string.
 */
export function normalizeFetchedEvent(
  event: gapi.client.calendar.Event,
  calendarId: string
): GoogleCalendarEvent {
  return {
    ...event,
    summary: event.summary ?? "",
    calendarId,
  };
}

/**
 * Normalise a raw `CalendarListEntry` into the slim shape consumed by the app.
 *
 * Applies the same `summary ?? ""` fallback as {@link normalizeFetchedEvent}
 * so {@link UserCalendar.summary} is genuinely a string — `CalendarListEntry.summary`
 * is optional in the Google schema, even though it is almost always present
 * in practice.
 */
export function normalizeCalendarListEntry(
  entry: gapi.client.calendar.CalendarListEntry
): UserCalendar {
  return {
    id: entry.id,
    summary: entry.summary ?? "",
    description: entry.description,
    backgroundColor: entry.backgroundColor,
    foregroundColor: entry.foregroundColor,
    primary: entry.primary,
    colorId: entry.colorId,
    timeZone: entry.timeZone,
    summaryOverride: entry.summaryOverride,
    selected: entry.selected,
    accessRole: entry.accessRole,
  };
}
