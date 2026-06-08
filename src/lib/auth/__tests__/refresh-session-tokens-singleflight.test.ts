import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleRefreshedTokens } from "../refresh-google-token";
import {
  type GoogleAccountForRefresh,
  type RefreshSessionDeps,
  __resetSessionTokenSingleflightCache,
  getOrStartSessionTokenRefresh,
} from "../refresh-session-tokens";

const FIXED_NOW = 1_700_000_000_000;
const EXPIRED_AT = Math.floor(FIXED_NOW / 1000) - 60;
const USER_ID = "user-test-singleflight";

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

describe("getOrStartSessionTokenRefresh (singleflight wrapper)", () => {
  beforeEach(() => {
    __resetSessionTokenSingleflightCache();
    vi.clearAllMocks();
  });

  it("collapses 5 concurrent calls with the same userId into exactly one refresh", async () => {
    let resolveRefresh: (tokens: GoogleRefreshedTokens) => void = () => {};
    const refreshSpy = vi.fn(
      () =>
        new Promise<GoogleRefreshedTokens>((resolve) => {
          resolveRefresh = resolve;
        })
    );
    const deps = makeDeps({ refreshGoogleAccessToken: refreshSpy });

    const calls = Array.from({ length: 5 }, () =>
      getOrStartSessionTokenRefresh(USER_ID, makeAccount(), deps)
    );

    // The HTTP fetch and the DB update should each be started at most once.
    expect(refreshSpy).toHaveBeenCalledTimes(1);

    resolveRefresh({ access_token: "shared-access-token", expires_in: 3600 });
    const outcomes = await Promise.all(calls);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(deps.prisma.account.update).toHaveBeenCalledTimes(1);
    expect(outcomes).toHaveLength(5);
    for (const outcome of outcomes) {
      expect(outcome.kind).toBe("refreshed");
    }
  });

  it("does not collapse calls with different userIds", async () => {
    const deps = makeDeps();

    await Promise.all([
      getOrStartSessionTokenRefresh("user-a", makeAccount(), deps),
      getOrStartSessionTokenRefresh("user-a", makeAccount(), deps),
      getOrStartSessionTokenRefresh(
        "user-b",
        makeAccount({ providerAccountId: "google-user-2" }),
        deps
      ),
      getOrStartSessionTokenRefresh(
        "user-b",
        makeAccount({ providerAccountId: "google-user-2" }),
        deps
      ),
      getOrStartSessionTokenRefresh(
        "user-c",
        makeAccount({ providerAccountId: "google-user-3" }),
        deps
      ),
    ]);

    // Three distinct userIds → three refreshes.
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(3);
    expect(deps.prisma.account.update).toHaveBeenCalledTimes(3);
  });

  it("releases the in-flight slot after a successful refresh so the next call starts a fresh one", async () => {
    const deps = makeDeps();

    const first = await getOrStartSessionTokenRefresh(
      USER_ID,
      makeAccount(),
      deps
    );
    expect(first.kind).toBe("refreshed");

    const second = await getOrStartSessionTokenRefresh(
      USER_ID,
      makeAccount(),
      deps
    );
    expect(second.kind).toBe("refreshed");

    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(2);
  });

  it("releases the in-flight slot after a transient failure so the next call can retry", async () => {
    const transientThenSuccess = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        access_token: "second-try-access",
        expires_in: 3600,
      });
    const deps = makeDeps({ refreshGoogleAccessToken: transientThenSuccess });

    const first = await getOrStartSessionTokenRefresh(
      USER_ID,
      makeAccount(),
      deps
    );
    // Generic Error → classifier returns `transient`; outcome should be transient-error.
    expect(first.kind).toBe("transient-error");

    const second = await getOrStartSessionTokenRefresh(
      USER_ID,
      makeAccount(),
      deps
    );
    expect(second.kind).toBe("refreshed");

    expect(transientThenSuccess).toHaveBeenCalledTimes(2);
  });

  it("propagates the same outcome to every concurrent awaiter", async () => {
    let rejectRefresh: (err: Error) => void = () => {};
    const refreshSpy = vi.fn(
      () =>
        new Promise<GoogleRefreshedTokens>((_resolve, reject) => {
          rejectRefresh = reject;
        })
    );
    const deps = makeDeps({ refreshGoogleAccessToken: refreshSpy });

    const calls = Array.from({ length: 5 }, () =>
      getOrStartSessionTokenRefresh(USER_ID, makeAccount(), deps)
    );

    rejectRefresh(new Error("network down"));
    const outcomes = await Promise.all(calls);

    expect(refreshSpy).toHaveBeenCalledTimes(1);
    expect(outcomes).toHaveLength(5);
    for (const outcome of outcomes) {
      expect(outcome.kind).toBe("transient-error");
    }
  });

  it("does not pollute the cache when the account has no refresh token", async () => {
    const deps = makeDeps();
    // First call: missing refresh-token → terminal error; this still resolves
    // (it's a discriminated outcome, not a thrown rejection), but the
    // `.finally()` purge must still run so the next call doesn't reuse the
    // settled-with-terminal-error promise as if it were still in flight.
    const noTokenAccount = makeAccount({ refresh_token: null });
    const first = await getOrStartSessionTokenRefresh(
      USER_ID,
      noTokenAccount,
      deps
    );
    expect(first.kind).toBe("terminal-error");

    // Second call with a valid account on the same userId — should trigger
    // a fresh refresh, not return the cached terminal outcome.
    const second = await getOrStartSessionTokenRefresh(
      USER_ID,
      makeAccount(),
      deps
    );
    expect(second.kind).toBe("refreshed");
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(1);
  });

  it("short-circuits on a not-expired account without calling refresh or DB", async () => {
    const deps = makeDeps();
    const freshAccount = makeAccount({
      expires_at: Math.floor(FIXED_NOW / 1000) + 3600,
    });

    const outcome = await getOrStartSessionTokenRefresh(
      USER_ID,
      freshAccount,
      deps
    );
    expect(outcome.kind).toBe("not-expired");
    expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
    expect(deps.prisma.account.update).not.toHaveBeenCalled();
  });
});
