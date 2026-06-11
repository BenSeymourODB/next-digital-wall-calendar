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
  const key = account.providerAccountId;
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
