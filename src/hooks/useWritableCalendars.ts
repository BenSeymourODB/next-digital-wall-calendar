"use client";

import type {
  CalendarAccessRole,
  CalendarInfo,
} from "@/app/api/calendar/calendars/route";
import { logger } from "@/lib/logger";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

/**
 * A calendar the user can create events on. Identical to {@link CalendarInfo}
 * apart from the narrowed `accessRole` — never "reader" / "freeBusyReader".
 */
export interface WritableCalendar extends Omit<CalendarInfo, "accessRole"> {
  accessRole: "writer" | "owner";
}

interface UseWritableCalendarsResult {
  calendars: WritableCalendar[];
  isLoading: boolean;
}

const WRITABLE_ROLES: ReadonlySet<CalendarAccessRole> = new Set([
  "writer",
  "owner",
]);

function isWritable(c: CalendarInfo): c is WritableCalendar {
  return WRITABLE_ROLES.has(c.accessRole);
}

function sortPrimaryFirstThenAlpha(
  a: WritableCalendar,
  b: WritableCalendar
): number {
  if (a.primary !== b.primary) return a.primary ? -1 : 1;
  return a.summary.localeCompare(b.summary);
}

/**
 * Fetch the user's Google calendar list and return the subset they can write
 * events to (`accessRole` `writer` or `owner`). Used by the EventCreateDialog
 * calendar picker (issue #268).
 *
 * Returns an empty list while loading or when the session is unauthenticated;
 * callers should treat that case as "fall back to `primary`".
 */
export function useWritableCalendars(): UseWritableCalendarsResult {
  const { status } = useSession();
  const [calendars, setCalendars] = useState<WritableCalendar[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") {
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    (async () => {
      // The non-OK and catch branches both `return` early; relying on the
      // `finally` below is what guarantees `isLoading` resets in those
      // paths. Keep them as bare returns rather than calling
      // `setIsLoading(false)` inline so there's exactly one place that
      // owns the loading flag.
      try {
        const response = await fetch("/api/calendar/calendars");
        if (cancelled) return;
        if (!response.ok) {
          logger.log("useWritableCalendars: API returned non-OK", {
            status: response.status,
          });
          setCalendars([]);
          return;
        }
        const data = (await response.json()) as { calendars?: CalendarInfo[] };
        if (cancelled) return;
        const writable = (data.calendars ?? [])
          .filter(isWritable)
          .sort(sortPrimaryFirstThenAlpha);
        setCalendars(writable);
      } catch (error) {
        if (cancelled) return;
        logger.error(error as Error, { context: "useWritableCalendars" });
        setCalendars([]);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return { calendars, isLoading };
}
