/**
 * API endpoint for fetching and creating Google Calendar events.
 * Uses server-side authentication with NextAuth.js. Supports fetching from
 * multiple calendars (GET) and creating a single event (POST, #116).
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import {
  buildGoogleEventBody,
  validateEventBody,
} from "@/lib/calendar/event-body";
import {
  type GoogleCalendarEvent,
  normalizeFetchedEvent,
} from "@/lib/google-calendar-mappers";
import {
  GoogleApiValidationError,
  type GoogleEventPayload,
  GoogleEventSchema,
  type GoogleEventsListResponse,
  GoogleEventsListResponseSchema,
  VALIDATION_ISSUES_SUMMARY_COUNT,
  parseGoogleErrorBody,
  parseGoogleResponse,
} from "@/lib/google-calendar-schemas";
import { fetchWithRetry } from "@/lib/http/retry";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Wire shape for per-calendar errors surfaced in the partial-failure response.
 * Mirrors {@link InternalCalendarFetchError} minus the internal `logged` flag,
 * which is a server-side dedupe guard and must not leak to clients.
 */
interface CalendarFetchError {
  calendarId: string;
  error: string;
  status?: number;
}

interface InternalCalendarFetchError extends CalendarFetchError {
  /**
   * `true` when the producer has already logged a structured `logger.error`
   * for this failure (e.g. validation errors from `parseGoogleResponse`).
   * The outer aggregation loop honours this to avoid double-logging the same
   * failure with a generic "Calendar fetch error" envelope on top of the
   * rich validation entry. Internal-only — stripped before serialisation.
   */
  logged?: boolean;
}

/**
 * Project an internal per-calendar error onto its public wire shape, dropping
 * the server-only `logged` dedupe flag.
 */
function toWireFetchError(e: InternalCalendarFetchError): CalendarFetchError {
  const wire: CalendarFetchError = { calendarId: e.calendarId, error: e.error };
  if (e.status !== undefined) wire.status = e.status;
  return wire;
}

/**
 * Pick the HTTP status to return when every calendar in a multi-calendar
 * GET failed. If all per-calendar statuses agree, bubble that status. On
 * mixed statuses, collapse to a 502 — proxy-style "upstream failures" that
 * signals the overall request couldn't be served without claiming any
 * single upstream status as canonical. Auth (401) errors short-circuit the
 * outer handler so they never reach this function. The caller's guard
 * (`errors.length === calendarIds.length`) ensures `errors` is non-empty.
 */
function resolveAllFailStatus(errors: InternalCalendarFetchError[]): number {
  const first = errors[0].status ?? 500;
  return errors.every((e) => (e.status ?? 500) === first) ? first : 502;
}

/**
 * Fetch events from a single calendar
 */
