/**
 * Tests for the retry-with-backoff utility used to harden outbound HTTP calls
 * against transient failures (see issue #68).
 *
 * All tests use deterministic `random` / `now` / `sleep` overrides so they
 * run without real timers and without flakiness.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HttpRetryError,
  computeBackoffDelay,
  fetchWithRetry,
  isTransientHttpError,
  parseRetryAfter,
  withRetry,
} from "../retry";

/** Returns a sleep stub that records the delays it was asked to wait for. */
function createSleep() {
  const delays: number[] = [];
  const sleep = vi.fn((ms: number) => {
    delays.push(ms);
    return Promise.resolve();
  });
  return { sleep, delays };
}

/** Deterministic "random" that always returns the midpoint of [0, 1). */
const midpointRandom = () => 0.5;

describe("parseRetryAfter", () => {
  it("returns null for null / undefined / empty inputs", () => {
    expect(parseRetryAfter(null)).toBeNull();
    expect(parseRetryAfter(undefined)).toBeNull();
    expect(parseRetryAfter("")).toBeNull();
    expect(parseRetryAfter("   ")).toBeNull();
  });

  it("parses delay-seconds (integer) into milliseconds", () => {
    expect(parseRetryAfter("0")).toBe(0);
    expect(parseRetryAfter("5")).toBe(5000);
    expect(parseRetryAfter("120")).toBe(120_000);
  });

  it("parses a delay with surrounding whitespace", () => {
    expect(parseRetryAfter("   7   ")).toBe(7000);
  });

  it("returns null for negative or non-numeric non-date strings", () => {
    expect(parseRetryAfter("-5")).toBeNull();
    expect(parseRetryAfter("soon")).toBeNull();
    expect(parseRetryAfter("5.5")).toBeNull();
  });

  it("parses an HTTP-date relative to `now`", () => {
    const now = () => new Date("2026-04-22T12:00:00Z").getTime();
    const tenSecondsFromNow = new Date("2026-04-22T12:00:10Z").toUTCString();
    expect(parseRetryAfter(tenSecondsFromNow, now)).toBe(10_000);
  });

  it("clamps HTTP-dates in the past to 0", () => {
    const now = () => new Date("2026-04-22T12:00:00Z").getTime();
    const oneMinuteAgo = new Date("2026-04-22T11:59:00Z").toUTCString();
    expect(parseRetryAfter(oneMinuteAgo, now)).toBe(0);
  });

  it("returns null for invalid date strings", () => {
    expect(parseRetryAfter("not-a-date at all")).toBeNull();
  });
});

describe("isTransientHttpError", () => {
  it("treats 429 as transient", () => {
    expect(isTransientHttpError(new HttpRetryError(429, null))).toBe(true);
  });

  it("treats 5xx as transient", () => {
    expect(isTransientHttpError(new HttpRetryError(500, null))).toBe(true);
    expect(isTransientHttpError(new HttpRetryError(502, null))).toBe(true);
    expect(isTransientHttpError(new HttpRetryError(503, null))).toBe(true);
    expect(isTransientHttpError(new HttpRetryError(599, null))).toBe(true);
  });

  it("treats non-429 4xx as NOT transient (don't mask auth/validation bugs)", () => {
    expect(isTransientHttpError(new HttpRetryError(400, null))).toBe(false);
    expect(isTransientHttpError(new HttpRetryError(401, null))).toBe(false);
    expect(isTransientHttpError(new HttpRetryError(403, null))).toBe(false);
    expect(isTransientHttpError(new HttpRetryError(404, null))).toBe(false);
  });

  it("treats network errors (TypeError from fetch) as transient", () => {
    // `fetch` throws TypeError for DNS / TCP / CORS / abort-free network
    // failures. Node emits "fetch failed", Chrome "Failed to fetch", Firefox
    // "NetworkError when attempting to fetch resource" — all contain "fetch".
    expect(isTransientHttpError(new TypeError("fetch failed"))).toBe(true);
    expect(isTransientHttpError(new TypeError("Failed to fetch"))).toBe(true);
    expect(
      isTransientHttpError(
        new TypeError("NetworkError when attempting to fetch resource.")
      )
    ).toBe(true);
  });

  it("does NOT treat programming TypeErrors (bad URL / bad header) as transient", () => {
    // Regression guard for review feedback: `fetch` also throws TypeError for
    // synchronous programming errors — invalid URLs, malformed header values.
    // Those are bugs, not transient failures; retrying wastes quota and masks
    // the defect.
    expect(isTransientHttpError(new TypeError("Invalid URL"))).toBe(false);
    expect(
      isTransientHttpError(new TypeError("Header value contains invalid bytes"))
    ).toBe(false);
    expect(isTransientHttpError(new TypeError("foo is not a function"))).toBe(
      false
    );
  });

  it("does not treat AbortError as transient (caller requested abort)", () => {
    const abortError = Object.assign(new Error("aborted"), {
      name: "AbortError",
    });
    expect(isTransientHttpError(abortError)).toBe(false);
  });

  it("returns false for non-error values", () => {
    expect(isTransientHttpError(undefined)).toBe(false);
    expect(isTransientHttpError(null)).toBe(false);
    expect(isTransientHttpError("boom")).toBe(false);
    expect(isTransientHttpError(42)).toBe(false);
  });
});

