# Plan: Switch Prisma migration naming to datetime prefix (#346)

## Problem

Sequential `NNNN_` migration prefixes are a contended resource under concurrent
agent sessions. Two sessions independently choose the same next number;
collisions block CI on every open PR. This has already happened twice (#343,
#345) and is structural.

## Solution

Replace `NNNN_snake_case` with Prisma's out-of-the-box `YYYYMMDDHHMMSS_snake_case`
prefix. Same-second collisions across separate cloud sessions are implausible in
practice, and the updated check script catches them when they occur.

## Timestamp mapping (backfilled from first-merge commit times, UTC)

| Old name                                  | New name                                            |
| ----------------------------------------- | --------------------------------------------------- |
| `0001_initial`                            | `20260502052405_initial`                            |
| `0002_add_scheduler_settings`             | `20260502052406_add_scheduler_settings`             |
| `0003_unique_account_user_provider`       | `20260502052407_unique_account_user_provider`       |
| `0004_add_calendar_settings`              | `20260502052408_add_calendar_settings`              |
| `0005_add_meal_planning`                  | `20260506033858_add_meal_planning`                  |
| `0006_pointtransaction_unique_task_award` | `20260507135533_pointtransaction_unique_task_award` |

Migrations 0001–0004 all landed in the same commit (`7f97d3c`, 2026-05-02
05:24:05 UTC). Their timestamps are incremented by 1s each to maintain strictly
ascending order on disk.

## Changes

### `scripts/check-migration-naming.mjs`

- Change `MIGRATION_NAME_PATTERN` to `^[0-9]{14}_[a-z0-9]+(?:_[a-z0-9]+)*$`
- Remove sequential prefix check (gaps are now normal)
- Add duplicate 14-digit prefix detection (catches same-second collisions and
  hand-typed duplicates)

### `scripts/__tests__/check-migration-naming.test.ts`

Full test rewrite to match new pattern:

- Pattern accepts `20260427120000_initial` and rejects `0001_initial`
- `validateMigrationNames` accepts ascending-but-non-sequential timestamps
- `validateMigrationNames` rejects duplicate timestamps
- On-disk regression test (scans real `prisma/migrations/`) passes

### `prisma/migrations/`

Six `git mv` renames; migration SQL contents unchanged.

### `docs/database.md`

- Replace `NNNN_snake_case` convention section with `YYYYMMDDHHMMSS_snake_case`
- Remove the "rename ritual" section (no longer needed — accept Prisma's default)
- Document `_prisma_migrations` UPDATE SQL for deployed environments
- Explain drift check rationale

### `.github/workflows/main_nextjs-template-build.yml`

Update the "Validate Prisma migrations are up to date" step's leading comment
to describe the drift-check's role under concurrent schema edits (catching
two-branch merge conflicts where each branch is valid in isolation). The
existing `--to-schema prisma/schema.prisma` flag is retained — Prisma 7
removed the older `--to-schema-datamodel` form.

## Production `_prisma_migrations` SQL

For any environment that has already applied the old-named migrations, run
before deploying this PR:

```sql
UPDATE _prisma_migrations SET migration_name = '20260502052405_initial'                               WHERE migration_name = '0001_initial';
UPDATE _prisma_migrations SET migration_name = '20260502052406_add_scheduler_settings'                WHERE migration_name = '0002_add_scheduler_settings';
UPDATE _prisma_migrations SET migration_name = '20260502052407_unique_account_user_provider'          WHERE migration_name = '0003_unique_account_user_provider';
UPDATE _prisma_migrations SET migration_name = '20260502052408_add_calendar_settings'                 WHERE migration_name = '0004_add_calendar_settings';
UPDATE _prisma_migrations SET migration_name = '20260506033858_add_meal_planning'                     WHERE migration_name = '0005_add_meal_planning';
UPDATE _prisma_migrations SET migration_name = '20260507135533_pointtransaction_unique_task_award'    WHERE migration_name = '0006_pointtransaction_unique_task_award';
```

## Acceptance

- [x] `scripts/check-migration-naming.mjs` enforces `^[0-9]{14}_[a-z0-9_]+$` with duplicate-timestamp detection
- [x] All existing migrations renamed to timestamp form (six directories)
- [x] `pnpm db:migrate:check-names` exits 0
- [x] CI drift check retains `--to-schema` (Prisma 7 removed `--to-schema-datamodel`)
- [x] `docs/database.md` updated
- [x] Tests updated (unit + on-disk regression)
- [x] PR body documents per-row `_prisma_migrations` SQL
