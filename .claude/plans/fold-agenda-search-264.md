# Fold AgendaCalendar search into AgendaList day/week agenda mode (#264)

## Context

After PR #195 (day/week agenda toggle), the production `ViewSwitcher` no longer
mounts the search-driven `AgendaCalendar`; day/week agenda mode renders the
slimmer `AgendaList`. The search input, match count, and clear control that
landed in PR #144 only live on `/test/calendar?view=agenda`. Users have lost a
visible capability.

## Goal

Port the search input UI from `AgendaCalendar` into `AgendaList` so day and
week agenda mode filter their rendered events by query the same way
`AgendaCalendar` does, without changing the legacy `AgendaCalendar` UX or
removing it.

## Out of scope

- Retiring `AgendaCalendar.tsx`. `/test/calendar?view=agenda` still mounts it,
  and removal is tracked separately.
- Replacing the per-view header search affordance the calendar surface already
  ships elsewhere; this is strictly the agenda-mode-internal filter.

## Design

### Shared helper

Move `filterEventsBySearch` into a new pure module
`src/components/calendar/agenda-helpers.ts`. Both `AgendaCalendar.tsx` and
`AgendaList.tsx` import from there. The helper is already heavily tested in
`agenda-helpers.test.ts` (which currently imports from `AgendaCalendar`); the
test file moves its import to the new module path with no test changes.

We do **not** also relocate `sortEventsByStartTime` / `groupEventsByColor` /
`groupEventsByDate` / `parseDateKey` / `capitalize` / `getColorClasses`. Those
helpers exist in subtly different forms in both files already, and merging
them is bigger than this issue. Keeping the refactor surface tight.

### AgendaList search UI

Add local state `searchQuery` and a `<div>` wrapping a `<Input type="search">`
plus an absolutely-positioned `<Search>` icon and (when active) a clear `<X>`
button. Mirror `AgendaCalendar`'s structure exactly: testids
`agenda-list-search-input`, `agenda-list-search-clear`,
`agenda-list-search-match-count`, `agenda-list-search-status` (sr-only live
region). Tabular-nums match count to the right of the input. Use the same
case-insensitive substring filter on title / description / attendee name.

Order of filtering inside the component: window by `[rangeStart, rangeEnd]`
first, then apply the search query, then group. This matches AgendaCalendar's
"window then search" pattern and keeps results scoped to the user's current
day/week.

### Empty-state semantics

`AgendaList` currently shows the single `emptyLabel` empty state when
`windowed.length === 0`. After the change, the two states are distinct:

- `windowed.length === 0` → render `emptyLabel` (existing behaviour; the
  caller already provides a contextual label like "No events on Monday").
- `windowed.length > 0 && filtered.length === 0` (search active, no matches)
  → render `No events match "<query>"` inside the same bordered card.

The search input is always visible when `windowed.length > 0`, so the user can
clear the search from the no-matches state. We do **not** show the input on
the "no events in range" state (consistent with AgendaCalendar's pattern of
only meaningful search after data exists; avoids a dead control on empty
days).

### Accessibility

- `aria-label="Search events"` on the input.
- `aria-label="Clear search"` on the clear button.
- `role="status"` sr-only live region announces match count while typing.
- `aria-hidden="true"` on the visible match-count span so the live region is
  the sole announcement vector.

## TDD plan

Write tests first, all in `__tests__/AgendaList.test.tsx`:

1. **renders search input and clear button**: input is visible when events
   are in range; clear button appears once a query is typed and clears the
   query on click.
2. **filters by title / description / attendee** (single happy-path test
   covering all three fields via separate assertions inside one `it` block,
   since the underlying helper is exhaustively covered in
   `agenda-helpers.test.ts`).
3. **shows distinct no-matches empty state**: typing a non-matching query
   renders `No events match "<query>"` and does **not** render any
   `agenda-list-group` elements; clearing brings the results back.
4. **keeps existing in-range empty state when no events exist at all**:
   typing while `events=[]` keeps the contextual `emptyLabel` and does not
   render the no-matches card.
5. **live region announces match count**: after typing, the sr-only status
   region contains the human-readable match count phrasing.

Existing tests must continue to pass unchanged.

## Phases

Single phase — the change is small enough to deliver and commit as one slice.

1. Add `src/components/calendar/agenda-helpers.ts` exporting
   `filterEventsBySearch`.
2. Update `AgendaCalendar.tsx` and `agenda-helpers.test.ts` to import from
   the new module (`AgendaCalendar.tsx` keeps re-exporting if any other call
   site relied on the old path — none currently does, but a grep confirms
   before deletion).
3. Add the search UI + state to `AgendaList.tsx` and the empty-state branch.
4. Add the new `AgendaList.test.tsx` cases.
5. Run `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.
6. Commit, push, open draft PR, Sonnet review, address comments, mark ready.
