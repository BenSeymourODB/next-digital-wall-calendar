# Hook file naming standardization → kebab-case (#444)

## Goal

`src/hooks/` mixes two file-naming conventions: camelCase (`useDateFormat.ts`, etc.) and kebab-case (`use-mobile.ts`, etc.). Standardize on **kebab-case** for all hook filenames, matching:

- The existing kebab-case files in `src/hooks/` (`use-mobile`, `use-reduced-motion`, `use-slide-direction`).
- The prevailing kebab-case convention across `src/components/ui/` (shadcn) and most of the rest of the codebase.
- The explicit suggestion in issue #444.

The exported hook function names (`useDateFormat`, `useUserSettings`, …) do not change — this is a file-name and import-path change only.

## Files to rename

`src/hooks/`:

- `useDateFormat.ts` → `use-date-format.ts`
- `useEventCacheVisibilitySweep.ts` → `use-event-cache-visibility-sweep.ts`
- `useEventCreate.ts` → `use-event-create.ts`
- `useEventDelete.ts` → `use-event-delete.ts`
- `useEventEdit.ts` → `use-event-edit.ts`
- `useLocalStorage.ts` → `use-local-storage.ts`
- `useUserSettings.ts` → `use-user-settings.ts`
- `useWritableCalendars.ts` → `use-writable-calendars.ts`

`src/hooks/__tests__/`:

- `useDateFormat.test.tsx` → `use-date-format.test.tsx`
- `useEventCacheVisibilitySweep.test.tsx` → `use-event-cache-visibility-sweep.test.tsx`
- `useEventCreate.test.tsx` → `use-event-create.test.tsx`
- `useEventDelete.test.tsx` → `use-event-delete.test.tsx`
- `useUserSettings.test.tsx` → `use-user-settings.test.tsx`
- `useWritableCalendars.test.tsx` → `use-writable-calendars.test.tsx`

(`useEventEdit.ts` has no separate test file at present — covered by `EventCreateDialog`/`AddEventButton` integration tests.)

## Imports to update

Repo-wide grep across `**/*.{ts,tsx}` finds ~40+ files that import these modules via `@/hooks/<name>` or relative paths. Each import is mechanically rewritten.

Key surfaces include:

- `src/app/api/settings/route.ts`, `src/app/api/calendar/calendars/route.ts`
- `src/components/providers/CalendarProvider.tsx`, `TasksProvider.tsx`
- `src/components/calendar/*` (`SimpleCalendar`, `AgendaCalendar`, `AnalogClockView`, `EventCreateDialog`, `AddEventButton`)
- `src/components/settings/settings-form.tsx`, `display-section.tsx`
- `src/app/settings/page.tsx`, `src/app/recipe/page.tsx`, `src/app/test/**/page.tsx`
- `src/hooks/__tests__/*` (cross-hook imports)
- E2E specs that import nothing from `src/hooks` directly — confirmed `e2e/*.spec.ts` references are to test pages, not hook modules.

## Validation

No behavior change → no new tests. The existing suite is the regression guard:

```
pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test
```

All four must be clean. Additionally:

- `git mv` (not delete-then-create) so history is preserved.
- After rename, confirm no `@/hooks/use[A-Z]` import remains:
  ```
  grep -RnE "from ['\"]@/hooks/use[A-Z]" src e2e
  ```
- Confirm no orphaned references to the old paths via a final repo grep on each old basename.

## Out of scope

- Renaming the exported hook function symbols (e.g. `useUserSettings` → `useUserSettings`). The function names are React-canonical (`use*` camelCase) — only file names change.
- Renaming non-hook camelCase files elsewhere in the repo. Issue #444 explicitly scopes to `src/hooks/`.
- Adding a CI lint to enforce the kebab-case convention going forward. Worth a follow-up issue if drift recurs.
