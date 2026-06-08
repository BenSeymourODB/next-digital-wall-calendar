/**
 * Local-time date / datetime parsing + formatting helpers shared by the
 * calendar's `<input type="date">` and `<input type="datetime-local">`
 * surfaces (event create dialog, event detail edit form).
 *
 * `<input type="date">` and `<input type="datetime-local">` emit values in
 * the user's local time zone but as strings (`YYYY-MM-DD` and
 * `YYYY-MM-DDTHH:mm`). The browser's `new Date(value)` parser interprets
 * a bare `YYYY-MM-DD` as **UTC midnight**, which shifts to the previous
 * day in negative-offset zones — so we have to parse those strings
 * piecewise to keep them anchored to the user's local day.
 */

/** Format a `Date` as `YYYY-MM-DDTHH:mm` in the local time zone. */
export function toDateTimeLocal(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Format a `Date` as `YYYY-MM-DD` in the local time zone. */
export function toDateOnly(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Parse the value from a date-only input as a local midnight `Date`, not
 * UTC midnight (which is what `new Date("2026-04-20")` would give).
 */
export function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(
    parseInt(match[1], 10),
    parseInt(match[2], 10) - 1,
    parseInt(match[3], 10),
    0,
    0,
    0,
    0
  );
}

/** Parse a `YYYY-MM-DDTHH:mm` string as a local `Date`. */
export function parseDateTimeLocal(value: string): Date | null {
  // `new Date(value)` interprets `YYYY-MM-DDTHH:mm` as local time, which is
  // what we want for a datetime-local input.
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
