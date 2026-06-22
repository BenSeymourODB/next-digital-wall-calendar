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
 *
 * On a 200 response the JSON body is validated against
 * {@link GoogleRefreshedTokensSchema} before returning. A malformed payload
 * (proxy rewrite, partial body, edge-case rate-limit JSON) is converted into
 * a `GoogleTokenRefreshError` with `body.error === "malformed_token_response"`
 * so the orchestrator's classifier treats it as transient — the alternative
 * is `expires_in` being `undefined`, `Math.floor(NaN)`, and a corrupted
 * `expires_at` column. See issue #405.
 */
import { fetchWithRetry } from "@/lib/http/retry";
import { z } from "zod";

export const GOOGLE_OAUTH_TOKEN_ENDPOINT =
  "https://oauth2.googleapis.com/token";

/**
 * Per-flight timeout for Google's OAuth token endpoint. 10 s is a generous
 * upper bound for a single `client_credentials`-shaped exchange; tune via
 * `GOOGLE_TOKEN_REFRESH_TIMEOUT_MS` if Google's tail latency shifts.
 *
 * Without this bound, a TCP connect that hangs with no RST would wait
 * forever inside `undici`'s default fetch and — under the #216 singleflight
 * — pin the in-flight slot for every concurrent caller until the Node
 * process restarts. See #404.
 */
export const DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS = 10_000;
const TIMEOUT_ENV_KEY = "GOOGLE_TOKEN_REFRESH_TIMEOUT_MS";

/**
 * Resolve the per-flight timeout in ms. Strict integer parsing: anything
 * fractional, non-numeric, zero, or negative falls back to the default so
 * a misconfigured env value can't accidentally configure a zero-budget
 * timeout that instantly aborts every refresh.
 */
export function getRefreshTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
): number {
  const raw = env[TIMEOUT_ENV_KEY];
  if (raw == null || !/^\d+$/.test(raw)) {
    return DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(raw, 10);
  if (parsed <= 0) return DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS;
  return parsed;
}

/**
 * Schema for the JSON body of a successful Google OAuth refresh-token grant
 * response. Only `access_token` and `expires_in` are strictly required for
 * the orchestrator to write a usable account row; `refresh_token` is omitted
 * on routine refreshes and the remaining fields are advisory metadata.
 */
export const GoogleRefreshedTokensSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

export type GoogleRefreshedTokens = z.infer<typeof GoogleRefreshedTokensSchema>;

/**
 * Thrown by {@link refreshGoogleAccessToken} on a non-OK response from
 * Google's token endpoint, or on a 200 whose body fails
 * {@link GoogleRefreshedTokensSchema}. Carries both the upstream status (so
 * server-side routes can forward it to clients) and the parsed JSON body /
 * synthetic envelope (so callers can branch on `error: "invalid_grant"` or
 * `"malformed_token_response"` without re-reading the body).
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
 * Throws {@link GoogleTokenRefreshError} on non-OK responses or on a 200
 * whose body doesn't match {@link GoogleRefreshedTokensSchema}; transient
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
    // Bound each fetch attempt with a per-flight timeout. On timeout, fetch
    // rejects with a DOMException(name="TimeoutError"); `isTransientHttpError`
    // treats that as NON-retryable (returns false) so the retry budget is
    // not burned hammering a hung endpoint, and `classifyTokenRefreshError`
    // then maps the error to outcome `transient` (not `terminal`) — the
    // singleflight slot releases in `.finally()` and the next caller starts
    // a fresh flight rather than the user being kicked to re-auth.
    //
    // Note on scope: the signal aborts active fetch calls but not
    // `withRetry`'s inter-attempt sleep — actual worst-case wall time on a
    // 503 → hang sequence is `timeout + one backoff` (~15 s with defaults).
    // Tightening that to the bare timeout is tracked in #434.
    signal: AbortSignal.timeout(getRefreshTimeoutMs()),
  });

  const rawBody: unknown = await response.json();

  if (!response.ok) {
    throw new GoogleTokenRefreshError(response.status, rawBody);
  }

  const parsed = GoogleRefreshedTokensSchema.safeParse(rawBody);
  if (!parsed.success) {
    // Scrub Zod's raw issues to a fixed shape — `received` / `input` fields on
    // some issue codes can echo the offending value verbatim, which would
    // surface in the orchestrator's `logger.error(err, ...)` if a future
    // schema tightening ever applies to a string-typed token field.
    throw new GoogleTokenRefreshError(response.status, {
      error: "malformed_token_response",
      issues: parsed.error.issues.map(({ code, path, message }) => ({
        code,
        path,
        message,
      })),
    });
  }
  return parsed.data;
}
