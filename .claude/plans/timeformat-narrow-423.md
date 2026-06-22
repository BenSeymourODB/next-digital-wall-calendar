# Narrow `UserSettingsData.timeFormat` to `TTimeFormat` — #423

Pure refactor. No runtime behaviour change. Mirrors the (in-flight in #390)
`dateFormat: TDateFormat` narrowing for the sibling `timeFormat` field, and
matches the existing pattern already in place for `weekStartDay` /
`calendarTransitionSpeed`.

## Goal

`UserSettingsData.timeFormat` and `DisplayValues.timeFormat` carry the narrow
`TTimeFormat = "12h" | "24h"` union from `src/hooks/useUserSettings.ts`,
matching how `useUserSettings.UserCalendarSettings.timeFormat` already types
the field. The server-side `/api/settings/route.ts` validator already enforces
the allow-list on PUT, so this is type-safety only.

## Acceptance criteria (from issue body)

- [x] `UserSettingsData.timeFormat: TTimeFormat`
- [x] `DisplayValues.timeFormat: TTimeFormat`
- [x] No `as TTimeFormat` casts introduced (and remove the existing one at
      `useUserSettings.ts:249` since the new typeguard makes it unnecessary)
- [x] Full test suite passes
- [x] `pnpm lint:fix && pnpm format:fix && pnpm check-types` clean

## File-level changes

1. **`src/hooks/useUserSettings.ts`**
   - Export a typeguard `isTimeFormat(value: unknown): value is TTimeFormat`
     that wraps the existing `VALID_TIME_FORMATS` array. No duplicated
     allow-list.
   - Replace `picked.timeFormat = data.timeFormat as TTimeFormat` (line 249)
     with the typeguarded form (no cast).

2. **`src/components/settings/settings-form.tsx`**
   - `interface UserSettingsData.timeFormat: string` → `TTimeFormat`.
   - Import `TTimeFormat` from `@/hooks/useUserSettings`.

3. **`src/components/settings/display-section.tsx`**
   - `interface DisplayValues.timeFormat: string` → `TTimeFormat`.
   - Update the time-format `RadioGroup`'s `onValueChange` to narrow the raw
     string via `isTimeFormat` (the Radix callback signature is
     `(value: string) => void`, so we must validate before forwarding). A
     non-allow-listed value is silently ignored — the only producers are the
     `"12h"`/`"24h"` radio items so this branch is unreachable in practice
     but type-safe.

4. **`src/app/settings/page.tsx`**
   - Coerce `settings.timeFormat` (Prisma's `string`) at the server-rendered
     boundary using the typeguard, with a `"12h"` fallback that mirrors the
     Prisma `@default` and the `DEFAULT_USER_CALENDAR_SETTINGS` default.
     Parallel to the existing `calendarTransitionSpeed` shape on this page.

5. **`src/test/fixtures/user-settings.ts`**
   - Add `timeFormat` to the `Omit<UserSettings, …>` list and add
     `timeFormat: TTimeFormat` to the override block — same pattern as
     `weekStartDay` and `calendarTransitionSpeed` already in the fixture.
     The fixture's `timeFormat: "12h"` literal default stays.

6. **`src/app/test/time-format-sync/page.tsx` & `src/app/test/settings/page.tsx`**
   - Both pass `timeFormat: "12h"` as a literal — TS narrows literals to
     their union member automatically. No code change required, but they're
     covered by `check-types` so any regression will surface.

## Tests

- New unit test `src/hooks/__tests__/useUserSettings.test.tsx`:
  - `isTimeFormat` returns `true` for `"12h"` / `"24h"`, `false` for
    `"13h"`, `""`, `null`, `undefined`, `0`.
- Existing `display-section.test.tsx`, `settings-form.test.tsx`, and
  `useUserSettings.test.tsx` must pass unchanged — pure refactor.

## Independence

PR #390 narrows the sibling `dateFormat` field. The only files both PRs
touch are `interface UserSettingsData` (one-line edit) and the
`MockUserSettings` fixture (one-line edit). Whichever lands second has a
trivial conflict resolution.

## Out of scope

- The `/api/settings` server validator already enforces the allow-list;
  hardening that further is unrelated.
- `useUserSettings.UserCalendarSettings.timeFormat` is already `TTimeFormat`
  — no change there.
