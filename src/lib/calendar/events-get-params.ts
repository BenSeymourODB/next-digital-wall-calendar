/**
 * Pure parser for the `/api/calendar/events` GET query string. Extracted
 * from the route handler (#446) so the data flow is testable in isolation
 * and the handler can be a thin orchestrator.
 *
 * Defaults exactly match the pre-extraction handler:
 *   - calendarIds: comma-split when present, else `[calendarId]`, else `["primary"]`
 *   - timeMin: caller-supplied or `new Date().toISOString()`
 *   - timeMax: caller-supplied or `null`
 *   - maxResults: caller-supplied or `"250"` (kept as a string — Google's
 *     `URLSearchParams.set` coerces anyway, and round-tripping through
 *     `Number` would add lossy edge cases on huge values)
 *   - singleEvents: only the literal string `"false"` flips the default `true`
 */

export interface CalendarEventsGetParams {
  calendarIds: string[];
  timeMin: string;
  timeMax: string | null;
  maxResults: string;
  singleEvents: boolean;
}

export function parseCalendarEventsGetParams(
  url: URL
): CalendarEventsGetParams {
  const { searchParams } = url;
  const calendarIdsParam = searchParams.get("calendarIds");
  const calendarId = searchParams.get("calendarId") || "primary";
  const calendarIds = calendarIdsParam
    ? calendarIdsParam.split(",")
    : [calendarId];

  return {
    calendarIds,
    timeMin: searchParams.get("timeMin") || new Date().toISOString(),
    timeMax: searchParams.get("timeMax"),
    maxResults: searchParams.get("maxResults") || "250",
    singleEvents: searchParams.get("singleEvents") !== "false",
  };
}
