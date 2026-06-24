# `/api/auth/refresh-token` through the singleflight queue (#285)

## Goal

PR #252 added an in-memory singleflight for the **session-callback** refresh path. The
**client-driven** endpoint `POST /api/auth/refresh-token` still bypasses it, so two
concurrent client-driven refreshes for the same user race: both POST to Google's
token endpoint, both pay the rate-limit cost, and either can return a stale token
to its caller if Google rotates the refresh token mid-flight.

This issue closes the gap.

## Acceptance criteria (from #285)

- [ ] Concurrent calls to `/api/auth/refresh-token` for the same user dedupe to a
      single upstream Google call.
- [ ] Failure modes (unknown token, revoked token) handled gracefully — current
      route behaviour preserved bit-for-bit.
- [ ] Unit tests cover concurrent + failure paths.

## Key choice — what to key the singleflight on

The issue body suggests "lookup userId from the incoming refresh token (DB or
token introspection)". I considered three options:

1. **DB lookup by encrypted-refresh-token** — encrypt the incoming plaintext,
   query `Account.refresh_token`, take `userId` as the key. Cost: a DB round-trip
   per refresh (currently the route has zero DB reads). Plus a new index on
   `Account.refresh_token` if the field isn't already indexed. Overkill for what's
   a dedup concern.
2. **Token introspection (Google `tokeninfo`)** — defeats the purpose; we'd
   double the Google call count rather than halve it.
3. **Hash-by-token (`sha256(refreshToken).hex`)** — same-token-⇒-same-user by
   construction, so the dedup semantic is identical to keying by userId. Zero DB
   reads. The hash is one-way, doesn't leak the token if accidentally logged, and
   has zero PII content. No schema change.

**Chosen: (3) hash-by-token.** It also leaves the two singleflight paths cleanly
separable: the session-callback wrapper continues to key by
`google:${providerAccountId}` because it owns DB-write state and needs to dedupe
per-account regardless of how the token shows up; the client-driven wrapper keys
by `sha256(refreshToken)` because it's stateless and the token IS the identity
the caller has.

## Architecture

```
                            ┌──────────────────────────────────────┐
                            │  src/lib/auth/                       │
                            │  token-refresh-singleflight.ts        │
                            │                                      │
session callback ─────────▶ │  getOrStartSessionRefresh  (existing)│
                            │    key: google:${providerAccountId}  │
                            │    wraps refreshGoogleSessionTokens… │
                            │    return RefreshOutcome             │
                            │                                      │
/api/auth/refresh-token  ─▶ │  getOrStartTokenRefresh   (NEW)      │
                            │    key: sha256(refreshToken)         │
                            │    wraps refreshGoogleAccessToken    │
                            │    return GoogleRefreshedTokens      │
                            │    rejections propagate              │
                            └──────────────────────────────────────┘
```

Two independent `Map<string, Promise<…>>`s in the same module. Each clears its
slot in `.finally()` so a hung or failed flight doesn't pin subsequent callers.

## Implementation

### `src/lib/auth/token-refresh-singleflight.ts`

Add alongside the existing session wrapper:

```ts
import { createHash } from "node:crypto";
import {
  type GoogleRefreshedTokens,
  refreshGoogleAccessToken as defaultRefreshGoogleAccessToken,
} from "./refresh-google-token";

const tokenInflight = new Map<string, Promise<GoogleRefreshedTokens>>();

export interface TokenRefreshDeps {
  refreshGoogleAccessToken?: (
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ) => Promise<GoogleRefreshedTokens>;
}

export function getOrStartTokenRefresh(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
  deps: TokenRefreshDeps = {}
): Promise<GoogleRefreshedTokens> {
  const key = createHash("sha256").update(refreshToken).digest("hex");
  const existing = tokenInflight.get(key);
  if (existing) return existing;

  const refresh = deps.refreshGoogleAccessToken ?? defaultRefreshGoogleAccessToken;
  const pending = refresh(refreshToken, clientId, clientSecret).finally(() => {
    tokenInflight.delete(key);
  });
  tokenInflight.set(key, pending);
  return pending;
}

export function __resetTokenRefreshSingleflightCache(): void {
  if (process.env.NODE_ENV === "production") return;
  tokenInflight.clear();
}
```

Design notes:

- `deps` is optional. Production callers (the route) pass nothing and pick up
  the real `refreshGoogleAccessToken`. Tests inject a mock.
