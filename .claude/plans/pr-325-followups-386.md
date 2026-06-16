# Plan: PR #325 follow-ups (#386)

Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/386

Five observation-only findings surfaced during the in-depth review of PR #325.
This slice picks up items **1, 2, 4, 5**. Item 3 is deferred (out of scope —
bundled with the `gapi.client.calendar.*` retirement under #117 / #196).

## Phases

### Phase 1 — cleanup (item 5 + item 4)

Two small, mechanical changes; no behaviour change. Land them first so the
later phases ship against the cleaner baseline.

- **Item 5**: delete `interface CalendarInfo` at
  `src/app/api/calendar/calendars/__tests__/route.test.ts:45-56`. The file
  already imports `CalendarsResponse` from the route module and uses it for
  response parsing (lines 131, 179, 210, 228). The local copy is dead and
  surfaces as the only unused-vars lint warning on a file PR #325 touched.

- **Item 4**: define a single `VALIDATION_ISSUES_SUMMARY_COUNT` const in
  `src/lib/google-calendar-schemas.ts`. The constructor uses `.slice(0, 3)`;
  the four route loggers use `.slice(0, 5)`. The divergence has no rationale.
  Standardise on **5** — it matches 4 callsites vs 1, and 5 issues still fits
  the Error-message summary at the schema constructor. Export the const so
  routes share the same source of truth.

  Files to update:
  - `src/lib/google-calendar-schemas.ts` (constructor — replace `3` with the const)
  - `src/app/api/calendar/events/route.ts` (two sites: GET `:134`, POST `:609`)
  - `src/app/api/calendar/calendars/route.ts` (`:137`)
  - `src/app/api/calendar/colors/route.ts` (`:107`)

  No new tests needed — existing tests already cover the validation-failure
  log shape, and the const change preserves the behaviour they assert.

### Phase 2 — wire Zod error-body parsing (item 1)

`GoogleApiErrorBodySchema` is exported and unit-tested (`google-calendar-schemas.test.ts:192-218`)
but no route uses it. Every error-body access today is the raw
`errorData.error?.message || ...` pattern.

Approach: option **(a)** from the issue — wire it in via a typed helper so
the success/error-body validation asymmetry closes. The schema already
accepts empty `{}` so existing `.catch(() => ({}))` fallback shapes remain
valid input.

Add to `src/lib/google-calendar-schemas.ts`:

```ts
export function parseGoogleErrorBody(data: unknown): GoogleApiErrorBody {
  const result = GoogleApiErrorBodySchema.safeParse(data);
  return result.success ? result.data : {};
}
```

Failure mode is deliberately quiet: a malformed Google error body is not a
loggable Google-API contract break (the canonical error envelope is
documented but the route handlers already tolerate missing fields). The
helper falls back to `{}` so callers keep their `?.error?.message ?? "..."`
ladder; the only behaviour change is that the read goes through a parsed,
typed envelope instead of a raw cast.

Replace the three error-body access sites in the events routes (the
`calendars` and `colors` routes log the raw `errorData` as a structured
blob rather than reading `.error.message`, so they're not in scope):

| File                                        | Line    | Pattern today                                                 |
| ------------------------------------------- | ------- | ------------------------------------------------------------- |
| `src/app/api/calendar/events/route.ts`      | 110-118 | `await response.json().catch(() => ({}))` → `.error?.message` |
| `src/app/api/calendar/events/route.ts`      | 671-677 | same shape, POST path                                         |
| `src/app/api/calendar/events/[id]/route.ts` | 130-137 | same shape, DELETE path                                       |

Tests:

- New unit tests on `parseGoogleErrorBody` in `google-calendar-schemas.test.ts`:
  - returns `{}` on `null`, `undefined`, primitive, array
  - returns the parsed body when it matches the schema
  - returns `{}` when the body has the wrong shape (so callers fall through to their string fallback)
- Existing route tests pass unchanged — the user-visible `errorData.error?.message`
  fallback behaviour is preserved.

### Phase 3 — multi-calendar all-fail returns error status (item 2)

Today at `src/app/api/calendar/events/route.ts:262-268`:

```ts
if (errors.length === calendarIds.length && calendarIds.length === 1) {
  return NextResponse.json(
    { error: "Failed to fetch calendar events" },
    { status: errors[0].status || 500 }
  );
}
```

The `calendarIds.length === 1` guard means a 2-calendar request where both
fail returns 200 with `events: []` and a populated `errors[]`. Drop the
guard. Pick the response status as:

- All failures share the same status → return that status.
- Mixed statuses → return **502** (proxy-style "upstream failures").

Auth errors (401) already trigger an early return at line 227-238, so the
all-fail path will never see a 401.

Test cases to add to `events/__tests__/route.test.ts`:

1. Two-calendar request, both fail with 404 → response status **404**,
   `errors[]` lists both, `events[]` is empty.
2. Two-calendar request, mixed 404 + 502 → response status **502**.
3. Two-calendar request, one fails / one succeeds → still 200 (unchanged
   partial-failure semantics).
4. Single-calendar request, fails → still bubbles the per-calendar status
   (unchanged path).

## Commits / push cadence

Each phase commits and pushes separately. First push opens the draft PR;
subsequent pushes update it.

## Out of scope (this slice)

- **Item 3** (`event as gapi.client.calendar.Event` cast at the mapper
  boundary) — needs `normalizeFetchedEvent` and `GoogleCalendarEvent` to be
  retyped onto `GoogleEventPayload` rather than the `gapi.client.calendar.*`
  ambient types. That ripples into the legacy `lib/google-calendar.ts`
  client-side callers (also typed against gapi) and belongs with the wider
  gapi retirement under #117 / #196.
