# Plan: Playwright E2E coverage workflow (issue #281)

## Goal

Add a GitHub Actions workflow that runs the Playwright E2E suite on every PR
and on pushes to `main`, surfacing regressions before they reach `main` (or
before merge). PR #248 wired Vitest into CI but explicitly deferred E2E; this
plan delivers that follow-up.

## Acceptance criteria (from #281)

- [x] Workflow runs on PRs and on `main`.
- [x] Failures upload artifacts useful for debugging (Playwright HTML report
      and `test-results/` traces/screenshots/videos).
- [x] Total runtime acceptable (target `< ~10 min`).

## Constraints / context

- The repo's existing CI workflow (`main_nextjs-template-build.yml`) uses
  `actions/setup-node@v6`, `pnpm/action-setup@v6`, `pnpm install --frozen-lockfile`,
  Node 22.x. The new workflow mirrors that for consistency.
- `playwright.config.ts` defines five projects: `chromium`, `firefox`,
  `webkit`, `mobile-chrome`, `tablet`. Running all five blows past the 10-min
  budget. Restrict CI to `chromium` for now (web-only smoke); local devs
  retain the full matrix. Cross-browser parity is a follow-up.
- `webServer.command` is `pnpm dev`. Under `CI=true`, the config sets
  `reuseExistingServer: false`, so Playwright will start its own dev server.
  We do **not** need a separate "start server" step.
- Some specs (e.g. `calendar-integration.spec.ts`) require a real
  authenticated Google session. They `test.skip(true)` when
  `getExistingUserSession()` returns null, so they no-op cleanly in CI as
  long as the database is reachable. The shared Playwright auth fixture
  needed for non-trivial signed-in specs is tracked separately in #278; this
  PR doesn't need it.
- A Postgres service container is required because some specs query the DB
  during their pre-test skip check (e.g. `getExistingUserSession`). Without
  it, those specs error rather than skip cleanly. We provision one and run
  `prisma migrate deploy` against it before tests start.
- `test:e2e` is defined as `playwright test`. We append
  `--project=chromium` in the workflow command so the project selection
  lives in CI config, not in `package.json` (preserves local cross-browser
  default).
- The standard `pnpm` browser-cache key pattern is to key off
  `pnpm-lock.yaml`; Playwright browsers cache by `playwright/package.json`
  version. We use `actions/cache@v5` for both to stay aligned with the
  existing `secretless-deploy-sample.yml` style.

## Workflow design

File: `.github/workflows/e2e.yml`

Triggers:

- `pull_request` → branches: `[main]`
- `push` → branches: `[main]`
- `workflow_dispatch` (manual)

Job: `e2e` (Ubuntu runner)

Services:

- `postgres:17` with default user/password/db, healthcheck via `pg_isready`.

Steps (in order):

1. `actions/checkout@v6`.
2. `pnpm/action-setup@v6` (version inferred from `packageManager` field).
3. `actions/setup-node@v6` with `node-version: 22.x` and `cache: pnpm`.
4. `pnpm install --frozen-lockfile` (Prisma client generates via `postinstall`).
5. Resolve Playwright version from the lockfile for cache keying.
6. Cache `~/.cache/ms-playwright` keyed on Playwright version. On miss, run
   `pnpm exec playwright install --with-deps chromium` (only chromium, only
   when needed).
7. Apply Prisma migrations to the service DB:
   `pnpm db:migrate:deploy` with `DATABASE_URL` pointing at the service.
8. Run E2E: `pnpm test:e2e --project=chromium` with required env vars
   (`DATABASE_URL`, `TEST_DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`,
   `AUTH_SECRET`, dummy Google OAuth client id/secret so the app boots).
9. On failure (`if: failure()`), upload `playwright-report/` and
   `test-results/` as artifacts with a 14-day retention. Mark
   `if-no-files-found: ignore` so a hard early failure (before any report is
   produced) doesn't fail the upload step itself.

Concurrency: cancel in-progress runs for the same ref so rapid pushes don't
queue up.

## What this PR explicitly does NOT do

- Cross-browser CI matrix (firefox/webkit/mobile-chrome/tablet) — out of
  scope; chromium-only smoke is enough to start. Filed as a follow-up note
  in the PR body if needed.
- Shared authenticated-user fixture (#278). Auth-requiring specs continue to
  self-skip; CI will report them as skipped, not failed.
- Sharding across multiple runners. Single runner with `workers: 1` (the
  config default under CI) keeps runtime predictable; can be reconsidered
  later if the suite grows past 10 min.

## Test plan / verification

- Validate YAML syntax locally (`yamllint` if available, or rely on GitHub's
  parser on first push).
- Confirm `pnpm lint:fix && pnpm format:fix && pnpm check-types` pass
  (workflow files don't touch any of these, but the PR contains no source
  changes, so the gates remain green).
- Confirm `pnpm test:run` still passes (sanity — no Vitest impact).
- After push, observe the workflow run on the PR. Expected outcome on a
  fresh main-based branch: the suite runs to completion (skips or passes;
  failures should be analysed in follow-up).

## Risks

- Mismatch between dev's local Postgres setup (Prisma `@prisma/adapter-pg`)
  and the service container could surface adapter quirks. Mitigation: use
  Postgres 17 (matches `prisma/schema.prisma` provider default) and validate
  by running `prisma migrate deploy` before the test step — any
  schema/driver mismatch fails fast there.
- Auth-required specs that DB-skip might still hit unexpected errors on the
  empty test DB. Mitigation: monitor first run; if any spec errors instead
  of skipping, file a follow-up to harden the skip guard.
- Cache poisoning across Playwright versions. Mitigation: cache key includes
  the resolved Playwright version (parsed from the lockfile).
