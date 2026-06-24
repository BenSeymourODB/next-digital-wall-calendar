# Plan: drop `gapi.client.calendar.Event` cast at Zod/mapper boundary (#403)

Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/403

## Context

Item 3 from the PR #325 review (tracked in #386). Items 1, 2, 4, 5 shipped in
PR #402. Item 3 was deferred because it ripples beyond a single boundary fix.

## The problem

The `events/route.ts` GET (line 159) and POST (line 422) paths Zod-parse the
Google response into `GoogleEventPayload`, then cast that value to
`gapi.client.calendar.Event` to pass it to `normalizeFetchedEvent`:

```ts
normalizeFetchedEvent(event as gapi.client.calendar.Event, calendarId);
normalizeFetchedEvent(created as gapi.client.calendar.Event, event.calendarId);
```

The cast is safe at runtime (Zod `.loose()` preserves unknown fields; the
mapper just spreads + adds `summary: ""` fallback + `calendarId`), but it
defeats the trust boundary the Zod schema exists to enforce: we validate to
produce `GoogleEventPayload`, then immediately discard that type. The mapper
should accept the validated type directly.

`src/app/api/calendar/events/[id]/route.ts:255` has the same anti-pattern in
the PATCH success path — except it casts the _raw_ `await response.json()`,
not a Zod-validated value. Once the mapper's input type tightens to
`GoogleEventPayload`, that PATCH path stops compiling, so it must be wired
through `parseGoogleResponse` in the same PR.

## The fix (as implemented)

The issue lists two resolution paths. Option A (cleanest on paper) was to
make `GoogleCalendarEvent extends Omit<GoogleEventPayload, "summary">` —
flip the canonical domain type so every consumer reads the Zod-derived
shape directly. That broke `src/lib/calendar-transform.ts` immediately:
Zod 4 infers `z.object(...).loose()` as `{ ... [k: string]: unknown }`,
which widens inner fields (`start.dateTime`, `creator.email`,
`extendedProperties.shared.category`) to `unknown` and makes the transform
fail strict TS. Reshaping `calendar-transform.ts` to defensively narrow
each access would have ballooned the diff and risked behaviour changes far
from the issue's stated goal.

Option B (Option 1 in the issue body) is what shipped:

1. Keep `GoogleCalendarEvent extends Omit<gapi.client.calendar.Event, "summary">`
   so every consumer keeps the structural shape it relies on.
2. Tighten `normalizeFetchedEvent`'s input to `GoogleEventPayload` so the
   route call sites pass the Zod-validated payload directly with no cast.
3. The single structural assertion that bridges the loose Zod inference and
   the gapi-derived domain type lives **inside the mapper**, where the
   contract is documented: Zod has already validated the payload; the
   mapper is the only place where "wire shape" becomes "internal canonical
   event". Both schemas describe the same JSON, so the assertion is safe
   and the doc-comment on `normalizeFetchedEvent` explains exactly that.
4. Wire `parseGoogleResponse` into the PATCH success path of
   `events/[id]/route.ts` so the raw-JSON cast also goes away — pulled in
   because the mapper-signature tightening made it a strict requirement,
   not an opportunistic extension.
5. Wire `parseGoogleResponse` into the legacy client-side helper
   `fetchCalendarEvents` so it produces `GoogleEventPayload[]` for the
   mapper. The module's own docstring already recommended this for any
   future production caller; this brings the legacy path into alignment.

Net effect: zero `event as gapi.client.calendar.Event` casts at the route
boundary, zero raw-JSON casts at the PATCH success path, one documented
structural assertion inside the mapper itself.

## Files touched

- `src/lib/google-calendar-mappers.ts` — `normalizeFetchedEvent` accepts
  `GoogleEventPayload`; doc comments explain the trust-boundary contract.
- `src/app/api/calendar/events/route.ts` — drop both casts (GET line 159,
  POST line 422) and the cast-justification comment.
- `src/app/api/calendar/events/[id]/route.ts` — drop the raw-JSON cast on
  PATCH, wire `parseGoogleResponse(GoogleEventSchema)` to mirror POST.
- `src/lib/google-calendar.ts` — `fetchCalendarEvents` validates
  `response.result` through `GoogleEventsListResponseSchema` before mapping.
- `src/lib/__tests__/google-calendar-mappers.test.ts` — switch
  `normalizeFetchedEvent` fixture annotations to `GoogleEventPayload`. The
  end-to-end test still asserts the gapi-typed `EventsListResponse`
  fixture, but now parses it through `parseGoogleResponse` first so the
  flow mirrors production.

## Verification

`pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test:run` — all
green (2708 tests pass).

## Out of scope

- `normalizeCalendarListEntry` retyping — no cast at the calendars route
  boundary, so the analogous flip is non-urgent. Bundle with a future
  `gapi.d.ts` retirement when one happens.
- `src/types/gapi.d.ts` retirement — still required by the runtime
  `window.gapi.client.calendar.*` calls in the legacy helpers, so it stays.
  Tracked separately if/when those helpers are removed.

## Commits / push cadence

Single commit (the changes are tightly coupled — splitting them leaves
intermediate states that don't compile). First push opens the draft PR.
