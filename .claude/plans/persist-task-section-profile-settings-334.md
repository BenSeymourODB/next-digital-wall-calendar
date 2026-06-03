# Persist TaskSection values to ProfileSettings (#334)

Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/334

## Goal

`SettingsForm` currently holds Tasks settings (`taskSortOrder`, `showCompletedTasks`) in a sibling `useState` that is never PUT anywhere. The fields already exist in the database on the `ProfileSettings` model. Wire them up so they:

- persist across reloads
- are per-profile (so different family members can have different defaults)
- can be read by the future `TasksSettingsPanel` (#333) from the same source

## Architecture decision: dedicated `/api/profiles/[id]/settings` endpoint

Issue offers two options — extending `/api/settings` PUT, or a dedicated profile-scoped endpoint. The issue notes the rest of `ProfileSettings` (`theme`, `language`, `enableNotifications`, `notificationTime`, `defaultTaskListId`) needs the same treatment, so a dedicated endpoint is cleaner.

Route: `src/app/api/profiles/[id]/settings/route.ts`

- `GET /api/profiles/[id]/settings` — returns the `ProfileSettings` row for that profile, upserting defaults if missing. Ownership check: profile.userId must equal session.user.id.
- `PUT /api/profiles/[id]/settings` — partial update, same ownership check, field-level validation.

Why not extend the existing `/api/profiles/[id]` PATCH? Because mixing profile metadata (name, avatar, color) with settings creates a fat endpoint and forces clients to fetch + send the whole record. The settings endpoint is what `TasksSettingsPanel` will hit directly.

## Validation rules (PUT)

- `taskSortOrder` — string ∈ {`dueDate`, `title`, `priority`, `createdAt`}
- `showCompletedTasks` — boolean
- `theme` — string ∈ {`light`, `dark`, `auto`, `system`} (matches existing `/api/settings` rules)
- `language` — non-empty string (light validation; locale list is future work)
- `enableNotifications` — boolean
- `notificationTime` — string matching `HH:MM` or null
- `defaultTaskListId` — string or null

This issue's acceptance criteria only require the first two; the rest are validated defensively so the same endpoint can serve `TasksSettingsPanel` later without a schema rewrite.

## Client wiring (`SettingsForm`)

The component is server-rendered with `initialSettings`. Active profile is client-only (`useProfile()` from `ProfileContext`, backed by localStorage).

Pattern:

1. On mount (or when `activeProfile.id` changes), fetch `/api/profiles/<id>/settings` and seed local state.
2. Render `TaskSection` only once profile settings are loaded; before that, render the section with the loaded-but-not-yet-overridden defaults from `defaultValues`. (Keeps the section visible during the brief fetch; avoids flicker on stale values.)
3. `onChange` does an optimistic update + PUT; on failure, toast and rollback.

Disable interactions / show "no profile" state if `activeProfile` is null (e.g. before profiles load, or if the user has no profiles). The existing `SettingsForm` always renders, so the simplest UX is to leave TaskSection mounted with the in-memory defaults — interaction PUTs only fire once a profile exists.

## Test plan

### Phase 1 — API route (integration tests, then implementation)

`src/app/api/profiles/[id]/settings/__tests__/route.test.ts`

GET:

- returns 401 when no session
- returns 404 when profile not found / not owned by user
- returns existing settings
- upserts defaults when settings row is missing
- returns 500 on DB error

PUT:

- returns 401 when no session
- returns 404 when profile not found / not owned by user
- partial update of `taskSortOrder` persists
- partial update of `showCompletedTasks` persists
- rejects invalid `taskSortOrder` (400)
- rejects non-boolean `showCompletedTasks` (400)
- rejects invalid `theme` (400)
- rejects non-`HH:MM` `notificationTime` (400)
- accepts `notificationTime = null`
- returns 500 on DB error

### Phase 2 — `SettingsForm` wiring

Add `src/components/settings/__tests__/settings-form.test.tsx` covering:

- Fetches profile settings from `/api/profiles/<activeProfileId>/settings` on mount (mock `useProfile` + `fetch`)
- Initial render shows fallback defaults (`dueDate`, `false`) when fetch is pending
- After fetch resolves, TaskSection reflects fetched values
- Toggling `Show completed tasks` PUTs the new value
- Failed PUT rolls back the optimistic update and toasts an error
- Switching active profile re-fetches and updates the displayed values

Existing `task-section.test.tsx` continues to pass — the component contract is unchanged.

### Verification

- `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`
- Manual smoke (dev server): toggle, reload, verify persistence. (Requires database; if no DB available in remote env, document in PR.)

## Out of scope

- `TasksSettingsPanel` (#333) — sibling sub-issue; the endpoint is ready for it but the UI is not built here.
- Wiring `theme`, `language`, `enableNotifications`, `notificationTime`, `defaultTaskListId` into UI surfaces — endpoint accepts them, no UI uses them yet (covered by #328 cluster).
- Persisting per-profile settings via `User.activeProfileId` server-side — active profile remains a client-side concept; the endpoint is explicit about which profile is being read/written.
