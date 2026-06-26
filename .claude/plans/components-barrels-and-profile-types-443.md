# Components barrel exports + profile type extraction (#443)

## Issue summary

`src/components/` has 10 feature directories. 4 ship an `index.ts` barrel
(`profiles`, `recipe`, `settings`, `tasks`); 6 do not (`calendar`,
`navigation`, `providers`, `rewards`, `scheduler`, `theme`). Inside
`calendar/`, `analog-clock/` has its own barrel — a one-off "island" inside
an otherwise non-barreled directory.

Separately, `profiles/` scatters its public types inline across
`profile-context.tsx` (`Profile`, `ProfileAvatar`, `ViewMode`) and
`profile-form.tsx` (`ProfileType`, `AgeGroup`). The barrel re-exports
them through `profile-context`, but the underlying convention in `tasks`,
`recipe`, `scheduler` is a dedicated `types.ts`.

## Goals

1. Add `index.ts` barrels to the 6 missing directories.
2. Extract `src/components/profiles/types.ts` with the public profile
   types and update the in-directory consumers to import from there.
3. No behavior change. Pre-existing consumers that deep-import a file
   (`@/components/calendar/DayCalendar`) keep working — barrels are
   purely additive. The type-checker is the verification gate.

## Non-goals (deferred)

- Migrating existing consumer imports from deep paths to the barrel.
  That's a much larger diff, low value at this stage, and risks merge
  conflicts with the many in-flight calendar PRs. Tracked separately if
  ever wanted.
- Adding barrels for `__tests__/`, `ui/`, or other nested directories.
- Refactoring `settings/index.ts`, which is incomplete (missing some
  section exports) but out of scope here.
- Promoting component-specific prop types (e.g. `PinSetupModalProps`)
  into `types.ts` — convention in `recipe`/`tasks` is to keep prop types
  co-located with their component and re-export through the barrel, so
  `profiles` already matches.

## Public surface per directory

Following the existing `tasks` / `recipe` patterns: a barrel exports
components, the hooks they pair with, and the types/constants consumers
need. Internal helpers (`agenda-helpers.ts`, color buckets, etc.) stay
deep-importable but are NOT in the barrel.

### `calendar/`

Components: `AccountManager`, `AddEventButton`, `AgendaCalendar`,
`AgendaList`, `AnalogClockView`, `CalendarFilterPanel`,
`CalendarSettingsPanel`, `DayCalendar`, `DayOverflowPopover`,
`EventCreateDialog`, `EventDetailModal`, `MiniCalendarSidebar`,
`SimpleCalendar`, `ViewSwitcher`, `WeekCalendar`, `YearCalendar`,
`AnimatedSwap`. Re-export the `analog-clock` sub-barrel.

Types: `AgendaListProps`, `EventEditPatch`, `EventCreateInput`,
`AnimatedSwapType`, `AnimatedSwapDirection`.

### `navigation/`

Components: `AppShell`, `SideNavigation`.

### `providers/`

Components: `AppInsightsProvider`, `CalendarProvider`, `ErrorBoundary`,
`MockCalendarProvider`, `SessionProvider`, `TasksProvider`,
`ThemeProvider`.

Hooks: whatever each provider exposes (`useCalendar`, etc.).

### `rewards/`

Components: `MountedPointsProvider`, `PointsAnimation`, `PointsBadge`.
Hook + context: `PointsProvider`, `usePoints` from `points-context`.

### `scheduler/`

Components: `NavigationControls`, `SchedulerStatusIndicator`,
`ScreenScheduler`, `ScreenTransition`.

Hooks: `useInteractionDetector`, `useScreenScheduler`.

Types: existing `types.ts` symbols.

### `theme/`

Components: `ThemeScope`, `ThemeToggle`.

## `profiles/types.ts`

Move from `profile-context.tsx`:

- `interface ProfileAvatar`
- `interface Profile`
- `type ViewMode`

Move from `profile-form.tsx` (currently NOT exported — promote them):

- `type ProfileType`
- `type AgeGroup`

Re-import them in `profile-context.tsx` and `profile-form.tsx`. Update
`profiles/index.ts` to re-export from `./types` (already re-exports the
profile-context names; switch the source).

## Verification

The existing unit / component test suite already covers the public
surface. Mechanical refactor:

1. Add each barrel + the new types file.
2. `pnpm check-types` after each file group — catches any signature drift.
3. `pnpm lint:fix && pnpm format:fix` for style.
4. `pnpm test` for behavior.

No new tests are required — the change is import-graph-only and the
type-checker proves equivalence.

## Phases

1. **Profiles types extraction.** Create `profiles/types.ts`, update
   `profile-context.tsx` + `profile-form.tsx`, update `profiles/index.ts`
   to source types from `./types`. Run `pnpm check-types && pnpm test`.
2. **Add six barrels.** One commit per directory or one commit total —
   the diff is mechanical. Run checks after each.
3. **Final sweep.** `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.
   Push, open draft PR, mark ready-for-review.
