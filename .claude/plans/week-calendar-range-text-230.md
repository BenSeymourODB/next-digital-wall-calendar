# Adopt `rangeText` in WeekCalendar (and sibling views) — #230

## Problem

`src/lib/calendar-helpers.ts` exports `rangeText(view, date, weekStartsOn?)` (PR #229 added the `weekStartsOn` parameter to support #205), but no production call site uses it. Three view components hand-roll the same `format(rangeStart, "MMM d, yyyy") – format(rangeEnd, "MMM d, yyyy")` string:

| File                                         | Line    | View  |
| -------------------------------------------- | ------- | ----- |
| `src/components/calendar/WeekCalendar.tsx`   | 149–150 | week  |
| `src/components/calendar/YearCalendar.tsx`   | 279–280 | year  |
| `src/components/calendar/SimpleCalendar.tsx` | 215–216 | month |

The inline headers use the em-dash glyph (`–`) with single spaces. `rangeText` returns the ASCII hyphen (`-`) form, so adopting it as-is would change the user-visible string.

## Decision: standardize on em-dash

Three production headers already use the em-dash; one helper that is currently unused returns the hyphen. The em-dash reads better at the wall-calendar size and matches the surrounding typography. The cheapest reconciliation is to update `rangeText` to the em-dash form and let all four call sites converge on it. Existing `rangeText` unit tests will be updated; the `WeekCalendar` header test already expects em-dash.

## Scope

1. Change `rangeText`'s separator from `" - "` to `" – "` in `src/lib/calendar-helpers.ts`.
2. Update the four affected assertions in `src/lib/__tests__/calendar-helpers.test.ts` (month / Sunday-first week / Monday-first week / year).
3. Replace the inline range header in `WeekCalendar.tsx` with `rangeText("week", selectedDate, weekStartDay)`.
4. Replace the inline year-range header in `YearCalendar.tsx` with `rangeText("year", selectedDate)`.
5. Replace the inline month-range subheader in `SimpleCalendar.tsx` with `rangeText("month", selectedDate)`.
6. Delete the now-dead `startOfWeek/endOfWeek` (or `startOfYear/endOfYear`, `startOfMonth/endOfMonth`) imports/locals in any view if `rangeText` is the only remaining consumer of them.

Out of scope: any per-cell or per-day `format` calls (`MMMM yyyy`, `EEE, MMM d`, etc.) — those serve different purposes (year header, aria-labels, cell tooltips) and aren't range-text duplicates.

## Acceptance criteria (from issue body)

- [x] `WeekCalendar` header text comes from `rangeText`.
- [x] Glyph reconciled across `rangeText` callers and tests (em-dash).
- [x] No regression in `e2e/week-day-views.spec.ts` and `e2e/calendar-settings-panel.spec.ts` (verified by running the full vitest suite locally; the e2e suite is not exercised in this session — see "Test plan" below).
- [x] `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types` clean.

Bonus (proactively addressed):

- [x] `YearCalendar` and `SimpleCalendar` headers also route through `rangeText` so the helper has real production callers and any future range-formatting changes need to be made in one place.

## Test plan

- Update existing `rangeText` unit tests to assert the em-dash form.
- Existing `WeekCalendar.test.tsx` header test already asserts the em-dash form — it must keep passing post-refactor (it's the regression guard that the user-visible string did not change).
- Run `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types`.
- E2E specs (`e2e/week-day-views.spec.ts`, `e2e/calendar-settings-panel.spec.ts`) are scoped against `data-testid` attributes and weekday labels, not the range glyph — they should pass unchanged. Not run interactively in this session.

## Dependencies

None. PR #229 (#205) introduced the `weekStartsOn` parameter on `rangeText`, which is already on `main`. Tracking: #224.
