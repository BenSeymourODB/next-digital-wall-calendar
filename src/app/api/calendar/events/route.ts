/**
 * API endpoint for fetching and creating Google Calendar events.
 * Uses server-side authentication with NextAuth.js. Supports fetching from
 * multiple calendars (GET) and creating a single event (POST, #116).
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import {
  type GoogleCalendarEvent,
  normalizeFetchedEvent,
} from "@/lib/google-calendar-mappers";
import { fetchWithRetry } from "@/lib/http/retry";
import { logger } from "@/lib/logger";
import type { TEventColor } from "@/types/calendar";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Map our `TEventColor` palette to a representative Google Calendar `colorId`.
 * Google's event-level colors are 1–11; we pick the closest match for each
 * Tailwind palette entry. The reverse mapping (colorId → TEventColor) lives
 * in `src/lib/calendar-transform.ts`.
 */
const TAILWIND_TO_GOOGLE_COLOR_ID: Record<TEventColor, string> = {
  blue: "1",
  green: "2",
  purple: "3",
  red: "4",
  yellow: "5",
  orange: "6",
};

const SUPPORTED_COLORS = Object.keys(
  TAILWIND_TO_GOOGLE_COLOR_ID
) as TEventColor[];

interface CalendarFetchError {
  calendarId: string;
  error: string;
  status?: number;
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
  error?: CalendarFetchError;
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
    const errorData = await response.json().catch(() => ({}));
    return {
      events: [],
      error: {
        calendarId,
        error: errorData.error?.message || "Failed to fetch events",
        status: response.status,
      },
    };
  }

  const data = await response.json();
  const events: GoogleCalendarEvent[] = (data.items || []).map(
    (event: gapi.client.calendar.Event) =>
      normalizeFetchedEvent(event, calendarId)
  );

  return {
    events,
    summary: data.summary,
    timeZone: data.timeZone,
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
    const errors: CalendarFetchError[] = [];
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
        logger.error(new Error("Calendar fetch error"), {
          calendarId: result.error.calendarId,
          errorMessage: result.error.error,
          errorStatus: result.error.status || 0,
          userId: session.user.id,
        });
      }
      // Use summary/timezone from first successful calendar
      if (!summary && result.summary) {
        summary = result.summary;
        timeZone = result.timeZone;
      }
    }

    // If ALL calendars failed (and not auth errors), return error
    if (errors.length === calendarIds.length && calendarIds.length === 1) {
      return NextResponse.json(
        { error: "Failed to fetch calendar events" },
        { status: errors[0].status || 500 }
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

    // Include errors array if there were partial failures
    if (errors.length > 0) {
      response.errors = errors;
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
 * Body accepted by `POST /api/calendar/events`. The shape is the dialog's
 * submission payload plus an optional target `calendarId` (defaults to
 * `"primary"`). Dates are ISO strings; for all-day events the route reduces
 * them to `YYYY-MM-DD` and applies Google's exclusive-end convention.
 */
interface CreateEventBody {
  title: string;
  startDate: string;
  endDate: string;
  color: TEventColor;
  description?: string;
  isAllDay?: boolean;
  calendarId?: string;
}

interface ValidatedEvent {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: boolean;
  start: Date;
  end: Date;
  calendarId: string;
}

type ValidationResult =
  | { ok: true; event: ValidatedEvent }
  | { ok: false; error: string };

function isSupportedColor(value: unknown): value is TEventColor {
  return (
    typeof value === "string" && (SUPPORTED_COLORS as string[]).includes(value)
  );
}

function validateCreateBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const raw = body as Partial<CreateEventBody>;

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return { ok: false, error: "Title is required" };
  }

  if (typeof raw.startDate !== "string" || typeof raw.endDate !== "string") {
    return { ok: false, error: "startDate and endDate must be ISO strings" };
  }

  const start = new Date(raw.startDate);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "startDate is not a valid ISO date" };
  }

  const end = new Date(raw.endDate);
  if (Number.isNaN(end.getTime())) {
    return { ok: false, error: "endDate is not a valid ISO date" };
  }

  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: "endDate must be after startDate" };
  }

  if (!isSupportedColor(raw.color)) {
    return {
      ok: false,
      error: `color must be one of ${SUPPORTED_COLORS.join(", ")}`,
    };
  }

  const calendarId =
    typeof raw.calendarId === "string" && raw.calendarId.trim().length > 0
      ? raw.calendarId.trim()
      : "primary";

  const description =
    typeof raw.description === "string" ? raw.description : "";

  return {
    ok: true,
    event: {
      title,
      description,
      color: raw.color,
      isAllDay: raw.isAllDay === true,
      start,
      end,
      calendarId,
    },
  };
}