async function fetchEventsFromCalendar(
  calendarId: string,
  accessToken: string,
  timeMin: string,
  timeMax: string | null,
  maxResults: string,
  singleEvents: boolean
): Promise<{
  events: GoogleCalendarEvent[];
  error?: InternalCalendarFetchError;
  summary?: string;
  timeZone?: string;
}> {
  const apiUrl = new URL(
    `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
  );
  apiUrl.searchParams.set("timeMin", timeMin);
  if (timeMax) apiUrl.searchParams.set("timeMax", timeMax);
  apiUrl.searchParams.set("maxResults", maxResults);
  apiUrl.searchParams.set("singleEvents", String(singleEvents));
  apiUrl.searchParams.set("orderBy", "startTime");

  const response = await fetchWithRetry(apiUrl.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorBody = parseGoogleErrorBody(
      await response.json().catch(() => ({}))
    );
    return {
      events: [],
      error: {
        calendarId,
        error: errorBody.error?.message || "Failed to fetch events",
        status: response.status,
      },
    };
  }

  const rawData: unknown = await response.json();
  let parsed: GoogleEventsListResponse;
  try {
    parsed = parseGoogleResponse(rawData, GoogleEventsListResponseSchema, {
      endpoint: "events.list",
      calendarId,
    });
  } catch (error) {
    if (error instanceof GoogleApiValidationError) {
      logger.error(error, {
        endpoint: error.endpoint,
        ...(error.calendarId ? { calendarId: error.calendarId } : {}),
        validationIssues: error.issues
          .slice(0, VALIDATION_ISSUES_SUMMARY_COUNT)
          .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
          .join("; "),
      });
      return {
        events: [],
        error: {
          calendarId,
          error: "Google Calendar response failed validation",
          status: 502,
          logged: true,
        },
      };
    }
    throw error;
  }

  // The mappers spread `{ ...event }` so unknown Google fields pass through
  // unchanged (the Zod schema is `.loose()` for the same reason). The cast
  // is safe because the schema requires `id` — the contract our mapper relies
  // on — and treats every other field as optional, matching the Google API.
  const events: GoogleCalendarEvent[] = (parsed.items ?? []).map(
    (event: GoogleEventPayload) =>
      normalizeFetchedEvent(event as gapi.client.calendar.Event, calendarId)
  );

  return {
    events,
    summary: parsed.summary,
    timeZone: parsed.timeZone,
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if token refresh failed
    if (session.error === "RefreshTokenError") {
      return NextResponse.json(
        {
          error: "Session expired. Please sign in again.",
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const calendarIdsParam = searchParams.get("calendarIds");
    const calendarId = searchParams.get("calendarId") || "primary";
    const timeMin = searchParams.get("timeMin") || new Date().toISOString();
    const timeMax = searchParams.get("timeMax");
    const maxResults = searchParams.get("maxResults") || "250";
    const singleEvents = searchParams.get("singleEvents") !== "false";

    // Get access token (automatically refreshed if needed)
    const accessToken = await getAccessToken();

    // Determine which calendars to fetch from
    const calendarIds = calendarIdsParam
      ? calendarIdsParam.split(",")
      : [calendarId];

    // Fetch events from all calendars in parallel
    const results = await Promise.all(
      calendarIds.map((id) =>
        fetchEventsFromCalendar(
          id,
          accessToken,
          timeMin,
          timeMax,
          maxResults,
          singleEvents
        )
      )
    );

    // Collect events and errors
    const allEvents: GoogleCalendarEvent[] = [];
    const errors: InternalCalendarFetchError[] = [];
    let summary: string | undefined;
    let timeZone: string | undefined;

    for (const result of results) {
      allEvents.push(...result.events);
      if (result.error) {
        // Check if it's an auth error that should fail the whole request
        if (result.error.status === 401) {
          logger.error(new Error("Google Calendar API auth error"), {
            calendarId: result.error.calendarId,
            userId: session.user.id,
          });
          return NextResponse.json(
            {
              error: "Google authentication failed. Please sign in again.",
              requiresReauth: true,
            },
            { status: 401 }
          );
        }
        errors.push(result.error);
        // Skip the generic envelope when the producer already logged a
        // richer entry (e.g. `GoogleApiValidationError` from
        // `parseGoogleResponse`). Otherwise we'd emit a bare
        // "Calendar fetch error" alongside the structured one and degrade
        // the signal in Application Insights.
        if (!result.error.logged) {
          logger.error(new Error("Calendar fetch error"), {
            calendarId: result.error.calendarId,
            errorMessage: result.error.error,
            errorStatus: result.error.status || 0,
            userId: session.user.id,
          });
        }
      }
      // Use summary/timezone from first successful calendar
      if (!summary && result.summary) {
        summary = result.summary;
        timeZone = result.timeZone;
      }
    }

    // If ALL calendars failed (and not auth errors — those early-returned
    // above), surface an error status so the UI can react to the top-level
    // status without inspecting `errors[]`. Pre-#386 this was gated on
    // `calendarIds.length === 1` and multi-calendar all-fail leaked a 200
    // with an empty events array.
    if (errors.length === calendarIds.length) {
      return NextResponse.json(
        {
          error: "Failed to fetch calendar events",
          events: [],
          errors: errors.map(toWireFetchError),
        },
        { status: resolveAllFailStatus(errors) }
      );
    }

    logger.log("Calendar events fetched", {
      calendarCount: calendarIds.length,
      eventCount: allEvents.length,
      errorCount: errors.length,
      userId: session.user.id,
    });

    const response: {
      events: GoogleCalendarEvent[];
      nextPageToken?: string;
      summary?: string;
      timeZone?: string;
      errors?: CalendarFetchError[];
    } = {
      events: allEvents,
      summary,
      timeZone,
    };

    // Include errors array if there were partial failures. Strip the
    // server-only `logged` flag so the internal dedupe guard does not leak
    // onto the wire — clients should see only the public error shape.
    if (errors.length > 0) {
      response.errors = errors.map(toWireFetchError);
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/calendar/events",
      errorType: "fetch_events",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/events
 *
 * Creates a new event on a Google Calendar via `events.insert`. Auth and
 * error shape mirror the per-event DELETE route from #115:
 * - 401 / `requiresReauth: true` when our session is dead OR Google 401s.
 * - 403 / "permission" when Google denies the calendar.
 * - 404 when the target calendar is missing.
 * - 502 on other Google failures so callers can distinguish from local 5xx.
 *
 * On success: 201 with `{ event: GoogleCalendarEvent }`. The event is
 * normalised through `normalizeFetchedEvent` so the client can replace the
 * optimistic placeholder with the canonical representation (real `id`,
 * `etag`, etc.).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (session.error === "RefreshTokenError") {
      return NextResponse.json(
        {
          error: "Session expired. Please sign in again.",
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }

    const validation = validateEventBody(raw);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const event = validation.event;

    const accessToken = await getAccessToken();

    const apiUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
      event.calendarId
    )}/events`;

    const insertBody = buildGoogleEventBody(event);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(insertBody),
    });

    if (response.ok) {
      const rawCreated: unknown = await response.json();
      let created: GoogleEventPayload;
      try {
        created = parseGoogleResponse(rawCreated, GoogleEventSchema, {
          endpoint: "events.insert",
          calendarId: event.calendarId,
        });
      } catch (validationError) {
        if (validationError instanceof GoogleApiValidationError) {
          logger.error(validationError, {
            endpoint: validationError.endpoint,
            ...(validationError.calendarId
              ? { calendarId: validationError.calendarId }
              : {}),
            userId: session.user.id,
            validationIssues: validationError.issues
              .slice(0, VALIDATION_ISSUES_SUMMARY_COUNT)
              .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
              .join("; "),
          });
          return NextResponse.json(
            { error: "Failed to create calendar event" },
            { status: 502 }
          );
        }
        throw validationError;
      }

      const normalized = normalizeFetchedEvent(
        created as gapi.client.calendar.Event,
        event.calendarId
      );

      logger.event("CalendarEventCreated", {
        userId: session.user.id,
        calendarId: event.calendarId,
        eventId: normalized.id,
        isAllDay: event.isAllDay,
      });

      return NextResponse.json({ event: normalized }, { status: 201 });
    }

    if (response.status === 401) {
      logger.error(new Error("Google rejected access token on event create"), {
        userId: session.user.id,
        calendarId: event.calendarId,
      });
      return NextResponse.json(
        {
          error: "Google authentication failed. Please sign in again.",
          requiresReauth: true,
        },
        { status: 401 }
      );
    }

    if (response.status === 403) {
      logger.error(new Error("Google denied create on calendar (403)"), {
        userId: session.user.id,
        calendarId: event.calendarId,
      });
      return NextResponse.json(
        {
          error:
            "You do not have permission to create events on this calendar.",
        },
        { status: 403 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json(
        { error: "Calendar not found" },
        { status: 404 }
      );
    }

    const errorBody = parseGoogleErrorBody(
      await response.json().catch(() => ({}))
    );
    logger.error(new Error("Google Calendar create failed"), {
      userId: session.user.id,
      calendarId: event.calendarId,
      googleStatus: response.status,
      googleError: errorBody.error?.message ?? "unknown",
    });

    return NextResponse.json(
      { error: "Failed to create calendar event" },
      { status: 502 }
    );
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/calendar/events",
      method: "POST",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
