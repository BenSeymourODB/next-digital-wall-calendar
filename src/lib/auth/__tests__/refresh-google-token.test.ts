/**
 * Unit tests for the Google OAuth token-refresh helper.
 *
 * Issue #217 routes the NextAuth `session` callback's token-refresh fetch
 * through `fetchWithRetry`. The retry semantics themselves are covered by
 * `src/lib/http/__tests__/retry.test.ts`; here we exercise the wrapper's
 * argument shape, success-path response parsing, the throw-on-error envelope
 * the callback already depends on, and the regression that transient 5xx
 * failures are retried instead of bubbling to the caller.
 */
import { jsonResponse } from "@/lib/test-utils/api-test-helpers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyTokenRefreshError } from "../refresh-error-classifier";
import {
  DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS,
  GoogleTokenRefreshError,
  getRefreshTimeoutMs,
  refreshGoogleAccessToken,
} from "../refresh-google-token";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("refreshGoogleAccessToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs the URL-encoded refresh-token body to Google's OAuth endpoint", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({ access_token: "new-access", expires_in: 3600 })
    );

    await refreshGoogleAccessToken("rt-abc", "client-id-123", "secret-xyz");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/x-www-form-urlencoded"
    );

    const body = init.body as URLSearchParams;
    expect(body).toBeInstanceOf(URLSearchParams);
    expect(body.get("grant_type")).toBe("refresh_token");
    expect(body.get("refresh_token")).toBe("rt-abc");
    expect(body.get("client_id")).toBe("client-id-123");
    expect(body.get("client_secret")).toBe("secret-xyz");
  });

  it("passes an AbortSignal bound to the configured timeout so a hung connection cannot hold the singleflight slot indefinitely (#404)", async () => {
    // Spy on AbortSignal.timeout so we can confirm both that one is created
    // and what timeout value is supplied. We don't intercept the static
    // method on the AbortSignal type itself — just spy through the global
    // object so the real timeout is still produced and threaded onto the
    // fetch init exactly as production would.
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    mockFetch.mockResolvedValue(
      jsonResponse({ access_token: "x", expires_in: 3600 })
    );

    await refreshGoogleAccessToken("rt", "cid", "sec");

    expect(timeoutSpy).toHaveBeenCalledTimes(1);
    expect(timeoutSpy).toHaveBeenCalledWith(
      DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS
    );
    const init = mockFetch.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns the parsed tokens on success", async () => {
    mockFetch.mockResolvedValue(
      jsonResponse({
        access_token: "new-access",
        expires_in: 3600,
        refresh_token: "rotated-rt",
      })
    );

    const tokens = await refreshGoogleAccessToken("rt", "cid", "sec");

    expect(tokens).toEqual({
      access_token: "new-access",
      expires_in: 3600,
      refresh_token: "rotated-rt",
    });
  });

  it("throws GoogleTokenRefreshError on 400 invalid_grant (non-transient, no retry)", async () => {
    const errorBody = {
      error: "invalid_grant",
      error_description: "Token has been expired or revoked.",
    };
    mockFetch.mockResolvedValue(jsonResponse(errorBody, { status: 400 }));

    await expect(
      refreshGoogleAccessToken("revoked-rt", "cid", "sec")
    ).rejects.toMatchObject({
      name: "GoogleTokenRefreshError",
      status: 400,
      body: errorBody,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws GoogleTokenRefreshError on 401 invalid_client without retrying", async () => {
    // 401 is non-transient per `isTransientHttpError` — locking this in
    // prevents a regression that would hammer Google with retries against
    // a revoked grant.
    const errorBody = {
      error: "invalid_client",
      error_description: "The OAuth client was not found.",
    };
    mockFetch.mockResolvedValue(jsonResponse(errorBody, { status: 401 }));

    await expect(
      refreshGoogleAccessToken("rt", "wrong-client", "sec")
    ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries a transient 503 from Google and returns the eventual 200 tokens", async () => {
    vi.useFakeTimers();
    try {
      mockFetch
        .mockResolvedValueOnce(
          jsonResponse({ error: "service_unavailable" }, { status: 503 })
        )
        .mockResolvedValueOnce(
          jsonResponse({ access_token: "recovered", expires_in: 3600 })
        );

      const promise = refreshGoogleAccessToken("rt", "cid", "sec");
      await vi.runAllTimersAsync();
      const tokens = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(tokens.access_token).toBe("recovered");
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates the underlying TypeError when transient network errors exhaust the retry budget", async () => {
    // Closes the coverage gap flagged in #276: the outer `catch` branch of
    // `fetchWithRetry` (DNS / TCP failure after every retry) was not
    // exercised here. `fetch` throws `TypeError("fetch failed")` for these,
    // which `isTransientHttpError` classifies as transient — so we expect
    // the wrapper to retry up to its default budget (3 attempts) and then
    // re-throw the last TypeError. If a future refactor short-circuits the
    // retry loop, this test fails because `mockFetch` is no longer called
    // 3 times.
    vi.useFakeTimers();
    try {
      const networkError = new TypeError("fetch failed");
      mockFetch.mockRejectedValue(networkError);

      const promise = refreshGoogleAccessToken("rt", "cid", "sec");
      // Surface the rejection without unhandled-rejection noise while we
      // pump the retry sleeps.
      const settled = promise.catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      const result = await settled;

      expect(result).toBe(networkError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects with a TimeoutError-shaped error when the fetch hangs past the configured timeout, and the classifier marks it transient (#404)", async () => {
    // Drive the timeout via an AbortController whose signal we substitute
    // for `AbortSignal.timeout`'s. This is deterministic — fake timers
    // don't intercept the C++ timer `AbortSignal.timeout` uses internally,
    // so we abort it ourselves with the same DOMException shape Node
    // produces when the timeout fires.
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            reject(init.signal?.reason ?? new Error("aborted"));
          });
        })
    );

    const promise = refreshGoogleAccessToken("rt", "cid", "sec");
    controller.abort(new DOMException("signal timed out", "TimeoutError"));

    const result = (await promise.catch((e: unknown) => e)) as {
      name?: string;
    };
    expect(result.name).toBe("TimeoutError");
    // Lock the classification: a TimeoutError must not force re-auth.
    expect(classifyTokenRefreshError(result)).toBe("transient");
    // And `isTransientHttpError` excludes it from retry — only one attempt.
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("getRefreshTimeoutMs", () => {
  const ENV_KEY = "GOOGLE_TOKEN_REFRESH_TIMEOUT_MS";
  let originalValue: string | undefined;

  beforeEach(() => {
    originalValue = process.env[ENV_KEY];
  });

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalValue;
    }
  });

  it("returns the default 10s when the env var is unset", () => {
    delete process.env[ENV_KEY];
    expect(getRefreshTimeoutMs()).toBe(DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS);
    expect(DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS).toBe(10_000);
  });

  it("honours a positive integer override from the env var", () => {
    process.env[ENV_KEY] = "5000";
    expect(getRefreshTimeoutMs()).toBe(5_000);
  });

  it.each([
    ["not-a-number", "non-numeric input"],
    ["", "empty string"],
    ["0", "zero (no time budget)"],
    ["-1000", "negative duration"],
    ["1.5", "fractional ms (rejected; we only accept integers)"],
  ])("falls back to the default for invalid env value %p (%s)", (raw) => {
    process.env[ENV_KEY] = raw;
    expect(getRefreshTimeoutMs()).toBe(DEFAULT_GOOGLE_TOKEN_REFRESH_TIMEOUT_MS);
  });
});
