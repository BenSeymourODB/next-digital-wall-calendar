import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type GoogleRefreshedTokens,
  GoogleTokenRefreshError,
} from "../refresh-google-token";
import {
  type GoogleAccountForRefresh,
  type RefreshSessionDeps,
  refreshGoogleSessionTokensIfNeeded,
} from "../refresh-session-tokens";

const FIXED_NOW = 1_700_000_000_000; // milliseconds
const EXPIRED_AT = Math.floor(FIXED_NOW / 1000) - 60; // 60 s in the past
const FRESH_AT = Math.floor(FIXED_NOW / 1000) + 3600; // 1 h in the future
const USER_ID = "user-test";

function makeDeps(
  overrides: Partial<RefreshSessionDeps> = {}
): RefreshSessionDeps {
  const successTokens: GoogleRefreshedTokens = {
    access_token: "new-access-token",
    expires_in: 3600,
  };
  return {
    prisma: { account: { update: vi.fn().mockResolvedValue(undefined) } },
    refreshGoogleAccessToken: vi.fn().mockResolvedValue(successTokens),
    encryptToken: vi.fn((s: string | null | undefined) =>
      s == null ? null : `v1:enc(${s})`
    ),
    decryptToken: vi.fn((s: string | null | undefined) => {
      if (s == null) return null;
      return s.startsWith("v1:enc(") ? s.slice(7, -1) : s;
    }),
    logger: { error: vi.fn(), event: vi.fn() },
    googleClientId: "test-client-id",
    googleClientSecret: "test-client-secret",
    now: () => FIXED_NOW,
    ...overrides,
  };
}

function makeAccount(
  overrides: Partial<GoogleAccountForRefresh> = {}
): GoogleAccountForRefresh {
  return {
    providerAccountId: "google-user-1",
    refresh_token: "v1:enc(refresh-token-plaintext)",
    expires_at: EXPIRED_AT,
    ...overrides,
  };
}