- The wrapper does NOT classify errors — rejections propagate. The route's
  existing `catch (error)` block still owns the translation from
  `GoogleTokenRefreshError` → HTTP response.
- The slot purges on both success and failure so a transient outage doesn't pin
  the cache. Matches the session wrapper.
- Hash key uses `node:crypto`. The route already runs on the Node.js runtime
  (no `export const runtime = "edge"`).

### `src/app/api/auth/refresh-token/route.ts`

Two-line change. Replace the `refreshGoogleAccessToken` import with the new
wrapper:

```diff
-import {
-  GoogleTokenRefreshError,
-  refreshGoogleAccessToken,
-} from "@/lib/auth/refresh-google-token";
+import { GoogleTokenRefreshError } from "@/lib/auth/refresh-google-token";
+import { getOrStartTokenRefresh } from "@/lib/auth/token-refresh-singleflight";

-      const tokens = await refreshGoogleAccessToken(
+      const tokens = await getOrStartTokenRefresh(
         refreshToken,
         clientId,
         clientSecret
       );
```

All other behaviour — 400 on missing token, 500 on missing OAuth creds, 401 on
`invalid_grant`/`invalid_request`, `requiresReauth: true` envelope, logger
calls — stays bit-for-bit identical.

## Tests

### `src/lib/auth/__tests__/token-refresh-singleflight.test.ts`

A new `describe("getOrStartTokenRefresh (singleflight #285)")` block sibling
to the existing `getOrStartSessionRefresh` block. Mirror the established
gate/deferred pattern. Cases:

1. **Collapses 5 concurrent calls with the same refresh token onto one
   upstream call.** Gate the mock to hold the flight open until all five are
   issued.
2. **Does not collapse calls with distinct refresh tokens.** Three concurrent
   distinct tokens ⇒ three upstream calls (counted while the gate still holds
   them in-flight, proving true concurrency rather than serial purges).
3. **Delivers the same rejection to every concurrent awaiter on failure.**
   Five callers waiting on the same gated promise all see the same
   `GoogleTokenRefreshError` when it rejects.
4. **Releases the slot after success.** Two sequential (non-overlapping) calls
   each get their own upstream round-trip — the slot purges in `.finally()`.
5. **Releases the slot after a rejection.** First call rejects, second call
   succeeds, both round-trips counted.
6. **Releases the slot after a TimeoutError** — mirrors the #404 / session
   wrapper case to prove the same `.finally()` discipline.
7. **Test-only reset clears the cache.**

### `src/app/api/auth/__tests__/refresh-token.route.test.ts` (NEW)

Integration test for the route at the HTTP boundary. Existing tests for this
route don't appear to exist; the new test file is small but locks the contract:

1. **400 when `refreshToken` is missing** — route validation preserved.
2. **500 when OAuth env credentials are missing** — preserved.
3. **200 on success, returns Google's token envelope verbatim** — preserved,
   now flowing through the singleflight.
4. **401 + `requiresReauth: true` on `invalid_grant`** — preserved.
5. **Forwards Google's HTTP status on other refresh failures** — preserved.
6. **Two concurrent requests with the same refresh token dedupe to one upstream
   call** — the new behaviour. Asserts the mocked `refreshGoogleAccessToken` was
   called exactly once across two simultaneous `POST` invocations.

The route tests mock `@/lib/auth/refresh-google-token` (the bottom of the
import chain) so the singleflight wrapper still runs as production code.

## Out of scope (deferred — separate issues exist)

- **Cross-process dedupe.** The current and proposed singleflights are in-memory
  per Node process. Multi-instance deployments still race across processes; the
  cure is shared state (Redis lock, DB row-lock, etc.). Already tracked under
  **#286** ("feat(auth): cross-process token-refresh dedupe for multi-instance
  deployments"). PR body will link.
- **Idle-session timeout (other half of #216).** Parent issue stays open.

## Validation

`pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`. All four
must pass. No UI change ⇒ no Playwright in scope.

## Phases

Small enough for one commit, but for legibility I'll split into two:

1. `feat(auth): hash-keyed singleflight for /api/auth/refresh-token (#285)` —
   add `getOrStartTokenRefresh` + its unit tests + the two-line route swap.
2. `test(api/auth/refresh-token): lock route contract + dedupe behaviour
(#285)` — add the new route integration test.
