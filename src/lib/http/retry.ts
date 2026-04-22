/**
 * Retry-with-backoff utility for outbound HTTP calls.
 *
 * Addresses the first bullet of issue #68 — transient network failures and
 * rate-limited (429) / overloaded (5xx) responses against Google's APIs were
 * bubbling straight to the user as one-shot errors. This module adds:
 *
 *   - {@link withRetry} — a generic retry wrapper around any async function
 *   - {@link fetchWithRetry} — a drop-in replacement for `fetch` that retries
 *     transient HTTP failures and leaves non-transient responses (401, 404,
 *     etc.) alone for the caller to handle exactly as before
 *   - {@link isTransientHttpError} — classifier used by the default retry
 *     predicate
 *   - {@link parseRetryAfter} — parses `Retry-After` in both seconds and
 *     HTTP-date form
 *
 * All timing primitives (`sleep`, `now`, `random`) are injectable so the unit
 * tests can exercise every branch deterministically without real timers.
 */

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 300;
const DEFAULT_MAX_DELAY_MS = 5_000;
const DEFAULT_FACTOR = 2;

export type JitterMode = "none" | "full";

export interface BackoffOptions {
  /** Initial delay before the second attempt, in ms. */
  baseDelayMs?: number;
  /** Hard ceiling on any computed delay (including Retry-After). */
  maxDelayMs?: number;
  /** Exponential factor applied per attempt. */
  factor?: number;
  /** "full" spreads delays uniformly in [0, base*factor^(n-1)]. */
  jitter?: JitterMode;
  /** RNG used for jitter — override in tests for determinism. */
  random?: () => number;
}

export interface RetryAttemptInfo {
  attempt: number;
  delayMs: number;
  error: unknown;
  retryAfterMs: number | null;
}

export interface RetryOptions extends BackoffOptions {
  /** Total attempts INCLUDING the first one. Defaults to 3. */
  maxAttempts?: number;
  /** Returns true if the error/attempt combination should trigger a retry. */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  /** Observer invoked immediately before each retry's sleep. */
  onRetry?: (info: RetryAttemptInfo) => void;
  /** Aborts the retry loop; honours both pre-armed and in-flight aborts. */
  signal?: AbortSignal;
  /** Sleep primitive — override in tests. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Typed error raised when a response's HTTP status warrants a retry. Callers
 * of {@link fetchWithRetry} should never see this — it is used internally to
 * thread retry information (status + parsed Retry-After) through the retry
 * loop, and to give {@link isTransientHttpError} a structured signal.
 */
export class HttpRetryError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(status: number, retryAfterMs: number | null, message?: string) {
    super(message ?? `HTTP ${status}`);
    this.name = "HttpRetryError";
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

const resolvedBackoffDefaults = (opts: BackoffOptions) => ({
  baseDelayMs: opts.baseDelayMs ?? DEFAULT_BASE_DELAY_MS,
  maxDelayMs: opts.maxDelayMs ?? DEFAULT_MAX_DELAY_MS,
  factor: opts.factor ?? DEFAULT_FACTOR,
  jitter: opts.jitter ?? "full",
  random: opts.random ?? Math.random,
});

/**
 * Classifies whether an error (or an {@link HttpRetryError}) is worth
 * retrying. Intentionally strict: only 429, 5xx, and low-level network errors
 * (`TypeError` thrown by `fetch`) are considered transient. Non-429 4xx
 * responses — auth failures, validation errors, not-found — are treated as
 * permanent so retries never mask real bugs.
 */
export function isTransientHttpError(error: unknown): boolean {
  if (error instanceof HttpRetryError) {
    if (error.status === 429) return true;
    return error.status >= 500 && error.status < 600;
  }
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return false;
  }
  // `fetch` throws TypeError for DNS / TCP / CORS / offline failures — and
  // also for programming errors like invalid URLs or bad header values. The
  // network cases all mention "fetch" in the message across Node ("fetch
  // failed"), Chrome ("Failed to fetch"), and Firefox ("NetworkError when
  // attempting to fetch resource"); programming errors say things like
  // "Invalid URL" and should fail fast, not retry. Narrow the match so bugs
  // surface instead of burning retry budget.
  if (error instanceof TypeError && /fetch/i.test(error.message)) return true;
  return false;
}

/**
 * Parse a `Retry-After` header into milliseconds.
 *
 *  - `"5"` → 5000
 *  - `"Wed, 21 Oct 2026 07:28:00 GMT"` → ms-until-that-date (clamped at 0)
 *  - negative / malformed / empty → `null`
 */
export function parseRetryAfter(
  header: string | null | undefined,
  now: () => number = Date.now
): number | null {
  if (header == null) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;

  // Delay-seconds: must be a non-negative integer. Reject fractional seconds
  // so we don't silently truncate (the spec only permits integer seconds).
  if (/^\d+$/.test(trimmed)) {
    const seconds = Number.parseInt(trimmed, 10);
    return seconds * 1000;
  }

  // HTTP-date per RFC 7231 always contains a weekday abbreviation — require
  // at least one alphabetic character so things like "-5" or "5.5" don't
  // fall into `Date.parse`, which happily accepts "-5" as year -5.
  if (!/[A-Za-z]/.test(trimmed)) return null;
  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) return null;
  const delta = parsed - now();
  return delta > 0 ? delta : 0;
}

