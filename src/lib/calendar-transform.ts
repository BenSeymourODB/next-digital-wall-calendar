/**
 * Google Calendar event transformation utilities
 *
 * Transforms Google Calendar API events into the internal IEvent format.
 * Handles:
 * - All-day event detection (via start.date vs start.dateTime)
 * - Timezone-safe date parsing (appends T00:00:00 to date-only strings)
 * - Calendar color mapping (from Google Calendar API color mappings)
 * - CalendarId preservation for cache round-tripping
 * - User-attribution fallback ladder for shared-calendar events (#307)
 */
import type { CalendarColorMapping } from "@/lib/calendar-storage";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import type { IEvent, TEventColor } from "@/types/calendar";

/**
 * Pulls a user-supplied category label off a Google Calendar event.
 *
 * Google does not expose a first-class category field, so this app
 * conventionalises `extendedProperties.shared.category` (preferred —
 * visible to all attendees) and falls back to `.private.category`
 * (per-user). Returns `undefined` for missing or whitespace-only values
 * so the consumer can branch cleanly without a sentinel.
 *
 * The fallback is evaluated per-source after trimming so a whitespace-only
 * `shared.category` doesn't shadow a valid `private.category` — `??` on
 * the raw strings would short-circuit on a non-`undefined` empty/whitespace
 * shared value and drop the private value.
 *
 * Issue #211.
 */
function extractCategory(googleEvent: GoogleCalendarEvent): string | undefined {
  const sharedTrimmed =
    googleEvent.extendedProperties?.shared?.category?.trim();
  if (sharedTrimmed) return sharedTrimmed;
  const privateTrimmed =
    googleEvent.extendedProperties?.private?.category?.trim();
  if (privateTrimmed) return privateTrimmed;
  return undefined;
}

/**
 * Per-calendar metadata used by the user-attribution fallback ladder.
 * Keyed by `calendarId`. Values mirror the slice of `UserCalendar` we need
 * to produce a human-readable label when neither `creator.displayName` nor
 * `organizer.displayName` is populated (the common case for shared
 * personal/family calendars — Google only fills `displayName` when the user
 * has a discoverable People profile shared with the calling app).
 */
export interface CalendarAttributionMetadata {
  summary: string;
  summaryOverride?: string;
}

export type CalendarMetadataMap = ReadonlyMap<
  string,
  CalendarAttributionMetadata
>;

/**
 * Turn the local-part of an email into a best-effort human-readable name.
 *
 *   liv4ever42@gmail.com   → "Liv4ever42"
 *   john.doe@example.com   → "John Doe"
 *   alice_marie@x.com      → "Alice Marie"
 *
 * Splits on `.`, `_`, `-`, capitalises the first character of each chunk, and
 * joins with a space. Returns `undefined` when the input has no usable local
 * part so the caller can fall through to the next rung of the ladder.
 */
function humanizeLocalPart(email: string | undefined): string | undefined {
  if (!email) return undefined;
  const at = email.indexOf("@");
  const local = at >= 0 ? email.slice(0, at) : email;
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length === 0) return undefined;
  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolve the user attribution displayed on the event.
 *
 * Ladder (first non-empty wins):
 *   1. `creator.displayName`
 *   2. `organizer.displayName`
 *   3. Calendar metadata: `summaryOverride ?? summary` for `calendarId`
 *      (e.g. "Liv Seymour" for `liv4ever42@gmail.com`). This is the most
 *      reliable source for events on a calendar you don't own — Google
 *      always fills it on `calendarList.list`.
 *   4. Humanised local-part of the chosen email.
 *   5. Literal `"Unknown"`.
 *
 * `id` cascades through `creator.email → organizer.email → calendarId`.
 * The calendarId fallback ensures each shared calendar lands in a *distinct*
 * Filter-By-User bucket (#307 Bug B) — pre-fix every shared calendar without
 * a creator email shared the literal `"unknown"` id and collapsed into one
 * bucket. `calendarId` is required on `GoogleCalendarEvent` (stamped by
 * `normalizeFetchedEvent`), so the cascade always terminates with a
 * meaningful string; no `"unknown"` literal is needed.
 */
function resolveUser(
  googleEvent: GoogleCalendarEvent,
  calendarMetadata: CalendarMetadataMap | undefined
): { id: string; name: string; picturePath: null } {
  const creatorEmail = googleEvent.creator?.email;
  const organizerEmail = googleEvent.organizer?.email;
  const id: string = creatorEmail ?? organizerEmail ?? googleEvent.calendarId;

  const meta = calendarMetadata?.get(googleEvent.calendarId);
  // `??` (not `||`) is intentional: a non-empty `summaryOverride` always
  // wins over `summary`. An empty-string override would survive `??` but
  // is filtered out by the trim guard below, falling through to
  // humanizeLocalPart. In practice Google omits the field entirely when
  // the user hasn't set an override, so this edge case is theoretical.
  const calendarLabel = meta?.summaryOverride ?? meta?.summary;

  const name =
    googleEvent.creator?.displayName ??
    googleEvent.organizer?.displayName ??
    (calendarLabel && calendarLabel.trim().length > 0
      ? calendarLabel
      : undefined) ??
    humanizeLocalPart(creatorEmail ?? organizerEmail) ??
    "Unknown";

  return { id, name, picturePath: null };
}

/**
 * Transform a Google Calendar event to our IEvent format.
 * Uses color mappings from Google Calendar API when available.
 *
 * Key behaviors:
 * - Sets isAllDay based on presence of start.date (vs start.dateTime)
 * - Appends T00:00:00 to date-only strings to force local time interpretation
 * - Preserves calendarId from the Google event for cache round-tripping
 * - Maps colors via calendarId lookup, then colorId fallback, then default blue
 * - Resolves `user.name` via the {@link resolveUser} fallback ladder; pass
 *   `calendarMetadata` (a `Map<calendarId, { summary, summaryOverride? }>`)
 *   to enable the calendar-name rung. Optional for back-compat with 2-arg
 *   callers — the ladder simply skips that rung when it's missing.
 */
export function transformGoogleEvent(
  googleEvent: GoogleCalendarEvent,
  colorMappings: CalendarColorMapping[],
  calendarMetadata?: CalendarMetadataMap
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

  const user = resolveUser(googleEvent, calendarMetadata);

  const category = extractCategory(googleEvent);

  const baseEvent = {
    id: googleEvent.id,
    startDate,
    endDate,
    title: googleEvent.summary || "Untitled Event",
    description: googleEvent.description || "",
    user,
    isAllDay,
    calendarId,
    ...(category === undefined ? {} : { category }),
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
