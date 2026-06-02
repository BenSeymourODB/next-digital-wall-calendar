import { GoogleTokenRefreshError } from "./refresh-google-token";

export type RefreshErrorClassification = "terminal" | "transient";

/**
 * Thrown by the session-callback refresh path when the stored Google account
 * row has no refresh token at all. This is a permanent state — no amount of
 * retries can conjure a refresh token that was never stored — so the
 * classifier returns `terminal` and the session is invalidated.
 */
export class MissingRefreshTokenError extends Error {
  constructor() {
    super("No refresh token available");
    this.name = "MissingRefreshTokenError";
  }
}

/**
 * Thrown by the session-callback refresh path when the stored refresh token
 * cannot be decrypted (GCM auth-tag mismatch, unknown envelope version, key
 * rotation that hasn't propagated). This is a permanent state until the user
 * re-authenticates and a fresh token is written, so the classifier returns
 * `terminal`.
 */
export class RefreshTokenDecryptError extends Error {
  constructor() {
    super(
      "Failed to decrypt stored refresh token (possible key rotation or tampering)"
    );
    this.name = "RefreshTokenDecryptError";
  }
}

// Closed allow-list of Google OAuth error codes that mean "this refresh token
// is dead — re-auth is the only path forward". Everything else (network, rate
// limit, 5xx, decrypt failure, unknown error) is treated as transient so the
// next session callback can retry. See #315 for the failure mode this is
// defending against — any transient error silently forcing a 1-hour re-auth.
const TERMINAL_GOOGLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
  // Misconfiguration on our side — retrying with the same grant_type can never
  // succeed, so force re-auth rather than silently never refreshing.
  "unsupported_grant_type",
]);

/**
 * Classify an error thrown inside the session-callback refresh path as
 * `terminal` (genuine revocation / client misconfig / locally-permanent state
 * — session should be invalidated and the user re-authenticated) or
 * `transient` (network blip, rate limit, decrypt hiccup, unknown shape —
 * session should be left alone and the next callback should retry).
 *
 * Default is `transient`: a misclassification toward transient just delays a
 * forced re-auth by one callback cycle, but a misclassification toward
 * terminal dumps the user back to a sign-in screen — the exact failure mode
 * #315 fixes.
 */
export function classifyTokenRefreshError(
  err: unknown
): RefreshErrorClassification {
  // Internal sentinel errors: missing refresh-token row or undecryptable
  // ciphertext. Neither self-heals on retry; force re-auth.
  if (
    err instanceof MissingRefreshTokenError ||
    err instanceof RefreshTokenDecryptError
  ) {
    return "terminal";
  }

  if (err instanceof GoogleTokenRefreshError) {
    const body = err.body;
    if (
      body !== null &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error: unknown }).error === "string" &&
      TERMINAL_GOOGLE_ERROR_CODES.has((body as { error: string }).error)
    ) {
      return "terminal";
    }
    return "transient";
  }
  return "transient";
}