/**
 * Compute the delay before the next attempt. `retryAfterMs`, when provided,
 * overrides the exponential backoff but is still clamped by `maxDelayMs`.
 * Exposed for unit testing of the delay math in isolation.
 */
export function computeBackoffDelay(
  attempt: number,
  options: BackoffOptions,
  retryAfterMs: number | null = null
): number {
  const { baseDelayMs, maxDelayMs, factor, jitter, random } =
    resolvedBackoffDefaults(options);

  if (retryAfterMs != null) {
    if (retryAfterMs < 0) return 0;
    return Math.min(retryAfterMs, maxDelayMs);
  }

  const exp = baseDelayMs * Math.pow(factor, Math.max(0, attempt - 1));
  const capped = Math.min(exp, maxDelayMs);

  if (jitter === "full") {
    return Math.floor(random() * capped);
  }
  return capped;
}

function defaultSleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function abortError(): Error {
  // DOMException isn't guaranteed in every runtime; a plain Error with
  // `name: "AbortError"` is what the Web `fetch` spec surfaces and what
  // callers are likely to check.
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

function extractRetryAfterMs(error: unknown): number | null {
  if (error instanceof HttpRetryError) return error.retryAfterMs;
  return null;
}

/**
 * Retry `fn` with exponential backoff + jitter when it throws a transient
 * error. The function receives the 1-indexed `attempt` number so callers can
 * log or adapt on retry.
 *
 * Callers that want to retry every failure (e.g. a test helper) can pass a
 * permissive `shouldRetry: () => true`.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  const shouldRetry = options.shouldRetry ?? isTransientHttpError;
  const sleep = options.sleep ?? defaultSleep;
  const { signal, onRetry } = options;

  if (signal?.aborted) throw abortError();

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (signal?.aborted) throw abortError();
      if (attempt >= maxAttempts) throw error;
      if (!shouldRetry(error, attempt)) throw error;

      const retryAfterMs = extractRetryAfterMs(error);
      const delayMs = computeBackoffDelay(attempt, options, retryAfterMs);

      onRetry?.({ attempt, delayMs, error, retryAfterMs });

      await sleep(delayMs);

      if (signal?.aborted) throw abortError();
    }
  }

  // Unreachable: the loop either returns or throws. Rethrow the last seen
  // error as a safety net for future refactors.
  throw lastError;
}

/**
 * `fetch` wrapper that retries transient failures (429 / 5xx / network) and
 * returns non-transient responses (200s, 401, 404, ...) untouched. The caller
 * keeps full control of its `!response.ok` branch — retry is invisible to
 * downstream error handling.
 *
 * Signal precedence: if `init.signal` is provided it wins, because merging
 * two signals requires `AbortSignal.any` (Node 20+) and we want one simple
 * contract. If `init.signal` is absent and `options.signal` is provided, the
 * outer signal is threaded through.
 */
export async function fetchWithRetry(
  input: Parameters<typeof fetch>[0],
  init?: Parameters<typeof fetch>[1],
  options: RetryOptions = {}
): Promise<Response> {
  const effectiveInit: RequestInit = {
    ...(init ?? {}),
  };
  if (!effectiveInit.signal && options.signal) {
    effectiveInit.signal = options.signal;
  }

  // `fetchWithRetry` reads its own copy of maxAttempts so the inner function
  // can decide between "throw HttpRetryError" (ask `withRetry` to retry) and
  // "return the transient response as-is" (we're out of budget, let the
  // caller's existing !ok branch run). `withRetry` reads the same option too;
  // sharing the options object keeps them in lock-step.
  const maxAttempts = options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;

  let lastResponse: Response | undefined;

  try {
    await withRetry<Response>(async (attempt) => {
      // A Request body is a ReadableStream that is consumed on first read;
      // calling `fetch(request)` twice would send an empty body on retry.
      // Clone per attempt when the caller passed a Request so retries carry
      // the original payload. String/URL inputs are not consumable and do
      // not need cloning.
      const perAttemptInput = input instanceof Request ? input.clone() : input;
      const response = await fetch(perAttemptInput, effectiveInit);
      if (response.ok || !shouldRetryResponse(response)) {
        lastResponse = response;
        return response;
      }

      lastResponse = response;

      if (attempt >= maxAttempts) {
        // Out of budget: return the response so the caller's existing
        // !ok branch runs just like before retry existed.
        return response;
      }

      const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
      throw new HttpRetryError(
        response.status,
        retryAfterMs,
        `HTTP ${response.status} from ${safeUrl(input)}`
      );
    }, options);
  } catch (error) {
    // Only substitute the stored transient response when the retry loop
    // escalated *this* attempt via HttpRetryError. If the final attempt
    // threw a network error (TypeError) or AbortError, lastResponse may be
    // a stale Response from an earlier attempt whose body is already
    // consumed — returning it would silently corrupt the caller's error
    // handling. Propagate the thrown error instead.
    if (
      error instanceof HttpRetryError &&
      lastResponse &&
      !lastResponse.ok &&
      shouldRetryResponse(lastResponse)
    ) {
      return lastResponse;
    }
    throw error;
  }

  if (!lastResponse) {
    // Unreachable: `withRetry` either resolves (setting lastResponse) or
    // throws. Guard the type narrowing anyway.
    throw new Error("fetchWithRetry: no response produced");
  }
  return lastResponse;
}

function shouldRetryResponse(response: Response): boolean {
  if (response.ok) return false;
  return response.status === 429 || response.status >= 500;
}

function safeUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return "<request>";
}
