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
  type CalendarFetchError,
  type InternalCalendarFetchError,
  aggregateCalendarResults,
  resolveAllFailStatus,
  toWireFetchError,
} from "@/lib/calendar/events-aggregate";
import { parseCalendarEventsGetParams } from "@/lib/calendar/events-get-params";
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

    const params = parseCalendarEventsGetParams(new URL(request.url));
    // Get access token (automatically refreshed if needed)
    const accessToken = await getAccessToken();

    // Fetch events from all calendars in parallel
    const results = await Promise.all(
      params.calendarIds.map((id) =>
        fetchEventsFromCalendar(
          id,
          accessToken,
          params.timeMin,
          params.timeMax,
          params.maxResults,
          params.singleEvents
        )
      )
    );

    const agg = aggregateCalendarResults(results);

    // Walk errors in input order so log emission matches the
    // pre-extraction handler. A `[non-401, 401]` fan-out today logs the
    // non-401 "Calendar fetch error" envelope first, then the 401
    // "Google Calendar API auth error" envelope, then returns 401; an
    // earlier draft that early-returned on a single `authError` field
    // dropped the non-401 log.
    for (const err of agg.errors) {
      if (err.status === 401) {
        logger.error(new Error("Google Calendar API auth error"), {
          calendarId: err.calendarId,
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
      // Skip the generic envelope when the producer already logged a
      // richer entry (e.g. `GoogleApiValidationError` from
      // `parseGoogleResponse`). Otherwise we'd emit a bare
      // "Calendar fetch error" alongside the structured one and degrade
      // the signal in Application Insights.
      if (!err.logged) {
        logger.error(new Error("Calendar fetch error"), {
          calendarId: err.calendarId,
          errorMessage: err.error,
          errorStatus: err.status || 0,
          userId: session.user.id,
        });
      }
    }

    // If ALL calendars failed (and not auth errors — those early-returned
    // above), surface an error status so the UI can react to the top-level
    // status without inspecting `errors[]`. Pre-#386 this was gated on
    // `calendarIds.length === 1` and multi-calendar all-fail leaked a 200
    // with an empty events array.
    if (agg.errors.length === params.calendarIds.length) {
      return NextResponse.json(
        {
          error: "Failed to fetch calendar events",
          events: [],
          errors: agg.errors.map(toWireFetchError),
        },
        { status: resolveAllFailStatus(agg.errors) }
      );
    }

    logger.log("Calendar events fetched", {
      calendarCount: params.calendarIds.length,
      eventCount: agg.events.length,
      errorCount: agg.errors.length,
      userId: session.user.id,
    });

    const response: {
      events: GoogleCalendarEvent[];
      nextPageToken?: string;
      summary?: string;
      timeZone?: string;
      errors?: CalendarFetchError[];
    } = {
      events: agg.events,
      summary: agg.summary,
      timeZone: agg.timeZone,
    };

    // Include errors array if there were partial failures. Strip the
    // server-only `logged` flag so the internal dedupe guard does not leak
    // onto the wire — clients should see only the public error shape.
    if (agg.errors.length > 0) {
      response.errors = agg.errors.map(toWireFetchError);
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
