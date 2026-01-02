/**
 * Type declarations for Google Calendar API and Google Identity Services
 * Extends the existing gapi types with calendar-specific interfaces
 */

/**
 * Google Identity Services (GIS) types for OAuth2
 */
declare namespace google.accounts.oauth2 {
  interface TokenResponse {
    access_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
    error?: string;
    error_description?: string;
  }

  interface TokenClient {
    callback: (response: TokenResponse) => void;
    requestAccessToken: (overrideConfig?: {
      prompt?: "" | "none" | "consent" | "select_account";
    }) => void;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    callback: string | ((response: TokenResponse) => void);
    prompt?: "" | "none" | "consent" | "select_account";
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(token: string, done?: () => void): void;
}

/**
 * GAPI client types
 */
declare namespace gapi {
  function load(
    apiName: string,
    options: { callback: () => void; onerror?: () => void }
  ): void;

  namespace client {
    function init(config: {
      apiKey?: string;
      discoveryDocs?: string[];
    }): Promise<void>;

    function getToken(): {
      access_token: string;
      expires_in?: number;
      expires_at?: number;
    } | null;

    function setToken(token: { access_token: string } | null): void;
  }
}

declare namespace gapi.client.calendar {
  interface Event {
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
  }

  interface CalendarListEntry {
    id: string;
    summary: string;
    description?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    primary?: boolean;
  }

  interface EventsListResponse {
    items?: Event[];
  }

  interface CalendarListListResponse {
    items?: CalendarListEntry[];
  }

  namespace events {
    function list(request: {
      calendarId: string;
      timeMin: string;
      timeMax: string;
      showDeleted: boolean;
      singleEvents: boolean;
      maxResults: number;
      orderBy: string;
    }): Promise<{ result: EventsListResponse }>;
  }

  namespace calendarList {
    function list(): Promise<{ result: CalendarListListResponse }>;
  }
}
