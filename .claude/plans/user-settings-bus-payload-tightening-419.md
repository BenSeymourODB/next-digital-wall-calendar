# Tighten `UserSettingsBusPayload` to mirror `UserSettingsData` (#419)

## Problem

`UserSettingsBusPayload` in `src/lib/user-settings-bus.ts` is a hand-maintained subset of
`UserSettings`. It is missing three columns that the settings form can write:

- `weekStartDay`
- `calendarWorkingHoursStart`
- `calendarTransitionSpeed`

`SettingsForm.updateSettings` calls `emitUserSettingsChange(partial)` where
`partial: Partial<UserSettingsData>`. TypeScript does not excess-check on
non-literal arguments, so a `Partial<UserSettingsData>` is structurally
compatible with the narrower `UserSettingsBusPayload` and the call compiles.
The same hole exists at the two emit sites inside `useUserSettings.mutate`
(`src/hooks/useUserSettings.ts:193,214`). Extra keys flow through `CustomEvent.detail`
and are silently discarded by the consumer's `pickCalendarFields`.

## Decision: Option 1 from the issue

Tighten `UserSettingsBusPayload` so it models every settable column. Concretely,
extract the `UserSettingsData` shape out of `settings-form.tsx` into a shared
type module and redefine the bus payload as `Partial<UserSettingsData>`. This
keeps the change minimal — no runtime filtering or per-emit-site whitelists.

Subscribers (`useUserSettings` → `pickCalendarFields`) already validate every
key they care about, so they continue to work without modification.

Option 2 (runtime narrowing at every call site) was rejected as boilerplate.

## Files touched

1. **New: `src/types/user-settings.ts`** — exports the `UserSettingsData`
   interface previously local to `settings-form.tsx`. This is the single
   source of truth for the form's settings shape.
2. **`src/components/settings/settings-form.tsx`** — drop the local
   `UserSettingsData` declaration, import from the shared module. No
   behavioural change.
3. **`src/lib/user-settings-bus.ts`** — import `UserSettingsData` and
   redefine `UserSettingsBusPayload = Partial<UserSettingsData>`. Update
   the docstring to point at the shared type as the source of truth.
4. **`src/lib/__tests__/user-settings-bus.test.ts`** — add a runtime test
   verifying that emitting with the previously-missing keys
   (`weekStartDay`, `calendarWorkingHoursStart`, `calendarTransitionSpeed`)
   reaches subscribers intact. This catches a future regression where the
   bus payload drifts back to a narrower subset.

## Out of scope

- `useUserSettings.UserCalendarSettings` is the consumer-side projection,
  not the bus payload — it stays unchanged.
- `pickCalendarFields` keeps its current set; the bus carries a strict
  superset, the consumer picks what it cares about. Future widening of
  the consumer happens in separate issues (e.g. wiring `weekStartDay` /
  `calendarWorkingHoursStart` into `CalendarProvider` is already done
  through the GET path).
- `calendar-settings-panel.tsx` does **not** emit on the bus today, so it
  is not touched. (The issue body listed it conditionally with "if it
  also emits".)
- #418 (in-flight) adds a second emit site in the catch block of
  `updateSettings`. The current PR is independent of #418; if #418 lands
  first the rebase is trivial (both new emit calls accept the wider
  payload). If #419 lands first, #418's emit will pick up the wider
  type automatically.

## TDD steps

1. Add the test exercising `weekStartDay` / `calendarWorkingHoursStart` /
   `calendarTransitionSpeed` round-tripping through the bus — at this
   point the test passes runtime-wise (CustomEvent carries any payload),
   but the _type-level_ contract still claims those keys are not part of
   `UserSettingsBusPayload`. The acceptance is that the test compiles
   without `@ts-expect-error` once the type is widened.
2. Create `src/types/user-settings.ts` with the extracted interface.
3. Update `user-settings-bus.ts` to use `Partial<UserSettingsData>`.
4. Update `settings-form.tsx` to import from the shared module.
5. Run `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.

## Verification

- `pnpm check-types` clean — proves the type widening compiles end-to-end.
- New bus test green — proves the wider keys round-trip.
- Existing `user-settings-bus.test.ts` green — proves no regression of
  current behaviour.
- Existing `useUserSettings.test.tsx` and `settings-form.test.tsx`
  green — proves no consumer/emit-site regression.
