import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type GoogleTokenAccount,
  type TokenRefreshDeps,
  __resetTokenRefreshCache,
  getOrStartTokenRefresh,
  refreshGoogleAccessToken,
} from "../token-refresh";

const baseAccount: GoogleTokenAccount = {
  provider: "google",
  providerAccountId: "google-account-123",
  refresh_token: "mock-refresh-token",
};

function makeDeps(overrides: Partial<TokenRefreshDeps> = {}): TokenRefreshDeps {
  const okJson = {
    access_token: "new-access-token",
    expires_in: 3600,
    refresh_token: undefined,
    scope: "openid email",
    token_type: "Bearer",
  };
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(okJson), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
  );
  const prismaMock = {
    account: {
      update: vi.fn(async () => ({})),
    },
  };
  return {
    fetch: fetchMock as unknown as TokenRefreshDeps["fetch"],
    prisma: prismaMock as unknown as TokenRefreshDeps["prisma"],
    clientId: "test-client-id",
    clientSecret: "test-client-secret",
    now: () => 1_700_000_000_000,
    ...overrides,
  };
}

describe("refreshGoogleAccessToken", () => {
  beforeEach(() => {
    __resetTokenRefreshCache();
  });

  it("posts the correct refresh-grant body to Google and returns the new tokens", async () => {
    const deps = makeDeps();

    const result = await refreshGoogleAccessToken(baseAccount, deps);

    expect(deps.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (deps.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    const body = new URLSearchParams(init.body as string);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe(baseAccount.refresh_token);
    expect(body.get("client_id")).toBe("test-client-id");
    expect(body.get("client_secret")).toBe("test-client-secret");
    expect(result.access_token).toBe("new-access-token");
    expect(result.expires_in).toBe(3600);
  });

  it("updates the Account row with the new access token, expiry, and existing refresh token", async () => {
    const deps = makeDeps();

    await refreshGoogleAccessToken(baseAccount, deps);

    expect(deps.prisma.account.update).toHaveBeenCalledTimes(1);
    const call = (deps.prisma.account.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.where).toEqual({
      provider_providerAccountId: {
        provider: "google",
        providerAccountId: baseAccount.providerAccountId,
      },
    });
    // expires_at = floor(now/1000) + expires_in
    expect(call.data.access_token).toBe("new-access-token");
    expect(call.data.expires_at).toBe(
      Math.floor(1_700_000_000_000 / 1000) + 3600
    );
    expect(call.data.refresh_token).toBe(baseAccount.refresh_token);
  });

  it("uses the new refresh_token when Google rotates it", async () => {
    const rotated = {
      access_token: "new-access-token",
      expires_in: 3600,
      refresh_token: "rotated-refresh-token",
    };
    const deps = makeDeps({
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify(rotated), {
            status: 200,
          })
      ) as unknown as TokenRefreshDeps["fetch"],
    });

    await refreshGoogleAccessToken(baseAccount, deps);

    const call = (deps.prisma.account.update as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(call.data.refresh_token).toBe("rotated-refresh-token");
  });

  it("rejects (and skips the DB update) when the OAuth response is non-OK", async () => {
    const deps = makeDeps({
      fetch: vi.fn(
        async () =>
          new Response(JSON.stringify({ error: "invalid_grant" }), {
            status: 400,
          })
      ) as unknown as TokenRefreshDeps["fetch"],
    });

    await expect(refreshGoogleAccessToken(baseAccount, deps)).rejects.toThrow();
    expect(deps.prisma.account.update).not.toHaveBeenCalled();
  });

  it("rejects synchronously when the account has no refresh_token", async () => {
    const deps = makeDeps();

    await expect(
      refreshGoogleAccessToken({ ...baseAccount, refresh_token: null }, deps)
    ).rejects.toThrow(/refresh token/i);
    expect(deps.fetch).not.toHaveBeenCalled();
  });
});

describe("getOrStartTokenRefresh (singleflight)", () => {
  beforeEach(() => {
    __resetTokenRefreshCache();
  });

  it("collapses 5 concurrent calls with the same key into a single fetch", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    const deps = makeDeps({
      fetch: fetchMock as unknown as TokenRefreshDeps["fetch"],
    });

    const calls = Array.from({ length: 5 }, () =>
      getOrStartTokenRefresh(baseAccount, deps)
    );

    // The fetch should have been started exactly once.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Resolve the in-flight fetch.
    resolveFetch(
      new Response(
        JSON.stringify({
          access_token: "single-flight-access",
          expires_in: 3600,
        }),
        { status: 200 }
      )
    );

    const results = await Promise.all(calls);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.access_token).toBe("single-flight-access");
    }
  });

  it("does not collapse calls with different keys (one fetch per account)", async () => {
    const deps = makeDeps();
    const accountA = baseAccount;
    const accountB = {
      ...baseAccount,
      providerAccountId: "google-account-456",
    };

    await Promise.all([
      getOrStartTokenRefresh(accountA, deps),
      getOrStartTokenRefresh(accountA, deps),
      getOrStartTokenRefresh(accountB, deps),
      getOrStartTokenRefresh(accountB, deps),
      getOrStartTokenRefresh(accountB, deps),
    ]);

    expect(deps.fetch).toHaveBeenCalledTimes(2);
  });

  it("propagates the same rejection to every concurrent awaiter", async () => {
    let rejectFetch: (err: Error) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((_resolve, reject) => {
          rejectFetch = reject;
        })
    );
    const deps = makeDeps({
      fetch: fetchMock as unknown as TokenRefreshDeps["fetch"],
    });

    const calls = Array.from({ length: 5 }, () =>
      getOrStartTokenRefresh(baseAccount, deps).catch((e: Error) => e)
    );

    rejectFetch(new Error("network down"));
    const results = await Promise.all(calls);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r).toBeInstanceOf(Error);
      expect((r as Error).message).toBe("network down");
    }
  });

  it("releases the in-flight slot after the refresh resolves so the next call starts a fresh fetch", async () => {
    const deps = makeDeps();

    await getOrStartTokenRefresh(baseAccount, deps);
    await getOrStartTokenRefresh(baseAccount, deps);

    expect(deps.fetch).toHaveBeenCalledTimes(2);
  });

  it("releases the in-flight slot after the refresh rejects so the next call can retry", async () => {
    const failOnce = vi
      .fn()
      .mockImplementationOnce(async () => new Response("nope", { status: 500 }))
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({
              access_token: "second-try-access",
              expires_in: 3600,
            }),
            { status: 200 }
          )
      );
    const deps = makeDeps({
      fetch: failOnce as unknown as TokenRefreshDeps["fetch"],
    });

    await expect(getOrStartTokenRefresh(baseAccount, deps)).rejects.toThrow();
    const second = await getOrStartTokenRefresh(baseAccount, deps);

    expect(failOnce).toHaveBeenCalledTimes(2);
    expect(second.access_token).toBe("second-try-access");
  });
});
