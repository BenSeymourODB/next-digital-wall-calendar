# Token Refresh Singleflight Queue (#216 — slice 1 of 2)

> Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/216
> Branch: `claude/loving-faraday-8kblq`

## Scope

Issue #216 bundles two distinct workstreams:

1. **Concurrent token-refresh queue** — singleflight the Google OAuth refresh round-trip so two server requests with an expired access token result in **one** `oauth2.googleapis.com/token` call, not two.
2. **Idle session timeout** — sliding `maxAge`, user-settings toggle, 24/7 wall-display preserve mode.

This plan covers slice 1 only. Slice 2 is deferred to a follow-up issue.

## History — superseded by main's auth refactor

The original slice-1 design extracted a self-contained `src/lib/auth/token-refresh.ts` that owned the HTTP round-trip, the DB update, and the singleflight cache in one module. That module was reviewed and approved on 2026-05-04 (PR feedback addressed in `4657bfd`).

Between then and the 2026-06-06 rebase, `main` landed a substantial auth refactor:

- **#215** — refresh tokens are now encrypted at rest (`encryptToken` / `decryptToken` from `src/lib/crypto/token-cipher.ts`). Plaintext refresh-token writes are gone.
- **#315 / #348** — refresh errors are now classified as `terminal` vs `transient` (`src/lib/auth/refresh-error-classifier.ts`). Transient failures no longer dump the user to a sign-in screen for a network blip.
- **#217** — `fetchWithRetry` wraps the Google OAuth round-trip in `src/lib/auth/refresh-google-token.ts`.
- The session-callback path is now factored into:
  - `refresh-google-token.ts` — the HTTP layer (retry-aware).
  - `refresh-session-tokens.ts` — orchestration: decrypt → fetch → re-encrypt → DB write → classify-on-error.
  - `auth.ts` — thin: calls `refreshGoogleSessionTokensIfNeeded` and branches on the discriminated `RefreshOutcome`.

The original `token-refresh.ts` would now duplicate the HTTP layer **without** encryption support and **without** transient/terminal classification — i.e. it would regress two production-critical fixes. The right integration is to wrap singleflight **around** the new orchestration entry point.

## Final design — what actually lands

### Singleflight wrapper

`src/lib/auth/refresh-session-tokens.ts` exports a thin wrapper alongside the existing `refreshGoogleSessionTokensIfNeeded`:

```ts
const inflight = new Map<string, Promise<RefreshOutcome>>();

export function getOrStartSessionTokenRefresh(
  userId: string,
  account: GoogleAccountForRefresh,
  deps: RefreshSessionDeps
): Promise<RefreshOutcome> {
  const existing = inflight.get(userId);
  if (existing) return existing;
  const pending = refreshGoogleSessionTokensIfNeeded(userId, account, deps).finally(() =>
    inflight.delete(userId)
  );
  inflight.set(userId, pending);
  return pending;
}

export function __resetSessionTokenSingleflightCache(): void {
  if (process.env.NODE_ENV === "production") return;
  inflight.clear();
}
```

Key change from the original design: keyed by **`userId`** (string) rather than `provider:providerAccountId`. This app has one Google account per user, and the callers already have `userId` — keying by `userId` avoids the wrapper having to reach into `account.provider`/`account.providerAccountId` for cache identity.

### Why keep the singleflight layer separate from the orchestration

`refreshGoogleSessionTokensIfNeeded` is a pure function (every dependency injected, no module-level state). Singleflight introduces a module-level `Map` — collapsing it into the orchestration function would make `refreshGoogleSessionTokensIfNeeded` impure and would force its 200+ lines of test coverage to thread cache-state setup/teardown through every case. Keeping the wrapper a separate three-line export preserves the orchestration's purity and lets the singleflight tests focus on the cache contract only.

### Caller wiring

`src/lib/auth/auth.ts` calls `getOrStartSessionTokenRefresh(user.id, googleAccount, deps)` instead of `refreshGoogleSessionTokensIfNeeded(user.id, googleAccount, deps)`. No other call-site changes.

### Tests

`src/lib/auth/__tests__/refresh-session-tokens-singleflight.test.ts` — 7 unit tests covering the cache contract:

1. **5 concurrent same-userId calls → 1 refresh + 1 DB write** (acceptance criterion).
2. **Different userIds don't collapse** — 3 distinct userIds → 3 refreshes.
3. **Slot released after success** — sequential calls each trigger a fresh refresh.
4. **Slot released after transient failure** — first call rejects (network) → outcome `transient-error`; second call succeeds → outcome `refreshed`. Both refreshes ran.
5. **All concurrent awaiters see the same outcome** — when the in-flight refresh fails with a network error, all 5 awaiters receive `kind: "transient-error"`.
6. **No cache pollution on `null` refresh_token** — first call resolves with `terminal-error` (missing-token classifier); the `.finally()` purge still runs so a follow-up call with a valid account triggers a fresh refresh, not the cached terminal outcome.
7. **`not-expired` short-circuit** — a fresh account skips refresh and DB entirely.

The existing 12-case `session-callback.test.ts` continues to cover the orchestration semantics (decrypt → fetch → classify → re-encrypt → write); the singleflight tests don't re-test those paths.

## Files deleted

The earlier-iteration files are removed because their functionality is now duplicated (without encryption) by main's refactored modules:

- `src/lib/auth/token-refresh.ts`
- `src/lib/auth/__tests__/token-refresh.test.ts`

## Out of scope (deferred)

- Idle-session timeout (NextAuth `maxAge` sliding refresh + user-settings toggle + wall-display preserve mode). New follow-up issue or separate PR.
- Unifying `/api/auth/refresh-token`'s direct-from-client refresh with the singleflight queue. Tracked in #285.
- Cross-process refresh dedupe for multi-instance deployments (the current scope is explicitly process-local). Tracked in #286.

## Acceptance criteria → mapping

- ✅ "Refresh queue: integration test fires 5 concurrent expired-token requests and asserts exactly one Google OAuth refresh hits the network" → singleflight test #1.
- ✅ "No regression in single-request refresh path" → existing `session-callback.test.ts` continues to pass against the wrapped call.
- ⏸ "Idle expiration logs the user out after the configured timeout" → deferred.
- ⏸ "Wall-display mode (no idle expiration) is preserved via setting" → deferred.
