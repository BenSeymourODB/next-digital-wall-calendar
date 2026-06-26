# SettingsForm bus subscription (#424)

## Problem

`src/components/settings/settings-form.tsx` keeps its own `useState<UserSettingsData>(initialSettings)` and emits to the `user-settings-bus` on PUT success (see `emitUserSettingsChange(partial)` at L149) — but it never **subscribes** to that bus.

Today the form is the only writer for the production settings fields, so the two copies (form state vs. `useUserSettings.settings`) stay roughly in sync. As soon as a second writer exists in the same tab — a calendar settings popover, a future `/tasks` settings panel, a `/test/*-sync` fixture, or simply two open browser tabs that share a bus emit pathway — the form's local copy will drift:

1. User opens the Settings page (form copy = `dateFormat: "MM/DD/YYYY"`).
2. Another surface in the same tab calls `useUserSettings.mutate({ dateFormat: "DD/MM/YYYY" })`. The bus emit reaches `useUserSettings` subscribers; the Settings form does not subscribe so it still renders `MM/DD/YYYY`.
3. The user picks a different setting (say, theme) and triggers `updateSettings({ theme: "dark" })`. The form's PUT body only contains `{ theme: "dark" }` — but the form's local state still holds the stale `dateFormat`.
4. If the user later changes a second field in the form, that PUT will not include the stale `dateFormat` either (we only PUT the `partial`), so the DB stays correct — **but the form's optimistic state is wrong**, and any future read of `settings.dateFormat` inside the form (e.g. `AccountSection`'s `dateFormat` prop on L261) renders stale data.

The most visible symptom in production code today is the `AccountSection` `dateFormat` prop: a calendar-side `dateFormat` change would not be reflected on the Settings page until reload.

## Decision: option A (subscribe + merge)

Issue #424 lists two options:

- **A.** `SettingsForm` subscribes to the bus and merges incoming partials into local state.
- **B.** Drop local state; read exclusively from `useUserSettings()`.

The issue's recommendation is B, but B forces a wider refactor: several form fields are **not** on `UserCalendarSettings` in `useUserSettings.ts` —

- `theme`
- `rewardSystemEnabled`, `defaultTaskPoints`, `showPointsOnCompletion`
- `schedulerIntervalSeconds`, `schedulerPauseOnInteractionSeconds`

Consolidating would require either extending `useUserSettings` to read every column or splitting the form across two readers (one for hook-managed fields, one for the rest). That's a larger change than #424 is asking for; the broader consolidation belongs to #328 (`tracking(settings): promote non-Calendar-exclusive settings to app-wide and consolidate`).

Option A is a minimal, well-scoped fix: a single `useEffect` + `subscribeUserSettings` callback + a key-narrowing partial-merge, paired with an integration test for the lost-write reproduction.

## Shape

```tsx
// SettingsForm.tsx (additions)
import { type UserSettingsPartial, subscribeUserSettings } from "@/lib/user-settings-bus";

// inside the component, after the existing settingsRef effect:
useEffect(() => {
  return subscribeUserSettings((partial) => {
    const picked = pickSettingsBusFields(partial);
    if (Object.keys(picked).length === 0) return;
    setSettings((prev) => ({ ...prev, ...picked }));
  });
}, []);
```

The form does **not** need to filter as defensively as `useUserSettings.pickCalendarFields` — the bus payload is already typed `Partial<UserSettingsData>`, which matches the form's local shape exactly. A minimal `pickSettingsBusFields` that drops `undefined` values and accepts every key on `UserSettingsData` is sufficient.

### Self-emit avoidance

`updateSettings` already calls `emitUserSettingsChange(partial)` on PUT success. After subscribing, the form will receive its own emits. That's harmless — the bus partial is identical to what was just optimistically applied, so the merge is a no-op (`setSettings({ ...prev, ...partial })` with `partial` already in `prev`). No guard needed.

The rollback path's `emitUserSettingsChange(liveRevert)` likewise round-trips through the subscriber, but since the `liveRevert` was just written to local state via `setSettings`, the merge is again a no-op.

### React 19 / StrictMode behaviour

Subscribing in a single `useEffect` with no dependencies + returning the unsubscribe is the standard pattern (mirrors `useUserSettings.ts:177-185`). StrictMode's double-mount will subscribe twice and unsubscribe once on the first run; the second mount's subscribe is the surviving handler. No leaks.

## Tests (TDD-first)

New describe block in `src/components/settings/__tests__/settings-form.test.tsx`:

```
describe("SettingsForm — bus subscription (#424)", () => {
  it("merges incoming bus partials into the form's local state");
  it("does not include a stale field in a subsequent PUT after a bus update overwrites it");
  it("ignores bus emits with no own-keys");
});
```

The second test is the lost-write reproduction:

1. Render form with `dateFormat: "MM/DD/YYYY"`.
2. Fire `emitUserSettingsChange({ dateFormat: "DD/MM/YYYY" })` from outside the form.
3. Trigger a theme change in the form (PUT body = `{ theme: "dark" }`).
4. Assert: the PUT body for theme contains **only** `theme`, not `dateFormat` — but the form's `dateFormat` display value is now `DD/MM/YYYY`. (The DB doesn't get clobbered because the form PUTs partials, not the whole settings object.)

Stronger sanity: a follow-up PUT that includes `dateFormat` (e.g. from `DisplaySection`'s `dateFormat` radio — once the section is wired) would send the **bus-updated** value, not the stale initial value.

For the visual-sync assertion, we can use `AccountSection`'s `dateFormat` prop indirectly via the rendered date format label, or directly inspect the `settings` state via a re-render-induced display. The cleanest path: render the form and assert against the on-page date format display in `AccountSection` (the existing `account-section.test.tsx` already exercises that surface).

## Acceptance criteria checklist (from #424)

- [x] No path where a same-tab bus emit can leave `SettingsForm.settings` stale relative to `useUserSettings.settings`.
- [x] Existing settings-form tests still pass (no test weakening).
- [x] Lost-write reproduction is covered by an integration test.
- [x] `pnpm lint:fix && pnpm format:fix && pnpm check-types` clean.

## Out of scope

- Option B (drop local state) — deferred to #328 when the app-wide settings consolidation lands. See PR body for the explicit deferral note.
- `taskSettings` (profile-scoped) — they don't flow through `user-settings-bus`, no drift hazard.
- `transitionConfig` — `localStorage`-backed via `schedule-storage`, not bus-managed.

## File list

- `src/components/settings/settings-form.tsx` — add `subscribeUserSettings` effect + `pickSettingsBusFields` helper.
- `src/components/settings/__tests__/settings-form.test.tsx` — new `#424` describe with 3 cases.
