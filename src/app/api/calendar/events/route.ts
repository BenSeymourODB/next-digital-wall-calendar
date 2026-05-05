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

  const response = await fetch(apiUrl.toString(), {
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
 * Wire format for `POST /api/calendar/events`.
 *
 * For **timed** events (`isAllDay` absent or `false`):
 * - `startDate` / `endDate` are ISO-8601 datetime strings (e.g.
 *   `"2026-05-01T14:00:00.000Z"`).
 *
 * For **all-day** events (`isAllDay: true`):
 * - `startDate` / `endDate` are `YYYY-MM-DD` date strings (e.g.
 *   `"2026-04-20"`). Using plain date strings avoids the UTC-offset skew
 *   that occurs when a positive-offset client (e.g. NZST UTC+12) encodes
 *   local midnight as a UTC ISO string — Apr-20 00:00 NZST is Apr-19 in UTC.
 * - `endDate` is the **last included** day (inclusive). The route adds one
 *   calendar day to produce Google's exclusive-end `end.date`.
 *
 * Optional: `calendarId` (defaults to `"primary"`).
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

interface ValidatedTimedEvent {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: false;
  start: Date;
  end: Date;
  calendarId: string;
}

interface ValidatedAllDayEvent {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: true;
  /** Inclusive start date as YYYY-MM-DD string. */
  startDateStr: string;
  /** Inclusive end date as YYYY-MM-DD string. */
  endDateStr: string;
  calendarId: string;
}

type ValidatedEvent = ValidatedTimedEvent | ValidatedAllDayEvent;

type ValidationResult =
  | { ok: true; event: ValidatedEvent }
  | { ok: false; error: string };

function isSupportedColor(value: unknown): value is TEventColor {
  return (
    typeof value === "string" && (SUPPORTED_COLORS as string[]).includes(value)
  );
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Advance a `YYYY-MM-DD` string by one calendar day, returning a new
 * `YYYY-MM-DD` string. Used to compute Google's exclusive end date for
 * all-day events.
 */
function addOneDay(dateStr: string): string {
  // Split to avoid any TZ interpretation by `new Date(dateStr)`.
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
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
    return { ok: false, error: "startDate and endDate must be strings" };
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

  if (raw.isAllDay === true) {
    // All-day wire format: YYYY-MM-DD strings (timezone-independent).
    if (!DATE_ONLY_RE.test(raw.startDate)) {
      return {
        ok: false,
        error: "startDate must be a YYYY-MM-DD string for all-day events",
      };
    }
    if (!DATE_ONLY_RE.test(raw.endDate)) {
      return {
        ok: false,
        error: "endDate must be a YYYY-MM-DD string for all-day events",
      };
    }
    if (raw.endDate < raw.startDate) {
      return { ok: false, error: "endDate must be after startDate" };
    }
    return {
      ok: true,
      event: {
        title,
        description,
        color: raw.color,
        isAllDay: true,
        startDateStr: raw.startDate,
        endDateStr: raw.endDate,
        calendarId,
      },
    };
  }

  // Timed event: ISO datetime strings.
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

  return {
    ok: true,
    event: {
      title,
      description,
      color: raw.color,
      isAllDay: false,
      start,
      end,
      calendarId,
    },
  };
}

/**
 * Build the Google Calendar `events.insert` body from a validated event.
 *
 * For all-day events we emit `start.date` / `end.date` using Google's
 * exclusive-end convention: a single-day event on Apr 20 sends
 * `start.date = "2026-04-20"` / `end.date = "2026-04-21"`.
 *
 * `startDateStr` and `endDateStr` on `ValidatedAllDayEvent` are the
 * client's local YYYY-MM-DD strings — already timezone-correct since they
 * come straight from the `<input type="date">` value rather than being
 * derived from a UTC-adjusted `Date`. The exclusive end is simply
 * `addOneDay(endDateStr)`, which adds one calendar day without touching
 * UTC at all.
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
    insertBody.start.date = event.startDateStr;
    insertBody.end.date = addOneDay(event.endDateStr);
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
