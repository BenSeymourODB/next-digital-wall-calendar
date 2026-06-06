# Calendar filter panel (#85)

> Slice delivered by the scheduled session that claimed #85 on 2026-04-21.

## Goal

Expose the already-wired filter state on `CalendarProvider` — `selectedColors`,
`selectedUserId`, and `users` — through a compact filter panel in the
production calendar toolbar, matching the Jeraidi reference spec from #85.

`CalendarProvider` and `MockCalendarProvider` already:

- Toggle colors via `filterEventsBySelectedColors(color)` and track them in
  `selectedColors: TEventColor[]`.
- Track `selectedUserId` (either a `user.id` or `"all"`), mutated via
  `filterEventsBySelectedUser(userId)` / `setSelectedUserId(userId)`.
- Derive `users` from the currently loaded events.
- Filter `events` in a `useEffect` / `useMemo` using both filters.
- Expose `clearFilter()` to reset both filters.

No provider changes are required. This PR is UI-only.

## Non-goals

- Persisting filters across reloads (state stays in memory for this slice).
- Calendar-set filter (future — currently `calendarIds` are fetched but not
  exposed to filter).
- "Currently visible events" badge counts (can be added once the wire-up
  issues #113–#118 unblock richer data).

## Components

### `CalendarFilterPanel`

- File: `src/components/calendar/CalendarFilterPanel.tsx`
- Two side-by-side trigger buttons:
  - **Color filter:** `Filter` icon button. Active colors render as small
    swatches in the trigger, plus a count badge once any color is selected.
    Popover shows all six `TEventColor` values with a `Checkbox` + swatch.
  - **User filter:** avatar-group button. When `selectedUserId === "all"` it
    shows up to three fallback avatars derived from `users`; when a specific
    user is active it shows just that user's avatar. Popover lists `"All"` +
    every user from `users`, each with avatar + name.
- Shows a "Clear filters" action when either filter is active. Uses the
  provider's `clearFilter()`.
- No direct dependency on the active `view`, so it renders across all views.
- Uses `data-testid` hooks for targeted Vitest + Playwright selectors.

### `src/app/calendar/page.tsx`

- Mount `<CalendarFilterPanel />` alongside `<ViewSwitcher />` so the toolbar
  row contains both controls side by side.

### `src/app/test/calendar/page.tsx`

- Add a `filters=true` URL param that renders the filter panel above the
  calendar in the mock provider so the Playwright spec can drive filtering
  deterministically.

## Tests (TDD)

### Unit — `src/components/calendar/__tests__/CalendarFilterPanel.test.tsx`

1. Renders both trigger buttons (`filter-panel-color-trigger`,
   `filter-panel-user-trigger`).
2. Opening the color popover shows all six color options, none checked by
   default. Clicking a color calls `filterEventsBySelectedColors(color)`.
3. Color trigger shows an active-count badge when `selectedColors` is
   non-empty; the count reflects the number of selected colors.
4. Opening the user popover lists `"All"` + a row per user from `users`.
5. Clicking a user row calls `setSelectedUserId(user.id)`; clicking `"All"`
   calls `setSelectedUserId("all")`.
6. `Clear filters` button is only rendered when filters are active and, when
   clicked, calls `clearFilter()`.
7. With `users` empty, the user popover shows an empty-state message and no
   individual user rows.

### E2E — `e2e/calendar-filter-panel.spec.ts`

Video-on, navigates to `/test/calendar?events=family&filters=true`:

1. Opens the color popover, toggles a color, asserts the event list hides the
   filtered colors (e.g., turning off `blue` removes the `"Work Meeting"`
   event from the agenda view).
2. Opens the user popover, picks a specific user, asserts only that user's
   events remain visible.
3. Clicks `Clear filters` and asserts all events return.

## Phases

1. **Component & tests** — Vitest-first implementation of
   `CalendarFilterPanel`. Wire into both `/calendar` and `/test/calendar`.
2. **E2E** — Playwright spec driven from `/test/calendar?events=family`.

Each phase ends with `pnpm lint:fix && pnpm format:fix && pnpm check-types &&
pnpm test`, a commit, and a push. A draft PR is opened after phase 1.
