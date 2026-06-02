import { GoogleTokenRefreshError } from "./refresh-google-token";

export type RefreshErrorClassification = "terminal" | "transient";

// Closed allow-list of Google OAuth error codes that mean "this refresh token
// is dead — re-auth is the only path forward". Everything else (network, rate
// limit, 5xx, decrypt failure, unknown error) is treated as transient so the
// next session callback can retry. See #315 for the failure mode this is
// defending against — any transient error silently forcing a 1-hour re-auth.
const TERMINAL_GOOGLE_ERROR_CODES: ReadonlySet<string> = new Set([
  "invalid_grant",
  "invalid_client",
  "unauthorized_client",
]);

/**
 * Classify an error thrown inside the session-callback refresh path as
 * `terminal` (genuine revocation / client misconfig — session should be
 * invalidated and the user re-authenticated) or `transient` (network blip,
 * rate limit, decrypt hiccup, unknown shape — session should be left alone
 * and the next callback should retry).
 *
 * Default is `transient`: a misclassification toward transient just delays a
 * forced re-auth by one callback cycle, but a misclassification toward
 * terminal dumps the user back to a sign-in screen — the exact failure mode
 * #315 fixes.
 */
export function classifyTokenRefreshError(
  err: unknown
): RefreshErrorClassification {
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
