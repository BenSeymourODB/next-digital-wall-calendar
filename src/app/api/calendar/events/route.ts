/**
 * API endpoint for fetching Google Calendar events
 * Uses server-side authentication with NextAuth.js
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

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
    const calendarId = searchParams.get("calendarId") || "primary";
    const timeMin = searchParams.get("timeMin") || new Date().toISOString();
    const timeMax = searchParams.get("timeMax");
    const maxResults = searchParams.get("maxResults") || "250";
    const singleEvents = searchParams.get("singleEvents") !== "false";

    // Get access token (automatically refreshed if needed)
    const accessToken = await getAccessToken();

    // Build API URL
    const apiUrl = new URL(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`
    );
    apiUrl.searchParams.set("timeMin", timeMin);
    if (timeMax) apiUrl.searchParams.set("timeMax", timeMax);
    apiUrl.searchParams.set("maxResults", maxResults);
    apiUrl.searchParams.set("singleEvents", String(singleEvents));
    apiUrl.searchParams.set("orderBy", "startTime");

    // Fetch events from Google Calendar API
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
        calendarId,
        userId: session.user.id,
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
        { error: "Failed to fetch calendar events" },
        { status: response.status }
      );
    }

    const data = await response.json();

    logger.log("Calendar events fetched", {
      calendarId,
      eventCount: data.items?.length || 0,
      userId: session.user.id,
    });

    return NextResponse.json({
      events: data.items || [],
      nextPageToken: data.nextPageToken,
      summary: data.summary,
      timeZone: data.timeZone,
    });
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
