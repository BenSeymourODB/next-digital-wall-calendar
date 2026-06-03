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

Add a Postgres 16 service container to the `ci` job with a health-check, then expose its URL to the validate step via `SHADOW_DATABASE_URL`. Prisma 7's `migrate diff --from-migrations` does **not** auto-create a shadow DB from the datasource URL — it requires `datasource.shadowDatabaseUrl` to be set in `prisma.config.ts` (or a `--shadow-database-url` CLI flag that Prisma's own error suggests but the `migrate diff` parser actually rejects as "unknown or unexpected option"). The config path is the working one.

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

`prisma.config.ts` gets a new `datasource.shadowDatabaseUrl` field reading from env:

```ts
datasource: {
  url: process.env["DATABASE_URL"],
  shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"],
},
```

`undefined` is safe locally — `pnpm db:migrate` uses `prisma migrate dev`, which auto-manages a shadow DB on the user's local Postgres without needing this field.

The validation step becomes:

```yaml
- name: Validate Prisma migrations are up to date
  env:
    SHADOW_DATABASE_URL: postgresql://prisma:prisma@localhost:5432/shadow
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

- Prisma 7.3's `migrate diff` parser rejects `--shadow-database-url` as "unknown or unexpected option" — verified on the first CI run. The runtime check on a missing shadow DB then suggests using that very flag, which is misleading; the config-file path is the only one that actually works.
- `--to-schema` is the correct flag in Prisma 7. `--to-schema-datamodel` was removed.
- `postgres:16-alpine` matches the typical Prisma + Next.js production target and keeps the container small.
- Credentials are throwaway (CI-only, container lifetime).

### 2. prisma.config.ts

Add `shadowDatabaseUrl: process.env["SHADOW_DATABASE_URL"]` to the `datasource` block. Required by Prisma 7's `migrate diff --from-migrations`; harmless in dev where the variable is unset.

### 3. docs/database.md

Add a short subsection under `## CI Validation` explaining:

- CI provisions a Postgres service container.
- `SHADOW_DATABASE_URL` is set on the validate step; `prisma.config.ts` reads it into `datasource.shadowDatabaseUrl`.
- Local devs do not need anything extra — the env var stays unset and `pnpm db:migrate` continues to work.

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
