# `/api/calendar/events` GET handler — pure-helper extraction (#446)

## Problem

`src/app/api/calendar/events/route.ts:GET` (~lines 169-325, ~156 lines) interleaves
five responsibilities in one function:

1. session + refresh-token auth checks (`NextResponse.json` returns)
2. query-string parsing (defaults + comma-split)
3. parallel `fetchEventsFromCalendar` dispatch
4. per-calendar result aggregation with embedded auth-error short-circuit and
   `logger.error` dedupe (`!result.error.logged`)
5. all-fail vs success response shaping

The first and third stay in the handler (they touch `NextResponse` / `Promise.all`
of an already-pure helper); the second and fourth are pure data transforms and
extract cleanly. The fifth is one-liner shaping and stays inline.

## Out of scope

- **`validateEventBody` → Zod.** The issue body lumps "migrate `validateCreateBody`
  to a Zod schema" into the same ticket, but `validateCreateBody` was already
  extracted (it's `validateEventBody` in `src/lib/calendar/event-body.ts`) and is
  a pure, fully-tested function. Migrating its hand-rolled checks to Zod is a
  separate concern — file a follow-up issue and link from the PR.
- **`validateGetParams` "throw" pattern.** The issue suggests
  `validateGetParams(url) → parsed params or throw`. The current handler has no
  throwing validation in the GET path — defaults swallow every missing input.
  Adding a throw boundary would be a behaviour change; this slice extracts the
  data flow only.
- **Multi-calendar response-shape semantics.** This refactor preserves wire
  shape byte-for-byte. The existing 1,745-line integration test file is the gate.

## Phases

### Phase 1 — `parseGetParams`

Pure function in a new module
`src/lib/calendar/events-get-params.ts`:

```ts
export interface CalendarEventsGetParams {
  calendarIds: string[]; // never empty; defaults to ["primary"]
  timeMin: string; // ISO datetime; defaults to new Date().toISOString()
  timeMax: string | null; // null when caller didn't pass it
  maxResults: string; // string (matches Google API contract); defaults "250"
  singleEvents: boolean; // defaults true; `singleEvents=false` flips it
}

export function parseCalendarEventsGetParams(url: URL): CalendarEventsGetParams;
```

Tests (`events-get-params.test.ts`):

- empty URL → all defaults; `calendarIds === ["primary"]`, `singleEvents === true`,
  `timeMax === null`, `timeMin` is a valid ISO string (sentinel: `Date.parse(...)`
  not NaN), `maxResults === "250"`.
- `?calendarId=foo` → `calendarIds === ["foo"]`.
- `?calendarIds=a,b,c` → `calendarIds === ["a", "b", "c"]` (precedence over
  `calendarId` — matches existing branch).
- `?calendarIds=a&calendarId=b` → `calendarIds === ["a"]` (params-only wins, no
  fallback merge).
- `?singleEvents=false` → `singleEvents === false`.
- `?singleEvents=true` → `singleEvents === true`.
- `?singleEvents=foo` → `singleEvents === true` (current code: only literal
  `"false"` flips it; everything else stays default).
- `?timeMin=2024-01-01T00:00:00Z&timeMax=2024-02-01T00:00:00Z&maxResults=10`
  → values pass through.

Time injection: take `now: Date | (() => Date)` as an optional second arg so the
test for the default-`timeMin` branch can pin a clock. Public API stays
`parseCalendarEventsGetParams(url)` — the `now` param is internal-default.

### Phase 2 — `aggregateCalendarResults`

> **Revised after parallel-session feedback (issue comment 4785513589):** the
> original draft of this plan exposed an `authError` short-circuit on the
> aggregator's return. That would break log emission ordering — today's loop
> interleaves `logger.error` with iteration, so a `[200, 500, 401]` fan-out
> logs the 500 envelope first, then the 401 envelope, then returns 401.
> Aggregating + early-returning on `authError` drops the 500 log. Fix: the
> aggregator is a strict data transform — walks **every** result, accumulates
> errors (including 401s) in input order. The handler iterates `errors[]`,
> short-circuits on the first `.status === 401` after logging any non-auth
> errors that preceded it. Order is preserved by construction.

Pure function in a new module
`src/lib/calendar/events-aggregate.ts`:

```ts
type PerCalendarResult = Awaited<ReturnType<typeof fetchEventsFromCalendar>>;

export interface AggregatedCalendarFetch {
  events: GoogleCalendarEvent[];
  errors: InternalCalendarFetchError[]; // input order; preserves `logged`; may contain 401(s)
  summary: string | undefined; // first successful calendar's summary
  timeZone: string | undefined;
}

export function aggregateCalendarResults(results: PerCalendarResult[]): AggregatedCalendarFetch;
```

Behaviour mirrors the current loop's data side (logging stays in the handler):

- Walks every result in input order. Pushes `result.events` to `events`.
- Pushes `result.error` (when set) to `errors` — **including 401s**, so the
  handler can iterate in input order and emit logs in the same sequence the
  current code does.
- `summary`/`timeZone` come from the **first** result with a `summary` field
  set (matches current `if (!summary && result.summary)`).

Co-locate the per-calendar error types and their wire helpers in this module
since they all describe the same error shape:

- `InternalCalendarFetchError` (was inline in `route.ts`)
- `CalendarFetchError` (was inline in `route.ts`)
- `toWireFetchError` (was inline in `route.ts`)
- `resolveAllFailStatus` (was inline in `route.ts`)

`route.ts` imports them back. The handler keeps the human-readable JSDoc for
the wire contract.

Tests (`events-aggregate.test.ts`):

- empty input → empty events, empty errors, undefined summary/timezone.
- all-success → events concatenated in input order; summary/timezone from first
  successful (and only the first — later non-empty summaries don't override).
- partial fail (one error, status 500) → that error in `errors`, events from
  the others.
- multiple non-401 errors → all collected in input order.
- **`[non-401, 401]` ordering**: aggregator returns both errors in input
  order (no early-return). This is the pin against the regression the
  parallel session called out — without it, the helper looks correct in
  isolation while breaking the handler's log sequence.
- first result is 401 → 401 in `errors[0]`; later results still walked.
- `logged: true` preserved on the returned errors (round-trip).
- `summary`/`timeZone` come from the first result that has them set, not
  overridden by later results.

Also add a route-level integration test in `route.test.ts` that asserts the
log sequence for the `[non-401, 401]` ordering — `logger.error` called with
"Calendar fetch error" first, then "Google Calendar API auth error", then 401
returned. None of the current 1,745-line route tests exercise this exact
ordering.

### Phase 3 — wire helpers into GET handler

Refactor `route.ts:GET` to:

```ts
const params = parseCalendarEventsGetParams(new URL(request.url));
const accessToken = await getAccessToken();
const results = await Promise.all(
  params.calendarIds.map((id) =>
    fetchEventsFromCalendar(id, accessToken, params.timeMin, params.timeMax,
                            params.maxResults, params.singleEvents)
  )
);
const agg = aggregateCalendarResults(results);

for (const err of agg.errors) {
  if (err.status === 401) {
    logger.error(new Error("Google Calendar API auth error"), {
      calendarId: err.calendarId,
      userId: session.user.id,
    });
    return NextResponse.json(
      { error: "Google authentication failed. Please sign in again.",
        requiresReauth: true },
      { status: 401 }
    );
  }
  // Skip the generic envelope when the producer already logged a
  // richer entry (e.g. `GoogleApiValidationError`).
  if (!err.logged) {
    logger.error(new Error("Calendar fetch error"), {
      calendarId: err.calendarId,
      errorMessage: err.error,
      errorStatus: err.status || 0,
      userId: session.user.id,
    });
  }
}

if (agg.errors.length === params.calendarIds.length) {
  return NextResponse.json(
    { error: "Failed to fetch calendar events",
      events: [],
      errors: agg.errors.map(toWireFetchError) },
    { status: resolveAllFailStatus(agg.errors) }
  );
}

logger.log("Calendar events fetched", {
  calendarCount: params.calendarIds.length,
  eventCount: agg.events.length,
  errorCount: agg.errors.length,
  userId: session.user.id,
});

const response: { ... } = { events: agg.events, summary: agg.summary, timeZone: agg.timeZone };
if (agg.errors.length > 0) response.errors = agg.errors.map(toWireFetchError);
return NextResponse.json(response);
```

GET handler drops from ~156 lines to ~60. Existing route integration tests are
the regression gate — none of them should require edits.

## Files

- **NEW** `src/lib/calendar/events-get-params.ts`
- **NEW** `src/lib/calendar/__tests__/events-get-params.test.ts`
- **NEW** `src/lib/calendar/events-aggregate.ts`
- **NEW** `src/lib/calendar/__tests__/events-aggregate.test.ts`
- **EDIT** `src/app/api/calendar/events/route.ts`

Types `InternalCalendarFetchError` / `GoogleCalendarEvent` are shared with the
route — export `InternalCalendarFetchError` from `events-aggregate.ts` (its
new home; the route imports it back). `toWireFetchError` /
`resolveAllFailStatus` stay in `route.ts` — they're closely tied to the wire
contract.

## Quality gates

`pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`

All four must pass before each commit. The existing 1,745-line
`route.test.ts` is the integration regression guard.
