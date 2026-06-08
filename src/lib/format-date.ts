import { format } from "date-fns";

/**
 * The documented set of `UserSettings.dateFormat` choices. Kept in sync
 * with `VALID_DATE_FORMATS` in `src/app/api/settings/route.ts` and the
 * Prisma column default. Surfacing this as a typed union (rather than a
 * loose `string`) lets components consume the value through the type
 * system instead of re-validating at each call site.
 */
export type TDateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

export const VALID_DATE_FORMATS: readonly TDateFormat[] = [
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
] as const;

export const DEFAULT_DATE_FORMAT: TDateFormat = "MM/DD/YYYY";

/**
 * Map the user-facing format token to the date-fns pattern that produces
 * the same glyphs. The user-facing tokens are case-insensitive (e.g.
 * `"YYYY"` reads naturally), but date-fns is case-sensitive — `"YYYY"`
 * means "ISO week-numbering year", which is not what we want. The mapping
 * lives in one place so a future locale-aware refactor only has to change
 * here.
 */
const PATTERNS: Record<TDateFormat, string> = {
  "MM/DD/YYYY": "MM/dd/yyyy",
  "DD/MM/YYYY": "dd/MM/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

/**
 * Render `value` in the user's preferred numeric date format. Accepts
 * either a `Date` or any string the `Date` constructor parses. Returns
 * the empty string for invalid input so a corrupted `createdAt` field
 * does not throw inside a render — callers can render a placeholder.
 */
export function formatUserDate(
  value: Date | string,
  dateFormat: TDateFormat = DEFAULT_DATE_FORMAT
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pattern = PATTERNS[dateFormat] ?? PATTERNS[DEFAULT_DATE_FORMAT];
  return format(date, pattern);
}

/**
 * Runtime guard for narrowing an `unknown` (e.g. a payload pulled off the
 * settings bus, or a raw Prisma row) into the typed union. Mirrors the
 * shape of `isCalendarTransitionSpeed` so settings consumers can validate
 * uniformly.
 */
export function isDateFormat(value: unknown): value is TDateFormat {
  return (
    typeof value === "string" &&
    (VALID_DATE_FORMATS as readonly string[]).includes(value)
  );
}
