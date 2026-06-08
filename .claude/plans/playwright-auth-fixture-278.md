# Playwright auth fixture (#278)

Add a shared Playwright fixture that lets E2E specs drive the auth-gated
production `/calendar` page (and any other route protected by NextAuth) by
seeding a database session and reusing the resulting `storageState` across
specs.

## Why

The production `/calendar` page is gated on a NextAuth session. Today every
E2E that needs an authenticated context either (a) targets the `/test/*`
demo pages — which bypass auth entirely — or (b) uses
`createTestUser` + `setAuthCookies` per-test, which writes to the DB on
every spec. Several already-tracked specs (deep-link `?view=year`,
profile-switch task list, day-overflow modal on prod) are blocked on a
reusable signed-in context. Issue #278.

## Shape

Playwright's project-model `storageState` pattern:

1. **Setup project** (`e2e/auth.setup.ts`) — runs once. Creates a shared
   test user via the existing `createTestUser()` helper, attaches the
   session cookie to a fresh context, dumps `context.storageState()` to
   `playwright/.auth/user.json`.
2. **Authenticated chromium project** — depends on `setup`, loads the
   saved storageState, runs every spec under `e2e/authenticated/**`.
   Browser projects (firefox / webkit / mobile / tablet) keep the
   existing unauthenticated scope; we only need one authenticated
   project to start.
3. **First consumer**
   (`e2e/authenticated/calendar-view-deeplink.spec.ts`) — visits
   `/calendar?view=year`, asserts the YearCalendar landmarks
   (`year-calendar-grid`, twelve `year-calendar-month-N` panels) render
   from the URL alone, regardless of localStorage. Mirrors the unit
   coverage in `src/app/calendar/__tests__/page.test.tsx` at the E2E
   level on the real route.
4. **README** (`e2e/README.md`) — short note explaining the
   authenticated-vs-unauthenticated project split, where to put new
   authenticated specs, and the local DB requirement.

## Files

**New**

- `e2e/auth.setup.ts` — setup spec.
- `e2e/authenticated/calendar-view-deeplink.spec.ts` — first consumer.
- `e2e/README.md` — documentation.
- `playwright/.auth/.gitignore` — `*` so the credential file never gets
  committed (the directory itself is checked in so the path exists).

**Modified**

- `playwright.config.ts` — add the `setup` project + an
  `authenticated-chromium` project that `dependsOn` it and reads
  `storageState`. Bound `testIgnore`/`testMatch` so other projects
  don't pick up `e2e/authenticated/**` and the authenticated project
  doesn't pick up the unauthenticated specs.
- `e2e/auth/auth-setup.ts` — small `getOrCreateSharedTestUser` helper
  that returns a stable user (idempotent — re-uses an existing
  `e2e-shared@example.com` row if one exists) so re-running the setup
  doesn't pile up DB rows. Also export `SHARED_TEST_USER_EMAIL` and
  the storage-state path constant for the consumer spec.
- `.gitignore` — append `playwright/.auth/` (covered by the
  per-directory `.gitignore` too but belt-and-braces).

## TDD

The fixture itself is integration-shaped — its surface is a JSON file
on disk and a working browser cookie — so the test that proves it
works is the Playwright spec. Approach:

1. Write `calendar-view-deeplink.spec.ts` (RED — fails because the
   `authenticated-chromium` project and storageState don't exist).
2. Implement the setup spec + config changes.
3. Run locally (will only succeed against a live PG). Document the
   prerequisite and the fallback.
4. Add a small Vitest unit test where possible — the
   `getOrCreateSharedTestUser` helper is pure-ish (it calls `pg`)
   so we cover its idempotency check with a mock pool, not a real DB.

`pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`
must pass before push.

## Out of scope

- Migrating the existing `e2e/auth.spec.ts` per-test pattern. That suite
  is **testing auth itself**; using a shared storage state there would
  defeat the test. Leave it alone.
- Wiring the fixture into the Playwright CI workflow (PR #369). The
  config changes are forward-compatible — once #369 lands, the CI job
  will pick up the new `setup` + `authenticated-chromium` projects
  automatically.
- Mocking Google API responses inside authenticated specs. The first
  consumer asserts the YearCalendar landmarks, which render before any
  Google fetch resolves; we don't need network mocks for it. Future
  consumers (e.g. task-list filtering) will pull from
  `e2e/fixtures/google-api-mocks.ts` per the existing pattern.
- A separate firefox / webkit / mobile authenticated project. Add when
  the first consumer that needs them lands.

## Acceptance criteria (from #278)

- [x] Fixture available and used by at least one new spec — the
      `authenticated-chromium` project + `calendar-view-deeplink.spec.ts`.
- [x] CI Playwright job (or local script) succeeds with the fixture —
      `pnpm test:e2e -- --project=setup --project=authenticated-chromium`
      runs the setup once and then the authenticated specs against the
      shared storage state. Works locally against a live PG; the
      CI workflow added in #369 picks the projects up automatically.
- [x] Pattern documented for future spec authors — `e2e/README.md`.
