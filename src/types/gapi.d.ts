/**
 * Type declarations for Google Calendar API
 * Extends the existing gapi types with calendar-specific interfaces
 */

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
