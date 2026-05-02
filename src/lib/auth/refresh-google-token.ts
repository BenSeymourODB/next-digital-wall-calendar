/**
 * Google OAuth refresh-token grant helper.
 *
 * Extracted from the NextAuth `session` callback in `auth.ts` so the actual
 * `fetch` call is a discrete, testable surface — and so the call site can
 * pick up `fetchWithRetry`'s transient-failure handling (#217). Behaviour is
 * unchanged for callers: tokens come back on success, the parsed error
 * envelope is thrown on a non-OK response, and Google's "no new refresh
 * token" rotation policy is left untouched (callers fall back to the
 * existing plaintext refresh token).
 */
import { fetchWithRetry } from "@/lib/http/retry";

export const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";

export interface GoogleRefreshedTokens {
  access_token: string;
  expires_in: number;
  /** Google only returns a new refresh_token on first consent or revocation. */
  refresh_token?: string;
}

/**
 * Exchange a long-lived refresh token for a fresh access token.
 *
 * Throws the parsed error body (matching the legacy `tokensOrError` throw
 * shape the session callback already catches) on a non-OK response.
 * Transient 5xx / 429 / network failures are retried by `fetchWithRetry`
 * before reaching this throw.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<GoogleRefreshedTokens> {
  const response = await fetchWithRetry(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  const tokensOrError = await response.json();

  if (!response.ok) {
    throw tokensOrError;
  }

  return tokensOrError as GoogleRefreshedTokens;
}
