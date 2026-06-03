# Plan — CI shadow database for Prisma migration validation (#263)

GitHub issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/263

## Problem

The `Validate Prisma migrations are up to date` step in `.github/workflows/main_nextjs-template-build.yml` runs:

```yaml
npx prisma migrate diff \
--from-migrations prisma/migrations \
--to-schema prisma/schema.prisma \
--exit-code
```

`prisma migrate diff` with `--from-migrations` needs a **shadow database** to replay the SQL into so it can compute the resulting schema and diff it against `--to-schema`. The current CI job has no Postgres service, so Prisma cannot connect anywhere and the step fails (or relies on the workflow ignoring its exit code).

## Acceptance criteria (from #263)

- [x] CI Prisma validation step passes on a clean main without manual intervention.
- [x] Workflow uses a service container for Postgres (matches the local-dev pattern Prisma users expect).
- [x] `docs/database.md` documents the new CI behavior.

## Approach

Single phase — this is a YAML + docs change, no application code.

### 1. CI workflow

Add a Postgres 16 service container to the `ci` job with a health-check, and point Prisma at it via `DATABASE_URL` scoped to the validate step. When `migrate diff --from-migrations` runs against the `postgresql` provider, Prisma auto-provisions a transient shadow database on the same server (creates a `prisma_migrate_shadow_db_<uuid>`, applies the migrations, captures the resulting schema, drops it). This requires the connecting user to have `CREATEDB`, which the container's `POSTGRES_USER` has by default.

```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: prisma
      POSTGRES_PASSWORD: prisma
      POSTGRES_DB: shadow
    ports:
      - 5432:5432
    options: >-
      --health-cmd "pg_isready -U prisma -d shadow"
      --health-interval 5s
      --health-timeout 5s
      --health-retries 10
```

The validation step becomes:

```yaml
- name: Validate Prisma migrations are up to date
  env:
    DATABASE_URL: postgresql://prisma:prisma@localhost:5432/shadow
  run: |
    npx prisma migrate diff \
      --from-migrations prisma/migrations \
      --to-schema prisma/schema.prisma \
      --exit-code || {
      echo "::error::Prisma migrations are out of date. Run 'pnpm db:migrate' to create a new migration."
      exit 1
    }
```

Notes:

- Prisma 7.3's `migrate diff` does **not** accept a `--shadow-database-url` CLI flag (verified against the installed version's `--help`). The shadow DB is sourced from the datasource URL — `prisma.config.ts` reads `DATABASE_URL` from env, which is why scoping that env var to this single step is enough.
- `--to-schema` is the correct flag in Prisma 7. `--to-schema-datamodel` was removed.
- `postgres:16-alpine` matches the typical Prisma + Next.js production target and keeps the container small.
- Credentials are throwaway (CI-only, container lifetime).

### 2. docs/database.md

Add a short subsection under `## CI Validation` explaining:

- CI provisions a Postgres service container.
- `DATABASE_URL` is set on the validate step; Prisma auto-creates the shadow DB on that server.
- Local devs do not need anything extra — `pnpm db:migrate` follows the same pattern against the local Postgres server.

## Out of scope

- Adding a `pnpm db:migrate:validate` script that runs the same validation locally — useful but not required by #263; deferred.
- Wiring the shadow DB into the `Test` and `Build` steps — they don't read the DB at build time and unit tests mock Prisma; only the migrate-diff step needs it.
- Switching from sequential to timestamp migration naming — that's #346 / PR #347.

## Testing

This change is a CI workflow + docs edit. The only meaningful verification is observing the CI run on the resulting PR:

1. Push the branch.
2. Watch the workflow on the PR: the new `postgres` service must come up, and the validation step must exit 0 against the current `prisma/migrations` + `prisma/schema.prisma` (which are already in sync on main).
3. As a defensive sanity check, locally we still run `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test:run` (none of which touch the workflow file) — this guards against an accidental edit elsewhere.

A unit test for a YAML workflow doesn't add value here; the workflow itself is the assertion.

## Risk

Low. The change is additive: a new service container and an extra CLI flag. If the service fails to come up, the step errors out clearly via `pg_isready` health checks — no silent regressions.
