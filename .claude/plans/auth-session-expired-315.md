# Auth: Session-expired-every-hour (#315) — Parts A + B

## Symptom

Authenticated users on a healthy device get `"Session expired. Please sign in again."` ~every hour. Internally, the encryption key cannot be resolved (`Cannot resolve token encryption key: set TOKEN_ENCRYPTION_KEY ... or NEXTAUTH_SECRET`), so `encryptToken()` throws inside the session-callback refresh path. The catch sets `session.error = "RefreshTokenError"` and every API route returns 401 + the user-visible string.

The user's `.env.local` follows the **NextAuth v5** idiom (`AUTH_SECRET`), but `src/lib/crypto/token-cipher.ts:resolveKey()` reads only `NEXTAUTH_SECRET`. The dev fallback is silently bypassed.

## Scope of this PR

- **Part A** — make missing/misconfigured encryption key a fail-fast configuration error, surface `AUTH_SECRET` as a recognised dev-fallback source.
- **Part B** — distinguish transient from terminal refresh failures so the session is not invalidated for an encrypt failure or a network blip.

**Deferred** (follow-up issues):

- Part C — Prisma schema change for `consecutive_refresh_failures` + exponential backoff + grace window.
- Part D — `/api/health/auth` operator endpoint + AccountManager admin banner.

## Files touched

| File                                                            | Change                                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/crypto/token-cipher.ts`                                | `resolveKey()` accepts `AUTH_SECRET` alongside `NEXTAUTH_SECRET`; error messages enumerate all accepted vars; export `validateEncryptionKey()`       |
| `src/lib/crypto/__tests__/token-cipher.test.ts`                 | Tests for `AUTH_SECRET` fallback, error message wording, `validateEncryptionKey()`                                                                   |
| `src/lib/auth/auth.ts`                                          | Eager `validateEncryptionKey()` call at module init; session-callback uses `classifyTokenRefreshError()` to gate `RefreshTokenError`                 |
| `src/lib/auth/refresh-error-classifier.ts` (new)                | `classifyTokenRefreshError(err)` returns `'terminal' \| 'transient'`; terminal only on Google `invalid_grant`/`invalid_client`/`unauthorized_client` |
| `src/lib/auth/__tests__/refresh-error-classifier.test.ts` (new) | Unit tests for each error class                                                                                                                      |
| `src/lib/auth/__tests__/session-callback.test.ts` (new)         | Wraps the session-callback logic so terminal vs transient paths can be asserted directly                                                             |
| `.env.local.example`                                            | Documents `AUTH_SECRET` and `TOKEN_ENCRYPTION_KEY` (currently missing)                                                                               |

## TDD plan

### Phase 1

1. **Test:** `resolveKey` returns a 32-byte buffer when only `AUTH_SECRET` is set (NEXTAUTH_SECRET unset, NODE_ENV != production).
2. **Test:** `resolveKey` prefers `TOKEN_ENCRYPTION_KEY` over both fallbacks when all three are set.
3. **Test:** error message in non-production with neither `AUTH_SECRET` nor `NEXTAUTH_SECRET` set mentions `AUTH_SECRET`.
4. **Test:** `validateEncryptionKey()` returns silently when key is resolvable, throws when not.
5. **Implement** the changes in `token-cipher.ts`.
6. **Test:** `auth.ts` module fails to load when no key is configured (we wire this via an init call that throws).
7. **Implement** the eager call from `auth.ts`.
8. **Update** `.env.local.example` to document `AUTH_SECRET`.

### Phase 2

1. **Tests** (`refresh-error-classifier.test.ts`):
   - `GoogleTokenRefreshError` with body `error: "invalid_grant"` → `terminal`.
   - `GoogleTokenRefreshError` with body `error: "invalid_client"` → `terminal`.
   - `GoogleTokenRefreshError` with body `error: "unauthorized_client"` → `terminal`.
   - `GoogleTokenRefreshError` with body `error: "rate_limit_exceeded"` → `transient`.
   - `GoogleTokenRefreshError` with status 5xx and unknown body → `transient`.
   - Generic `TypeError` (network) → `transient`.
   - `Error("Failed to decrypt stored refresh token...")` → `transient`.
2. **Tests** (`session-callback.test.ts`): extract the inner refresh logic into a pure function so we can drive it with mocked `prisma`, `refreshGoogleAccessToken`, `encryptToken`, and assert `session.error` on each path.
3. **Implement** classifier + refactor of `auth.ts` session callback.

## Acceptance

- All existing tests still pass.
- New tests cover both phases.
- `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` clean.
- Manual: with `AUTH_SECRET` set and `TOKEN_ENCRYPTION_KEY` unset, app boots and tokens encrypt/decrypt round-trip. With both unset in dev, `auth.ts` module load throws a clear error referencing `AUTH_SECRET`.
- PR body documents the deferred follow-up issues for Parts C and D.
