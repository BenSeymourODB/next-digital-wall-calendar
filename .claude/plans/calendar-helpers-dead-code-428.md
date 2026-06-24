# Plan: drop dead exports from `src/lib/calendar-helpers.ts` (#428)

GitHub Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/428
Branch: `claude/elegant-newton-aw0vr2`

## Context

#428 lists four helpers in `src/lib/calendar-helpers.ts` as having no
production callers: `rangeText`, `getEventsCount`, `getCalendarCells`,
`getEventsByMode`. The issue explicitly says to re-check after PR #407
(adopts `rangeText`) merges. #407 landed today as `e7ebbf7`, so the
table is partly stale: `rangeText` now has three production callers
(`WeekCalendar.tsx`, `YearCalendar.tsx`, `SimpleCalendar.tsx`).

The remaining three are still dead on `origin/main` per
`git grep` over `src/**/*.{ts,tsx}` minus tests and the helper file
itself: zero production callers.

Issue also calls for an **audit pass** over the rest of
`calendar-helpers.ts`. A full grep produced a longer list of zero-caller
exports than the issue names; the scope split is below.

## Scope (this PR)

Delete and remove tests for:

1. `getEventsCount` (line 182) — zero callers, zero internal users.
2. `getCalendarCells` (line 228) — zero callers, zero internal users.
3. `getEventsByMode` (line 513) — zero callers; switch over `getEventsForX`.
4. **Transitive:** `getEventsForMonth` (line 451) — only consumer is
   `getEventsByMode` (line 526). Once `getEventsByMode` goes, this is
   dead too; its `describe` block at line 603 is the only test caller.

Each removal pairs with the corresponding `describe` block in
`src/lib/__tests__/calendar-helpers.test.ts`:

- `describe("getEventsCount", ...)` line 143
- `describe("getCalendarCells", ...)` line 237
- `describe("getEventsByMode (clock)", ...)` line 954
- `describe("getEventsForMonth", ...)` line 603

Import lists at the top of the test file need to drop the four names.

## Out of scope (follow-up issue)

A broader audit surfaced six more zero-caller exports the issue does
not name. They are deliberately left for a follow-up so this PR stays
focused on the criteria in #428 and the transitive consequence:

- `calculateMonthEventPositions`
- `getBgColor`
- `getFirstLetters`
- `getMonthCellEvents`
- `navigateDate`
- `toCapitalize`

A new GitHub issue will track these and be linked from the PR.

## Verification

- `pnpm test:run src/lib/__tests__/calendar-helpers.test.ts` — focused.
- `pnpm test:run` — full suite (regressions / unrelated breakage).
- `pnpm lint:fix && pnpm format:fix && pnpm check-types`.

Type-check matters most: TypeScript will flag any importer of a removed
symbol the grep missed (e.g. a barrel re-export).

## Commits

One commit on `claude/elegant-newton-aw0vr2`, then push and open a
draft PR. Single phase — the changes are mechanical and small.
