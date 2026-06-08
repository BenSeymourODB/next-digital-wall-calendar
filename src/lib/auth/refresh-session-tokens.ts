import type { Properties } from "@/lib/logger";
import {
  MissingRefreshTokenError,
  RefreshTokenDecryptError,
  classifyTokenRefreshError,
} from "./refresh-error-classifier";
import type { GoogleRefreshedTokens } from "./refresh-google-token";

/**
 * Minimal Google-Account row shape this module needs. Kept narrower than the
 * full Prisma model so unit tests don't have to construct every field.
 */
export interface GoogleAccountForRefresh {
  providerAccountId: string;
  refresh_token: string | null;
  expires_at: number | null;
}

export interface RefreshSessionLogger {
  error: (err: Error, properties?: Properties) => void;
  event: (name: string, properties?: Properties) => void;
}

export interface RefreshSessionPrisma {
  account: {
    update: (args: {
      data: {
        access_token: string | null;
        expires_at: number;
        refresh_token: string | null;
      };
      where: {
        provider_providerAccountId: {
          provider: "google";
          providerAccountId: string;
        };
      };
    }) => Promise<unknown>;
  };
}

export interface RefreshSessionDeps {
  prisma: RefreshSessionPrisma;
  refreshGoogleAccessToken: (
    refreshToken: string,
    clientId: string,
    clientSecret: string
  ) => Promise<GoogleRefreshedTokens>;
  // Signatures match the production `encryptToken` / `decryptToken` exactly so
  // production deps can be passed without coercion. Nullish inputs/outputs are
  // possible in principle; this module only ever passes / accepts strings.
  encryptToken: (plaintext: string | null | undefined) => string | null;
  decryptToken: (envelope: string | null | undefined) => string | null;
  logger: RefreshSessionLogger;
  googleClientId: string;
  googleClientSecret: string;
  now?: () => number;
}

export type RefreshOutcome =
  | { kind: "not-expired" }
  | { kind: "refreshed" }
  | { kind: "terminal-error"; error: Error }
  | { kind: "transient-error"; error: Error };

/**
 * Pure function form of the session-callback refresh path (#315 Part B).
 * Returns a discriminated `RefreshOutcome` so the caller (NextAuth `session`
 * callback) can decide whether to set `session.error = "RefreshTokenError"`
 * without owning the classification logic itself.
 *
 * The outer try/catch routes every thrown error through
 * `classifyTokenRefreshError`:
 *
 * - terminal → caller forces re-auth (legacy behaviour, intended for genuine
 *   revocation, missing refresh token, undecryptable ciphertext, terminal
 *   Google error codes).
 * - transient → caller leaves the session untouched so the next callback
 *   retries. The upstream API routes continue to serve cached data via the
 *   IndexedDB fallback during the outage rather than dumping the user to a
 *   sign-in screen for a network blip.
 */
export async function refreshGoogleSessionTokensIfNeeded(
  userId: string,
  account: GoogleAccountForRefresh,
  deps: RefreshSessionDeps
): Promise<RefreshOutcome> {
  const now = deps.now ?? (() => Date.now());

  if (!account.expires_at || account.expires_at * 1000 >= now()) {
    return { kind: "not-expired" };
  }

  try {
    if (!account.refresh_token) {
      throw new MissingRefreshTokenError();
    }

    let refreshTokenPlaintext: string | null;
    try {
      refreshTokenPlaintext = deps.decryptToken(account.refresh_token);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      deps.logger.error(err, {
        context: "RefreshTokenDecryptFailed",
        userId,
      });
      throw new RefreshTokenDecryptError();
    }
    if (!refreshTokenPlaintext) {
      throw new MissingRefreshTokenError();
    }

    const newTokens = await deps.refreshGoogleAccessToken(
      refreshTokenPlaintext,
      deps.googleClientId,
      deps.googleClientSecret
    );

    // Google only returns a new refresh_token on the first consent or after
    // revocation; fall back to re-encrypting the existing plaintext token
    // when one isn't included in the response so we don't accidentally null
    // the column.
    await deps.prisma.account.update({
      data: {
        access_token: deps.encryptToken(newTokens.access_token),
        expires_at: Math.floor(now() / 1000 + newTokens.expires_in),
        refresh_token: deps.encryptToken(
          newTokens.refresh_token ?? refreshTokenPlaintext
        ),
      },
      where: {
        provider_providerAccountId: {
          provider: "google",
          providerAccountId: account.providerAccountId,
        },
      },
    });

    deps.logger.event("TokenRefreshed", { userId });
    return { kind: "refreshed" };
  } catch (error) {
    // Normalise once so `logger.error` (typed `error: Error`) always receives a
    // real Error even if a non-Error value ever propagates out of decrypt /
    // refresh / prisma. The classifier already safe-defaults non-Error inputs
    // to "transient"; this just guarantees `.message`/`.stack` aren't undefined.
    const err = error instanceof Error ? error : new Error(String(error));
    const classification = classifyTokenRefreshError(err);
    if (classification === "terminal") {
      deps.logger.error(err, {
        context: "TokenRefreshFailed",
        userId,
      });
      return { kind: "terminal-error", error: err };
    }
    deps.logger.error(err, {
      context: "TokenRefreshTransientFailure",
      userId,
    });
    return { kind: "transient-error", error: err };
  }
}

// Per-user singleflight cache. Concurrent `session` callbacks for the same
// user share the same in-flight refresh promise so only one Google OAuth
// round-trip and one `prisma.account.update` happen per stale token, no
// matter how many requests fan in. Keyed by `userId` (one Google account per
// user in this app); the cache slot is purged in `.finally()` so transient
// failures don't pin the slot and the next callback can retry.
//
// This is the second half of issue #216's refresh-queue work — paired with
// the transient/terminal classifier from #315.
const inflight = new Map<string, Promise<RefreshOutcome>>();

/**
 * Singleflight wrapper around {@link refreshGoogleSessionTokensIfNeeded}.
 *
 * Multiple concurrent `session` callbacks for the same `userId` share the
 * same in-flight refresh promise so exactly one OAuth round-trip and exactly
 * one DB write occur per stale token. Without this, two concurrent
 * `session()` invocations both call `oauth2.googleapis.com/token` and both
 * `prisma.account.update()` — the second `prisma` write clobbers the first,
 * and the loser's rejected refresh-token can surface as a bogus
 * `RefreshTokenError` even though the winner just succeeded.
 *
 * Process-local only: the in-memory map does not survive a restart and is
 * not shared across instances. Cross-process dedupe is tracked in #286.
 */
export function getOrStartSessionTokenRefresh(
  userId: string,
  account: GoogleAccountForRefresh,
  deps: RefreshSessionDeps
): Promise<RefreshOutcome> {
  const existing = inflight.get(userId);
  if (existing) {
    return existing;
  }
  const pending = refreshGoogleSessionTokensIfNeeded(
    userId,
    account,
    deps
  ).finally(() => {
    inflight.delete(userId);
  });
  inflight.set(userId, pending);
  return pending;
}

/**
 * Test-only helper to clear the singleflight cache between tests. Gated on
 * `NODE_ENV` so an accidental production call is a no-op rather than wiping
 * the in-flight map mid-refresh.
 */
export function __resetSessionTokenSingleflightCache(): void {
  if (process.env.NODE_ENV === "production") return;
  inflight.clear();
}
