# Database & Migration Workflow

This project uses **PostgreSQL** with **Prisma ORM** for database management.

## Quick Reference

```bash
pnpm db:migrate              # Create a new migration (development)
pnpm db:migrate:deploy       # Apply pending migrations (production)
pnpm db:migrate:reset        # Reset database and reapply all migrations
pnpm db:migrate:status       # Check migration status
pnpm db:migrate:check-names  # Validate the NNNN_snake_case naming convention
```

## Migration Naming Convention

This project uses **sequential numeric prefixes** for migration directory names:

```
NNNN_snake_case_description
```

- `NNNN` — strictly increasing 4-digit prefix starting at `0001` (no gaps, no duplicates).
- `snake_case_description` — lowercase letters, digits, and underscores only.

Examples:

```
0001_initial
0002_add_scheduler_settings
0003_unique_account_user_provider
0004_add_calendar_settings
0005_add_meal_planning
```

### Why sequential, not Prisma's default timestamp prefix?

|                                         | Sequential `NNNN_`                             | Timestamp `YYYYMMDDHHMMSS_`              |
| --------------------------------------- | ---------------------------------------------- | ---------------------------------------- |
| Tidy ordering in code review            | ✓ aligned columns                              | ✗ wide column                            |
| Collision-free with concurrent PRs      | ✓ obvious next number; conflicts surface in CI | ✗ two PRs at the same minute can collide |
| Communicates ordering at a glance       | ✓ `0007` clearly follows `0006`                | ✗ requires reading the timestamp         |
| Matches Prisma's out-of-the-box default | ✗ requires explicit naming                     | ✓                                        |

Decision: trade the small friction of explicitly naming each new migration `NNNN_…` for the larger gains in review legibility and conflict avoidance.

### Enforcement

`pnpm db:migrate:check-names` (also wired into CI) validates that every entry under `prisma/migrations/` matches the convention and that prefixes are strictly sequential. Run it locally before pushing if you've added a migration.

### Renaming a freshly-created migration

When `pnpm db:migrate` prompts for a name, answer with the snake-case description only — `add_scheduler_settings`, not `0005_add_scheduler_settings`. Prisma still prepends a timestamp to the directory it creates on disk, and **also writes a row into the local `_prisma_migrations` table under the same timestamp name**. Renaming the directory only — without touching the DB row — leaves the two out of sync, and the next `pnpm db:migrate` run will fail with a "migration not found" / drift error.

The full rename ritual is:

```bash
# 1. Find the timestamp directory Prisma just created.
TIMESTAMP_DIR=$(ls -1d prisma/migrations/[0-9]*_add_scheduler_settings | head -1)
NEXT_PREFIX=$(printf "%04d" $(($(ls -1d prisma/migrations/[0-9]*/ | wc -l))))
NEW_NAME="${NEXT_PREFIX}_add_scheduler_settings"

# 2. Rename the directory.
mv "$TIMESTAMP_DIR" "prisma/migrations/$NEW_NAME"

# 3. Update the local _prisma_migrations row so Prisma still recognises it.
#    Either (a) rewrite the row in place:
psql "$DATABASE_URL" -c "UPDATE _prisma_migrations SET migration_name = '$NEW_NAME' \
  WHERE migration_name = '$(basename "$TIMESTAMP_DIR")';"

#    or (b) reset the local DB and re-apply from scratch — simplest in dev:
pnpm db:migrate:reset

# 4. Verify.
pnpm db:migrate:check-names
pnpm db:migrate:status
```

The check script rejects the timestamp form, so a forgotten rename fails CI. Production databases are not affected — `prisma migrate deploy` reads the renamed directory directly, and the `_prisma_migrations` row is created on first apply with the correct (renamed) value.

## Development Workflow

### Making Schema Changes

1. **Edit the schema** in `prisma/schema.prisma`
2. **Create a migration**:
   ```bash
   pnpm db:migrate
   ```
   Prisma will prompt you to name the migration (e.g., `add_scheduler_settings`). This:
   - Generates a SQL migration file in `prisma/migrations/`
   - Applies it to your local database
   - Regenerates the Prisma client
3. **Rename the migration directory** to the next sequential prefix (e.g. `0005_add_scheduler_settings/`) — see [Migration Naming Convention](#migration-naming-convention).
4. **Verify** the name with `pnpm db:migrate:check-names`.
5. **Commit** the migration file along with the schema change.

### Example: Adding a New Field

```prisma
// prisma/schema.prisma
model UserSettings {
  // ... existing fields
  schedulerInterval Int @default(30) // NEW: seconds between rotations
}
```

```bash
pnpm db:migrate
# Enter migration name: add_scheduler_interval
# Migration created and applied!

# Rename to the next sequential prefix (replace <NNNN> with the actual next
# number — check prisma/migrations/ or run pnpm db:migrate:check-names).
# Remember to also update the local _prisma_migrations row, or reset the
# dev DB. See "Renaming a freshly-created migration" above.
mv prisma/migrations/<timestamp>_add_scheduler_interval \
   prisma/migrations/<NNNN>_add_scheduler_interval

pnpm db:migrate:check-names  # Verify
```

## Production Deployment

Migrations run automatically on deployment via the startup script:

```bash
npx prisma migrate deploy
```

This applies any pending migrations that haven't been run on the production database. It never creates new migrations — it only applies existing ones from the `prisma/migrations/` directory.

### For Existing Databases

If you have an existing database that was set up with `prisma db push` (before migrations were adopted), you need to baseline it:

```bash
# Mark the initial migration as already applied
npx prisma migrate resolve --applied 0001_initial
```

This tells Prisma that the `0001_initial` migration has already been applied (since the tables already exist), and future migrations will proceed normally.

## CI Validation

The CI pipeline validates two things on every push:

1. **Schema-vs-migrations drift** — if you modify `prisma/schema.prisma` without creating a migration, CI fails with:
   ```
   Prisma migrations are out of date. Run 'pnpm db:migrate' to create a new migration.
   ```
2. **Naming convention** — `pnpm db:migrate:check-names` runs in CI and fails if any migration directory does not match `^[0-9]{4}_[a-z0-9_]+$` or if prefixes are not strictly sequential. See [Migration Naming Convention](#migration-naming-convention).

## Migration Directory Structure

```
prisma/
├── schema.prisma                    # The Prisma schema (source of truth)
├── migrations/
│   ├── migration_lock.toml          # Provider lock file (do not edit)
│   ├── 0001_initial/
│   │   └── migration.sql            # Baseline migration
│   └── NNNN_snake_case_description/
│       └── migration.sql            # Subsequent migrations (sequential prefix)
```

## Important Rules

1. **Never edit migration files** after they've been committed and shared
2. **Never delete migrations** that have been applied to any environment
3. **Always commit migration files** along with schema changes
4. **Use `prisma migrate dev`** for development (creates + applies migrations)
5. **Use `prisma migrate deploy`** for production (applies only, never creates)
6. **Don't use `prisma db push`** anymore — it bypasses the migration system

## Troubleshooting

### Migration Drift

If your local database gets out of sync:

```bash
pnpm db:migrate:reset   # Drops and recreates from all migrations
```

> **Warning:** This destroys all data. Only use in development.

### Failed Migration

If a migration fails partway through:

```bash
# Fix the issue, then mark it as rolled back
npx prisma migrate resolve --rolled-back <migration_name>

# Or fix the SQL and re-apply
npx prisma migrate resolve --applied <migration_name>
```

### Schema Drift Detection

To check if your database matches the expected state:

```bash
pnpm db:migrate:status
```
