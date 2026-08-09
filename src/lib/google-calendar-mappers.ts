/**
 * Pure mappers and canonical domain types for Google Calendar API responses.
 *
 * This module is deliberately **universal**: it has no dependencies on
 * `window`, `gapi` at runtime, or any browser global, so both server routes
 * (Next.js route handlers in `src/app/api/calendar/**`) and the client-side
 * `src/lib/google-calendar.ts` module can import from it safely.
 *
 * Keep this module free of side effects and do not import anything that
 * references browser-only globals — if you need that, put it in
 * `src/lib/google-calendar.ts` and import the mappers from here.
 */
import type { GoogleEventPayload } from "@/lib/google-calendar-schemas";
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
 *
 * Why the gapi-derived shape rather than `GoogleEventPayload` from the Zod
 * schema? `GoogleEventSchema` uses `z.object(...).loose()` so unknown
 * Google-API fields survive validation, but Zod's inferred type for a loose
 * object widens every defined inner field to `unknown` — accessing
 * `event.start.dateTime` or `event.creator.email` then fails strict TS
 * checks throughout `calendar-transform.ts`. The gapi typings give the
 * domain the structural shape it actually needs; the Zod schema remains the
 * runtime trust boundary. {@link normalizeFetchedEvent} bridges the two
 * once (#403), so routes no longer cast at every call site.
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
 * Normalise a Zod-validated Google Calendar API event ({@link GoogleEventPayload})
 * into our {@link GoogleCalendarEvent} shape, stamping the source `calendarId`
 * so cached events can be looked up by calendar later.
 *
 * Applies a `summary ?? ""` fallback because the Google API marks
 * `Event.summary` as optional but our UI code (`transformGoogleEvent`) expects
 * a string.
 *
 * The input is the Zod-parsed `GoogleEventPayload` so the routes no longer
 * cast at every call site (#403). The single structural assertion that
 * bridges the Zod schema's loose-object inference and the gapi-derived
 * domain shape lives here — the mapper IS the trust-boundary between
 * "wire payload" and "internal canonical event". Both schemas describe the
 * same JSON; the assertion is documented and safe because:
 *
 *   - Zod `.loose()` preserves unknown fields, so the spread carries every
 *     gapi-declared property forward unchanged.
 *   - `GoogleEventSchema` requires `id: string`, the only field the mapper
 *     relies on for the canonical contract.
 */
export function normalizeFetchedEvent(
  event: GoogleEventPayload,
  calendarId: string
): GoogleCalendarEvent {
  return {
    ...event,
    summary: event.summary ?? "",
    calendarId,
  } as GoogleCalendarEvent;
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
