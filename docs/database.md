# Database & Migration Workflow

This project uses **PostgreSQL** with **Prisma ORM** for database management.

## Quick Reference

```bash
pnpm db:migrate          # Create a new migration (development)
pnpm db:migrate:deploy   # Apply pending migrations (production)
pnpm db:migrate:reset    # Reset database and reapply all migrations
pnpm db:migrate:status   # Check migration status
```

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
3. **Commit** the migration file along with the schema change

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
```

This creates `prisma/migrations/<timestamp>_add_scheduler_interval/migration.sql`.

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

The CI pipeline validates that migrations are in sync with the schema. If you modify `prisma/schema.prisma` without creating a migration, CI will fail with:

```
Prisma migrations are out of date. Run 'pnpm db:migrate' to create a new migration.
```

## Migration Directory Structure

```
prisma/
├── schema.prisma                    # The Prisma schema (source of truth)
├── migrations/
│   ├── migration_lock.toml          # Provider lock file (do not edit)
│   ├── 0001_initial/
│   │   └── migration.sql            # Baseline migration
│   └── <timestamp>_<name>/
│       └── migration.sql            # Subsequent migrations
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
