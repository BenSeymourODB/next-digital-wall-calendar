# Plan — guard user-settings-bus subscribers against same-key PUT-race rollback (#420)

## Problem

Two `updateSettings` calls in flight against the same key:

1. A: `theme: "dark"`, snapshots `previousPartial = { theme: "light" }`, optimistic state → `dark`.
2. B: `theme: "system"`, snapshots `previousPartial = { theme: "dark" }` (A's optimistic value), optimistic state → `system`.
3. B's PUT succeeds first → `emitUserSettingsChange({ theme: "system" })`. Subscribers and form both at `system`.
4. A's PUT fails → catch path runs `setSettings(curr => ({ ...curr, ...{ theme: "light" } }))` and `emitUserSettingsChange({ theme: "light" })`. Both the form and bus subscribers regress to `light`, even though B's later, successful PUT was the most-recent truth.

The same shape exists at the second emit site in `src/hooks/useUserSettings.ts` (`mutate` catch block, lines 207–216) — `settingsRef` is already wired but the rollback writes `snapshot` unconditionally.

## Approach — compare-and-swap rollback

For each key in the saved `previousPartial`, before reverting:

- Read the current state from a `settingsRef` (mirror of `settings`, updated in `useEffect`).
- If `settingsRef.current[key] === thisCallOptimisticValue[key]`, this call's optimistic write is still in place → safe to revert.
- If they differ, a later call has touched the key → leave it alone.

Emit only the keys actually reverted. Rolls back both local state and bus emit in lockstep, fixes both same-key and different-key cases (latter already covered by #363; this is a strict generalization).

Pseudo-code (SettingsForm):

```ts
const settingsRef = useRef(settings);
useEffect(() => {
  settingsRef.current = settings;
}, [settings]);

const updateSettings = async (partial: Partial<UserSettingsData>) => {
  const optimistic = partial; // values this call wrote
  let previousPartial: Partial<UserSettingsData> | undefined;
  setSettings((curr) => {
    previousPartial = Object.fromEntries(
      (Object.keys(partial) as Array<keyof UserSettingsData>).map((k) => [k, curr[k]])
    ) as Partial<UserSettingsData>;
    return { ...curr, ...partial };
  });

  try {
    /* PUT, throw on !ok, emit(partial) */
  } catch {
    toast.error("Failed to save settings");
    if (!previousPartial) return;

    // Build the actual-revert subset from settingsRef (post-render).
    const liveRevert: Partial<UserSettingsData> = {};
    const curr = settingsRef.current;
    for (const key of Object.keys(previousPartial) as Array<keyof UserSettingsData>) {
      if (Object.is(curr[key], optimistic[key])) {
        (liveRevert as Record<string, unknown>)[key] = previousPartial[key];
      }
    }

    if (Object.keys(liveRevert).length === 0) return;
    setSettings((prev) => ({ ...prev, ...liveRevert }));
    emitUserSettingsChange(liveRevert);
  }
};
```

`useUserSettings.mutate` gets the analogous change — it already has `settingsRef`, just needs the per-key compare-and-swap before the rollback + emit.

## Test plan (TDD)

In `src/components/settings/__tests__/settings-form.test.tsx`:

1. Same-key race (the headline acceptance case):
   - Click `Dark` (A), then `System` (B) before either resolves.
   - Resolve B as ok, reject A.
   - Assert: bus handler observed `{ theme: "dark" }` (B's optimistic emit on success) but NOT `{ theme: "light" }` (A's stale rollback). Local form still shows System checked, not Light.
2. Different-key behaviour preserved (#363 + #414 — exists for happy path; add explicit bus-side mirror): rapid theme=dark + timeFormat=24h, A theme fails, B succeeds → bus saw `{ theme: "dark" }` rolled back, `{ timeFormat: "24h" }` preserved.

In `src/hooks/__tests__/useUserSettings.test.tsx`:

3. Same-key race at the hook level: two `mutate` calls in flight on the same key, second succeeds, first fails → snapshot's revert is suppressed, no `{ theme: "light" }` emit.

Regression: existing `SettingsForm — bus rollback on PUT failure (#414)` cases must continue to pass (single-call failure still emits the rolled-back partial).

## Files touched

- `src/components/settings/settings-form.tsx` — add `settingsRef`, rewrite catch block.
- `src/hooks/useUserSettings.ts` — rewrite catch block to compare-and-swap against `settingsRef`.
- `src/components/settings/__tests__/settings-form.test.tsx` — new test cases.
- `src/hooks/__tests__/useUserSettings.test.tsx` — new test case.

## Out of scope

- Cross-tab race (storage event) — different bus, not in the user-settings-bus contract.
- Sequence-numbering scheme (Option 1 from the issue) — heavier than required for the observed race.
- `updateTaskSettings` race (different store, tracked separately by #413 / #416).

## Acceptance criteria (from issue)

- [x] Test: rapid B-succeeds → A-fails sequence leaves the bus subscriber holding B's value, not A's pre-call value.
- [x] Same key updated twice with the second succeeding does not regress on the first's failure.
- [x] No regression of the #363 `setSettings` rollback semantics.
- [x] `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` clean.
