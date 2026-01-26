/**
 * API endpoint for fetching Google Calendar events
 * Uses server-side authentication with NextAuth.js
 * Supports fetching from multiple calendars
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  colorId?: string;
  creator?: { email?: string; displayName?: string };
  organizer?: { email?: string; displayName?: string };
  [key: string]: unknown;
}

interface CalendarEventWithId extends GoogleCalendarEvent {
  calendarId: string;
}

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
  events: CalendarEventWithId[];
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
  const events: CalendarEventWithId[] = (data.items || []).map(
    (event: GoogleCalendarEvent) => ({
      ...event,
      calendarId,
    })
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
    const allEvents: CalendarEventWithId[] = [];
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
      events: CalendarEventWithId[];
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
