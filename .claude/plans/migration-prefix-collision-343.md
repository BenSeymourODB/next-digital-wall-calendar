# Plan: Resolve duplicate `0005_*` migration prefix on `main` (#343)

## Problem

Two migrations on `main` share prefix `0005_`:

- `prisma/migrations/0005_add_meal_planning/` (PR #193, merged at `93f584d`)
- `prisma/migrations/0005_pointtransaction_unique_task_award/` (PR #198, merged at `8fc429e`)

`pnpm db:migrate:check-names` (run in CI by `Validate Prisma migrations`) fails on every PR because prefixes must be strictly sequential (no duplicates). This blocks every open PR.

## Fix

Rename the second-merged migration to `0006_`:

```
0005_pointtransaction_unique_task_award/  →  0006_pointtransaction_unique_task_award/
```

This preserves merge order (PR #193 first, PR #198 second) and matches the convention in `docs/database.md`.

## Risk & deploy mitigation

Renaming a migration directory is safe in dev (Prisma keys `_prisma_migrations` rows on the directory name; running `pnpm db:migrate:reset` re-applies cleanly). It is **not** safe in any environment that has already applied the old name, because Prisma will see the row as a stale name and treat the new name as pending.

For each environment that has already deployed `0005_pointtransaction_unique_task_award`, run **before** deploying the rename:

```sql
UPDATE _prisma_migrations
SET migration_name = '0006_pointtransaction_unique_task_award'
WHERE migration_name = '0005_pointtransaction_unique_task_award';
```

Document this in the PR body so any operator can do it in lockstep with the deploy.

## Tests (TDD)

The existing tests in `scripts/__tests__/check-migration-naming.test.ts` cover the pure function. They pass today because the function is correct — the failure is in the on-disk state. Add one more test that scans the actual `prisma/migrations/` directory and asserts zero errors. This test fails today (red) and will pass after the rename (green), giving a fast local signal next time someone introduces a duplicate.

## Acceptance

- [x] `0005_pointtransaction_unique_task_award` renamed to `0006_*`
- [x] Migration SQL inside is unchanged
- [x] `pnpm db:migrate:check-names` exits 0
- [x] New regression test passes
- [x] No other source references to the old name (verified)
- [x] PR body documents the `_prisma_migrations` rename SQL

## Out of scope

- Coordinating any actual production rename — that's an operator step at deploy time, not in this PR.
- Adding a CI hook for `_prisma_migrations` renames — over-engineered for a duplicate that should never recur with the new test in place.
