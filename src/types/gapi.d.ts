/**
 * Ambient type declarations for the Google Calendar API v3 client (`gapi`)
 * and Google Identity Services (`google.accounts.oauth2`).
 *
 * These are **custom partial type definitions** maintained by this project,
 * because:
 *
 *   - `@types/gapi` covers the core loader but does not include calendar-
 *     specific interfaces.
 *   - `@types/gapi.auth2` is for the legacy auth flow we no longer use.
 *   - There is no official DT package for `google.accounts` Identity Services
 *     at the time of writing.
 *
 * Field definitions are modelled on the public Google documentation:
 *   - Events resource:         https://developers.google.com/workspace/calendar/api/v3/reference/events
 *   - CalendarList resource:   https://developers.google.com/workspace/calendar/api/v3/reference/calendarList
 *   - Events.list parameters:  https://developers.google.com/workspace/calendar/api/v3/reference/events/list
 *   - Identity Services token: https://developers.google.com/identity/oauth2/web/reference/js-reference
 *
 * They are partial by design — we only declare fields the app uses or is
 * likely to use. Index signatures (`[key: string]: unknown`) are intentionally
 * avoided so the compiler catches typos. Extend as new fields are consumed.
 */

/**
 * Google Identity Services (GIS) types for the `google.accounts.oauth2`
 * namespace. Loaded via https://accounts.google.com/gsi/client.
 */
declare namespace google.accounts.oauth2 {
  /** Successful or failed token response delivered to the callback. */
  interface TokenResponse {
    access_token: string;
    /** Token lifetime in seconds (Google returns this as a string in some clients). */
    expires_in: number;
    /** Space-delimited list of scopes granted. */
    scope: string;
    token_type: string;
    /**
     * Refresh token. Only provided on initial consent (`prompt: "consent"`)
     * and when `access_type=offline` is requested server-side.
     */
    refresh_token?: string;
    /** Present when an error prevented the token from being issued. */
    error?: string;
    error_description?: string;
    error_uri?: string;
    /** State value echoed back if supplied in the request. */
    state?: string;
  }

  /** A token client used to request OAuth2 access tokens. */
  interface TokenClient {
    callback: (response: TokenResponse) => void;
    requestAccessToken: (overrideConfig?: {
      prompt?: "" | "none" | "consent" | "select_account";
      hint?: string;
      state?: string;
      /** Override scopes for this specific request. */
      scope?: string;
      include_granted_scopes?: boolean;
      enable_granular_consent?: boolean;
    }) => void;
  }

  interface TokenClientConfig {
    client_id: string;
    scope: string;
    /**
     * Either a callback function or an empty string placeholder. When empty,
     * the caller must assign `tokenClient.callback` per request.
     */
    callback: string | ((response: TokenResponse) => void);
    prompt?: "" | "none" | "consent" | "select_account";
    hint?: string;
    state?: string;
    hosted_domain?: string;
    include_granted_scopes?: boolean;
    enable_granular_consent?: boolean;
    error_callback?: (error: { type: string; message?: string }) => void;
  }

  function initTokenClient(config: TokenClientConfig): TokenClient;
  function revoke(token: string, done?: () => void): void;
  function hasGrantedAnyScope(
    tokenResponse: TokenResponse,
    ...scopes: string[]
  ): boolean;
  function hasGrantedAllScopes(
    tokenResponse: TokenResponse,
    ...scopes: string[]
  ): boolean;
}

/**
 * `gapi` loader and client configuration.
 */
declare namespace gapi {
  function load(
    apiName: string,
    options: { callback: () => void; onerror?: (err?: unknown) => void }
  ): void;

  namespace client {
    /**
     * Initialise the gapi client. `apiKey` and `discoveryDocs` are the
     * common pair; `clientId`/`scope` are optional legacy parameters that
     * some older integrations still pass.
     */
    function init(config: {
      apiKey?: string;
      discoveryDocs?: string[];
      clientId?: string;
      scope?: string;
    }): Promise<void>;

    function getToken(): {
      access_token: string;
      expires_in?: number;
      expires_at?: number;
      scope?: string;
      token_type?: string;
    } | null;

    function setToken(token: { access_token: string } | null): void;
  }
}

/**
 * Google Calendar API v3 resources accessed through `gapi.client.calendar`.
 */
declare namespace gapi.client.calendar {
  /**
   * Event-level attendee entry.
   * https://developers.google.com/workspace/calendar/api/v3/reference/events#resource
   */
  interface EventAttendee {
    id?: string;
    email?: string;
    displayName?: string;
    organizer?: boolean;
    self?: boolean;
    resource?: boolean;
    optional?: boolean;
    responseStatus?: "needsAction" | "declined" | "tentative" | "accepted";
    comment?: string;
    additionalGuests?: number;
  }

  interface EventDateTime {
    /** RFC3339 timestamp for timed events. */
    dateTime?: string;
    /** `YYYY-MM-DD` for all-day events. */
    date?: string;
    timeZone?: string;
  }

  interface EventReminderOverride {
    method: "email" | "popup";
    minutes: number;
  }

  interface EventReminders {
    useDefault?: boolean;
    overrides?: EventReminderOverride[];
  }

  interface EventSource {
    url: string;
    title: string;
  }

  interface EventAttachment {
    fileUrl: string;
    title?: string;
    mimeType?: string;
    iconLink?: string;
    fileId?: string;
  }

