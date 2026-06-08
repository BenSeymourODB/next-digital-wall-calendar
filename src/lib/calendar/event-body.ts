/**
 * Shared validation + Google-API body construction for the calendar event
 * mutation routes.
 *
 * Used by:
 *   - `POST /api/calendar/events`         — create
 *   - `PATCH /api/calendar/events/[id]`   — edit
 *
 * The two routes accept the same wire format (title, start/end, color,
 * description, isAllDay, optional calendarId) and emit the same Google
 * request body, so the validator + body builder live here and the route
 * handlers only differ in how they forward the result.
 */
import type { TEventColor } from "@/types/calendar";

const TAILWIND_TO_GOOGLE_COLOR_ID: Record<TEventColor, string> = {
  blue: "1",
  green: "2",
  purple: "3",
  red: "4",
  yellow: "5",
  orange: "6",
};

export const SUPPORTED_COLORS = Object.keys(
  TAILWIND_TO_GOOGLE_COLOR_ID
) as TEventColor[];

/**
 * Wire format for both `POST /api/calendar/events` and
 * `PATCH /api/calendar/events/[id]`.
 *
 * For **timed** events (`isAllDay` absent or `false`):
 * - `startDate` / `endDate` are ISO-8601 datetime strings (e.g.
 *   `"2026-05-01T14:00:00.000Z"`).
 *
 * For **all-day** events (`isAllDay: true`):
 * - `startDate` / `endDate` are `YYYY-MM-DD` date strings (e.g.
 *   `"2026-04-20"`). Using plain date strings avoids the UTC-offset skew
 *   that occurs when a positive-offset client (e.g. NZST UTC+12) encodes
 *   local midnight as a UTC ISO string — Apr-20 00:00 NZST is Apr-19 in UTC.
 * - `endDate` is the **last included** day (inclusive). The builder adds
 *   one calendar day to produce Google's exclusive-end `end.date`.
 *
 * On PATCH the `calendarId` field is ignored — the route reads it from
 * the query string for symmetry with DELETE.
 */
export interface EventBody {
  title: string;
  startDate: string;
  endDate: string;
  color: TEventColor;
  description?: string;
  isAllDay?: boolean;
  calendarId?: string;
}

interface ValidatedTimedEvent {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: false;
  start: Date;
  end: Date;
  calendarId: string;
}

interface ValidatedAllDayEvent {
  title: string;
  description: string;
  color: TEventColor;
  isAllDay: true;
  /** Inclusive start date as YYYY-MM-DD string. */
  startDateStr: string;
  /** Inclusive end date as YYYY-MM-DD string. */
  endDateStr: string;
  calendarId: string;
}

export type ValidatedEvent = ValidatedTimedEvent | ValidatedAllDayEvent;

export type ValidationResult =
  | { ok: true; event: ValidatedEvent }
  | { ok: false; error: string };

function isSupportedColor(value: unknown): value is TEventColor {
  return (
    typeof value === "string" && (SUPPORTED_COLORS as string[]).includes(value)
  );
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Advance a `YYYY-MM-DD` string by one calendar day, returning a new
 * `YYYY-MM-DD` string. Used to compute Google's exclusive end date for
 * all-day events.
 */
export function addOneDay(dateStr: string): string {
  // Split to avoid any TZ interpretation by `new Date(dateStr)`.
  const [y, m, d] = dateStr.split("-").map(Number) as [number, number, number];
  const next = new Date(y, m - 1, d + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`;
}

/**
 * Parse + validate an event mutation body. Shared between POST (create) and
 * PATCH (edit) — both accept the same wire format, so a single validator
 * keeps behaviour symmetric.
 */
export function validateEventBody(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const raw = body as Partial<EventBody>;

  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  if (!title) {
    return { ok: false, error: "Title is required" };
  }

  if (typeof raw.startDate !== "string" || typeof raw.endDate !== "string") {
    return { ok: false, error: "startDate and endDate must be strings" };
  }

  if (!isSupportedColor(raw.color)) {
    return {
      ok: false,
      error: `color must be one of ${SUPPORTED_COLORS.join(", ")}`,
    };
  }

  const calendarId =
    typeof raw.calendarId === "string" && raw.calendarId.trim().length > 0
      ? raw.calendarId.trim()
      : "primary";

  const description =
    typeof raw.description === "string" ? raw.description : "";

  if (raw.isAllDay === true) {
    // All-day wire format: YYYY-MM-DD strings (timezone-independent).
    if (!DATE_ONLY_RE.test(raw.startDate)) {
      return {
        ok: false,
        error: "startDate must be a YYYY-MM-DD string for all-day events",
      };
    }
    if (!DATE_ONLY_RE.test(raw.endDate)) {
      return {
        ok: false,
        error: "endDate must be a YYYY-MM-DD string for all-day events",
      };
    }
    if (raw.endDate < raw.startDate) {
      return { ok: false, error: "endDate must be after startDate" };
    }
    return {
      ok: true,
      event: {
        title,
        description,
        color: raw.color,
        isAllDay: true,
        startDateStr: raw.startDate,
        endDateStr: raw.endDate,
        calendarId,
      },
    };
  }

  // Timed event: ISO datetime strings.
  const start = new Date(raw.startDate);
  if (Number.isNaN(start.getTime())) {
    return { ok: false, error: "startDate is not a valid ISO date" };
  }

  const end = new Date(raw.endDate);
  if (Number.isNaN(end.getTime())) {
    return { ok: false, error: "endDate is not a valid ISO date" };
  }

  if (end.getTime() <= start.getTime()) {
    return { ok: false, error: "endDate must be after startDate" };
  }

  return {
    ok: true,
    event: {
      title,
      description,
      color: raw.color,
      isAllDay: false,
      start,
      end,
      calendarId,
    },
  };
}

interface GoogleEventBody {
  summary: string;
  description?: string;
  colorId?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
}

/**
 * Build the Google Calendar event body (used by `events.insert` and
 * `events.patch` — same shape).
 *
 * For all-day events we emit `start.date` / `end.date` using Google's
 * exclusive-end convention: a single-day event on Apr 20 sends
 * `start.date = "2026-04-20"` / `end.date = "2026-04-21"`.
 *
 * `startDateStr` and `endDateStr` on `ValidatedAllDayEvent` are the
 * client's local YYYY-MM-DD strings — already timezone-correct since they
 * come straight from the `<input type="date">` value rather than being
 * derived from a UTC-adjusted `Date`. The exclusive end is simply
 * `addOneDay(endDateStr)`, which adds one calendar day without touching
 * UTC at all.
 */
export function buildGoogleEventBody(event: ValidatedEvent): GoogleEventBody {
  const body: GoogleEventBody = {
    summary: event.title,
    colorId: TAILWIND_TO_GOOGLE_COLOR_ID[event.color],
    start: {},
    end: {},
  };

  if (event.description) {
    body.description = event.description;
  }

  if (event.isAllDay) {
    body.start.date = event.startDateStr;
    body.end.date = addOneDay(event.endDateStr);
  } else {
    body.start.dateTime = event.start.toISOString();
    body.end.dateTime = event.end.toISOString();
  }

  return body;
}