/**
 * Format a `Date` as a `YYYY-MM-DD` string using its UTC components, so the
 * route's behaviour is independent of the server's timezone.
 *
 * This is the right choice for Google's all-day shape AND for the wire
 * format the dialog produces: `start = local-midnight Date.toISOString()`
 * and `end = local-end-of-day Date.toISOString()`. Using `getUTC*` here
 * keeps the start date stable across server TZs, and the duration-based
 * `exclusiveEnd` below avoids the off-by-one that `setHours(0,0,0,0)` +
 * `getDate()+1` produces on a server in a different TZ to the client.
 *
 * Caveat: a client in a positive UTC offset (e.g., NZST = UTC+12) creating
 * an all-day event for "Apr 20 local" sends UTC = Apr 19. The route still
 * sees Apr 19 here. Fully fixing that needs a wire-format change so the
 * dialog emits `YYYY-MM-DD` strings (or a `tzOffsetMinutes`) rather than
 * encoding local-midnight as a UTC ISO. Tracked as follow-up.
 */
function formatUTCDate(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const MS_PER_DAY = 86_400_000;

/**
 * Build the Google Calendar `events.insert` body from a validated event.
 *
 * For all-day events we emit `start.date` / `end.date` and apply Google's
 * exclusive-end convention: a single-day event on Apr 20 sends
 * `start.date = "2026-04-20"` / `end.date = "2026-04-21"`. The exclusive
 * end is computed as `start + N * MS_PER_DAY` where N is the inclusive
 * day-count rounded from the input span (`24h - 1ms` per day), so the
 * result is server-TZ-independent and survives DST boundaries.
 */
function buildGoogleInsertBody(event: ValidatedEvent) {
  const insertBody: {
    summary: string;
    description?: string;
    colorId?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
  } = {
    summary: event.title,
    colorId: TAILWIND_TO_GOOGLE_COLOR_ID[event.color],
    start: {},
    end: {},
  };

  if (event.description) {
    insertBody.description = event.description;
  }

  if (event.isAllDay) {
    const inclusiveDays = Math.max(
      1,
      Math.round((event.end.getTime() - event.start.getTime()) / MS_PER_DAY)
    );
    const exclusiveEnd = new Date(
      event.start.getTime() + inclusiveDays * MS_PER_DAY
    );

    insertBody.start.date = formatUTCDate(event.start);
    insertBody.end.date = formatUTCDate(exclusiveEnd);
  } else {
    insertBody.start.dateTime = event.start.toISOString();
    insertBody.end.dateTime = event.end.toISOString();
  }

  return insertBody;
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

    const validation = validateCreateBody(raw);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }
    const event = validation.event;

    const accessToken = await getAccessToken();

    const apiUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
      event.calendarId
    )}/events`;

    const insertBody = buildGoogleInsertBody(event);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(insertBody),
    });

    if (response.ok) {
      const created = (await response.json()) as gapi.client.calendar.Event;
      const normalized = normalizeFetchedEvent(created, event.calendarId);

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

    const errorBody = await response.json().catch(() => ({}));
    logger.error(new Error("Google Calendar create failed"), {
      userId: session.user.id,
      calendarId: event.calendarId,
      googleStatus: response.status,
      googleError: errorBody?.error?.message ?? "unknown",
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
