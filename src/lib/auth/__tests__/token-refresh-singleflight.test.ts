import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleTokenRefreshError } from "../refresh-google-token";
import type { GoogleRefreshedTokens } from "../refresh-google-token";
import type {
  GoogleAccountForRefresh,
  RefreshSessionDeps,
} from "../refresh-session-tokens";
import {
  __resetSessionRefreshSingleflightCache,
  getOrStartSessionRefresh,
} from "../token-refresh-singleflight";

const FIXED_NOW = 1_700_000_000_000; // milliseconds
const EXPIRED_AT = Math.floor(FIXED_NOW / 1000) - 60; // 60 s in the past
const FRESH_AT = Math.floor(FIXED_NOW / 1000) + 3600; // 1 h in the future
const USER_ID = "user-test";

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

describe("getOrStartSessionRefresh (singleflight #216)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetSessionRefreshSingleflightCache();
  });

  afterEach(() => {
    __resetSessionRefreshSingleflightCache();
  });

  it("collapses 5 concurrent calls for one account onto a single refresh + DB write", async () => {
    // Hold the OAuth round-trip in-flight so all 5 callers overlap on the same
    // cache slot before any of them resolves.
    const gate = deferred<GoogleRefreshedTokens>();
    const deps = makeDeps({
      refreshGoogleAccessToken: vi.fn().mockReturnValue(gate.promise),
    });
    const account = makeAccount();

    const calls = Array.from({ length: 5 }, () =>
      getOrStartSessionRefresh(USER_ID, account, deps)
    );

    gate.resolve({ access_token: "new-access-token", expires_in: 3600 });
    const outcomes = await Promise.all(calls);

    expect(outcomes).toEqual(
      Array.from({ length: 5 }, () => ({ kind: "refreshed" }))
    );
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(1);
    expect(deps.prisma.account.update).toHaveBeenCalledTimes(1);
  });

  it("does not collapse calls for distinct providerAccountIds (true in-flight concurrency)", async () => {
    // Hold every flight open with a shared gate so all three slots coexist in
    // the inflight Map simultaneously before any resolves. Without the gate
    // the test only proves serial independence (one slot purges before the
    // next sets), which would miss a bug where two truly concurrent flights
    // for different keys shared state.
    const gate = deferred<GoogleRefreshedTokens>();
    const deps = makeDeps({
      refreshGoogleAccessToken: vi.fn().mockReturnValue(gate.promise),
    });

    const calls = [
      getOrStartSessionRefresh(
        "user-a",
        makeAccount({ providerAccountId: "google-a" }),
        deps
      ),
      getOrStartSessionRefresh(
        "user-b",
        makeAccount({ providerAccountId: "google-b" }),
        deps
      ),
      getOrStartSessionRefresh(
        "user-c",
        makeAccount({ providerAccountId: "google-c" }),
        deps
      ),
    ];

    // All three flights are in-flight at this point; the gate hasn't fired.
    // refreshGoogleAccessToken must already have been called 3× (once per
    // distinct slot) — proving no collapse — even though zero have resolved.
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(3);

    gate.resolve({ access_token: "new-access-token", expires_in: 3600 });
    const outcomes = await Promise.all(calls);

    expect(outcomes).toEqual([
      { kind: "refreshed" },
      { kind: "refreshed" },
      { kind: "refreshed" },
    ]);
    expect(deps.prisma.account.update).toHaveBeenCalledTimes(3);
  });

  it("delivers the same transient-error outcome to every concurrent awaiter (errors are classified, not thrown)", async () => {
    const err = new GoogleTokenRefreshError(503, {
      error: "service_unavailable",
    });
    const gate = deferred<GoogleRefreshedTokens>();
    const deps = makeDeps({
      refreshGoogleAccessToken: vi.fn().mockReturnValue(gate.promise),
    });
    const account = makeAccount();

    const calls = Array.from({ length: 5 }, () =>
      getOrStartSessionRefresh(USER_ID, account, deps)
    );

    gate.reject(err);
    const outcomes = await Promise.all(calls);

    // A transient outage resolves to the same `transient-error` for all five —
    // it is classified, not thrown, so no awaiter sees a different result.
    expect(outcomes).toEqual(
      Array.from({ length: 5 }, () => ({ kind: "transient-error", error: err }))
    );
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(1);
  });

  it("releases the slot after success so a later call refreshes again", async () => {
    const deps = makeDeps();
    const account = makeAccount();

    const first = await getOrStartSessionRefresh(USER_ID, account, deps);
    const second = await getOrStartSessionRefresh(USER_ID, account, deps);

    expect(first).toEqual({ kind: "refreshed" });
    expect(second).toEqual({ kind: "refreshed" });
    // Two sequential (non-overlapping) calls each get their own round-trip
    // because the slot is purged in `.finally()`.
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(2);
  });

  it("releases the slot after a transient failure so the next call can retry", async () => {
    const refreshGoogleAccessToken = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({ access_token: "recovered", expires_in: 3600 });
    const deps = makeDeps({ refreshGoogleAccessToken });
    const account = makeAccount();

    const first = await getOrStartSessionRefresh(USER_ID, account, deps);
    const second = await getOrStartSessionRefresh(USER_ID, account, deps);

    expect(first.kind).toBe("transient-error");
    expect(second).toEqual({ kind: "refreshed" });
    expect(refreshGoogleAccessToken).toHaveBeenCalledTimes(2);
  });

  it("releases the slot after a hung refresh times out so a later call starts a fresh flight (#404)", async () => {
    // Simulates the failure mode #404 fixes: the Google token endpoint
    // hangs, the per-flight AbortSignal fires, and `refreshGoogleAccessToken`
    // rejects with a TimeoutError. The singleflight slot must purge in the
    // `.finally()` so a subsequent caller is not pinned to the dead flight.
    const timeoutErr = Object.assign(new Error("signal timed out"), {
      name: "TimeoutError",
    });
    const refreshGoogleAccessToken = vi
      .fn()
      .mockRejectedValueOnce(timeoutErr)
      .mockResolvedValueOnce({ access_token: "recovered", expires_in: 3600 });
    const deps = makeDeps({ refreshGoogleAccessToken });
    const account = makeAccount();

    const first = await getOrStartSessionRefresh(USER_ID, account, deps);
    expect(first).toEqual({ kind: "transient-error", error: timeoutErr });

    const second = await getOrStartSessionRefresh(USER_ID, account, deps);
    expect(second).toEqual({ kind: "refreshed" });
    // Two distinct round-trips — the second is not awaiting the first's
    // long-dead promise.
    expect(refreshGoogleAccessToken).toHaveBeenCalledTimes(2);
  });

  it("does not pollute the cache when the account has no refresh_token", async () => {
    const deps = makeDeps();

    const first = await getOrStartSessionRefresh(
      USER_ID,
      makeAccount({ refresh_token: null }),
      deps
    );
    expect(first.kind).toBe("terminal-error");
    expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();

    // The slot purged even though the outcome was terminal, so a subsequent
    // call with a valid token still refreshes rather than being short-circuited.
    const second = await getOrStartSessionRefresh(USER_ID, makeAccount(), deps);
    expect(second).toEqual({ kind: "refreshed" });
    expect(deps.refreshGoogleAccessToken).toHaveBeenCalledTimes(1);
  });

  it("emits the TokenRefreshed telemetry event exactly once for collapsed callers", async () => {
    const gate = deferred<GoogleRefreshedTokens>();
    const deps = makeDeps({
      refreshGoogleAccessToken: vi.fn().mockReturnValue(gate.promise),
    });
    const account = makeAccount();

    const calls = Array.from({ length: 5 }, () =>
      getOrStartSessionRefresh(USER_ID, account, deps)
    );
    gate.resolve({ access_token: "new-access-token", expires_in: 3600 });
    await Promise.all(calls);

    expect(deps.logger.event).toHaveBeenCalledTimes(1);
    expect(deps.logger.event).toHaveBeenCalledWith("TokenRefreshed", {
      userId: USER_ID,
    });
  });

  it("logs the refresh error exactly once for collapsed callers", async () => {
    const err = new GoogleTokenRefreshError(503, {
      error: "service_unavailable",
    });
    const gate = deferred<GoogleRefreshedTokens>();
    const deps = makeDeps({
      refreshGoogleAccessToken: vi.fn().mockReturnValue(gate.promise),
    });
    const account = makeAccount();

    const calls = Array.from({ length: 5 }, () =>
      getOrStartSessionRefresh(USER_ID, account, deps)
    );
    gate.reject(err);
    await Promise.all(calls);

    expect(deps.logger.error).toHaveBeenCalledTimes(1);
    expect(deps.logger.error).toHaveBeenCalledWith(err, {
      context: "TokenRefreshTransientFailure",
      userId: USER_ID,
    });
  });

  it("short-circuits a not-expired account without a network round-trip", async () => {
    const deps = makeDeps();
    const outcome = await getOrStartSessionRefresh(
      USER_ID,
      makeAccount({ expires_at: FRESH_AT }),
      deps
    );
    expect(outcome).toEqual({ kind: "not-expired" });
    expect(deps.refreshGoogleAccessToken).not.toHaveBeenCalled();
    expect(deps.prisma.account.update).not.toHaveBeenCalled();
  });
});
