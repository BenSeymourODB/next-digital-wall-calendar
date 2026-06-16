# Plan — Unify bare-date parsing across calendar overlap helpers (#375)

Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/375

## Context

PR #251 fixed YearCalendar dot rendering for bare-date all-day events by
introducing a private `parseEventStartLocal` helper inside `YearCalendar.tsx`.
That helper treats `YYYY-MM-DD` startDates as the local calendar day so the
dot lands on the correct cell regardless of harness TZ.

The **count path** in the same PR delegates to `getEventsForYear` in
`src/lib/calendar-helpers.ts`, which uses `parseISO(event.startDate)`.
`parseISO` parses bare dates as **UTC midnight**, so the count path
silently undercounts bare-date events that land at year boundaries in
negative-offset zones — disagreeing with the dot path's rendering.

The same parser-strategy mismatch exists in the sibling helpers:

- `getEventsForDay` (line 354/355, 369/370)
- `getEventsForWeek` (line 405/406)
- `getEventsForMonth` (line 421/422)
- `getEventsForYear` (line 439/440)

## Fix

Promote `parseEventStartLocal` to `src/lib/calendar-helpers.ts`, exporting
`parseEventStart(event)` and a symmetric `parseEventEnd(event)`:

```ts
const BARE_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseEventStart(event: IEvent): Date {
  const m = BARE_DATE_RE.exec(event.startDate);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : parseISO(event.startDate);
}

export function parseEventEnd(event: IEvent): Date {
  const m = BARE_DATE_RE.exec(event.endDate);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : parseISO(event.endDate);
}
```

Replace `parseISO(event.startDate)` / `parseISO(event.endDate)` in the four
overlap helpers (`getEventsForDay`, `getEventsForWeek`, `getEventsForMonth`,
`getEventsForYear`) with the new shared parsers.

Update `YearCalendar.tsx`: drop the local `parseEventStartLocal` and import
the shared `parseEventStart` from `@/lib/calendar-helpers`. Existing
`bucketEventColorsByDayKey` unit tests stay green — parser semantics are
identical to what PR #251 introduced.

## Out of scope

- Other consumers of `parseISO(event.startDate)` in `calendar-helpers.ts`
  (`groupEvents`, `calculateMonthEventPositions`, `getMonthCellEvents`,
  `getEventTimePosition`, `computeEventColumns`, `assignBarRows`,
  `getEventsCount`). Those are tracked separately if/when bugs surface.
- Multi-day-event dot rendering (only the start day gets a dot today).
- The full-year fetch path (#117).

## Tests (TDD — write first)

In `src/lib/__tests__/calendar-helpers.test.ts`:

1. `parseEventStart` / `parseEventEnd` direct unit tests:
   - Bare `YYYY-MM-DD` → `new Date(y, m-1, d)` (local) — verified via
     `.getFullYear() / .getMonth() / .getDate()`.
   - Full ISO with offset → identical to `parseISO`.
   - Naive local datetime (`"2024-03-15T10:00:00"`) → identical to `parseISO`.
2. `getEventsForYear` regression: bare-date Jan 1 event included when
   viewing that year (was excluded before fix).
3. `getEventsForMonth` regression: bare-date event on first day of month
   included.
4. `getEventsForWeek` regression: bare-date event on first day of week
   included.
5. `getEventsForDay` regression: bare-date event on the queried day
   included.

In `src/components/calendar/__tests__/YearCalendar.test.tsx`:

6. Year event count agrees with dot path for bare-date Jan-1 event — the
   asymmetry case from this issue.

All existing tests must stay green.

## Phases

Single PR, single phase: helpers + YearCalendar import + tests.
