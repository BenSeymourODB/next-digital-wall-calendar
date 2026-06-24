# Issue #438 — Remove vestigial client-side gapi code

## Source of truth

[#438](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/438) —
the browser-side Google API integration (`src/lib/google-calendar.ts`) is no
longer reachable from any production path. Server routes under
`src/app/api/calendar/**` are the only callers of Google APIs, and they hit
Google directly with a server-side OAuth token (NextAuth). The legacy module
still exists because it is the import path for the canonical
`GoogleCalendarEvent` / `UserCalendar` types via a re-export shim — and because
no one has migrated callers to the source module.

Closely related but **out of scope** for this PR: #403 (drop the
`gapi.client.calendar.Event` boundary cast in
`src/app/api/calendar/events/route.ts`). That's the gating change to remove
`@types/gapi` + the remaining `gapi.client.calendar.*` namespace in
`src/types/gapi.d.ts`; doing it correctly requires the Zod migration discussed
in #403 and is not a mechanical change.

## State of the code (verified)

- `src/lib/google-calendar.ts` (578 lines) re-exports `GoogleCalendarEvent`,
  `UserCalendar`, `normalizeCalendarListEntry`, `normalizeFetchedEvent` from
  `./google-calendar-mappers`. Five files import via this re-export — three
  prod, two test — and **only** for these symbols.
- The runtime helpers (`fetchCalendarEvents`, `fetchEventsFromMultipleCalendars`,
  `fetchUserCalendars`, `initGoogleAPI`, `signInToGoogle`, plus their global
  state `gapiInitialized` / `gisInitPromise` / `tokenClient`) are not imported
  anywhere under `src/components/**`, `src/app/**`, or `src/lib/**` apart from
  this module itself.
- `src/types/gapi.d.ts` (386 lines) declares two ambient namespaces:
  - `google.accounts.oauth2` — used **only** by `google-calendar.ts`. Dead
    once that module is gone.
  - `gapi.client.calendar` augmentation — still load-bearing for the
    `as gapi.client.calendar.Event` casts in `events/route.ts:159`,
    `events/route.ts:422`, `events/[id]/route.ts:255`, and the mapper tests.
    Removal is gated on #403.
- `gapi-script` is imported nowhere (grepped). It was a browser-only loader
  for the legacy `gapi` global; only `google-calendar.ts` ever needed it.
- `@types/gapi.auth2` is the legacy auth2 flow types. The `gapi.d.ts` header
  explicitly notes "we no longer use" auth2 — and nothing references the
  `gapi.auth2` namespace in the repo (only `google.accounts.oauth2`, declared
  locally).
- `@types/gapi` (the package) is still load-bearing for the
  `gapi.client.calendar.Event` boundary cast. Out of scope.

## Plan

### Phase 1 — Migrate type imports off the re-export shim

In each of the 5 files below, change
`from "@/lib/google-calendar"` →
`from "@/lib/google-calendar-mappers"`:

- `src/lib/event-cache.ts`
- `src/lib/calendar-transform.ts`
- `src/components/providers/CalendarProvider.tsx`
- `src/lib/__tests__/event-cache.test.ts`
- `src/lib/__tests__/calendar-transform.test.ts`
- `src/lib/__tests__/google-calendar-mappers.test.ts` (also imports
  `normalizeCalendarListEntry`, `normalizeFetchedEvent` via the shim — drop
  the shim import; the test already has a direct
  `from "@/lib/google-calendar-mappers"` import for `canWriteToCalendar`,
  so merge the two)

No behavior change. Gate: `pnpm check-types && pnpm test:run` clean.

### Phase 2 — Delete the dead module

- `git rm src/lib/google-calendar.ts`.
- Trim `src/types/gapi.d.ts` to drop the `google.accounts.oauth2` namespace
  declaration (lines 25–110 or thereabouts). Update the file header to reflect
  that auth2 / GIS types are gone and the file now only augments
  `gapi.client.calendar` at the trust boundary for the events route.
- Gate: `pnpm check-types && pnpm lint:fix && pnpm test:run` clean.

### Phase 3 — Drop dead deps

- `package.json`: remove `gapi-script` and `@types/gapi.auth2` from
  `dependencies`. Leave `@types/gapi` (still used by route casts).
- `pnpm install` to regenerate `pnpm-lock.yaml`.
- Gate: `pnpm check-types && pnpm lint:fix && pnpm format:fix && pnpm test:run`
  clean.

## TDD posture

The existing test suite (2708 tests across 160 files, all currently green)
**is** the regression gate. The change is mechanical (rename one import path)
plus a deletion of unreferenced code — no new behavior to test, and writing
new tests for "this file is gone" would be ceremony, not coverage.

If any test imported the legacy module directly for its runtime exports (it
doesn't, per the verification above), that would be a code-design problem to
fix; the test suite catches it via `check-types`.

## Deferred

Filed/linked in the PR body, not added to this session:

- **`@types/gapi` + remaining `gapi.client.calendar` namespace** — gated on
  #403's Zod-validated mapper boundary replacing the
  `as gapi.client.calendar.Event` casts.

## Out-of-scope cleanups noticed but not touched

- `src/lib/logger.ts` has duplicate `case "info" / "warn"` clauses that vite
  flags during tests. Not part of #438. If unfiled, would warrant its own
  ticket — but the duplicates likely match #448 (logger.log overloaded
  signature) which already has an open PR (#461). Not filing a new issue.
