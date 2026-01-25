import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { auth } from "./auth";

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

  return googleAccount.access_token;
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

  return googleAccount;
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
