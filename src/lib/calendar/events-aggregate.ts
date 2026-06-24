/**
 * Per-calendar fetch result aggregation for `/api/calendar/events` GET.
 *
 * The route fans out one `fetchEventsFromCalendar` call per requested calendar
 * and then merges the results. This module is the pure data side of that
 * merge: it walks every result, accumulates events and errors in input order,
 * picks summary/timeZone from the first successful calendar, and leaves all
 * logging + `NextResponse` shaping to the handler.
 *
 * **Why every error — including 401s — is surfaced in input order:** the
 * pre-extraction handler interleaved logging with iteration. On a
 * `[non-401, 401]` fan-out, today's order is the non-401 "Calendar fetch
 * error" envelope first, then the 401 "Google Calendar API auth error"
 * envelope, then the 401 response. An aggregator that early-returned on the
 * first 401 (e.g. via an `authError` field) would drop the preceding
 * non-401 log. So the contract here is "walk every result"; the handler
 * iterates `errors[]` and dispatches.
 */
import type { GoogleCalendarEvent } from "@/lib/google-calendar-mappers";

/**
 * Wire shape for per-calendar errors surfaced in the partial-failure
 * response. Mirrors `InternalCalendarFetchError` minus the internal
 * `logged` flag, which is a server-side dedupe guard and must not leak
 * to clients.
 */
export interface CalendarFetchError {
  calendarId: string;
  error: string;
  status?: number;
}

export interface InternalCalendarFetchError extends CalendarFetchError {
  /**
   * `true` when the producer has already logged a structured `logger.error`
   * for this failure (e.g. validation errors from `parseGoogleResponse`).
   * The handler honours this to avoid double-logging the same failure with
   * a generic "Calendar fetch error" envelope on top of the rich
   * validation entry. Internal-only — stripped before serialisation.
   */
  logged?: boolean;
}

/**
 * Shape of one per-calendar fetch outcome. Matches the return type of
 * `fetchEventsFromCalendar` in the route handler — kept loose here so the
 * aggregator is decoupled from that helper's signature evolution.
 */
export interface PerCalendarFetchResult {
  events: GoogleCalendarEvent[];
  error?: InternalCalendarFetchError;
  summary?: string;
  timeZone?: string;
}

export interface AggregatedCalendarFetch {
  events: GoogleCalendarEvent[];
  errors: InternalCalendarFetchError[];
  summary: string | undefined;
  timeZone: string | undefined;
}

export function aggregateCalendarResults(
  results: PerCalendarFetchResult[]
): AggregatedCalendarFetch {
  const events: GoogleCalendarEvent[] = [];
  const errors: InternalCalendarFetchError[] = [];
  let summary: string | undefined;
  let timeZone: string | undefined;

  for (const result of results) {
    events.push(...result.events);
    if (result.error) {
      errors.push(result.error);
    }
    if (!summary && result.summary) {
      summary = result.summary;
      timeZone = result.timeZone;
    }
  }

  return { events, errors, summary, timeZone };
}

/**
 * Project an internal per-calendar error onto its public wire shape,
 * dropping the server-only `logged` dedupe flag.
 */
export function toWireFetchError(
  e: InternalCalendarFetchError
): CalendarFetchError {
  const wire: CalendarFetchError = { calendarId: e.calendarId, error: e.error };
  if (e.status !== undefined) wire.status = e.status;
  return wire;
}

/**
 * Pick the HTTP status to return when every calendar in a multi-calendar
 * GET failed. If all per-calendar statuses agree, bubble that status. On
 * mixed statuses, collapse to a 502 — proxy-style "upstream failures" that
 * signals the overall request couldn't be served without claiming any
 * single upstream status as canonical. Auth (401) errors short-circuit
 * the outer handler so they never reach this function (the handler returns
 * before computing the all-fail response). The caller's guard
 * (`errors.length === calendarIds.length`) ensures `errors` is non-empty.
 */
export function resolveAllFailStatus(
  errors: InternalCalendarFetchError[]
): number {
  const first = errors[0].status ?? 500;
  return errors.every((e) => (e.status ?? 500) === first) ? first : 502;
}
