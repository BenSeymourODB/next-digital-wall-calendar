# Wire `UserSettings.dateFormat` through to date displays — #339

## Context

`UserSettings.dateFormat` (`prisma/schema.prisma`, default `"MM/DD/YYYY"`) is
persisted server-side and validated in `/api/settings`, but no client code
reads it as a formatting directive. The corresponding `DisplayValues.dateFormat`
field exists in `SettingsForm`'s state but `DisplaySection` does not render a
control for it today.

PR #344 (`user-settings-bus` + `useUserSettings.mutate`, for #337) merged on
`main` (commit `b88d25e`), so the bus infrastructure that #337 introduced for
`timeFormat` is now the natural carrier for `dateFormat` too.

## Goals (this slice)

Ship the helper + hook + one production consumer + cross-surface sync test
page. Do **not** add the `dateFormat` control to `DisplaySection` — PR #381 is
rewriting that file to shadcn `RadioGroup` and a parallel edit would conflict.

## Out of scope

- `DisplaySection` UI control for `dateFormat` — deferred until #381 lands.
- Full audit "no hardcoded format strings anywhere across calendar / tasks /
  recipe surfaces". Those use long-form patterns (`"EEEE, MMMM d, yyyy"`,
  `"EEE, MMM d"`) that aren't natural consumers of the numeric `dateFormat`
  preference; surfacing it there needs a UX call and should be tracked
  separately.

## Design

### Type

```ts
// src/lib/format-date.ts
export type TDateFormat = "MM/DD/YYYY" | "DD/MM/YYYY" | "YYYY-MM-DD";

export const VALID_DATE_FORMATS: readonly TDateFormat[] = [
  "MM/DD/YYYY",
  "DD/MM/YYYY",
  "YYYY-MM-DD",
] as const;

export const DEFAULT_DATE_FORMAT: TDateFormat = "MM/DD/YYYY";
```

### Format mapper

Pure function — no React, no hooks — so unit tests don't need a renderer:

```ts
// src/lib/format-date.ts
import { format } from "date-fns";

const PATTERNS: Record<TDateFormat, string> = {
  "MM/DD/YYYY": "MM/dd/yyyy",
  "DD/MM/YYYY": "dd/MM/yyyy",
  "YYYY-MM-DD": "yyyy-MM-dd",
};

export function formatUserDate(
  value: Date | string,
  dateFormat: TDateFormat = DEFAULT_DATE_FORMAT
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const pattern = PATTERNS[dateFormat] ?? PATTERNS[DEFAULT_DATE_FORMAT];
  return format(date, pattern);
}

export function isDateFormat(value: unknown): value is TDateFormat {
  return typeof value === "string" && (VALID_DATE_FORMATS as readonly string[]).includes(value);
}
```

### Hook

Thin wrapper around `useUserSettings()` for the common case where a component
just wants a memo-stable formatter:

```ts
// src/lib/format-date.ts
import { useUserSettings } from "@/hooks/useUserSettings";

export function useDateFormat(): {
  dateFormat: TDateFormat;
  format: (value: Date | string) => string;
} {
  const { settings } = useUserSettings();
  return {
    dateFormat: settings.dateFormat,
    format: (value) => formatUserDate(value, settings.dateFormat),
  };
}
```

`React.useCallback` is intentionally not used — CLAUDE.md forbids manual
memoization; React Compiler memoizes at call sites that need it.

### `useUserSettings` integration

Add `dateFormat: TDateFormat` to `UserCalendarSettings`, default
`DEFAULT_DATE_FORMAT`, and extend `pickCalendarFields` to validate the field
the same way `timeFormat` is validated (string + allow-list).

### Production consumer

`src/components/settings/account-section.tsx` currently formats `createdAt`
via `toLocaleDateString("en-US", { year, month, day })`. Replace that with
`formatUserDate(createdAt, dateFormat)` read off `useUserSettings`. This is
the only `toLocaleDateString` call in user-facing production code today.

### Cross-surface sync test page

Mirror `src/app/test/time-format-sync/page.tsx`: render `SettingsForm` plus a
`DateFormatProbe` component that reads `useUserSettings().dateFormat` and
displays the formatted current date. A Playwright spec asserts that mutating
the form propagates to the probe via the in-tab bus.

Since `DisplaySection` does not currently expose a `dateFormat` control, the
test page will include a tiny inline `<select>` that calls
`mutate({ dateFormat: ... })` directly. That keeps the page self-contained and
proves the bus carries `dateFormat` end to end.

## Phases

1. **Helper + hook + unit tests** — `src/lib/format-date.ts`,
   `src/lib/__tests__/format-date.test.ts`.
2. **`useUserSettings` integration + tests** — extend
   `UserCalendarSettings` / `DEFAULT_USER_CALENDAR_SETTINGS` /
   `pickCalendarFields`; extend `src/hooks/__tests__/useUserSettings.test.tsx`.
3. **Production consumer** — `account-section.tsx`; update
   `src/components/settings/__tests__/account-section.test.tsx`.
4. **Cross-surface sync test page + E2E** —
   `src/app/test/date-format-sync/page.tsx` + `e2e/date-format-sync.spec.ts`.

Each phase ends with `pnpm lint:fix && pnpm format:fix && pnpm check-types &&
pnpm test`, then a commit + push.

## Acceptance criteria (from #339, mapped)

- [x] `formatUserDate()` helper exists and is used by at least one
      previously-hardcoded format path (the `AccountSection` "Member since"
      line).
- [x] Switching `dateFormat` via the bus updates the consumer immediately —
      proven by the new `/test/date-format-sync` page + Playwright spec.
- [x] Unit tests for each supported format.
- [ ] Remaining hardcoded format strings across calendar/task/recipe surfaces
      — explicitly deferred (see Out of scope).

## Notes

- The Prisma column and `/api/settings` validation already accept
  `dateFormat`, so no migration / route change is needed for this slice.
- `src/lib/user-settings-bus.ts:UserSettingsBusPayload` already includes
  `dateFormat?: string`, so the bus carries it; this change only teaches the
  client-side reducer (`pickCalendarFields`) to act on it.
