/**
 * API endpoint for fetching user's Google Calendar list
 * Returns all calendars with their color information
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Calendar information returned by this endpoint
 */
export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  backgroundColor: string;
  foregroundColor: string;
  primary: boolean;
  selected: boolean;
}

/**
 * Response type for GET /api/calendar/calendars
 */
export interface CalendarsResponse {
  calendars: CalendarInfo[];
}

/**
 * Raw Google Calendar API calendarList item
 */
interface GoogleCalendarListItem {
  id: string;
  summary: string;
  description?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  primary?: boolean;
  selected?: boolean;
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
    const response = await fetch(apiUrl.toString(), {
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

    const data = await response.json();
    const items: GoogleCalendarListItem[] = data.items || [];

    // Transform to our CalendarInfo format
    const calendars: CalendarInfo[] = items.map((item) => ({
      id: item.id,
      summary: item.summary,
      description: item.description,
      backgroundColor: item.backgroundColor || "#4285f4", // Default Google blue
      foregroundColor: item.foregroundColor || "#ffffff",
      primary: item.primary || false,
      selected: item.selected || false,
    }));

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
