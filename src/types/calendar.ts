/**
 * Calendar type definitions
 */

export type TCalendarView = "day" | "week" | "month" | "year" | "agenda";

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
}

export interface ICalendarCell {
  day: number;
  currentMonth: boolean;
  date: Date;
}
