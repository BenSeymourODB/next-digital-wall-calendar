import { decryptToken } from "@/lib/crypto/token-cipher";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { auth } from "./auth";

type AccountRow = Awaited<ReturnType<typeof prisma.account.findFirst>>;

/**
 * Return an Account clone whose `access_token`, `refresh_token`, and
 * `id_token` have been decrypted. Legacy plaintext values pass through
 * unchanged (see `decryptToken`).
 */
function decryptAccountTokens<T extends NonNullable<AccountRow>>(
  account: T
): T {
  return {
    ...account,
    access_token: decryptToken(account.access_token),
    refresh_token: decryptToken(account.refresh_token),
    id_token: decryptToken(account.id_token),
  };
}

/**
 * Google OAuth scope required to read or write Google Tasks. The same string
 * is requested at sign-in (see `auth.ts`); centralised here so callers can
 * verify it against the user's stored grant before hitting the upstream API.
 */
export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";

/**
 * Test whether the stored OAuth grant on `account` includes `scope` as a
 * complete token. Splits on any combination of whitespace, `+`, or `,` —
 * Google's spec uses spaces, the authorisation URL uses `+`-encoded spaces,
 * and a manual DB seed or legacy adapter version may have stored a
 * comma-delimited grant. Whole-token matching (rather than substring) keeps
 * `tasks.readonly` from falsely satisfying a `tasks` check.
 */
export function accountHasScope(
  account: { scope?: string | null } | null | undefined,
  scope: string
): boolean {
  if (!account?.scope) return false;
  const granted = account.scope.split(/[\s,+]+/).filter(Boolean);
  return granted.includes(scope);
}

/**
 * Get the current user's session
 */
export async function getSession() {
  return await auth();
}

/**
 * Get access token for current user's Google account
 * Throws if no session or no access token available
 */
export async function getAccessToken(): Promise<string> {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new Error("Not authenticated");
  }

  if (session.error === "RefreshTokenError") {
    throw new Error("Failed to refresh access token. Please sign in again.");
  }

  // Get the Google account with access token
  const [googleAccount] = await prisma.account.findMany({
    where: { userId: session.user.id, provider: "google" },
  });

  if (!googleAccount?.access_token) {
    throw new Error("No Google account linked. Please sign in with Google.");
  }

  const plaintext = decryptToken(googleAccount.access_token);
  if (!plaintext) {
    throw new Error("No Google account linked. Please sign in with Google.");
  }
  return plaintext;
}

/**
 * Get current user from session
 * Throws if not authenticated
 */
export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error("Not authenticated");
  }

  return session.user;
}

/**
 * Require authentication - throws if not authenticated
 * Returns the session if authenticated
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw new Error("Not authenticated");
  }

  return session;
}

/**
 * Check if the current user is authenticated
 * Returns boolean without throwing
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return !!session?.user;
}

/**
 * Get the current user's Google account data
 * Useful for checking scopes, token expiry, etc.
 */
export async function getGoogleAccount() {
  const session = await getSession();

  if (!session?.user?.id) {
    return null;
  }

  const [googleAccount] = await prisma.account.findMany({
    where: { userId: session.user.id, provider: "google" },
  });

  if (!googleAccount) {
    return googleAccount;
  }

  return decryptAccountTokens(googleAccount);
}

/**
 * Check if the user needs to re-authenticate
 * (e.g., refresh token failed)
 */
export async function needsReauthentication(): Promise<boolean> {
  const session = await getSession();
  return session?.error === "RefreshTokenError";
}

/**
 * Wrapper for API route handlers that require authentication
 * Returns 401 if not authenticated
 */
export async function withAuth<T>(
  handler: (userId: string, accessToken: string) => Promise<T>
): Promise<T> {
  const session = await getSession();

  if (!session?.user?.id) {
    throw new AuthError("Not authenticated", 401);
  }

  if (session.error === "RefreshTokenError") {
    throw new AuthError("Session expired. Please sign in again.", 401);
  }

  try {
    const accessToken = await getAccessToken();
    return await handler(session.user.id, accessToken);
  } catch (error) {
    logger.error(error as Error, {
      context: "withAuth",
      userId: session.user.id,
    });
    throw error;
  }
}

/**
 * Asserts that the user's *stored* Google OAuth grant string includes the
 * Tasks scope. Throws `AuthError(401)` if the user is not signed in or the
 * session is in `RefreshTokenError`, and `AuthError(403)` if the scope is
 * missing — the 403 is the signal API routes use to return
 * `requiresReauth: true`.
 *
 * Caveat: this is a check against the persisted grant, not a guarantee the
 * live access token still carries that scope. Google can issue a narrower
 * token on refresh after a user revokes scopes from their Google account
 * settings; the stored `scope` field does not reflect that. Routes still
 * need to handle upstream `GoogleTasksApiError(403)` as a fallback.
 */
export async function assertGoogleTasksScope(): Promise<void> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new AuthError("Not authenticated", 401);
  }
  if (session.error === "RefreshTokenError") {
    throw new AuthError("Session expired. Please sign in again.", 401);
  }

  const account = await getGoogleAccount();
  if (!account) {
    throw new AuthError("No Google account linked.", 401);
  }

  if (!accountHasScope(account, GOOGLE_TASKS_SCOPE)) {
    throw new AuthError(
      "Re-authentication required: Google Tasks scope missing.",
      403
    );
  }
}

/**
 * Custom error class for auth-related errors
 */
export class AuthError extends Error {
  status: number;

  constructor(message: string, status: number = 401) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
