/**
 * Unit tests for auth helper functions
 */
import { prisma } from "@/lib/db";
import type { Session } from "next-auth";
import type { MockedFunction } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  });
});
