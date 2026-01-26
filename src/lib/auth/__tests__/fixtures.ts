/**
 * Test fixtures for authentication tests
 */
import type { Session } from "next-auth";

/**
 * Mock user data matching the Prisma User model
 */
export const mockUser = {
  id: "test-user-123",
  name: "Test User",
  email: "test@example.com",
  image: "https://example.com/avatar.jpg",
  emailVerified: new Date("2024-01-01T00:00:00Z"),
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

/**
 * Mock session with authenticated user
 */
export const mockSession: Session = {
  user: {
    id: mockUser.id,
    name: mockUser.name,
    email: mockUser.email,
    image: mockUser.image,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

/**
 * Mock session with RefreshTokenError
 */
export const mockSessionWithError: Session & { error: "RefreshTokenError" } = {
  user: {
    id: mockUser.id,
    name: mockUser.name,
    email: mockUser.email,
    image: mockUser.image,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  error: "RefreshTokenError",
};

/**
 * Mock Google account with valid tokens
 */
export const mockGoogleAccount = {
  id: "account-123",
  userId: mockUser.id,
  type: "oauth" as const,
  provider: "google",
  providerAccountId: "google-account-123",
  refresh_token: "mock-refresh-token",
  access_token: "mock-access-token",
  expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
  token_type: "Bearer",
  scope:
    "openid email profile https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks",
  id_token: "mock-id-token",
  session_state: null,
};

/**
 * Mock Google account with expired tokens
 */
export const mockExpiredGoogleAccount = {
  ...mockGoogleAccount,
  id: "expired-account-123",
  expires_at: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
};

/**
 * Mock Google account without access token
 */
export const mockGoogleAccountNoToken = {
  ...mockGoogleAccount,
  id: "no-token-account-123",
  access_token: null,
};

/**
 * Factory function to create custom mock sessions
 */
export function createMockSession(
  overrides: Partial<Session> & { error?: "RefreshTokenError" } = {}
): Session {
  return {
    ...mockSession,
    ...overrides,
    user: {
      ...mockSession.user,
      ...overrides.user,
    },
  };
}

/**
 * Factory function to create custom mock accounts
 */
export function createMockGoogleAccount(
  overrides: Partial<typeof mockGoogleAccount> = {}
) {
  return {
    ...mockGoogleAccount,
    ...overrides,
  };
}
