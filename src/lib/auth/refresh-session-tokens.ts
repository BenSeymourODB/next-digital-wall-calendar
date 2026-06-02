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
      deps.logger.error(error as Error, {
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

    deps.logger.event("TokenRefreshed", { userId, success: true });
    return { kind: "refreshed" };
  } catch (error) {
    const classification = classifyTokenRefreshError(error);
    if (classification === "terminal") {
      deps.logger.error(error as Error, {
        context: "TokenRefreshFailed",
        userId,
      });
      return { kind: "terminal-error", error: error as Error };
    }
    deps.logger.error(error as Error, {
      context: "TokenRefreshTransientFailure",
      userId,
    });
    return { kind: "transient-error", error: error as Error };
  }
}
