# Issue #375 — Unify bare-date parsing across calendar-helpers + YearCalendar

## Goal

Eliminate the dot-vs-count asymmetry for bare-date all-day events. PR #251
introduced `parseEventStartLocal` inside `YearCalendar.tsx`, but the
sibling `getEventsForX` overlap helpers in `src/lib/calendar-helpers.ts`
still use `parseISO`, which parses bare `YYYY-MM-DD` as UTC midnight.
Promote the local helper to a shared `parseEventStart` (+ symmetric
`parseEventEnd`) and use it everywhere the overlap math needs it.

## Failure mode (from the issue)

Bare-date all-day event `{ startDate: "2026-01-01", endDate: "2026-01-01",
isAllDay: true }` in a negative-offset zone (UTC-8): the YearCalendar dot
renders on Jan 1 but `getEventsForYear` returns `[]` because
`parseISO("2026-01-01") → 2025-12-31T16:00 local`. Count and dot disagree.

## Scope

Touches the four overlap helpers only. Other `parseISO` callers
(`groupEvents`, `getEventsCount`, `computeEventColumns`, `assignBarRows`,
`calculateMonthEventPositions`, `getMonthCellEvents`, `getEventTimePosition`)
are explicitly **out of scope** — the issue lists only the four overlap
helpers in its table, and broadening would invite scope creep on a
targeted fix.

## Phases

### Phase 1 — Shared parsers + overlap-helper rewire

**TDD: write failing tests first.**

1. `src/lib/__tests__/calendar-helpers.test.ts`:
   - `parseEventStart` / `parseEventEnd`: bare `YYYY-MM-DD` parses to
     local-midnight `Date`; full ISO timestamp falls through to `parseISO`.
   - `getEventsForDay` / `getEventsForWeek` / `getEventsForMonth` /
     `getEventsForYear`: a bare-date event at the year/month/week/day
     boundary is included in the result. Tests construct expected dates
     via `new Date(y, m, d)` to mirror the parser semantics (no
     `process.env.TZ` manipulation, matching the PR #251 test style).

2. `src/lib/calendar-helpers.ts`:
   - Export a `BARE_DATE_RE` and two helpers:
     ```ts
     export function parseEventStart(event: IEvent): Date;
     export function parseEventEnd(event: IEvent): Date;
     ```
   - Each tries `BARE_DATE_RE` first, falls back to `parseISO` on the
     respective field.
3. Swap `parseISO(event.startDate)` / `parseISO(event.endDate)` for the
   new helpers inside `getEventsForDay`, `getEventsForWeek`,
   `getEventsForMonth`, `getEventsForYear`. Other helpers stay on
   `parseISO`.

### Phase 2 — YearCalendar consumer + regression test

1. `src/components/calendar/YearCalendar.tsx`:
   - Import `parseEventStart` from `@/lib/calendar-helpers`.
   - Replace the local `parseEventStartLocal` (and its `BARE_DATE_RE`)
     with the shared helper.
   - `bucketEventColorsByDayKey` keeps the same semantics — its existing
     unit test still passes.
2. `src/components/calendar/__tests__/YearCalendar.test.tsx`:
   - Add a regression test asserting the year-count path matches the dot
     path for a bare-date Jan-1 event in 2026 (the exact case from the
     issue). Render with a single
     `{ startDate: "2026-01-01", endDate: "2026-01-01", isAllDay: true }`
     event and verify the `year-calendar-event-count` testid reads
     `1 event` while the dot is visible on the Jan-1 cell.

## Acceptance (mirrors issue)

- [x] `parseEventStart` / `parseEventEnd` exported and used by the four
      overlap helpers.
- [x] `YearCalendar.tsx` imports the shared parsers instead of its local
      copy.
- [x] Unit tests cover bare-date events at Jan-1, Dec-31, first/last day
      of month/week, and bare-date day queries.
- [x] Regression test in `YearCalendar.test.tsx` proves count agrees with
      dot for the issue's exact scenario.
- [x] No behavior change for full-ISO-timestamp events — existing tests
      stay green.
- [x] `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types`
      all green.

## Out of scope

- Multi-day bare-date event coverage in `assignBarRows` /
  `calculateMonthEventPositions` — pre-existing limitation, not in #375.
- The `getEventsCount` path (also uses `parseISO`) — it's the count used
  by view headers, not the overlap helpers; the issue lists only the
  four overlap helpers explicitly.
- Retiring `parseISO` project-wide. The intent is to fix the bare-date
  bug, not refactor all date parsing.
