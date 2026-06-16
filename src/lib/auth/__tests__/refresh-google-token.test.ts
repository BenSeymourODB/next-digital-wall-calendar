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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { classifyTokenRefreshError } from "../refresh-error-classifier";
import {
  GoogleTokenRefreshError,
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

  // Issue #405: Google can return a 200 with a non-token body (proxy error,
  // partial payload, edge-case rate-limit JSON). Without runtime validation
  // `expires_in` is undefined → `Math.floor(now/1000 + undefined)` is NaN and
  // Prisma writes corrupt the account row's refresh window. These tests pin
  // the shape-check at the wire boundary so the malformed payload surfaces as
  // a transient `GoogleTokenRefreshError` instead of silent NaN downstream.
  describe("runtime payload validation (issue #405)", () => {
    it("throws GoogleTokenRefreshError when a 200 response is missing expires_in", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ access_token: "valid-but-incomplete" })
      );

      await expect(
        refreshGoogleAccessToken("rt", "cid", "sec")
      ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
    });

    it("throws GoogleTokenRefreshError when expires_in is the wrong type (string)", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ access_token: "valid", expires_in: "3600" })
      );

      await expect(
        refreshGoogleAccessToken("rt", "cid", "sec")
      ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
    });

    it("throws GoogleTokenRefreshError when the 200 body is null", async () => {
      mockFetch.mockResolvedValue(jsonResponse(null));

      await expect(
        refreshGoogleAccessToken("rt", "cid", "sec")
      ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
    });

    it("throws GoogleTokenRefreshError when the 200 body is an unrelated JSON value", async () => {
      // A proxy rewriting the response to a string or array still parses as
      // JSON but doesn't satisfy the token shape.
      mockFetch.mockResolvedValue(jsonResponse([]));

      await expect(
        refreshGoogleAccessToken("rt", "cid", "sec")
      ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
    });

    it("throws GoogleTokenRefreshError when expires_in is non-positive", async () => {
      // `Math.floor(now/1000 + 0)` would still update the row to an already-
      // expired window — caller would re-enter the refresh path on every
      // session callback. Treat zero / negative as malformed.
      mockFetch.mockResolvedValue(
        jsonResponse({ access_token: "valid", expires_in: 0 })
      );

      await expect(
        refreshGoogleAccessToken("rt", "cid", "sec")
      ).rejects.toBeInstanceOf(GoogleTokenRefreshError);
    });

    it("tags the malformed-payload error so classifyTokenRefreshError returns transient", async () => {
      // The orchestrator's `.finally()` purges the singleflight slot on either
      // classification, but a terminal classification would dump the user back
      // to a sign-in screen for a Google-side anomaly. Pin it to transient.
      mockFetch.mockResolvedValue(jsonResponse({}));

      const caught = await refreshGoogleAccessToken("rt", "cid", "sec").catch(
        (e: unknown) => e
      );

      expect(caught).toBeInstanceOf(GoogleTokenRefreshError);
      const err = caught as GoogleTokenRefreshError;
      expect(err.body).toMatchObject({ error: "malformed_token_response" });
      expect(classifyTokenRefreshError(err)).toBe("transient");
    });

    it("accepts a canonical response (access_token + positive int expires_in) without throwing", async () => {
      // Locks in that the validator doesn't reject the happy path, including
      // when the optional refresh_token / scope / token_type fields are absent
      // (Google omits refresh_token on routine refreshes).
      mockFetch.mockResolvedValue(
        jsonResponse({ access_token: "new-access", expires_in: 3599 })
      );

      const tokens = await refreshGoogleAccessToken("rt", "cid", "sec");

      expect(tokens.access_token).toBe("new-access");
      expect(tokens.expires_in).toBe(3599);
    });
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
});
