/**
 * Unit tests for auth helper functions
 */
import { prisma } from "@/lib/db";
import type { Session } from "next-auth";
import { randomBytes } from "node:crypto";
import type { MockedFunction } from "vitest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { auth } from "../auth";
import {
  AuthError,
  GOOGLE_TASKS_SCOPE,
  accountHasScope,
  assertGoogleTasksScope,
  getAccessToken,
  getCurrentUser,
  getGoogleAccount,
  getSession,
  isAuthenticated,
  needsReauthentication,
  requireAuth,
  requireAuthenticatedSession,
  requireGoogleTasksAccessToken,
  requireGoogleTasksSession,
  withAuth,
} from "../helpers";
import {
  mockGoogleAccount,
  mockGoogleAccountNoToken,
  mockSession,
  mockSessionWithError,
} from "./fixtures";

// Mock modules - vi.mock is hoisted so these must use factory functions
vi.mock("@/lib/auth/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    account: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
  },
}));

// Pin a deterministic TOKEN_ENCRYPTION_KEY for the whole file so the cipher
// module can encrypt within the test and the helpers decrypt with the same key.
const TEST_KEY_B64 = randomBytes(32).toString("base64");
beforeAll(() => {
  vi.stubEnv("TOKEN_ENCRYPTION_KEY", TEST_KEY_B64);
});
afterAll(() => {
  vi.unstubAllEnvs();
});

// Type the mocked auth function correctly
// NextAuth's auth has complex overloads, so we need to cast it
const mockAuth = auth as unknown as MockedFunction<
  () => Promise<Session | null>
>;

