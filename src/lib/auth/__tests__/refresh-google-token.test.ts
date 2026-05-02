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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshGoogleAccessToken } from "../refresh-google-token";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function jsonResponse(
  body: unknown,
  init: { ok?: boolean; status?: number } = {}
): Response {
  const status = init.status ?? 200;
  const ok = init.ok ?? (status >= 200 && status < 300);
  return {
    ok,
    status,
    headers: new Headers(),
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

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

  it("throws the parsed error body on a 4xx response (non-transient, no retry)", async () => {
    const errorBody = {
      error: "invalid_grant",
      error_description: "Token has been expired or revoked.",
    };
    mockFetch.mockResolvedValue(jsonResponse(errorBody, { status: 400 }));

    await expect(
      refreshGoogleAccessToken("revoked-rt", "cid", "sec")
    ).rejects.toEqual(errorBody);
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
});
