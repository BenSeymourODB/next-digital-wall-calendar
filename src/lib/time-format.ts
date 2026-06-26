/**
 * The documented set of `UserSettings.timeFormat` choices. Lives in a
 * server-safe module (no `"use client"`) so server-side route handlers and
 * client components can share the same typeguard without crossing a client
 * boundary. Mirrors the shape of `VALID_DATE_FORMATS` in `format-date.ts`.
 */
export type TTimeFormat = "12h" | "24h";

export const VALID_TIME_FORMATS: readonly TTimeFormat[] = [
  "12h",
  "24h",
] as const;

/**
 * Runtime guard for narrowing an `unknown` (e.g. a Prisma row, a JSON
 * request body, or a payload pulled off the settings bus) into the typed
 * union. Mirrors `isDateFormat` so settings consumers can validate
 * uniformly.
 */
export function isTimeFormat(value: unknown): value is TTimeFormat {
  return (
    typeof value === "string" &&
    (VALID_TIME_FORMATS as readonly string[]).includes(value)
  );
}