describe("refreshGoogleSessionTokensIfNeeded", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("when access token has not expired", () => {
    it("returns not-expired and does not call Google", async () => {
      const deps = makeDeps();
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount({ expires_at: FRESH_AT }),
        deps
      );
      expect(outcome).toEqual({ kind: "not-expired" });
      expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
      expect(deps.prisma.account.update).not.toHaveBeenCalled();
    });

    it("returns not-expired when expires_at is null (no token info)", async () => {
      const deps = makeDeps();
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount({ expires_at: null }),
        deps
      );
      expect(outcome).toEqual({ kind: "not-expired" });
      expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("happy path — refresh succeeds", () => {
    it("returns refreshed, writes new tokens, and logs the success event", async () => {
      const deps = makeDeps();
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome).toEqual({ kind: "refreshed" });
      expect(deps.refreshGoogleAccessToken).toHaveBeenCalledWith(
        "refresh-token-plaintext",
        "test-client-id",
        "test-client-secret"
      );
      expect(deps.prisma.account.update).toHaveBeenCalledWith({
        data: {
          access_token: "v1:enc(new-access-token)",
          expires_at: Math.floor(FIXED_NOW / 1000) + 3600,
          // No new refresh_token in the response → re-encrypt the existing one.
          refresh_token: "v1:enc(refresh-token-plaintext)",
        },
        where: {
          provider_providerAccountId: {
            provider: "google",
            providerAccountId: "google-user-1",
          },
        },
      });
      expect(deps.logger.event).toHaveBeenCalledWith("TokenRefreshed", {
        userId: USER_ID,
        success: true,
      });
    });

    it("uses the new refresh_token when Google rotates it (revocation case)", async () => {
      const deps = makeDeps({
        refreshGoogleAccessToken: vi.fn().mockResolvedValue({
          access_token: "fresh-access",
          expires_in: 3600,
          refresh_token: "rotated-refresh",
        }),
      });
      await refreshGoogleSessionTokensIfNeeded(USER_ID, makeAccount(), deps);
      expect(deps.prisma.account.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            refresh_token: "v1:enc(rotated-refresh)",
          }),
        })
      );
    });
  });

  describe("terminal failures — session.error MUST be set", () => {
    it("returns terminal-error when Google replies invalid_grant", async () => {
      const err = new GoogleTokenRefreshError(400, {
        error: "invalid_grant",
      });
      const deps = makeDeps({
        refreshGoogleAccessToken: vi.fn().mockRejectedValue(err),
      });
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome).toEqual({ kind: "terminal-error", error: err });
      expect(deps.prisma.account.update).not.toHaveBeenCalled();
      expect(deps.logger.error).toHaveBeenCalledWith(err, {
        context: "TokenRefreshFailed",
        userId: USER_ID,
      });
    });

    it("returns terminal-error when the stored row has no refresh_token", async () => {
      // No retry can conjure a refresh token that was never stored — force
      // re-auth so the user can write a fresh one.
      const deps = makeDeps();
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount({ refresh_token: null }),
        deps
      );
      expect(outcome.kind).toBe("terminal-error");
      expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ name: "MissingRefreshTokenError" }),
        { context: "TokenRefreshFailed", userId: USER_ID }
      );
    });

    it("returns terminal-error when the stored refresh_token cannot be decrypted", async () => {
      // Key rotation / tamper / unknown envelope → ciphertext is permanently
      // unreadable. Force re-auth instead of silently never refreshing.
      const deps = makeDeps({
        decryptToken: vi.fn(() => {
          throw new Error("auth tag mismatch");
        }),
      });
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome.kind).toBe("terminal-error");
      expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
      // First the decrypt log, then the terminal classification log.
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ message: "auth tag mismatch" }),
        { context: "RefreshTokenDecryptFailed", userId: USER_ID }
      );
      expect(deps.logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ name: "RefreshTokenDecryptError" }),
        { context: "TokenRefreshFailed", userId: USER_ID }
      );
    });

    it("returns terminal-error when decryptToken returns null (legacy empty envelope)", async () => {
      const deps = makeDeps({ decryptToken: vi.fn(() => null) });
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome.kind).toBe("terminal-error");
      expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("transient failures — session.error MUST NOT be set (#315)", () => {
    it("returns transient-error for a Google 5xx response", async () => {
      const err = new GoogleTokenRefreshError(503, {
        error: "service_unavailable",
      });
      const deps = makeDeps({
        refreshGoogleAccessToken: vi.fn().mockRejectedValue(err),
      });
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome).toEqual({ kind: "transient-error", error: err });
      expect(deps.logger.error).toHaveBeenCalledWith(err, {
        context: "TokenRefreshTransientFailure",
        userId: USER_ID,
      });
    });

    it("returns transient-error for a network failure (TypeError from fetch)", async () => {
      const err = new TypeError("fetch failed");
      const deps = makeDeps({
        refreshGoogleAccessToken: vi.fn().mockRejectedValue(err),
      });
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome).toEqual({ kind: "transient-error", error: err });
    });

    it("returns transient-error for a rate-limit response", async () => {
      const err = new GoogleTokenRefreshError(429, {
        error: "rate_limit_exceeded",
      });
      const deps = makeDeps({
        refreshGoogleAccessToken: vi.fn().mockRejectedValue(err),
      });
      const outcome = await refreshGoogleSessionTokensIfNeeded(
        USER_ID,
        makeAccount(),
        deps
      );
      expect(outcome.kind).toBe("transient-error");
    });

    it("does NOT write to prisma.account on a transient error (preserves last-known-good state)", async () => {
      const deps = makeDeps({
        refreshGoogleAccessToken: vi
          .fn()
          .mockRejectedValue(new TypeError("network")),
      });
      await refreshGoogleSessionTokensIfNeeded(USER_ID, makeAccount(), deps);
      expect(deps.prisma.account.update).not.toHaveBeenCalled();
    });
  });
});