  interface EventConferenceData {
    conferenceId?: string;
    conferenceSolution?: {
      key?: { type: string };
      name?: string;
      iconUri?: string;
    };
    entryPoints?: Array<{
      entryPointType: "video" | "phone" | "sip" | "more";
      uri?: string;
      label?: string;
      meetingCode?: string;
    }>;
    notes?: string;
    signature?: string;
  }

  /**
   * Events resource.
   * https://developers.google.com/workspace/calendar/api/v3/reference/events#resource
   */
  interface Event {
    id: string;
    summary?: string;
    description?: string;
    start: EventDateTime;
    end: EventDateTime;

    /** Event-level colorId (references `calendar#colors.event`). */
    colorId?: string;
    creator?: {
      id?: string;
      email?: string;
      displayName?: string;
      self?: boolean;
    };
    organizer?: {
      id?: string;
      email?: string;
      displayName?: string;
      self?: boolean;
    };

    /** Lifecycle metadata. */
    kind?: "calendar#event";
    etag?: string;
    status?: "confirmed" | "tentative" | "cancelled";
    htmlLink?: string;
    created?: string;
    updated?: string;
    iCalUID?: string;
    sequence?: number;

    /** Location + meeting metadata. */
    location?: string;
    hangoutLink?: string;
    conferenceData?: EventConferenceData;

    /** Visibility / scheduling flags. */
    transparency?: "opaque" | "transparent";
    visibility?: "default" | "public" | "private" | "confidential";
    anyoneCanAddSelf?: boolean;
    guestsCanInviteOthers?: boolean;
    guestsCanModify?: boolean;
    guestsCanSeeOtherGuests?: boolean;
    privateCopy?: boolean;
    locked?: boolean;

    /** Attendees, reminders, recurrence. */
    attendees?: EventAttendee[];
    attendeesOmitted?: boolean;
    reminders?: EventReminders;
    recurrence?: string[];
    recurringEventId?: string;
    originalStartTime?: EventDateTime;

    /** Extras surfaced to consumers. */
    attachments?: EventAttachment[];
    source?: EventSource;
    eventType?:
      | "default"
      | "outOfOffice"
      | "focusTime"
      | "workingLocation"
      | "fromGmail";
    extendedProperties?: {
      private?: Record<string, string>;
      shared?: Record<string, string>;
    };
  }

  /**
   * CalendarList resource entry.
   * https://developers.google.com/workspace/calendar/api/v3/reference/calendarList#resource
   *
   * The Google API schema does not mark `summary` as required — matching the
   * treatment of `Event.summary` — so it is modelled as optional here. Callers
   * that need a guaranteed string should use `normalizeCalendarListEntry`,
   * which applies the same `?? ""` fallback used for events.
   */
  interface CalendarListEntry {
    id: string;
    summary?: string;
    description?: string;
    location?: string;
    timeZone?: string;
    summaryOverride?: string;
    /** Calendar-level colorId (references `calendar#colors.calendar`). */
    colorId?: string;
    backgroundColor?: string;
    foregroundColor?: string;
    hidden?: boolean;
    selected?: boolean;
    accessRole?: "freeBusyReader" | "reader" | "writer" | "owner";
    primary?: boolean;
    deleted?: boolean;
    defaultReminders?: EventReminderOverride[];
    notificationSettings?: {
      notifications?: Array<{
        type:
          | "eventCreation"
          | "eventChange"
          | "eventCancellation"
          | "eventResponse"
          | "agenda";
        method: "email";
      }>;
    };
    conferenceProperties?: {
      allowedConferenceSolutionTypes?: string[];
    };
    kind?: "calendar#calendarListEntry";
    etag?: string;
  }

  /**
   * Response from `events.list`.
   * https://developers.google.com/workspace/calendar/api/v3/reference/events/list
   */
  interface EventsListResponse {
    kind?: "calendar#events";
    etag?: string;
    summary?: string;
    description?: string;
    updated?: string;
    timeZone?: string;
    accessRole?: "freeBusyReader" | "reader" | "writer" | "owner";
    defaultReminders?: EventReminderOverride[];
    nextPageToken?: string;
    nextSyncToken?: string;
    items?: Event[];
  }

  /** Response from `calendarList.list`. */
  interface CalendarListListResponse {
    kind?: "calendar#calendarList";
    etag?: string;
    nextPageToken?: string;
    nextSyncToken?: string;
    items?: CalendarListEntry[];
  }

  /**
   * Query parameters accepted by `events.list`.
   * https://developers.google.com/workspace/calendar/api/v3/reference/events/list#parameters
   */
  interface EventsListRequest {
    calendarId: string;
    timeMin?: string;
    timeMax?: string;
    updatedMin?: string;
    showDeleted?: boolean;
    showHiddenInvitations?: boolean;
    singleEvents?: boolean;
    maxResults?: number;
    orderBy?: "startTime" | "updated";
    pageToken?: string;
    syncToken?: string;
    q?: string;
    iCalUID?: string;
    timeZone?: string;
    privateExtendedProperty?: string | string[];
    sharedExtendedProperty?: string | string[];
    /** Partial-response field mask. */
    fields?: string;
    eventTypes?: Array<
      "default" | "outOfOffice" | "focusTime" | "workingLocation" | "fromGmail"
    >;
  }

  namespace events {
    function list(
      request: EventsListRequest
    ): Promise<{ result: EventsListResponse }>;
  }

  namespace calendarList {
    function list(request?: {
      maxResults?: number;
      pageToken?: string;
      minAccessRole?: "freeBusyReader" | "reader" | "writer" | "owner";
      showDeleted?: boolean;
      showHidden?: boolean;
      syncToken?: string;
    }): Promise<{ result: CalendarListListResponse }>;
  }
}
