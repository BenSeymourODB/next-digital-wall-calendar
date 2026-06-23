# Mini-Calendar Sidebar — Day-click E2E (#279)

> Addresses #279. Test-only. Closes #222 item 3.

## Goal

Extend `e2e/mini-calendar-sidebar.spec.ts` so the day-click flow asserts the
**main view** navigates to the clicked date (not just the sidebar's local
events-list heading), and add explicit cross-month coverage that pins #202's
"clicking a padding cell also advances `viewMonth`" branch.

## Why now

PR #245 deferred a MiniCalendarSidebar day-click E2E and the gap has sat in
the backlog since. The existing spec (`mini-calendar-sidebar.spec.ts` line 67)
clicks a sidebar day but only verifies the sidebar's own events-list heading.
The acceptance criteria from #279 are:

- [ ] Spec passes deterministically against a seeded fixture
- [ ] Cross-month click case included (regression coverage for #202)

…and the second one isn't covered today.

## Scope

**In scope** (test additions only — no production code changes):

1. Extend the "clicking a different day updates the events list and main
   calendar state" test to additionally assert `data-testid="day-calendar-heading"`
   shows the clicked day's date string. Same-month case.
2. New test: cross-month click via the sidebar's own `mini-calendar-next-month`
   chevron. Navigates `viewMonth` two months forward, clicks an in-month cell,
   asserts the main view's `day-calendar-heading` reflects the new date
   (different month from the initial `selectedDate`).
3. New test: out-of-month spillover click. Clicks a cell carrying
   `data-in-month="false"` (a trailing or leading padding cell), asserts both
   the main view's `day-calendar-heading` and the sidebar's
   `mini-calendar-header` follow the new month — this is the exact path #202
   fixed (the `setViewMonth(startOfMonth(day))` arm of `handleDayClick`).

**Out of scope**

- Authenticated `/calendar` coverage — the shared auth fixture (#278) is
  landed but the existing spec was deliberately scoped to `/test/calendar` with
  `MockCalendarProvider` for deterministic events. We keep that surface.
- Anchor-pinned timestamps (`?anchor=YYYY-MM-DD`). The new assertions read
  attributes set by `format(selectedDate, …)` and `aria-label`, so they don't
  depend on the wall-clock "today". Day-of-week / month names roll
  consistently.

## Design notes

### Why the same spec page (`/test/calendar?view=agenda&sidebar=true`) works

`DayCalendar.tsx:167-172` renders `data-testid="day-calendar-heading"`
_outside_ the `agendaMode` branch — i.e. the heading is present whether the
day view is the grid or the agenda list. The current spec page (`view=agenda`
→ `view=day` + `agendaMode=true` per `src/app/test/calendar/page.tsx:485-491`)
therefore exposes the heading we need, no additional URL params required.

### The cross-month "in-month" click path

After chevron-advancing `viewMonth`, the sidebar shows next month's grid but
`selectedDate` is unchanged. Clicking an in-month day calls
`handleDayClick(day, true)` which only calls `setSelectedDate(day)`. On the
next render, `MiniCalendarSidebar`'s auto-sync block
(`MiniCalendarSidebar.tsx:84-91`) detects the month change and pulls
`viewMonth` to the new month — but it was already there, so no visible jump.
The main view's `DayCalendar` re-renders with the new `selectedDate` and the
heading updates.

### The out-of-month padding cell click path (#202 regression coverage)

When the user clicks a `data-in-month="false"` cell, `handleDayClick(day, false)`
calls _both_ `setSelectedDate(day)` and `setViewMonth(startOfMonth(day))`.
Without this second call (#202's fix), the sidebar would scroll the
highlighted cell off-grid. The test asserts: after the click, the cell that
_was_ `data-in-month="false"` is now `data-in-month="true"` (because
`viewMonth` is now the cell's month) — and the sidebar header reflects the
new month.

### Picking a deterministic out-of-month cell

The grid always renders 5 or 6 rows of 7 cells (`MiniCalendarSidebar.tsx:103-107`).
Some leading and/or trailing cells are padding from adjacent months. We
deterministically locate the _first_ `[data-in-month='false']` cell — this is
always in the leading week (a trailing-week padding cell wouldn't be "first"
in document order) when the month does not start on the configured week-start
day. The `default` mock event set + the default `weekStartDay=0` (Sunday) at
the wall-clock current date will not always have leading padding (e.g. if
the 1st is a Sunday). To stay deterministic we use the existing
`mini-calendar-next-month` chevron to advance the sidebar to a month with
non-zero leading padding before clicking — i.e. we _first_ navigate to a known
configuration, then click. The chosen approach in the spec: navigate forward
exactly 1 month and check that the grid contains at least one
`data-in-month="false"` cell; if not, navigate one more month. Two months is
sufficient — at least one of any three consecutive months has non-Sunday
first-of-month with weekStartDay=0.

## Phases

Single phase — all three test additions land together in one commit.

## Acceptance checklist

- [ ] "clicking a different day updates the events list and main calendar state"
      additionally asserts `day-calendar-heading` matches the clicked cell's
      aria-label.
- [ ] New test "click in-month day in a navigated-forward month updates the main
      view": advances `viewMonth` via chevron and asserts the heading and the
      selected cell.
- [ ] New test "clicking an out-of-month padding cell pulls the main view and
      the sidebar onto the new month": asserts both `day-calendar-heading` and
      `mini-calendar-header` follow the new month (and the clicked cell flips
      to `data-in-month="true"` post-click).
- [ ] `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` clean.
- [ ] Playwright spec runs to green locally (or, if E2E browser binaries can't
      be installed in this environment, the test is statically verified by
      mechanical derivation from the component source and the limitation is
      called out in the PR body).
- [ ] No `test-results/`, `playwright-report/`, or `blob-report/` committed.
