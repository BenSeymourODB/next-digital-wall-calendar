/**
 * API endpoint for fetching calendar color mappings
 * Returns calendarId -> Tailwind color mappings for UI rendering
 */
import { AuthError, getAccessToken, getSession } from "@/lib/auth";
import { mapHexToTailwindColor } from "@/lib/color-utils";
import { logger } from "@/lib/logger";
import type { TEventColor } from "@/types/calendar";
import { NextResponse } from "next/server";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

/**
 * Calendar color mapping returned by this endpoint
 */
export interface CalendarColorMapping {
  calendarId: string;
  hexColor: string;
  tailwindColor: TEventColor;
}

/**
 * Response type for GET /api/calendar/colors
 */
export interface ColorsResponse {
  colorMappings: CalendarColorMapping[];
}

/**
 * Raw Google Calendar API calendarList item (subset of fields we need)
 */
interface GoogleCalendarListItem {
  id: string;
  backgroundColor?: string;
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
        endpoint: "calendarList.list (colors)",
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
        { error: "Failed to fetch calendar colors" },
        { status: response.status }
      );
    }

    const data = await response.json();
    const items: GoogleCalendarListItem[] = data.items || [];

    // Map each calendar to its color
    const colorMappings: CalendarColorMapping[] = items.map((item) => {
      const hexColor = item.backgroundColor || "#3b82f6"; // Default to blue-500
      return {
        calendarId: item.id,
        hexColor,
        tailwindColor: mapHexToTailwindColor(hexColor),
      };
    });

    logger.log("Calendar color mappings fetched", {
      mappingCount: colorMappings.length,
      userId: session.user.id,
    });

    return NextResponse.json({ colorMappings });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message, requiresReauth: error.status === 401 },
        { status: error.status }
      );
    }

    logger.error(error as Error, {
      endpoint: "/api/calendar/colors",
      errorType: "fetch_colors",
    });

    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
