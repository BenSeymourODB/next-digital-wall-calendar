/**
 * Per-event mutation API for Google Calendar.
 *
 * This route file establishes the shared auth + Google-API forwarding shape
 * for the calendar CRUD cluster (#115/#116/#118). Today only `DELETE` is
 * implemented — `PATCH` (edit) and additional verbs land in follow-up PRs
 * and reuse this file's helpers.
 *
 * Query params:
 * - `calendarId` (required): the Google Calendar that owns the event.
 *
 * Path:
 * - `[id]`: the Google Calendar event id.
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * DELETE /api/calendar/events/[id]?calendarId=...
 *
 * Forwards to Google Calendar `events.delete`. A 204 from Google (or a 410
 * "already gone") collapses to a 204 here so the client can treat the event
 * as gone either way. Auth failures from Google surface as 401 with
 * `requiresReauth: true` so the existing client re-auth flow kicks in.
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
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

    const { id } = await params;
    const eventId = id?.trim();
    if (!eventId) {
      return NextResponse.json(
        { error: "Event id is required" },
        { status: 400 }
      );
    }

    const calendarId = new URL(request.url).searchParams
      .get("calendarId")
      ?.trim();
    if (!calendarId) {
      return NextResponse.json(
        { error: "calendarId query parameter is required" },
        { status: 400 }
      );
    }

    const accessToken = await getAccessToken();

    const apiUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`;

    const response = await fetch(apiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    // Google returns 204 No Content on success and 410 Gone if the event was
    // already deleted. Both mean the event is gone — collapse to 204 so the
    // optimistic client UI doesn't have to special-case the race.
    if (response.ok || response.status === 410) {
      logger.event("CalendarEventDeleted", {
        userId: session.user.id,
        calendarId,
        eventId,
        googleStatus: response.status,
      });
      return new NextResponse(null, { status: 204 });
    }

    if (response.status === 401) {
      logger.error(new Error("Google rejected access token on event delete"), {
        userId: session.user.id,
        calendarId,
        eventId,
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
      return NextResponse.json(
        {
          error:
            "You do not have permission to delete events on this calendar.",
        },
        { status: 403 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const errorBody = await response.json().catch(() => ({}));
    logger.error(new Error("Google Calendar delete failed"), {
      userId: session.user.id,
      calendarId,
      eventId,
      googleStatus: response.status,
      googleError: errorBody?.error?.message ?? "unknown",
    });

    return NextResponse.json(
      { error: "Failed to delete calendar event" },
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
      endpoint: "/api/calendar/events/[id]",
      method: "DELETE",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
