/**
 * Google Calendar API integration for client-side calendar fetching
 * This module handles OAuth authentication and event fetching from multiple Google Calendars
 * Uses Google Identity Services (GIS) for modern OAuth authentication
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
  // Request calendar access + user profile information (email and name)
  scopes:
    "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
};

let gapiInitialized = false;
let gapiInitPromise: Promise<void> | null = null;
let gisInitialized = false;
let gisInitPromise: Promise<void> | null = null;
let tokenClient: google.accounts.oauth2.TokenClient | null = null;

/**
 * Wait for a global object to be available (script loaded by Next.js Script component)
 */
function waitForGlobal<T>(
  globalName: string,
  checkInterval = 100,
  maxWait = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = () => {
      // Check if the global exists
      const globalObj = (window as unknown as Record<string, unknown>)[
        globalName
      ];
      if (globalObj) {
        logger.log("Global object available", { globalName });
        resolve(globalObj as T);
        return;
      }

      // Check if we've exceeded max wait time
      if (Date.now() - startTime > maxWait) {
        const error = new Error(
          `Timeout waiting for global object: ${globalName}`
        );
        logger.error(error, {
          context: "waitForGlobal",
          globalName,
          maxWait,
        });
        reject(error);
        return;
      }

      // Check again after interval
      setTimeout(check, checkInterval);
    };

    check();
  });
}

/**
 * Initialize Google Identity Services (GIS) for OAuth
 */
async function initGoogleIdentityServices(): Promise<void> {
  if (gisInitialized) {
    return;
  }

  if (gisInitPromise) {
    return gisInitPromise;
  }

  gisInitPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error(
        "Google Identity Services can only be initialized in the browser"
      );
    }

    if (!GOOGLE_CALENDAR_CONFIG.clientId) {
      throw new Error(
        "Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env.local file."
      );
    }

    try {
      // Wait for Google Identity Services to load (loaded via Next.js Script component)
      await waitForGlobal<typeof google>("google");

      // Initialize token client for OAuth
      tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CALENDAR_CONFIG.clientId,
        scope: GOOGLE_CALENDAR_CONFIG.scopes,
        callback: "", // Will be set per-request
      });

      gisInitialized = true;
      logger.log("Google Identity Services initialized successfully");
    } catch (error) {
      gisInitPromise = null;
      throw error;
    }
  })();

  return gisInitPromise;
}

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

  gapiInitPromise = (async () => {
    if (typeof window === "undefined") {
      throw new Error("Google API can only be initialized in the browser");
    }

    if (!GOOGLE_CALENDAR_CONFIG.clientId) {
      throw new Error(
        "Google Client ID is not configured. Please set NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env.local file."
      );
    }

    try {
      // Wait for gapi to load (loaded via Next.js Script component)
      await waitForGlobal<typeof gapi>("gapi");

      // Load the calendar API client
      await new Promise<void>((resolve, reject) => {
        window.gapi.load("client", {
          callback: resolve,
          onerror: reject,
        });
      });

      // Initialize the API client
      await window.gapi.client.init({
        apiKey: GOOGLE_CALENDAR_CONFIG.apiKey || undefined,
        discoveryDocs: GOOGLE_CALENDAR_CONFIG.discoveryDocs,
      });

      gapiInitialized = true;
      logger.log("Google API client initialized successfully");
    } catch (error) {
      gapiInitPromise = null;
      logger.error(error as Error, { context: "initGoogleAPI" });
      throw error;
    }
  })();

  return gapiInitPromise;
}

/**
 * Sign in to Google and get user credentials using Google Identity Services
 */
export async function signInToGoogle(): Promise<GoogleCalendarAccount> {
  // Initialize both GIS (for auth) and GAPI (for API calls)
  await Promise.all([initGoogleIdentityServices(), initGoogleAPI()]);

  if (!tokenClient) {
    throw new Error("Token client not initialized");
  }

  return new Promise((resolve, reject) => {
    try {
      // Request an access token
      tokenClient!.callback = async (
        response: google.accounts.oauth2.TokenResponse
      ) => {
        if (response.error) {
          const error = new Error(
            `OAuth error: ${response.error} - ${response.error_description || ""}`
          );
          logger.error(error, { context: "signInToGoogle" });
          reject(error);
          return;
        }

        try {
          // Set the access token for API calls
          window.gapi.client.setToken({
            access_token: response.access_token,
          });

          // Get user info using People API
          const userInfoResponse = await fetch(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            {
              headers: {
                Authorization: `Bearer ${response.access_token}`,
              },
            }
          );

          if (!userInfoResponse.ok) {
            throw new Error("Failed to fetch user info");
          }

          const userInfo = await userInfoResponse.json();

          const account: GoogleCalendarAccount = {
            id: userInfo.id,
            email: userInfo.email,
            name: userInfo.name || userInfo.email,
            accessToken: response.access_token,
            expiresAt: Date.now() + (response.expires_in || 3600) * 1000,
            calendarIds: ["primary"], // Start with primary calendar
          };

          logger.event("GoogleCalendarSignIn", {
            userId: account.id,
            email: account.email,
          });

          resolve(account);
        } catch (error) {
          logger.error(error as Error, { context: "signInToGoogle" });
          reject(error);
        }
      };

      // Request access token
      tokenClient!.requestAccessToken({ prompt: "consent" });
    } catch (error) {
      logger.error(error as Error, { context: "signInToGoogle" });
      reject(error);
    }
  });
}

/**
 * Sign out from Google
 */
export async function signOutFromGoogle(): Promise<void> {
  try {
    // Revoke the access token
    const token = window.gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        logger.event("GoogleCalendarSignOut");
      });
      window.gapi.client.setToken(null);
    }
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
    if (!gapiInitialized) {
      return false;
    }
    const token = window.gapi.client.getToken();
    // Token exists means user is signed in (we'll let the API handle token refresh)
    return !!token;
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
  } catch (error: unknown) {
    const err = error as {
      result?: { error?: { code?: number; message?: string } };
    };
    const errorCode = err.result?.error?.code;
    const errorMessage = err.result?.error?.message;

    logger.error(error as Error, {
      context: "fetchCalendarEvents",
      calendarId,
      errorCode,
      errorMessage,
    });

    // Provide helpful error messages
    if (errorCode === 404) {
      throw new Error(
        `Calendar not found: ${calendarId}. The calendar may not exist or you may not have access to it.`
      );
    } else if (errorCode === 403) {
      throw new Error(
        `Access denied to calendar: ${calendarId}. Please check your permissions.`
      );
    }

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
