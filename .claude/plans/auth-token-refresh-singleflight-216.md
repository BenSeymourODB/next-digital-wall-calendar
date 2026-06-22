# Plan: Singleflight Google OAuth token-refresh (#216)

## Context

Two concurrent NextAuth `session` callbacks for the same Google account with an
expired access token both race the refresh path: each decrypts the stored
refresh token, each POSTs to `oauth2.googleapis.com/token`, and each calls
`prisma.account.update`. The second `update()` clobbers the first. If Google
rotates the refresh token on refresh, only one of the two new ciphertexts wins
the write and the loser is left holding a stale token — surfacing later as a
bogus `RefreshTokenError` and an unnecessary re-sign-in.

Issue #216's first acceptance criterion: **5 concurrent expired-token requests →
exactly one OAuth refresh hits the network (and one DB write).**

## History — why this is a thin wrapper, not a replacement

The original 2026-05-03 design (PR #252) extracted a self-contained
`token-refresh.ts` owning the HTTP round-trip, the DB update, and the cache in
one module. While that PR was open, `main` landed a substantial auth refactor:

- **#215** — refresh tokens encrypted at rest (`crypto/token-cipher.ts`).
- **#315 / #348** — refresh errors classified `terminal` vs `transient`
  (`refresh-error-classifier.ts`), with the session-callback path factored into
  `refresh-session-tokens.ts` returning a `RefreshOutcome` discriminated union.
- **#217** — `fetchWithRetry` wrapping the OAuth round-trip
  (`refresh-google-token.ts`).

Replaying the original module on current `main` would silently regress
encryption-at-rest and terminal/transient classification. PR #252 was therefore
**closed as architecturally superseded** (per its in-depth review,
`pullrequestreview-4453877881`), and the singleflight concept reimplemented as a
thin wrapper around the existing `refreshGoogleSessionTokensIfNeeded` rather
than a replacement for it. The underlying race is still real on `main` — the
orchestrator has no concurrent-call de-duplication — so the work is still
wanted.

## Design

### `src/lib/auth/token-refresh-singleflight.ts`

A module-level `Map<string, Promise<RefreshOutcome>>` keyed by
`account.providerAccountId`. `getOrStartSessionRefresh(userId, account, deps)`:

- returns the in-flight promise if one exists for the key (collapse);
- otherwise calls `refreshGoogleSessionTokensIfNeeded(userId, account, deps)`,
  attaches a `.finally()` that purges the slot, stores the pending promise, and
  returns it.

The slot is purged on **both** success and failure so a transient outage never
pins it; the next caller can retry. Because the orchestrator resolves (rather
than rejects) for terminal/transient outcomes, those clear the slot too.

A `__resetSessionRefreshSingleflightCache()` helper (NODE_ENV-gated to a no-op
in production) clears the cache for test isolation.

### `src/lib/auth/auth.ts`

Single-line swap in the `session` callback:
`await refreshGoogleSessionTokensIfNeeded(...)` →
`await getOrStartSessionRefresh(...)`. All decrypt → fetch → re-encrypt → DB
write → classify behaviour and the terminal-error `session.error` handling are
preserved unchanged.

## Tests — `src/lib/auth/__tests__/token-refresh-singleflight.test.ts`

1. 5 concurrent same-account calls → exactly 1 refresh + 1 DB write.
2. 3 distinct `providerAccountId`s → 3 refreshes (different keys don't collapse).
3. All concurrent awaiters see the same outcome on a transient rejection.
4. Slot released after success → a later call refreshes again.
5. Slot released after a transient failure → next call retries and succeeds.
6. `null` refresh_token → `terminal-error`; cache still purges so a follow-up
   valid call refreshes (no pollution).
7. `TokenRefreshed` telemetry fires exactly once for collapsed callers.
8. Refresh error is logged exactly once for collapsed callers.

Plus a `not-expired` short-circuit guard (no network round-trip).

Concurrency is forced with a deferred promise so all callers overlap on the
same cache slot before any resolves.

## Out of scope (tracked separately)

- Idle-session timeout (sliding `maxAge`, wall-display preserve mode) — #216
  stays open to track that half.
- Unifying `/api/auth/refresh-token` with the singleflight queue — #285.
- Cross-process refresh dedupe for multi-instance deployments — #286.

## Verification

`pnpm test:run src/lib/auth/__tests__/`, then
`pnpm lint:fix && pnpm format:fix && pnpm check-types`.