describe("computeBackoffDelay", () => {
  it("grows exponentially with attempt number (jitter: 'none')", () => {
    const opts = {
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 10_000,
      jitter: "none" as const,
      random: midpointRandom,
    };
    expect(computeBackoffDelay(1, opts)).toBe(100);
    expect(computeBackoffDelay(2, opts)).toBe(200);
    expect(computeBackoffDelay(3, opts)).toBe(400);
    expect(computeBackoffDelay(4, opts)).toBe(800);
  });

  it("caps delay at `maxDelayMs`", () => {
    const opts = {
      baseDelayMs: 1000,
      factor: 10,
      maxDelayMs: 3000,
      jitter: "none" as const,
      random: midpointRandom,
    };
    expect(computeBackoffDelay(1, opts)).toBe(1000);
    expect(computeBackoffDelay(2, opts)).toBe(3000);
    expect(computeBackoffDelay(5, opts)).toBe(3000);
  });

  it("applies full jitter within [0, base] using the injected random source", () => {
    const opts = {
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 10_000,
      jitter: "full" as const,
      random: () => 0.25,
    };
    // attempt 1: uniform in [0, 100) — random=0.25 → 25
    // attempt 2: uniform in [0, 200) — random=0.25 → 50
    expect(computeBackoffDelay(1, opts)).toBe(25);
    expect(computeBackoffDelay(2, opts)).toBe(50);
  });

  it("prefers retryAfterMs over the backoff value when provided", () => {
    const opts = {
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 10_000,
      jitter: "none" as const,
      random: midpointRandom,
    };
    expect(computeBackoffDelay(1, opts, 2500)).toBe(2500);
  });

  it("caps retryAfterMs at maxDelayMs", () => {
    const opts = {
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 3000,
      jitter: "none" as const,
      random: midpointRandom,
    };
    expect(computeBackoffDelay(1, opts, 60_000)).toBe(3000);
  });

  it("clamps retryAfterMs at 0 (never negative)", () => {
    const opts = {
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 3000,
      jitter: "none" as const,
      random: midpointRandom,
    };
    expect(computeBackoffDelay(1, opts, -50)).toBe(0);
  });
});

