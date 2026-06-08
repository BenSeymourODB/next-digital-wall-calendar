/**
 * Per-event mutation API for Google Calendar.
 *
 * Implements `DELETE` (#115 delete half, PR #197) and `PATCH` (#115 edit
 * half, #265) against the same path. Both share the auth + Google-API
 * error shape; PATCH additionally reuses the body validator + Google body
 * builder from `src/lib/calendar/event-body.ts` so POST and PATCH stay in
 * lockstep.
 *
 * Query params:
 * - `calendarId` (required): the Google Calendar that owns the event.
 *
 * Path:
 * - `[id]`: the Google Calendar event id.
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import {
  buildGoogleEventBody,
  validateEventBody,
} from "@/lib/calendar/event-body";
import { normalizeFetchedEvent } from "@/lib/google-calendar-mappers";
import { fetchWithRetry } from "@/lib/http/retry";
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

    const response = await fetchWithRetry(apiUrl, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
      logger.error(new Error("Google denied delete on calendar (403)"), {
        userId: session.user.id,
        calendarId,
        eventId,
      });
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

/**
 * PATCH /api/calendar/events/[id]?calendarId=...
 *
 * Forwards an event edit to Google Calendar `events.patch`. Body shape is
 * identical to `POST /api/calendar/events` (validated via the shared
 * `validateEventBody` helper), so callers reuse the same form. The
 * `calendarId` query string is the source of truth for the target
 * calendar — a `calendarId` field in the body is ignored. Auth/error
 * mirror DELETE (401 / `requiresReauth`, 403 / 404 / 502 / 500).
 *
 * On success: 200 with `{ event: GoogleCalendarEvent }`, normalised through
 * `normalizeFetchedEvent` so the client can replace its optimistic row with
 * the canonical representation (etag, updated timestamps, etc.).
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
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

    const accessToken = await getAccessToken();

    const apiUrl = `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(eventId)}`;

    const patchBody = buildGoogleEventBody(validation.event);

    const response = await fetchWithRetry(apiUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patchBody),
    });

    if (response.ok) {
      const updated = (await response.json()) as gapi.client.calendar.Event;
      const normalized = normalizeFetchedEvent(updated, calendarId);

      logger.event("CalendarEventUpdated", {
        userId: session.user.id,
        calendarId,
        eventId: normalized.id,
        isAllDay: validation.event.isAllDay,
      });

      return NextResponse.json({ event: normalized });
    }

    if (response.status === 401) {
      logger.error(new Error("Google rejected access token on event patch"), {
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
      logger.error(new Error("Google denied patch on calendar (403)"), {
        userId: session.user.id,
        calendarId,
        eventId,
      });
      return NextResponse.json(
        {
          error: "You do not have permission to edit events on this calendar.",
        },
        { status: 403 }
      );
    }

    if (response.status === 404) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const errorBody = await response.json().catch(() => ({}));
    logger.error(new Error("Google Calendar patch failed"), {
      userId: session.user.id,
      calendarId,
      eventId,
      googleStatus: response.status,
      googleError: errorBody?.error?.message ?? "unknown",
    });

    return NextResponse.json(
      { error: "Failed to update calendar event" },
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
      method: "PATCH",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
