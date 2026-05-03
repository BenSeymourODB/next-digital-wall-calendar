# Token Refresh Singleflight Queue (#216 — slice 1 of 2)

> Issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/216
> Branch: `claude/loving-faraday-8kblq`

## Scope

Issue #216 bundles two distinct workstreams:

1. **Concurrent token-refresh queue** — singleflight the Google OAuth refresh round-trip so two server requests with an expired access token result in **one** `oauth2.googleapis.com/token` call, not two.
2. **Idle session timeout** — sliding `maxAge`, user-settings toggle, 24/7 wall-display preserve mode.

This plan covers slice 1 only. Slice 2 is deferred to a follow-up issue (will be noted in the PR body).

## Why this slice first

- Pure server-side logic; no UI, no Prisma migration, no NextAuth config negotiation.
- High-confidence unit-test story: a `Map<string, Promise>` with a settle-then-purge contract is small and tractable.
- Removes a real production-data hazard (two concurrent updates to `Account.access_token` racing each other; the second clobbers the first and the rejected refresh-token races into a bogus `RefreshTokenError`).
- Independent of every in-flight PR; no merge conflicts.

## Current state on `main`

`src/lib/auth/auth.ts:42-104` — the NextAuth `session` callback inlines the refresh round-trip:

```ts
if (googleAccount.expires_at && googleAccount.expires_at * 1000 < Date.now()) {
  const response = await fetch("https://oauth2.googleapis.com/token", { ... });
  // ...
  await prisma.account.update({ ... });
}
```

There is no de-duplication. Concurrent `auth()` invocations both fire the fetch and both write to the DB.

`/api/auth/refresh-token/route.ts` is a separate, client-driven endpoint that takes a refresh token in the request body. Out of scope for this slice (different code path, no DB lookup, distinct caller story). Will note in PR body.

## Phase 1 — Extract + singleflight

### New module

`src/lib/auth/token-refresh.ts`

Exports:

- `type GoogleTokenAccount = Pick<Account, "providerAccountId" | "refresh_token" | "expires_at" | ...>` — minimal shape we need.
- `type TokenRefreshDeps = { fetch: typeof fetch; prisma: PrismaClient; logger: Logger; clientId: string; clientSecret: string; now?: () => number }` — injected so unit tests don't need a real network or DB.
- `refreshGoogleAccessToken(account, deps): Promise<RefreshedTokens>` — the actual round-trip + DB update.
- `getOrStartTokenRefresh(account, deps): Promise<RefreshedTokens>` — singleflight wrapper. Internal `Map<string, Promise<RefreshedTokens>>` keyed by `provider:providerAccountId`. Concurrent callers `await` the same in-flight promise. Cache entry is deleted in a `.finally()` so the next call after a settle (success **or** failure) starts a new refresh.
- `__resetTokenRefreshCache()` — test-only helper exported for cache cleanup between tests.

### Tests

`src/lib/auth/__tests__/token-refresh.test.ts`

Unit tests covering:

1. **Happy path** — `refreshGoogleAccessToken` posts the correct body to the Google endpoint and updates the DB row with the new tokens + expires_at.
2. **Network failure** — `refreshGoogleAccessToken` propagates the error and does not call `prisma.account.update`.
3. **Singleflight, same key** — 5 concurrent `getOrStartTokenRefresh` calls with the same key result in exactly **1** `fetch` call (THE acceptance-criterion test).
4. **Singleflight, different keys** — 5 concurrent calls split across two keys result in exactly **2** `fetch` calls.
5. **Failure clears cache** — after a refresh rejects, the next call triggers a new fetch (no permanent stickiness).
6. **Success clears cache** — after a refresh resolves, the next call triggers a new fetch (no stale memoisation past expiry).
7. **Missing refresh_token** — `refreshGoogleAccessToken` rejects synchronously; the cache is not polluted.
8. **All concurrent awaiters see the same rejection** — when the in-flight refresh fails, all 5 awaiters receive the same error.

## Phase 2 — Wire into the session callback

- Replace the inline refresh logic in `src/lib/auth/auth.ts` with a call to `getOrStartTokenRefresh()`.
- Inject `fetch`, `prisma`, `logger`, env vars at call-site (or via a tiny default-deps helper).
- Preserve all existing semantics:
  - Same `RefreshTokenError` surfacing on failure.
  - Same `TokenRefreshed` log event on success.
  - Same DB update shape.
- Update `src/lib/auth/__tests__/helpers.test.ts` if any session-callback paths are touched (likely none — helpers tests mock `auth` directly).

## Out of scope (deferred)

- Idle-session timeout (NextAuth `maxAge` sliding refresh + user-settings toggle + wall-display preserve mode). New follow-up issue or separate PR on the same #216 thread.
- Unifying `/api/auth/refresh-token`'s direct-from-client refresh with the singleflight queue. Would require routing every refresh through a userId lookup; doable but a bigger refactor.
- Persistence of the singleflight cache across processes (multi-instance deployments). The current scope says "Survives the lifetime of a single Node process (in-memory Map keyed by user id)" — explicit guidance.

## Acceptance criteria → mapping

- ✅ "Refresh queue: integration test fires 5 concurrent expired-token requests and asserts exactly one Google OAuth refresh hits the network" → Phase 1, test #3.
- ✅ "No regression in single-request refresh path" → Phase 1, test #1; Phase 2 preserves existing semantics; existing helper tests stay green.
- ⏸ "Idle expiration logs the user out after the configured timeout" → deferred.
- ⏸ "Wall-display mode (no idle expiration) is preserved via setting" → deferred.

## Test-driven order

1. Write `token-refresh.test.ts` with all 8 cases — they all fail (module doesn't exist).
2. Implement `token-refresh.ts` to satisfy each test, simplest first.
3. Phase-1 commit + push + draft PR.
4. Wire the new module into `auth.ts`.
5. Run full `pnpm test:run`; confirm no regressions in `helpers.test.ts` or any API route tests that touch auth.
6. Phase-2 commit + push.
7. Mark PR ready, run review subagent, address feedback.
