# PR #325 Review Follow-ups (#386)

## Summary

Five observation-only findings surfaced during the PR #325 review. This plan delivers items 1, 2, 4, and 5; item 3 is deferred to the `#117 / #196` gapi-types retirement work.

## Scope (in-session)

### Item 5 — Delete dead `interface CalendarInfo` in calendars route test

**File:** `src/app/api/calendar/calendars/__tests__/route.test.ts:45-56`

The local interface is never referenced — the test file uses `CalendarsResponse` imported from `../route` for response parsing. Lint warning surfaces this on every touch.

**Change:** delete lines 45-56 (interface + blank line). No tests change.

### Item 4 — Unify validation-issues slice length

**Files:**

- `src/lib/google-calendar-schemas.ts:266` (constructor) — currently `.slice(0, 3)`
- `src/app/api/calendar/events/route.ts:134` — currently `.slice(0, 5)`
- `src/app/api/calendar/events/route.ts:609` — currently `.slice(0, 5)`
- `src/app/api/calendar/calendars/route.ts` — uses `.slice(0, 5)` in the validation log path
- `src/app/api/calendar/colors/route.ts` — uses `.slice(0, 5)` in the validation log path

**Change:** add `export const VALIDATION_ISSUES_SUMMARY_COUNT = 5;` to `google-calendar-schemas.ts`. Update the constructor and all route callsites to use the const. The constructor's effective slice grows 3→5 — this is a string-message change only (no behaviour change in any code path that inspects `error.issues` directly), and aligns with the per-route structured log which is the dominant pattern.

### Item 1 — Wire `GoogleApiErrorBodySchema` in via a typed helper

**Files:**

- `src/lib/google-calendar-schemas.ts` — add `parseGoogleErrorBody(unknown): GoogleApiErrorBody` helper.
- `src/app/api/calendar/events/route.ts:110-115` — `fetchEventsFromCalendar` non-ok path.
- `src/app/api/calendar/events/route.ts:671-677` — POST catch-all non-ok path.
- `src/app/api/calendar/events/[id]/route.ts:130-137` — DELETE catch-all non-ok path.

**Helper contract:** accepts arbitrary `unknown` (the `.json().catch(() => ({}))` result), runs `GoogleApiErrorBodySchema.safeParse`, and returns the parsed `GoogleApiErrorBody` on success or `{}` on failure. Never throws — the existing fallbacks (`?? "unknown"`, `|| "Failed to fetch events"`) preserve the current UX when Google sends garbage.

**Why not throw on parse failure?** Routes already log the per-Google-status error and route off `response.status`; a malformed error body is a Google-side anomaly, not a route-handler failure mode. We want a soft fallback that closes the type-safety gap without changing observable behaviour.

### Item 2 — Multi-calendar all-fail returns error status

**File:** `src/app/api/calendar/events/route.ts:262-268`

Today, the "all calendars failed" branch only fires when `calendarIds.length === 1`. A two-calendar request where both calendars fail returns 200 with `events: []` and a populated `errors[]` — a caller keying off the top-level status misses the failure entirely.

**Change:** drop the `calendarIds.length === 1` guard. Unified logic:

```ts
if (errors.length === calendarIds.length && errors.length > 0) {
  const statuses = errors.map((e) => e.status ?? 500);
  const allSame = statuses.every((s) => s === statuses[0]);
  return NextResponse.json(
    { error: "Failed to fetch calendar events" },
    { status: allSame ? statuses[0] : 502 }
  );
}
```

For single calendar, `statuses` has length 1, `allSame` is true, status is `statuses[0]` — identical to current behaviour, so the existing single-calendar 404/500/etc. tests remain green.

For multi-calendar all-fail with the same Google status (e.g. both 502 from validation failure): returns 502.

For multi-calendar all-fail with mixed statuses (one 404, one 502): returns 502, since the caller cannot generally pick one calendar's status as canonical.

## Out of scope

- **Item 3** — `event as gapi.client.calendar.Event` cast at the Zod/mapper boundary. Per the issue, this lives in the `#117 / #196` gapi-types retirement cluster. Touching it pulls in `lib/google-calendar.ts` and its callers, out of scope for a follow-up slice.

## Test strategy (TDD)

**Item 5:** no new tests; existing tests must stay green.

**Item 4:** no new tests; existing `route.test.ts` and `google-calendar-schemas.test.ts` tests must stay green. The constructor's `Error.message` content is not asserted in any test today (confirmed via grep) so the 3→5 widening is safe.

**Item 1:**

- Add unit tests in `src/lib/__tests__/google-calendar-schemas.test.ts` for `parseGoogleErrorBody`:
  - returns the parsed body on a canonical Google error envelope
  - returns `{}` on completely unrelated shapes (`null`, `"string"`, `42`, `[]`)
  - returns `{}` when `error` is the wrong type (string instead of object)
  - returns the body unchanged when `error.message` is the only field
- Existing route tests already exercise the consuming paths; they should pass unchanged because the helper preserves observable behaviour.

**Item 2:**

- Add tests to `src/app/api/calendar/events/__tests__/route.test.ts` under the existing multi-calendar `describe` block:
  - 2 calendars, both fail with 502 (validation errors): returns 502 with the standard error body, errors[] still populated
  - 2 calendars, both fail with mixed statuses (404 and 502): returns 502
  - 2 calendars, both fail with the same status from Google (both 404): returns 404
  - 1 calendar fail still returns its own status (existing test guarantees this; reaffirm)
  - 2 calendars, one ok one fails: still 200 (existing partial-failure test guarantees this; reaffirm via the existing test passing)

## Acceptance criteria mapping

- [x] Item 1: helper added + wired (closes success/error validation asymmetry)
- [x] Item 2: multi-calendar all-fail returns error status (route + test coverage)
- [x] Item 4: single const for validation-issues slice length
- [x] Item 5: dead interface deleted
- [ ] Item 3: deferred — link in PR body to keep the tracking thread alive

## Phases

1. **Phase 1 (refactor):** items 4 + 5 — pure cleanup, no behaviour change.
2. **Phase 2 (item 1):** `parseGoogleErrorBody` helper + wire into three route callsites. Tests first.
3. **Phase 3 (item 2):** drop `calendarIds.length === 1` guard. Tests first.

Each phase: `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`, commit, push.
