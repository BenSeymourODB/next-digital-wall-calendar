/**
 * Google OAuth refresh-token grant helper.
 *
 * Extracted from the NextAuth `session` callback in `auth.ts` so the actual
 * `fetch` call is a discrete, testable surface — and so the call site can
 * pick up `fetchWithRetry`'s transient-failure handling (#217). Behaviour is
 * unchanged for callers: tokens come back on success, the parsed error
 * envelope is thrown on a non-OK response (wrapped in
 * {@link GoogleTokenRefreshError} so the upstream HTTP status survives),
 * and Google's "no new refresh token" rotation policy is left untouched
 * (callers fall back to the existing plaintext refresh token).
 */
import { fetchWithRetry } from "@/lib/http/retry";

export const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";

export interface GoogleRefreshedTokens {
  access_token: string;
  expires_in: number;
  /** Google only returns a new refresh_token on first consent or revocation. */
  refresh_token?: string;
  scope?: string;
  token_type?: string;
}

/**
 * Thrown by {@link refreshGoogleAccessToken} on a non-OK response from
 * Google's token endpoint. Carries both the upstream status (so server-side
 * routes can forward it to clients) and the parsed JSON body (so callers
 * can branch on `error: "invalid_grant"` etc. without re-reading the body).
 */
export class GoogleTokenRefreshError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    super(`Google token refresh failed: HTTP ${status}`);
    this.name = "GoogleTokenRefreshError";
    this.status = status;
    this.body = body;
  }
}

/**
 * Exchange a long-lived refresh token for a fresh access token.
 *
 * Throws {@link GoogleTokenRefreshError} on non-OK responses; transient
 * 5xx / 429 / network failures are retried by {@link fetchWithRetry} before
 * reaching the throw.
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
    throw new GoogleTokenRefreshError(response.status, tokensOrError);
  }

  return tokensOrError as GoogleRefreshedTokens;
}
