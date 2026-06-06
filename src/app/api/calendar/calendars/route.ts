/**
 * API endpoint for fetching user's Google Calendar list
 * Returns all calendars with their color information
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import {
  GoogleApiValidationError,
  type GoogleCalendarListEntry,
  type GoogleCalendarListResponse,
  GoogleCalendarListResponseSchema,
  parseGoogleResponse,
} from "@/lib/google-calendar-schemas";
import { fetchWithRetry } from "@/lib/http/retry";
import { logger } from "@/lib/logger";
import { narrowAccessRole, type TCalendarAccessRole } from "@/types/calendar";
import { NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Access role exposed by `calendarList.list`. Determines whether the calendar
 * accepts writes (used by the EventCreateDialog calendar picker — issue #268)
 * and whether mutating actions render in `EventDetailModal` (#266).
 *
 * Re-exported from this module as an alias for the canonical
 * {@link TCalendarAccessRole} so existing consumers (e.g.
 * `useWritableCalendars`) keep working — but new code should import the
 * canonical name from `@/types/calendar`.
 */
export type CalendarAccessRole = TCalendarAccessRole;

/**
 * Calendar information returned by this endpoint
 */
export interface CalendarInfo {
  id: string;
  summary: string;
  /**
   * The user's per-calendar override of `summary` (set in the Google
   * Calendar UI for shared calendars they don't own). When present it's the
   * label the user expects to see for that calendar, so downstream code
   * (e.g. the user-attribution fallback ladder in `transformGoogleEvent`)
   * should prefer it over `summary`.
   */
  summaryOverride?: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  primary: boolean;
  selected: boolean;
  /**
   * The user's permission level on this calendar (#266, #268). Always
   * present — when Google omits the field on a `CalendarListEntry`, the
   * route fails closed to `"reader"` so the event-create picker never
   * offers a calendar we can't write to.
   */
  accessRole: CalendarAccessRole;
}

/**
 * Response type for GET /api/calendar/calendars
 */
export interface CalendarsResponse {
  calendars: CalendarInfo[];
}

export async function GET() {
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

    // Get access token (automatically refreshed if needed)
    const accessToken = await getAccessToken();

    // Build API URL for calendarList.list
    const apiUrl = new URL(`${GOOGLE_CALENDAR_API}/users/me/calendarList`);

    // Fetch calendar list from Google Calendar API
    const response = await fetchWithRetry(apiUrl.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error(new Error("Google Calendar API error"), {
        status: response.status,
        errorData,
        userId: session.user.id,
        endpoint: "calendarList.list",
      });

      if (response.status === 401) {
        return NextResponse.json(
          {
            error: "Google authentication failed. Please sign in again.",
            requiresReauth: true,
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch calendar list" },
        { status: response.status }
      );
    }

    const rawData: unknown = await response.json();
    let parsed: GoogleCalendarListResponse;
    try {
      parsed = parseGoogleResponse(rawData, GoogleCalendarListResponseSchema, {
        endpoint: "calendarList.list",
      });
    } catch (validationError) {
      if (validationError instanceof GoogleApiValidationError) {
        logger.error(validationError, {
          endpoint: validationError.endpoint,
          userId: session.user.id,
          validationIssues: validationError.issues
            .slice(0, 5)
            .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
            .join("; "),
        });
        return NextResponse.json(
          { error: "Failed to fetch calendar list" },
          { status: 502 }
        );
      }
      throw validationError;
    }

    // Transform to our CalendarInfo format. `summary` is optional per the
    // Google schema — fall back to empty string so downstream UI code can
    // treat it as a plain string.
    const calendars: CalendarInfo[] = (parsed.items ?? []).map(
      (item: GoogleCalendarListEntry): CalendarInfo => ({
        id: item.id,
        summary: item.summary ?? "",
        summaryOverride: item.summaryOverride,
        description: item.description,
        backgroundColor: item.backgroundColor || "#4285f4", // Default Google blue
        foregroundColor: item.foregroundColor || "#ffffff",
        primary: item.primary || false,
        selected: item.selected || false,
        // Default to "reader" when Google omits accessRole or sends an
        // unknown value — fail-closed so the event-create picker (#268)
        // never offers a calendar we can't write to, and so the
        // EventDetailModal delete gating (#266) hides the button on
        // unknown-role calendars rather than allowing a doomed mutation.
        // The Zod schema keeps `accessRole` as a loose `string` (#277) to
        // forward future Google additions unchanged; this narrow is the
        // closing trust boundary that picks a safe default for anything
        // we don't recognise.
        accessRole: narrowAccessRole(item.accessRole),
      })
    );

    logger.log("Calendar list fetched", {
      calendarCount: calendars.length,
      userId: session.user.id,
    });

    return NextResponse.json({ calendars });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/calendar/calendars",
      errorType: "fetch_calendars",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
