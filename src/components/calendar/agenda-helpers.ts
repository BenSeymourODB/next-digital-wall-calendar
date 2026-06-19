import type { IEvent } from "@/types/calendar";

/**
 * Filter events whose title, description, or attendee name contains the
 * query (case-insensitive). An empty/whitespace-only query returns the
 * list unchanged.
 *
 * Shared between `AgendaCalendar` (the legacy `/test/calendar?view=agenda`
 * renderer) and `AgendaList` (the production day/week agenda-mode renderer)
 * so search behaves identically on both surfaces.
 */
export function filterEventsBySearch(
  events: IEvent[],
  query: string
): IEvent[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return events;
  return events.filter((event) => {
    const haystack =
      `${event.title} ${event.description ?? ""} ${event.user?.name ?? ""}`.toLowerCase();
    return haystack.includes(normalized);
  });
}
