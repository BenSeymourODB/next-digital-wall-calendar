# Plan — YearCalendar correctness bugs (#203)

Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/203

Four discrete correctness bugs in `src/components/calendar/YearCalendar.tsx`. All four
are independent of #117 (year-view data wiring, PR #196) and #204 (`useDateNow`,
PR #225). Land all four in a single PR with one phase per bug.

## Bug 1 — All-day event timezone

`new Date(event.startDate)` parses bare `YYYY-MM-DD` strings as UTC, so an all-day
event on June 15 in negative-offset zones renders the dot on June 14.

The canonical `transformGoogleEvent` already appends `T00:00:00` to bare date
strings, so the typical Google → IEvent flow is mitigated. But the `MockCalendarProvider`,
the test page fixture, and any non-Google source can still emit a bare `YYYY-MM-DD`,
and the year grid is the only renderer that compares the parsed date directly with
`isSameDay` rather than going through `parseISO` in `calendar-helpers`. Make the
year grid robust regardless of source.

**Fix:** add a private `parseEventStartLocal(event: IEvent): Date` helper inside
`YearCalendar.tsx` that:

- if `event.startDate` matches `^\d{4}-\d{2}-\d{2}$` → `new Date(y, m-1, d)` (local)
- otherwise → `new Date(event.startDate)`

Use this everywhere `YearCalendar.tsx` parses `event.startDate`.

**Test:** in `YearCalendar.test.tsx`, add a regression test that constructs an
all-day-shaped event with `startDate: "2026-06-15"` and asserts the dot lands on
the `year-calendar-day-2026-06-15` cell (not 2026-06-14). Pinning the harness
timezone via `process.env.TZ = "America/Los_Angeles"` is unreliable in vitest's
worker model — instead the test asserts the local-date semantics directly by
constructing the bare-date input that triggered the bug. The local-time parser
gives the right cell regardless of which TZ the worker is running in.

## Bug 2 — Multi-year overlap missed in `yearEventCount`

`yearEventCount` filters only by `startDate`, so an event running Dec 2025 → Jan 2026
is invisible in the 2026 count.

**Fix:** replace the inline filter with `getEventsForYear(events, selectedDate).length`.
`getEventsForYear` (`src/lib/calendar-helpers.ts:389`) already implements overlap.

**Test:** asserts a Dec 2025 → Jan 2026 event is counted both when `selectedDate`
is in 2025 and when it's in 2026.

## Bug 3 — Per-day perf: pre-bucket by day key

`getUniqueColorsForDay` iterates the full event array per day cell (up to 366
cells × N events). Pre-bucket events into a `Map<string, Set<TEventColor>>` keyed
on `formatDayKey` — built once per render — and pass it down to `MonthPanel`
so each day cell is an O(1) lookup.

**Fix:** introduce `bucketEventsByDayKey(events: IEvent[]): Map<string, Set<TEventColor>>`
private to `YearCalendar.tsx`. Call it once at the top of `YearCalendar()`. Replace
the per-cell `getUniqueColorsForDay(events, day)` call with `colorsByDayKey.get(key) ?? EMPTY`.

This hits both ends of the issue's perf criterion: the inner loop drops from
`O(events × cells)` to `O(events + cells)`, and the resulting refactor surfaces
the day-key as the single source of truth across the file.

**Test:** add a test that asserts the bucketer is invoked exactly once per render
(spy via wrapping the helper before passing into the component, or assert via the
public dot-count behaviour with a large fixture — picking the latter for
behaviour stability). Confirm the dot-count tests still pass under the new path.

## Bug 4 — Year navigation semantics

`previousYear`/`nextYear` currently preserve the month from `selectedDate`:

```tsx
new Date(year - 1, selectedDate.getMonth(), 1);
```

The issue specifies prev/next should land on **Jan 1** of the target year:

```tsx
new Date(year - 1, 0, 1);
```

**Fix:** simple substitution.

**Test:** in addition to the existing `getFullYear()` assertion, the new test
asserts `getMonth() === 0` and `getDate() === 1` for both prev and next.

## Out of scope

- Anything related to the `today` highlight or its midnight tick — that belongs
  to #204 / PR #225.
- The full-year data fetching path — that's #117 / PR #196.
- Accessibility improvements — tracked in #220.
- Touching the `ICalendarContext` shape (would conflict with PR #196 which adds
  `loadEventsForYear`). All work stays inside `YearCalendar.tsx` and
  `YearCalendar.test.tsx`.

## Phases

1. **Phase 1** — Bug 1 timezone-safe parsing + regression test. Commit + push +
   open draft PR.
2. **Phase 2** — Bug 2 `yearEventCount` overlap + regression test. Commit + push.
3. **Phase 3** — Bug 3 pre-bucketing + perf-shape test. Commit + push.
4. **Phase 4** — Bug 4 nav semantics + Jan-1 assertions. Commit + push.
5. Final: full test sweep, mark PR ready, kick off review subagent.

After every phase: `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.
