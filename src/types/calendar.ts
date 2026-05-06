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
  /**
   * User-supplied category label sourced from Google Calendar's
   * `extendedProperties.shared.category` (preferred) or
   * `.private.category` (fallback). Optional because Google does not
   * expose a first-class category field — events created from clients
   * that don't stamp this property carry no category. See issue #211.
   */
  category?: string;
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
