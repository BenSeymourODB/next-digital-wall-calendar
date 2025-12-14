/**
 * Google Calendar API integration for client-side calendar fetching
 * This module handles OAuth authentication and event fetching from multiple Google Calendars
 */
import { logger } from "@/lib/logger";

// Google API configuration types
export interface GoogleCalendarConfig {
  clientId: string;
  apiKey: string;
  discoveryDocs: string[];
  scopes: string;
}

export interface GoogleCalendarAccount {
  id: string;
  email: string;
  name: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  calendarIds: string[]; // List of calendar IDs to fetch from this account
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
  creator?: {
    email?: string;
    displayName?: string;
  };
  calendarId: string;
}

const GOOGLE_CALENDAR_CONFIG: GoogleCalendarConfig = {
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || "",
  discoveryDocs: [
    "https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest",
  ],
  scopes: "https://www.googleapis.com/auth/calendar.readonly",
};

let gapiInitialized = false;
let gapiInitPromise: Promise<void> | null = null;

/**
 * Initialize the Google API client
 */
export async function initGoogleAPI(): Promise<void> {
  if (gapiInitialized) {
    return;
  }

  if (gapiInitPromise) {
    return gapiInitPromise;
  }

  gapiInitPromise = new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Google API can only be initialized in the browser"));
      return;
    }

    // Load gapi script dynamically
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      window.gapi.load("client:auth2", async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_CALENDAR_CONFIG.apiKey,
            clientId: GOOGLE_CALENDAR_CONFIG.clientId,
            discoveryDocs: GOOGLE_CALENDAR_CONFIG.discoveryDocs,
            scope: GOOGLE_CALENDAR_CONFIG.scopes,
          });
          gapiInitialized = true;
          logger.log("Google API initialized successfully");
          resolve();
        } catch (error) {
          logger.error(error as Error, { context: "initGoogleAPI" });
          reject(error);
        }
      });
    };
    script.onerror = () => {
      const error = new Error("Failed to load Google API script");
      logger.error(error, { context: "initGoogleAPI" });
      reject(error);
    };
    document.body.appendChild(script);
  });

  return gapiInitPromise;
}

/**
 * Sign in to Google and get user credentials
 */
export async function signInToGoogle(): Promise<GoogleCalendarAccount> {
  await initGoogleAPI();

  try {
    const auth2 = window.gapi.auth2.getAuthInstance();
    const googleUser = await auth2.signIn();
    const authResponse = googleUser.getAuthResponse(true);
    const profile = googleUser.getBasicProfile();

    const account: GoogleCalendarAccount = {
      id: profile.getId(),
      email: profile.getEmail(),
      name: profile.getName(),
      accessToken: authResponse.access_token,
      expiresAt: authResponse.expires_at,
      calendarIds: ["primary"], // Start with primary calendar
    };

    logger.event("GoogleCalendarSignIn", {
      userId: account.id,
      email: account.email,
    });

    return account;
  } catch (error) {
    logger.error(error as Error, { context: "signInToGoogle" });
    throw error;
  }
}

/**
 * Sign out from Google
 */
export async function signOutFromGoogle(): Promise<void> {
  await initGoogleAPI();

  try {
    const auth2 = window.gapi.auth2.getAuthInstance();
    await auth2.signOut();
    logger.event("GoogleCalendarSignOut");
  } catch (error) {
    logger.error(error as Error, { context: "signOutFromGoogle" });
    throw error;
  }
}

/**
 * Check if user is currently signed in
 */
export async function isSignedIn(): Promise<boolean> {
  try {
    await initGoogleAPI();
    const auth2 = window.gapi.auth2.getAuthInstance();
    return auth2.isSignedIn.get();
  } catch (error) {
    logger.error(error as Error, { context: "isSignedIn" });
    return false;
  }
}

/**
 * Fetch events from a specific calendar
 */
export async function fetchCalendarEvents(
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  await initGoogleAPI();

  try {
    const response = await window.gapi.client.calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      showDeleted: false,
      singleEvents: true,
      maxResults: 2500,
      orderBy: "startTime",
    });

    const events = response.result.items || [];
    logger.log("Fetched calendar events", {
      calendarId,
      count: events.length,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
    });

    return events.map(
      (event): GoogleCalendarEvent => ({
        ...event,
        calendarId,
      })
    );
  } catch (error) {
    logger.error(error as Error, {
      context: "fetchCalendarEvents",
      calendarId,
    });
    throw error;
  }
}

/**
 * Fetch events from multiple calendars
 */
export async function fetchEventsFromMultipleCalendars(
  calendarIds: string[],
  timeMin: Date,
  timeMax: Date
): Promise<GoogleCalendarEvent[]> {
  const allEvents: GoogleCalendarEvent[] = [];

  for (const calendarId of calendarIds) {
    try {
      const events = await fetchCalendarEvents(calendarId, timeMin, timeMax);
      allEvents.push(...events);
    } catch (error) {
      logger.error(error as Error, {
        context: "fetchEventsFromMultipleCalendars",
        calendarId,
      });
      // Continue fetching from other calendars even if one fails
    }
  }

  return allEvents;
}

/**
 * Fetch all calendars for the signed-in user
 */
export async function fetchUserCalendars() {
  await initGoogleAPI();

  try {
    const response = await window.gapi.client.calendar.calendarList.list();
    const calendars = response.result.items || [];

    logger.log("Fetched user calendars", { count: calendars.length });

    return calendars.map(
      (calendar: {
        id: string;
        summary: string;
        description?: string;
        backgroundColor?: string;
        foregroundColor?: string;
        primary?: boolean;
      }) => ({
        id: calendar.id,
        summary: calendar.summary,
        description: calendar.description,
        backgroundColor: calendar.backgroundColor,
        foregroundColor: calendar.foregroundColor,
        primary: calendar.primary,
      })
    );
  } catch (error) {
    logger.error(error as Error, { context: "fetchUserCalendars" });
    throw error;
  }
}
