# Wire week and day views to CalendarProvider — issue #113

## Goal

Day and Week views currently consume `events` from `CalendarProvider` but
render them as a simple per-day stacked list. Issue #113 calls for true
time-grid views with hourly positioning, multi-day spanning bars in week
view, and a live current-time indicator — all driven by the provider's
existing data flow.

The provider plumbing (`loadEventsForDate`, color/user filters,
`refreshEvents`) is already in place from PR #114 (mini-calendar) and
earlier wiring work. This issue focuses on the visual layer plus a small
provider extension so day/week navigation does not over-fetch.

## In scope

1. **Hourly time-grid** for `DayCalendar` and `WeekCalendar`. Timed
   events are absolutely positioned with `top` / `height` derived from
   `startDate` / `endDate` against a 1440-minute axis.
2. **All-day / multi-day row** above the hour grid in week view; events
   spanning more than one day render as a single horizontal bar
   clamped to the week boundary.
3. **Live current-time indicator** — a horizontal line at the
   wall-clock time, refreshed once per minute, only on today's column.
4. **Provider regression tests** — lock in the existing
   `loadEventsForDate` and filter behavior so this PR is the one that
   formalizes "navigating between days/weeks triggers appropriate data
   loading" and "events respect color and user filters".

## Out of scope (deferred)

- Drag-and-drop rescheduling (#84)
- Inline event create / edit from the time grid (#82, #115, #116)
- Per-user-configurable slot granularity beyond the 1-hour default
- Replacing `loadEventsForDate`'s month-chunked fetch with a strict
  view-window fetch — month chunks already cover any week/day view, so
  the practical "narrow time range" win is small. Cross-references
  the open work in #114's follow-ups if it ever becomes hot.

## Acceptance map (issue #113 body → this plan)

| Issue criterion                                  | Where it lands                    |
| ------------------------------------------------ | --------------------------------- |
| Day view displays events in correct time slots   | Phase 1                           |
| Week view across 7 columns with time positioning | Phase 1                           |
| Multi-day events as spanning bars in week view   | Phase 2                           |
| Current time indicator                           | Phase 1                           |
| Navigating triggers appropriate data loading     | Phase 3 — regression test         |
| Events respect color/user filters                | Phase 3 — regression test         |
| `refreshEvents` respects active view's range     | Already month-chunked — test only |

## Phase 1 — Time-grid layouts + current-time line

**New helpers** in `src/lib/calendar-helpers.ts`:

- `getEventTimePosition(event, day)` → `{ top: number, height: number }`
  in percent of the 1440-minute axis. Events that start before `day`
  clamp `top` to 0; events that end after `day` clamp `height` to the
  remaining axis.
- `getCurrentTimePosition(now = new Date())` → `{ top: number }` percent
  from start-of-day.

**`DayCalendar.tsx`**:

- Keep the header (date label, prev/today/next, event count).
- Keep the existing all-day section unchanged when present.
- Replace the timed-events card stack with a 24-row hourly grid
  (`min-h-[1440px]` so 1 minute = 1px). Render hour labels in a fixed
  left column.
- Position timed events via `getEventTimePosition`. Adjacent overlaps
  are laid out side-by-side using the existing `groupEvents` helper —
  events in the same group share the column, distinct groups occupy
  separate sub-columns.
- A `<NowLine />` child renders when `isSameDay(selectedDate, today)`;
  it owns a `useState`/`useEffect` pair that ticks every 60s.

**`WeekCalendar.tsx`**:

- Header unchanged.
- Below: 7-column hour grid, same positioning logic per column.
- All-day events rendered in a row above the grid (one cell per day).
  Multi-day handling for week view ships in Phase 2 — for Phase 1, an
  event spanning multiple days is duplicated into each day cell of the
  all-day row. (Phase 2 swaps this for a single spanning bar.)
- `<NowLine />` rendered absolutely-positioned over today's column.

## Phase 2 — Multi-day spanning bars (week view)

`WeekCalendar.tsx` gains a multi-day row above the hour grid. Bars
render once across N columns where N = number of in-week days the event
covers (clamped to `[0..6]`). Stacking handles overlapping bars by
assigning each bar a row index (existing `calculateMonthEventPositions`
solves the same problem for month view — extract a generic
`assignBarRows(events, weekStart, weekEnd)` helper).

The day view's all-day section grows a small "(through MMM d)" suffix
on multi-day events so users at a single-day view still know an event
is part of a longer span.

## Phase 3 — Provider regression tests + final E2E

- `src/components/providers/__tests__/CalendarProvider.test.tsx` (new):
  - `setSelectedDate(farFutureDate)` triggers `loadEventsForDate`
    (mock `fetch`, assert request fired with the expected `timeMin` /
    `timeMax`).
  - Filtered `events` reflects `selectedColors` / `selectedUserId`.
- `src/components/calendar/__tests__/DayCalendar.test.tsx` and
  `WeekCalendar.test.tsx` extended with positioning + now-line tests.
- `e2e/week-day-views.spec.ts` extended:
  - Time-positioned event lands on the correct row.
  - Now line visible on today, not on a past/future day.
  - Multi-day event renders as a spanning bar in week view (one bar,
    not three duplicates).
  - Filter changes (color filter) hide the right events in week and
    day views — drives the existing provider wiring through the new UI.

Video capture (`use: { video: "on" }`) is enabled only on the
multi-day-spanning + now-line tests since those exercise the
animated/timed paths; the rest stay on `retain-on-failure`.

## Files

```
src/lib/calendar-helpers.ts                                    (extend)
src/lib/__tests__/calendar-helpers.test.ts                     (new — helper tests)
src/components/calendar/DayCalendar.tsx                        (rewrite body)
src/components/calendar/WeekCalendar.tsx                       (rewrite body)
src/components/calendar/__tests__/DayCalendar.test.tsx         (extend)
src/components/calendar/__tests__/WeekCalendar.test.tsx        (extend)
src/components/providers/__tests__/CalendarProvider.test.tsx   (new)
src/app/test/calendar/page.tsx                                 (add multi-day mock)
e2e/week-day-views.spec.ts                                     (extend)
```

## Risk notes

- **Now line tick interval** — must be cleared on unmount or it leaks
  across views. Tested with `vi.useFakeTimers()`.
- **`new Date()` vs frozen clocks** — components must accept the
  current time from a hook or default arg so tests can inject. Pattern
  already used elsewhere (`startOfDay(new Date())` lifted to module
  scope).
- **Hour grid scroll position** — for usability, scroll to ~7am on
  mount. Use a `ref` + `scrollIntoView` rather than CSS magic.
