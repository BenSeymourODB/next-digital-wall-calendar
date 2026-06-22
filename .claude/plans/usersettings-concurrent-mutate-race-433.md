# useUserSettings — two-concurrent-mutate coverage for same-key rollback race (#433)

## Issue

[#433](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/433) — follow-up to the #420 fix landed by PR #432. PR #432 introduced the CAS guard inside `useUserSettings.mutate`'s catch block: when a PUT rejects, only roll back keys whose live value still matches the one _this_ mutate set, so a concurrent successful mutate is not stomped by the rejection of an earlier in-flight one.

PR #432 also added a test in `src/hooks/__tests__/useUserSettings.test.tsx` under `useUserSettings > same-key rollback race (#420)`. That test stands in for a parallel successful mutate by **emitting a same-key bus event** between A's optimistic write and A's PUT rejection — a legitimate test of the rollback guard, but it bypasses the exact sequencing of two real concurrent `mutate` calls.

## Goal

Add a second test case in the same describe block that exercises the **actual production race**:

1. Initial state: `timeFormat = "12h"` (from GET).
2. A: `mutate({ timeFormat: "24h" })` — `fetch` returns a deferred promise the test controls.
3. B: `mutate({ timeFormat: "12h" })` — `fetch` returns an immediately-ok response. B's optimistic `setSettings` and bus emit run; React commits; `settingsRef.current.timeFormat` becomes `"12h"`.
4. Reject A's PUT.
5. Assert: no `{ timeFormat: ... }` bus event fires for A (the CAS guard suppresses the stale emit), and local state stays at `"12h"`.

## Implementation notes

- Keep the new test inside the existing `describe("same-key rollback race (#420)", ...)` block as a sibling `it(...)` — it's coverage for the same regression, just via a different driver.
- Mock the fetch queue in order: GET (12h) → A's PUT (deferred) → B's PUT (immediate ok).
- Use the `act` concurrency pattern flagged in the issue body:
  1. `act` #1: kick off A without awaiting (`aMutate = mutate(...).catch(() => {})`), then `await Promise.resolve()` to flush A's synchronous prelude (setSettings + emit).
  2. `act` #2: `await mutate(...)` for B (resolves immediately).
  3. Subscribe a `busHandler` _after_ B's emit so we only observe whether A's rollback path re-emits.
  4. `act` #3: `rejectA(new Error(...))` then `await aMutate` to drain the rejection.
- Assertions: `expect(busHandler).not.toHaveBeenCalled()` and `expect(result.current.settings.timeFormat).toBe("12h")`.
- Run the full suite afterwards (`pnpm test`) to verify no unresolved-promise leak into adjacent specs (the "bus subscription" tests immediately after are sensitive to leaked subscribers).

## Verification that the test catches the regression

If the CAS guard in `useUserSettings.ts` (the `Object.is(live[key], picked[key])` check) is removed and A's catch unconditionally re-emits its snapshot:

- `liveRollback = { timeFormat: "12h" }` (A's snapshot of the pre-A value).
- `emitUserSettingsChange({ timeFormat: "12h" })` fires.
- `busHandler` records the call → assertion fails.

Verified mentally against the file at `src/hooks/useUserSettings.ts:241-257`. Will not commit a temporary guard-removal patch; the inline reasoning is enough to confirm fault sensitivity.

## Scope

- One new `it(...)` block in `useUserSettings.test.tsx`.
- No production code change.
- No other test file change.

## Out of scope

- Any change to `useUserSettings.mutate` itself.
- The `SettingsForm — same-key rollback race (#420)` component-level test (already covers the full two-mutate flow at a higher altitude).
- Generalising the CAS guard to non-primitive `UserCalendarSettings` keys (none exist today; #433 explicitly scopes to the timeFormat case).
