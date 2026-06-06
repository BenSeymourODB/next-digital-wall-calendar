# Mini-Calendar Sidebar — Implementation Plan

> Addresses GitHub Issue #80. Delivered in PR #140. Unblocks #114 (wiring
> mini-calendar to CalendarProvider for event indicators and navigation).

## Goal

Add a compact month-grid sidebar to the calendar page for quick date navigation
and day-level event preview, matching the Jeraidi/charlietlamb reference
implementations. The sidebar reads from `CalendarProvider` (already exposes
`selectedDate`, `setSelectedDate`, `events`, `use24HourFormat`) so no provider
changes are required in this ticket — that remains the follow-up scope of #114.

## Scope

**In scope**

- New `MiniCalendarSidebar` component at `src/components/calendar/MiniCalendarSidebar.tsx`
- Hand-rolled 7-column month grid with single-letter day-of-week labels
  (`S M T W T F S`). We explicitly chose not to build on the shadcn
  `Calendar`/react-day-picker primitive so we can keep the sidebar's visual
  density and dot indicators under direct control without fighting the
  day-picker's `modifiers` conventions.
- `data-today`, `data-selected`, and `data-in-month` attributes on each cell
  for deterministic Playwright and Vitest selectors
- Today highlight (filled blue circle) and selected-day highlight (blue ring);
  both can coexist when they point at different dates
- Event-indicator dot under the day number, colored by the **first event** on
  that day (derived from `getEventsForDay` in `@/lib/calendar-helpers`, which
  handles multi-day spans — dots therefore appear on every day covered by a
  multi-day event)
- Events-list panel beneath the grid, scoped to the selected day, with a
  colored leading dot, the event time (or "All day"), and the title.
  Chronologically sorted ascending. Time format follows `use24HourFormat`
  (`HH:mm` vs `h:mm a`).
- Internal prev/next month navigation that is **independent of the main
  calendar view**: chevrons mutate a local `viewMonth` and do NOT call
  `setSelectedDate`. Clicking a day cell commits the navigation by calling
  `setSelectedDate(day)`. Clicking an out-of-month padding cell also advances
  `viewMonth` so the new selection stays on-screen.
- Integration into `src/app/calendar/page.tsx` as an `lg:` right sidebar
  (`lg:grid-cols-[1fr_280px]`); stacks below the main calendar on smaller
  viewports.
- Integration into `src/app/test/calendar/page.tsx` behind the `sidebar=true`
  search param so Playwright can exercise it against mock fixtures.
- Unit tests (Vitest + RTL) and E2E tests (Playwright, video capture on).

**Out of scope (deferred)**

- Wiring the sidebar's date-navigation into a day/week view (depends on #70 / #114)
- Per-event-color dot _clusters_ (one dot per event-color up to N) — we ship a
  single dot colored by the first event, which is enough to signal "something
  is happening that day"; cluster visuals can come in #114 if desired
- Full provider extensions for per-day event-indicator aggregation (tracked in #114)

## Design notes

### Rendering the dot indicators

We compute `getEventsForDay(events, day)` for each cell and render a single
small absolutely-positioned dot under the day number when the list is
non-empty. The dot color uses a lookup table
(`COLOR_DOT_CLASS: Record<TEventColor, string>`) mapping `blue|green|red|yellow|purple|orange`
→ `bg-<color>-500`. Standard Tailwind palette only, per CLAUDE.md styling rules.

### Internal vs global selected date

Local `viewMonth` state is seeded from `startOfMonth(selectedDate)`. Chevron
navigation mutates `viewMonth` only. Clicking a day cell calls
`setSelectedDate(day)`; if that day is outside the currently viewed month
(a padding cell), we _also_ update `viewMonth` so the highlighted selection
stays visible.

We intentionally do **not** auto-sync `viewMonth` to follow external
`selectedDate` changes — the sidebar is a scouting tool and shouldn't chase
the main calendar around. If we later want that behavior we can add a
`useEffect` that watches `selectedDate` and calls `setViewMonth`.

### Events list

Beneath the grid we render a heading formatted `EEE, MMM d` (e.g. `Mon, May 15`)
followed by a `<ul data-testid="mini-calendar-events-list">`. Each event row
carries its own `data-testid="mini-calendar-event-<id>"`. Empty days render a
single italicized "No events" item.

### Test IDs

Deterministic per-day test IDs of the form `mini-calendar-day-<yyyy-MM-dd>`
let Playwright select specific cells across locales and time zones. The same
IDs are used by Vitest tests so the two layers don't drift.

## Phases

1. **Phase 1 — Component + unit tests.** TDD-first: Vitest specs for
   rendering, selected/today states, event dots (including multi-day spans),
   event list (sort, filter, 12h/24h, all-day, empty), and click-to-select
   (including out-of-month cells). Implement `MiniCalendarSidebar`.
2. **Phase 2 — Page integration + Playwright E2E.** Wire the sidebar into
   `/calendar` and `/test/calendar?sidebar=true`. Playwright specs cover
   visibility, today highlight, navigation independence, click-to-select, and
   empty-state, all with video capture on.
3. **Phase 3 — Review + polish.** Address review feedback; retrigger CI on
   transient Prisma flakes.

## Acceptance checklist

- [x] Mini-calendar renders a month grid with single-letter weekday headers
- [x] Today is visually distinguished (filled blue circle)
- [x] The selected day is visually distinguished (blue ring)
- [x] Days with one or more events show a dot indicator, colored by first event
- [x] Multi-day events produce dots on every day they span
- [x] Prev/next month buttons change the mini-calendar display month without
      mutating `CalendarProvider.selectedDate`
- [x] Clicking a day sets `CalendarProvider.selectedDate`; clicking a padding
      cell also advances the view month
- [x] Events-for-selected-day list appears below the grid, chronologically sorted
- [x] Time labels in the list respect `use24HourFormat` (24h and 12h both tested)
- [x] All-day events render as "All day"
- [x] Integrated into `/calendar` page as an `lg:` sidebar, stacks on mobile
- [x] Integrated into `/test/calendar?sidebar=true` for E2E
- [x] Vitest tests cover the acceptance items above (17 specs)
- [x] Playwright spec covers the golden path on desktop viewport (5 specs, video on)
- [x] `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` pass
- [x] No `test-results/`, `playwright-report/`, or `blob-report/` committed
