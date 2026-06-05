/**
 * Boot-time assertion that `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are
 * populated. Intended to be called once at server startup (from
 * `src/lib/auth/auth.ts` module init), so an env-var gap surfaces as an
 * immediate failure on `pnpm start` rather than as a per-session
 * `invalid_client` from Google — which the refresh-error classifier
 * (correctly) treats as terminal and force-logs the user out (#315, #379).
 *
 * Skipped during `next build` via the same `NEXT_PHASE !== "phase-production-build"`
 * guard that wraps `validateEncryptionKey()` — page-data collection runs
 * this module without runtime env vars and a throw would abort the build.
 */
export function validateGoogleOAuthEnv(): void {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  const missing: string[] = [];
  if (!clientId) missing.push("GOOGLE_CLIENT_ID");
  if (!clientSecret) missing.push("GOOGLE_CLIENT_SECRET");

  if (missing.length > 0) {
    throw new Error(
      `Missing required Google OAuth env var(s): ${missing.join(", ")}. ` +
        "Set these from your Google Cloud Console OAuth client " +
        "(https://console.cloud.google.com/apis/credentials). " +
        "Without them NextAuth registers the Google provider with " +
        "`undefined` credentials and Google returns `invalid_client` on " +
        "refresh, which the classifier treats as terminal and force-logs " +
        "the user out — see issues #315 / #379."
    );
  }
}