describe("withRetry", () => {
  it("returns the value on first success without calling sleep", async () => {
    const { sleep, delays } = createSleep();
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry(fn, { sleep, random: midpointRandom });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(delays).toEqual([]);
  });

  it("retries transient errors up to maxAttempts, then throws the final error", async () => {
    const { sleep, delays } = createSleep();
    const transient = new HttpRetryError(500, null);
    const fn = vi.fn().mockRejectedValue(transient);

    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        factor: 2,
        jitter: "none",
        sleep,
        random: midpointRandom,
      })
    ).rejects.toBe(transient);

    expect(fn).toHaveBeenCalledTimes(3);
    // Two sleeps: between attempt 1→2 and 2→3. Not after the final failure.
    expect(delays).toEqual([10, 20]);
  });

  it("does not retry non-transient errors", async () => {
    const { sleep, delays } = createSleep();
    const nonTransient = new HttpRetryError(404, null);
    const fn = vi.fn().mockRejectedValue(nonTransient);

    await expect(withRetry(fn, { sleep, random: midpointRandom })).rejects.toBe(
      nonTransient
    );

    expect(fn).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("respects a custom shouldRetry predicate", async () => {
    const { sleep } = createSleep();
    const err = new Error("always retry");
    const fn = vi
      .fn()
      .mockRejectedValueOnce(err)
      .mockRejectedValueOnce(err)
      .mockResolvedValue("ok");

    const result = await withRetry(fn, {
      maxAttempts: 4,
      shouldRetry: () => true,
      baseDelayMs: 1,
      jitter: "none",
      sleep,
      random: midpointRandom,
    });

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("succeeds on a retry after transient failures", async () => {
    const { sleep } = createSleep();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new HttpRetryError(503, null))
      .mockResolvedValue("recovered");

    const result = await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 1,
      jitter: "none",
      sleep,
      random: midpointRandom,
    });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("invokes onRetry with attempt / delay / error metadata", async () => {
    const { sleep } = createSleep();
    const onRetry = vi.fn();
    const err = new HttpRetryError(500, null);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");

    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      factor: 2,
      jitter: "none",
      onRetry,
      sleep,
      random: midpointRandom,
    });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 100,
      error: err,
      retryAfterMs: null,
    });
  });

  it("honours retryAfterMs from an HttpRetryError (caps at maxDelayMs)", async () => {
    const { sleep, delays } = createSleep();
    const err = new HttpRetryError(429, 2500);
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");

    await withRetry(fn, {
      maxAttempts: 3,
      baseDelayMs: 100,
      factor: 2,
      maxDelayMs: 10_000,
      jitter: "full",
      sleep,
      random: midpointRandom,
    });

    expect(delays).toEqual([2500]);
  });

  it("throws immediately when the AbortSignal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = vi.fn();

    await expect(
      withRetry(fn, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("stops retrying once the signal is aborted between attempts", async () => {
    const controller = new AbortController();
    const { sleep } = createSleep();
    const err = new HttpRetryError(500, null);
    const fn = vi.fn(async (attempt: number) => {
      if (attempt === 1) {
        // Abort after the first failure but before the second attempt.
        controller.abort();
      }
      throw err;
    });

    await expect(
      withRetry(fn, {
        maxAttempts: 5,
        baseDelayMs: 1,
        jitter: "none",
        signal: controller.signal,
        sleep,
        random: midpointRandom,
      })
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults maxAttempts to 3 (one initial + two retries)", async () => {
    const { sleep } = createSleep();
    const err = new HttpRetryError(503, null);
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { baseDelayMs: 1, jitter: "none", sleep })
    ).rejects.toBe(err);

    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe("fetchWithRetry", () => {
  let originalFetch: typeof fetch;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = global.fetch;
    mockFetch = vi.fn();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const okResponse = (body: unknown = {}) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const errorResponse = (
    status: number,
    body: unknown = {},
    headers: Record<string, string> = {}
  ) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json", ...headers },
    });

  it("returns the first ok response without retrying", async () => {
    mockFetch.mockResolvedValueOnce(okResponse({ items: ["a"] }));
    const { sleep, delays } = createSleep();

    const response = await fetchWithRetry("https://example.com/x", undefined, {
      sleep,
      random: midpointRandom,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: ["a"] });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("returns a non-transient !ok response without retrying (e.g. 401)", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(401, { error: "auth" }));
    const { sleep, delays } = createSleep();

    const response = await fetchWithRetry("https://example.com/x", undefined, {
      sleep,
      random: midpointRandom,
    });

    expect(response.status).toBe(401);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([]);
  });

  it("retries transient 5xx responses and returns the eventual ok response", async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(502))
      .mockResolvedValueOnce(okResponse({ ok: true }));
    const { sleep, delays } = createSleep();

    const response = await fetchWithRetry("https://example.com/x", undefined, {
      maxAttempts: 3,
      baseDelayMs: 10,
      factor: 2,
      jitter: "none",
      sleep,
      random: midpointRandom,
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(delays).toEqual([10, 20]);
  });

  it("honours Retry-After on 429 responses", async () => {
    mockFetch
      .mockResolvedValueOnce(errorResponse(429, {}, { "Retry-After": "2" }))
      .mockResolvedValueOnce(okResponse());
    const { sleep, delays } = createSleep();

    await fetchWithRetry("https://example.com/x", undefined, {
      maxAttempts: 2,
      baseDelayMs: 100,
      maxDelayMs: 10_000,
      jitter: "full",
      sleep,
      random: midpointRandom,
    });

    expect(delays).toEqual([2000]);
  });

  it("returns the last transient response if every retry also fails", async () => {
    const finalResponse = errorResponse(503, { error: "still broken" });
    mockFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(finalResponse);
    const { sleep } = createSleep();

    const response = await fetchWithRetry("https://example.com/x", undefined, {
      maxAttempts: 3,
      baseDelayMs: 1,
      jitter: "none",
      sleep,
      random: midpointRandom,
    });

    // Caller still sees a Response with status 503 so their `if (!ok)` branch
    // runs as before — retry is invisible to downstream error handling.
    expect(response.status).toBe(503);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries when fetch itself throws a network error", async () => {
    mockFetch
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(okResponse());
    const { sleep } = createSleep();

    const response = await fetchWithRetry("https://example.com/x", undefined, {
      maxAttempts: 2,
      baseDelayMs: 1,
      jitter: "none",
      sleep,
      random: midpointRandom,
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("re-throws a thrown network error after exhausting retries", async () => {
    const netError = new TypeError("fetch failed");
    mockFetch.mockRejectedValue(netError);
    const { sleep } = createSleep();

    await expect(
      fetchWithRetry("https://example.com/x", undefined, {
        maxAttempts: 2,
        baseDelayMs: 1,
        jitter: "none",
        sleep,
        random: midpointRandom,
      })
    ).rejects.toBe(netError);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("threads an AbortSignal through to fetch", async () => {
    mockFetch.mockResolvedValueOnce(okResponse());
    const controller = new AbortController();
    const { sleep } = createSleep();

    await fetchWithRetry(
      "https://example.com/x",
      { method: "GET" },
      {
        signal: controller.signal,
        sleep,
        random: midpointRandom,
      }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/x",
      expect.objectContaining({ signal: controller.signal })
    );
  });

  it("re-throws a network error even when a prior attempt returned a transient response (no stale fallback)", async () => {
    // Regression guard for review feedback: if attempts mix transient 5xx
    // responses and network failures and the FINAL attempt throws a network
    // error, `fetchWithRetry` must surface the thrown error — not the stale
    // Response object left over from an earlier transient attempt.
    const netError = new TypeError("fetch failed");
    mockFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockRejectedValueOnce(netError)
      .mockRejectedValueOnce(netError);
    const { sleep } = createSleep();

    await expect(
      fetchWithRetry("https://example.com/x", undefined, {
        maxAttempts: 3,
        baseDelayMs: 1,
        jitter: "none",
        sleep,
        random: midpointRandom,
      })
    ).rejects.toBe(netError);

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("clones a Request input before retrying (body stream is single-shot)", async () => {
    // A Request body is a ReadableStream that is consumed on the first fetch.
    // Retrying with the same Request would send an empty body. `fetchWithRetry`
    // must clone per attempt.
    const request = new Request("https://example.com/x", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "payload",
    });

    mockFetch
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse());
    const { sleep } = createSleep();

    await fetchWithRetry(request, undefined, {
      maxAttempts: 2,
      baseDelayMs: 1,
      jitter: "none",
      sleep,
      random: midpointRandom,
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Each call must receive a distinct Request instance so body reads
    // succeed on the retry.
    const firstArg = mockFetch.mock.calls[0]![0];
    const secondArg = mockFetch.mock.calls[1]![0];
    expect(firstArg).toBeInstanceOf(Request);
    expect(secondArg).toBeInstanceOf(Request);
    expect(firstArg).not.toBe(secondArg);
  });

  it("does not clobber a pre-existing init.signal (caller signal wins)", async () => {
    // If a caller passes their own signal via `init`, we keep it as-is. Merging
    // two signals into one requires AbortSignal.any, which is available in
    // Node 20+ but not universally, so the simpler contract is: caller's
    // init.signal overrides options.signal.
    mockFetch.mockResolvedValueOnce(okResponse());
    const innerController = new AbortController();
    const outerController = new AbortController();
    const { sleep } = createSleep();

    await fetchWithRetry(
      "https://example.com/x",
      { method: "GET", signal: innerController.signal },
      {
        signal: outerController.signal,
        sleep,
        random: midpointRandom,
      }
    );

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/x",
      expect.objectContaining({ signal: innerController.signal })
    );
  });
});

describe("HttpRetryError", () => {
  it("captures status and retryAfterMs for callers to inspect", () => {
    const err = new HttpRetryError(503, 1500, "custom");
    expect(err.name).toBe("HttpRetryError");
    expect(err.status).toBe(503);
    expect(err.retryAfterMs).toBe(1500);
    expect(err.message).toContain("custom");
  });

  it("defaults message based on status", () => {
    const err = new HttpRetryError(429, 500);
    expect(err.message).toMatch(/429/);
  });
});
