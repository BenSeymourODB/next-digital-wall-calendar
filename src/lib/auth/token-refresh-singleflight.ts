import { createHash } from "node:crypto";
import {
  type GoogleRefreshedTokens,
  refreshGoogleAccessToken as defaultRefreshGoogleAccessToken,
} from "./refresh-google-token";
import {
  type GoogleAccountForRefresh,
  type RefreshOutcome,
  type RefreshSessionDeps,
  refreshGoogleSessionTokensIfNeeded,
} from "./refresh-session-tokens";

/**
 * Per-account singleflight cache for the session-callback refresh path (#216).
 *
 * Two concurrent `auth()` invocations on an expired access token otherwise
 * race: both decrypt the same refresh token, both POST to Google's token
 * endpoint, and both `prisma.account.update` — the second clobbering the
 * first. If Google rotates the refresh token, only one of the two new
 * ciphertexts wins the write and the loser is left holding a stale token.
 *
 * This wrapper collapses concurrent callers for the same account onto a single
 * in-flight promise so exactly one OAuth round-trip and one DB write happen per
 * stale token, regardless of how many concurrent requests trigger it.
 *
 * It is a thin layer over `refreshGoogleSessionTokensIfNeeded` — all of the
 * decrypt → refresh → re-encrypt → DB-write → classify behaviour (and the
 * transient/terminal `RefreshOutcome` union the session callback branches on)
 * lives in that orchestrator, unchanged. This module only adds de-duplication.
 */
const inflight = new Map<string, Promise<RefreshOutcome>>();

export function getOrStartSessionRefresh(
  userId: string,
  account: GoogleAccountForRefresh,
  deps: RefreshSessionDeps
): Promise<RefreshOutcome> {
  // Prefix with the provider. The `Account` table's unique constraint is on
  // `(provider, providerAccountId)`, not on `providerAccountId` alone — two
  // numerically identical IDs across different OAuth providers (none today,
  // app is Google-only, but defensive against future provider additions or
  // accidental re-use of this module from another wrapper) must not share an
  // in-flight slot. Hardcoded literal because this module wraps the
  // Google-specific orchestrator `refreshGoogleSessionTokensIfNeeded`.
  const key = `google:${account.providerAccountId}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  // Purge the slot in `.finally()` so it clears on both success and failure —
  // a transient outage must not pin the slot, or the next caller could never
  // retry. Because `refreshGoogleSessionTokensIfNeeded` resolves (rather than
  // rejects) for terminal/transient outcomes, the slot also clears for those.
  const pending = refreshGoogleSessionTokensIfNeeded(
    userId,
    account,
    deps
  ).finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, pending);
  return pending;
}

/**
 * Test-only escape hatch to clear the module-level cache between cases.
 * NODE_ENV-gated so an accidental production call is a no-op.
 */
export function __resetSessionRefreshSingleflightCache(): void {
  if (process.env.NODE_ENV === "production") return;
  inflight.clear();
}

/**
 * Per-token singleflight cache for the client-driven `/api/auth/refresh-token`
 * endpoint (#285).
 *
 * The session-callback wrapper above runs inside `auth()` and owns the full
 * decrypt → refresh → re-encrypt → DB-write orchestration. The client-driven
 * endpoint is the other half of the refresh story: a client (browser tab,
 * native shell) sends a *plaintext* refresh token in the POST body and gets
 * fresh tokens back. The endpoint itself reads no DB rows and writes none —
 * it's a stateless proxy in front of Google's token endpoint.
 *
 * So this wrapper can't share the session wrapper's Map: the operation,
 * return type, and storage semantics differ. But the deduplication concern is
 * identical — two concurrent client-driven refreshes for the same user race
 * against Google's rate limit and, if Google rotates the refresh token
 * mid-flight, can return a stale token to one of the callers.
 *
 * Key choice: SHA-256 of the refresh token. Two requests with the same
 * refresh token are by construction for the same Google account, so the
 * dedup semantic is identical to keying on userId — without the DB lookup the
 * issue body considered. The hash is one-way (does not leak the token if
 * accidentally logged) and is bounded-length regardless of token format.
 *
 * Cross-process dedupe is out of scope here — it's a different problem with a
 * different solution (Redis lock, DB row-lock, etc.) and is tracked under
 * #286.
 */
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

  const refresh =
    deps.refreshGoogleAccessToken ?? defaultRefreshGoogleAccessToken;
  // Slot purges on both fulfilment and rejection — a transient Google outage
  // must not pin the cache, or the next caller would attach to a long-dead
  // promise and never see a fresh attempt. Errors are NOT classified here;
  // the route's existing `catch (error)` block continues to own the
  // `GoogleTokenRefreshError → HTTP response` translation.
  const pending = refresh(refreshToken, clientId, clientSecret).finally(() => {
    tokenInflight.delete(key);
  });
  tokenInflight.set(key, pending);
  return pending;
}

/**
 * Test-only escape hatch to clear the module-level cache between cases.
 * NODE_ENV-gated so an accidental production call is a no-op.
 */
export function __resetTokenRefreshSingleflightCache(): void {
  if (process.env.NODE_ENV === "production") return;
  tokenInflight.clear();
}