describe("auth helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSession", () => {
    it("returns session when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const session = await getSession();

      expect(session).toEqual(mockSession);
      expect(mockAuth).toHaveBeenCalledTimes(1);
    });

    it("returns null when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const session = await getSession();

      expect(session).toBeNull();
    });
  });

  describe("getAccessToken", () => {
    it("returns access token when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockGoogleAccount]);

      const token = await getAccessToken();

      expect(token).toBe(mockGoogleAccount.access_token);
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockSession.user.id, provider: "google" },
      });
    });

    it("throws when no session", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getAccessToken()).rejects.toThrow("Not authenticated");
    });

    it("throws when session has RefreshTokenError", async () => {
      mockAuth.mockResolvedValue(mockSessionWithError);

      await expect(getAccessToken()).rejects.toThrow(
        "Failed to refresh access token. Please sign in again."
      );
    });

    it("throws when no Google account linked", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      await expect(getAccessToken()).rejects.toThrow(
        "No Google account linked. Please sign in with Google."
      );
    });

    it("throws when Google account has no access token", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        mockGoogleAccountNoToken,
      ]);

      await expect(getAccessToken()).rejects.toThrow(
        "No Google account linked. Please sign in with Google."
      );
    });

    it("decrypts a v1-enveloped access_token before returning it", async () => {
      const { encryptToken } = await import("@/lib/crypto/token-cipher");
      mockAuth.mockResolvedValue(mockSession);
      const plainAccessToken = "ya29.fresh-access-token";
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        {
          ...mockGoogleAccount,
          access_token: encryptToken(plainAccessToken)!,
        },
      ]);

      const token = await getAccessToken();

      expect(token).toBe(plainAccessToken);
      expect(token).not.toContain("v1:");
    });

    it("returns legacy plaintext access_token unchanged (backwards compat)", async () => {
      mockAuth.mockResolvedValue(mockSession);
      const legacyPlaintext = "ya29.legacy-plaintext-token";
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        { ...mockGoogleAccount, access_token: legacyPlaintext },
      ]);

      const token = await getAccessToken();

      expect(token).toBe(legacyPlaintext);
    });
  });

  describe("getCurrentUser", () => {
    it("returns user when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const user = await getCurrentUser();

      expect(user).toEqual(mockSession.user);
    });

    it("throws when no session", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(getCurrentUser()).rejects.toThrow("Not authenticated");
    });

    it("throws when session has no user", async () => {
      mockAuth.mockResolvedValue({
        ...mockSession,
        user: undefined,
      } as unknown as typeof mockSession);

      await expect(getCurrentUser()).rejects.toThrow("Not authenticated");
    });
  });

  describe("requireAuth", () => {
    it("returns session when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const session = await requireAuth();

      expect(session).toEqual(mockSession);
    });

    it("throws when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(requireAuth()).rejects.toThrow("Not authenticated");
    });
  });

  describe("isAuthenticated", () => {
    it("returns true when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const result = await isAuthenticated();

      expect(result).toBe(true);
    });

    it("returns false when no session", async () => {
      mockAuth.mockResolvedValue(null);

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });

    it("returns false when session has no user", async () => {
      mockAuth.mockResolvedValue({
        ...mockSession,
        user: undefined,
      } as unknown as typeof mockSession);

      const result = await isAuthenticated();

      expect(result).toBe(false);
    });
  });

  describe("getGoogleAccount", () => {
    it("returns Google account when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockGoogleAccount]);

      const account = await getGoogleAccount();

      expect(account).toEqual(mockGoogleAccount);
      expect(prisma.account.findMany).toHaveBeenCalledWith({
        where: { userId: mockSession.user.id, provider: "google" },
      });
    });

    it("returns null when no session", async () => {
      mockAuth.mockResolvedValue(null);

      const account = await getGoogleAccount();

      expect(account).toBeNull();
    });

    it("returns null when session has no user id", async () => {
      mockAuth.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, id: undefined },
      } as unknown as typeof mockSession);

      const account = await getGoogleAccount();

      expect(account).toBeNull();
    });

    it("returns undefined when no Google account found", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      const account = await getGoogleAccount();

      expect(account).toBeUndefined();
    });

    it("decrypts access_token, refresh_token, and id_token fields", async () => {
      const { encryptToken } = await import("@/lib/crypto/token-cipher");
      mockAuth.mockResolvedValue(mockSession);

      const plainAccess = "ya29.fresh-access";
      const plainRefresh = "1//refresh-token-abc";
      const plainIdToken = "eyJhbGciOi...";
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        {
          ...mockGoogleAccount,
          access_token: encryptToken(plainAccess)!,
          refresh_token: encryptToken(plainRefresh)!,
          id_token: encryptToken(plainIdToken)!,
        },
      ]);

      const account = await getGoogleAccount();

      expect(account?.access_token).toBe(plainAccess);
      expect(account?.refresh_token).toBe(plainRefresh);
      expect(account?.id_token).toBe(plainIdToken);
      // Non-token fields pass through untouched
      expect(account?.provider).toBe(mockGoogleAccount.provider);
      expect(account?.userId).toBe(mockGoogleAccount.userId);
      expect(account?.expires_at).toBe(mockGoogleAccount.expires_at);
    });

    it("leaves legacy plaintext token fields unchanged (backwards compat)", async () => {
      mockAuth.mockResolvedValue(mockSession);
      // mockGoogleAccount fixture uses plaintext strings like "mock-access-token"
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockGoogleAccount]);

      const account = await getGoogleAccount();

      expect(account?.access_token).toBe(mockGoogleAccount.access_token);
      expect(account?.refresh_token).toBe(mockGoogleAccount.refresh_token);
      expect(account?.id_token).toBe(mockGoogleAccount.id_token);
    });

    it("preserves null token fields", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        {
          ...mockGoogleAccount,
          access_token: null,
          refresh_token: null,
          id_token: null,
        },
      ]);

      const account = await getGoogleAccount();

      expect(account?.access_token).toBeNull();
      expect(account?.refresh_token).toBeNull();
      expect(account?.id_token).toBeNull();
    });
  });

  describe("needsReauthentication", () => {
    it("returns true when session has RefreshTokenError", async () => {
      mockAuth.mockResolvedValue(mockSessionWithError);

      const result = await needsReauthentication();

      expect(result).toBe(true);
    });

    it("returns false when session has no error", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const result = await needsReauthentication();

      expect(result).toBe(false);
    });

    it("returns false when no session", async () => {
      mockAuth.mockResolvedValue(null);

      const result = await needsReauthentication();

      expect(result).toBe(false);
    });
  });

  describe("withAuth", () => {
    it("calls handler with userId and accessToken when authenticated", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockGoogleAccount]);

      const handler = vi.fn().mockResolvedValue({ success: true });

      const result = await withAuth(handler);

      expect(handler).toHaveBeenCalledWith(
        mockSession.user.id,
        mockGoogleAccount.access_token
      );
      expect(result).toEqual({ success: true });
    });

    it("throws AuthError when not authenticated", async () => {
      mockAuth.mockResolvedValue(null);

      const handler = vi.fn();

      await expect(withAuth(handler)).rejects.toThrow(AuthError);
      await expect(withAuth(handler)).rejects.toThrow("Not authenticated");
      expect(handler).not.toHaveBeenCalled();
    });

    it("throws AuthError when session has RefreshTokenError", async () => {
      mockAuth.mockResolvedValue(mockSessionWithError);

      const handler = vi.fn();

      await expect(withAuth(handler)).rejects.toThrow(AuthError);
      await expect(withAuth(handler)).rejects.toThrow(
        "Session expired. Please sign in again."
      );
      expect(handler).not.toHaveBeenCalled();
    });

    it("propagates errors from handler", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockGoogleAccount]);

      const handler = vi.fn().mockRejectedValue(new Error("Handler error"));

      await expect(withAuth(handler)).rejects.toThrow("Handler error");
    });

    it("propagates errors from getAccessToken", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      const handler = vi.fn();

      await expect(withAuth(handler)).rejects.toThrow(
        "No Google account linked"
      );
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("accountHasScope", () => {
    it("returns true when the scope is present (space separator)", () => {
      expect(accountHasScope(mockGoogleAccount, GOOGLE_TASKS_SCOPE)).toBe(true);
    });

    it("returns true when the scope is present with `+` separators", () => {
      const account = {
        ...mockGoogleAccount,
        scope:
          "openid+email+profile+https://www.googleapis.com/auth/tasks+https://www.googleapis.com/auth/calendar.readonly",
      };
      expect(accountHasScope(account, GOOGLE_TASKS_SCOPE)).toBe(true);
    });

    it("returns true when the scope is present with comma separators", () => {
      // Defensive: Google's spec uses spaces, but a manual DB seed or a
      // legacy Prisma adapter version may have stored comma-delimited
      // grants. Accept the broader form so those rows still resolve.
      const account = {
        ...mockGoogleAccount,
        scope:
          "openid,email,profile,https://www.googleapis.com/auth/tasks,https://www.googleapis.com/auth/calendar.readonly",
      };
      expect(accountHasScope(account, GOOGLE_TASKS_SCOPE)).toBe(true);
    });

    it("returns false when the scope is missing", () => {
      const account = {
        ...mockGoogleAccount,
        scope:
          "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      };
      expect(accountHasScope(account, GOOGLE_TASKS_SCOPE)).toBe(false);
    });

    it("returns false when the stored scope is null", () => {
      const account = { ...mockGoogleAccount, scope: null };
      expect(accountHasScope(account, GOOGLE_TASKS_SCOPE)).toBe(false);
    });

    it("returns false when the stored scope is an empty string", () => {
      const account = { ...mockGoogleAccount, scope: "" };
      expect(accountHasScope(account, GOOGLE_TASKS_SCOPE)).toBe(false);
    });

    it("returns false when the account is null", () => {
      expect(accountHasScope(null, GOOGLE_TASKS_SCOPE)).toBe(false);
    });

    it("does not match a substring of a different scope", () => {
      const account = {
        ...mockGoogleAccount,
        scope:
          "openid email profile https://www.googleapis.com/auth/tasks.readonly",
      };
      expect(accountHasScope(account, GOOGLE_TASKS_SCOPE)).toBe(false);
    });
  });

  describe("assertGoogleTasksScope", () => {
    it("resolves silently when the tasks scope is present", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([mockGoogleAccount]);

      await expect(assertGoogleTasksScope()).resolves.toBeUndefined();
    });

    it("throws AuthError(403) with requiresReauth message when the tasks scope is missing", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([
        {
          ...mockGoogleAccount,
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
        },
      ]);

      await expect(assertGoogleTasksScope()).rejects.toBeInstanceOf(AuthError);
      await expect(assertGoogleTasksScope()).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("Google Tasks"),
      });
    });

    it("throws AuthError(401) when no session", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(assertGoogleTasksScope()).rejects.toMatchObject({
        status: 401,
      });
    });

    it("throws AuthError(401) when session has RefreshTokenError", async () => {
      mockAuth.mockResolvedValue(mockSessionWithError);

      await expect(assertGoogleTasksScope()).rejects.toMatchObject({
        status: 401,
      });
    });

    it("throws AuthError(401) when no Google account is linked", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findMany).mockResolvedValue([]);

      await expect(assertGoogleTasksScope()).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe("requireGoogleTasksAccessToken", () => {
    // Combined helper introduced for #260: takes a Session (so the caller
    // can reuse the auth() result they already have) and returns a
    // decrypted access token in a single Prisma query, replacing the
    // assertGoogleTasksScope() + getAccessToken() pair that previously hit
    // the DB twice per request.

    it("returns the decrypted access token when scope is granted", async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockGoogleAccount);

      const token = await requireGoogleTasksAccessToken(mockSession);

      expect(token).toBe(mockGoogleAccount.access_token);
    });

    it("makes exactly one prisma.account.findFirst call and never calls auth() itself", async () => {
      // The helper takes a Session so the caller can reuse the auth() it
      // already resolved. The savings are wasted if either contract leaks:
      // this test pins both.
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockGoogleAccount);

      await requireGoogleTasksAccessToken(mockSession);

      expect(prisma.account.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.account.findFirst).toHaveBeenCalledWith({
        where: { userId: mockSession.user.id, provider: "google" },
      });
      expect(mockAuth).not.toHaveBeenCalled();
    });

    it("decrypts a v1-enveloped access_token before returning it", async () => {
      const { encryptToken } = await import("@/lib/crypto/token-cipher");
      const plainAccessToken = "ya29.fresh-access-token";
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        ...mockGoogleAccount,
        access_token: encryptToken(plainAccessToken)!,
      });

      const token = await requireGoogleTasksAccessToken(mockSession);

      expect(token).toBe(plainAccessToken);
      expect(token).not.toContain("v1:");
    });

    it("throws AuthError(401) when the session is in RefreshTokenError without touching the DB", async () => {
      // Future callers that don't pre-check the session must not silently
      // burn a Prisma query when we already know the user has to re-auth.
      const promise = requireGoogleTasksAccessToken(mockSessionWithError);

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining("Session expired"),
      });
      expect(prisma.account.findFirst).not.toHaveBeenCalled();
    });

    it("throws AuthError(401) when no Google account is linked", async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      const promise = requireGoogleTasksAccessToken(mockSession);

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({ status: 401 });
    });

    it("throws AuthError(403) when the Tasks scope is missing", async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        ...mockGoogleAccount,
        scope:
          "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      });

      await expect(
        requireGoogleTasksAccessToken(mockSession)
      ).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("Google Tasks"),
      });
    });

    it("throws AuthError(401) when the account row has no access_token", async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(
        mockGoogleAccountNoToken
      );

      await expect(
        requireGoogleTasksAccessToken(mockSession)
      ).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining("token unavailable"),
      });
    });

    it("checks scope before decrypting — a missing scope on a nulled token still surfaces as 403", async () => {
      // Scope is the user-recoverable failure (re-grant). Token-null is a
      // server-side data integrity issue. When both are wrong, callers should
      // see the scope error first so they get the right re-auth CTA.
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        ...mockGoogleAccount,
        access_token: null,
        scope: "openid email profile",
      });

      await expect(
        requireGoogleTasksAccessToken(mockSession)
      ).rejects.toMatchObject({ status: 403 });
    });
  });

  describe("AuthError", () => {
    it("creates error with default status 401", () => {
      const error = new AuthError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.status).toBe(401);
      expect(error.name).toBe("AuthError");
    });

    it("creates error with custom status", () => {
      const error = new AuthError("Forbidden", 403);

      expect(error.message).toBe("Forbidden");
      expect(error.status).toBe(403);
    });

    it("is an instance of Error", () => {
      const error = new AuthError("Test");

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
    });

    it("leaves requiresReauth undefined by default so the route catch-block can keep its status-based fallback", () => {
      // Existing AuthError throw-sites do not set this flag. The route
      // catch-block falls back to `status === 401 || 403` for them, so
      // their response shape is unchanged after this refactor.
      const error = new AuthError("Unauthorized", 401);

      expect(error.requiresReauth).toBeUndefined();
    });

    it("accepts an explicit requiresReauth: false to suppress the re-auth CTA on plain unauthenticated requests", () => {
      // The new requireAuthenticatedSession helper uses this to differentiate
      // "no session at all" (no re-auth UI — could just be a logged-out user)
      // from "session error — definitely needs re-auth".
      const error = new AuthError("Unauthorized", 401, {
        requiresReauth: false,
      });

      expect(error.requiresReauth).toBe(false);
    });

    it("accepts an explicit requiresReauth: true so the route catch-block can render the CTA without inferring from status", () => {
      const error = new AuthError(
        "Session expired. Please sign in again.",
        401,
        {
          requiresReauth: true,
        }
      );

      expect(error.requiresReauth).toBe(true);
    });
  });

  describe("requireAuthenticatedSession", () => {
    it("returns the session when authenticated and not in a refresh-error state", async () => {
      mockAuth.mockResolvedValue(mockSession);

      const { session } = await requireAuthenticatedSession();

      expect(session).toEqual(mockSession);
    });

    it("throws AuthError(401, requiresReauth: false) when there is no session", async () => {
      // Distinct from RefreshTokenError: a missing session is just "not signed
      // in" — the client should NOT pop a re-auth modal because the user may
      // never have signed in at all.
      mockAuth.mockResolvedValue(null);

      const promise = requireAuthenticatedSession();

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({
        status: 401,
        message: "Unauthorized",
        requiresReauth: false,
      });
    });

    it("throws AuthError(401, requiresReauth: false) when the session has no user.id", async () => {
      mockAuth.mockResolvedValue({
        ...mockSession,
        user: undefined,
      } as unknown as typeof mockSession);

      await expect(requireAuthenticatedSession()).rejects.toMatchObject({
        status: 401,
        message: "Unauthorized",
        requiresReauth: false,
      });
    });

    it("throws AuthError(401, requiresReauth: false) when user.id is an empty string", async () => {
      // user.id is typed `string` but JS can hand us an empty string through
      // a malformed session. `!session?.user?.id` already treats "" as falsy;
      // this pins that behavior so a future refactor can't loosen the guard
      // by switching to a `user.id === undefined` check.
      mockAuth.mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, id: "" },
      } as unknown as typeof mockSession);

      await expect(requireAuthenticatedSession()).rejects.toMatchObject({
        status: 401,
        message: "Unauthorized",
        requiresReauth: false,
      });
    });

    it("throws AuthError(401, requiresReauth: true) when session.error === RefreshTokenError", async () => {
      mockAuth.mockResolvedValue(mockSessionWithError);

      const promise = requireAuthenticatedSession();

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({
        status: 401,
        message: "Session expired. Please sign in again.",
        requiresReauth: true,
      });
    });
  });

  describe("requireGoogleTasksSession", () => {
    it("returns { session, accessToken } on the happy path", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockGoogleAccount);

      const { session, accessToken } = await requireGoogleTasksSession();

      expect(session).toEqual(mockSession);
      expect(accessToken).toBe(mockGoogleAccount.access_token);
    });

    it("does not call prisma when there is no session (short-circuits in requireAuthenticatedSession)", async () => {
      mockAuth.mockResolvedValue(null);

      await expect(requireGoogleTasksSession()).rejects.toMatchObject({
        status: 401,
        message: "Unauthorized",
        requiresReauth: false,
      });
      expect(prisma.account.findFirst).not.toHaveBeenCalled();
    });

    it("does not call prisma when the session is in RefreshTokenError", async () => {
      mockAuth.mockResolvedValue(mockSessionWithError);

      await expect(requireGoogleTasksSession()).rejects.toMatchObject({
        status: 401,
        requiresReauth: true,
      });
      expect(prisma.account.findFirst).not.toHaveBeenCalled();
    });

    it("propagates a 403 from requireGoogleTasksAccessToken when scope is missing", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        ...mockGoogleAccount,
        scope:
          "openid email profile https://www.googleapis.com/auth/calendar.readonly",
      });

      const promise = requireGoogleTasksSession();

      await expect(promise).rejects.toBeInstanceOf(AuthError);
      await expect(promise).rejects.toMatchObject({
        status: 403,
        message: expect.stringContaining("Google Tasks"),
      });
    });

    it("propagates a 401 from requireGoogleTasksAccessToken when no Google account is linked", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null);

      await expect(requireGoogleTasksSession()).rejects.toMatchObject({
        status: 401,
        message: expect.stringContaining("No Google account"),
      });
    });

    it("calls prisma.account.findFirst exactly once (no duplicate query)", async () => {
      mockAuth.mockResolvedValue(mockSession);
      vi.mocked(prisma.account.findFirst).mockResolvedValue(mockGoogleAccount);

      await requireGoogleTasksSession();

      expect(prisma.account.findFirst).toHaveBeenCalledTimes(1);
    });
  });
});
