/**
 * Calendar type definitions
 */

/**
 * Top-level calendar views. `agenda` is no longer a peer view — it's now an
 * `agendaMode` toggle that applies inside `day` and `week` (issue #150). Old
 * persisted `"agenda"` values are migrated at provider boot to
 * `view: "day", agendaMode: true`.
 */
export type TCalendarView = "day" | "week" | "month" | "year" | "clock";

/**
 * Which day a user-visible calendar week begins on.
 * 0 = Sunday, 1 = Monday — the only two values exposed by the settings UI
 * (#86). Typed as a union of `date-fns` `Day` values so it plugs straight
 * into `startOfWeek`, `endOfWeek`, etc. without casting.
 */
export type TWeekStartDay = 0 | 1;

export type TEventColor =
  | "blue"
  | "green"
  | "red"
  | "yellow"
  | "purple"
  | "orange";

/**
 * Per-calendar permission level reported by Google's `CalendarList.list`.
 * Mirrors `gapi.client.calendar.CalendarListEntry.accessRole`. Lives here
 * (rather than in `CalendarProvider`) so server-only modules — the
 * `/api/calendar/calendars` route and `lib/google-calendar-mappers` —
 * can import it without pulling in client-side React. Used by the
 * read-only delete-button gating (#266).
 */
export type TCalendarAccessRole =
  | "freeBusyReader"
  | "reader"
  | "writer"
  | "owner";

// Typed as `Record<TCalendarAccessRole, true>` so adding a new role to the
// union above forces a compile error here until the lookup is updated. A
// plain Set would silently miss the new value and downgrade legitimate
// access to "reader" — unacceptable for a fail-closed trust boundary.
const VALID_ACCESS_ROLES: Record<TCalendarAccessRole, true> = {
  freeBusyReader: true,
  reader: true,
  writer: true,
  owner: true,
};

/**
 * Narrow Google's `accessRole` string (or `undefined`) into the canonical
 * {@link TCalendarAccessRole} union, failing closed to `"reader"` for
 * missing or unrecognised values. The Zod schema in
 * `lib/google-calendar-schemas.ts` keeps `accessRole` as a loose `string`
 * (#277) so future Google additions pass validation; this helper is the
 * route's trust boundary that picks a safe default for anything we don't
 * recognise.
 */
export function narrowAccessRole(
  value: string | undefined
): TCalendarAccessRole {
  return value !== undefined &&
    Object.prototype.hasOwnProperty.call(VALID_ACCESS_ROLES, value)
    ? (value as TCalendarAccessRole)
    : "reader";
}

export interface IUser {
  id: string;
  name: string;
  picturePath: string | null;
}

export interface IEvent {
  id: string;
  startDate: string;
  endDate: string;
  title: string;
  color: TEventColor;
  description: string;
  user: IUser;
  isAllDay: boolean;
  calendarId: string;
}

/**
 * Lightweight calendar metadata used by the filter panel and any other
 * surface that needs to render a list of the user's calendars. Sourced
 * from `/api/calendar/calendars` (see `CalendarInfo` in that route for the
 * full schema). We keep only the fields the client UI actually uses.
 */
export interface ICalendarInfo {
  id: string;
  summary: string;
  backgroundColor: string;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
