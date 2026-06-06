# Prevent Duplicate Google Accounts per User (Issue #61)

## Problem

A single `User` can end up with multiple `Account` rows for the same `provider = "google"` but different `providerAccountId`s. When that happens:

- `auth.ts` `session()` picks one via `findMany().then([0])`, which was consistently stale
- Every session triggered `TokenRefreshFailed` against the stale refresh token
- Users were stuck in a 401 / "session expired" loop

The Prisma schema has `@@unique([provider, providerAccountId])` but **no** `@@unique([userId, provider])`, so the NextAuth Prisma adapter is free to attach a second Google identity to an existing user when email-matching or cookie state produces a collision.

PR #48 applied a tactical `orderBy: { expires_at: "desc" }` fix. The _root cause_ (duplicate rows allowed at all) is still live. This PR addresses that.

## Scope

One-Google-account-per-user, enforced at two layers:

1. **Database** — `@@unique([userId, provider])` constraint (new migration).
2. **Application** — `signIn` callback guard that refuses to link a new Google `providerAccountId` onto a user that already has a `google` `Account` row with a _different_ `providerAccountId`.

**Explicitly out of scope** (per the issue's "Future Considerations"):

- Multi-Google-account-per-user support (would need smarter account selection UX/logic).
- Any change to the `session()` token-refresh path — the `orderBy` patch already handles the defense-in-depth case.

## Design

### Phase 1 — DB constraint + migration

`prisma/schema.prisma`:

```prisma
model Account {
  ...
  @@unique([provider, providerAccountId])
  @@unique([userId, provider])
}
```

New migration `prisma/migrations/0003_unique_account_user_provider/migration.sql`:

```sql
-- Enforce one account per (user, provider) to prevent stale duplicate OAuth links.
-- If this fails with a uniqueness violation, run the dedup query in
-- docs/nextauth-troubleshooting.md before retrying.
CREATE UNIQUE INDEX "Account_userId_provider_key" ON "Account"("userId", "provider");
```

Update `prisma/__tests__/migration-setup.test.ts` to cover the new migration + constraint.

### Phase 2 — `signIn` callback guard

Extract a pure helper `shouldAllowSignIn({ user, account, existingAccounts })` that takes:

- `user`: the incoming NextAuth user (may or may not have an `id` yet)
- `account`: incoming OAuth account (`provider`, `providerAccountId`, etc.)
- `existingAccounts`: accounts already in the DB for the incoming user

Return `{ allow: boolean, reason?: string }`.

Rules:

- If there is no existing user (fresh sign-up): allow.
- If the incoming account's `(provider, providerAccountId)` matches an existing row on the user: allow (same identity re-signing in).
- If the incoming account shares the provider with an existing row but differs on `providerAccountId`: **deny** — this is the bug from #61.
- Otherwise (different provider): allow.

Wire the helper into `callbacks.signIn` in `auth.ts`. On deny, log a `GoogleAccountLinkRejected` event and return `false` so NextAuth redirects to the error page.

Unit-test the helper exhaustively in `src/lib/auth/__tests__/sign-in-guard.test.ts`.

## Phases

1. Phase 1 — schema constraint + migration + migration-setup tests. Commit + push + open draft PR.
2. Phase 2 — `shouldAllowSignIn` helper + wiring + unit tests. Commit + push.
3. Finalize — full test suite, `pnpm lint:fix && pnpm format:fix && pnpm check-types`, mark PR ready, launch Sonnet reviewer.

## Risks / rollout

- If an existing prod DB has duplicates, the migration will fail. The issue body confirms that was manually cleaned up in PR #48. Migration SQL includes a comment pointing to the dedup path. Nothing fancier (no `DO $$ ... $$` dedup logic) because state is already clean and we don't want to silently destroy evidence.
- The guard returns `false` from `signIn`, which NextAuth maps to the `/auth/error` page. That's the correct UX — the user should investigate why their account is linked to a stranger's Google identity.
