# Plan — Issue #404: fetch timeout for `refreshGoogleAccessToken`

## Problem

After PR #401 collapses concurrent session refreshes onto a single in-flight
promise (singleflight, #216), a hung TCP connection to
`oauth2.googleapis.com` pins the slot until the Node process restarts.
`refreshGoogleAccessToken` calls `fetchWithRetry` with no `AbortSignal`,
so a connect that hangs with no RST waits indefinitely.

## Goal

Bound the total time a single Google token-refresh flight can occupy. On
timeout, propagate a `TimeoutError`-shaped error so the singleflight
`.finally()` purges the slot, the classifier marks it `transient`, and the
next call retries.

## Design

1. **Per-flight timeout via `AbortSignal.timeout(ms)`.** Passed as
   `init.signal` to `fetchWithRetry`, threaded into every `fetch` attempt
   by the existing init pass-through. A single overall budget (10 s
   default) is the simplest model: a hung attempt aborts; backoff sleeps
   between retries cut into the budget, which is fine for a 3-attempt
   budget against a 10 s ceiling.

2. **Env-tuneable default.** New env var `GOOGLE_TOKEN_REFRESH_TIMEOUT_MS`.
   Parsed per-call so tests can override via `process.env`. Invalid values
   (NaN, non-positive) fall back to the 10 s default; we never want to
   accidentally configure a zero-/negative-millisecond timeout that
   instantly aborts every refresh.

3. **No change to error classification.** `isTransientHttpError` already
   excludes `name === "TimeoutError"` from retry (good — don't burn the
   budget retrying a hang), and `classifyTokenRefreshError` already defaults
   non-Google, non-sentinel errors to `transient`. The new timeout error
   threads through unchanged.

## Files touched

- `src/lib/auth/refresh-google-token.ts` — set `signal` on the
  `fetchWithRetry` init; new exported helper `getRefreshTimeoutMs(env)` for
  testable env-parsing.
- `src/lib/auth/__tests__/refresh-google-token.test.ts` — assertions that
  (a) a `signal` is passed, (b) the signal is an `AbortSignal` produced
  with the configured timeout, (c) a fetch that hangs past the timeout
  rejects with `name === "TimeoutError"`, (d) env override is honoured,
  (e) invalid env values fall back to default.
- `src/lib/auth/__tests__/refresh-error-classifier.test.ts` — explicit case
  that a `TimeoutError`-shaped error classifies as `transient`. (Already
  covered by the "arbitrary unknown error" path, but lock the contract.)
- `src/lib/auth/__tests__/token-refresh-singleflight.test.ts` — additional
  case proving the in-flight slot is purged after a hung refresh times
  out, so the next caller starts a fresh flight.

## Acceptance criteria (from #404)

- [x] `refreshGoogleAccessToken` passes a per-request `AbortSignal` with a
      finite timeout (default 10 s, env-tuneable).
- [x] Regression test in `refresh-google-token.test.ts` proves a hung fetch
      rejects with a `TimeoutError`-named error and that the classifier
      returns `transient` for it.
- [x] Singleflight test asserts the in-flight Map slot is purged after a
      hung refresh times out (subsequent call starts a new flight).

## Out of scope

- Cross-process dedupe (#286) — orthogonal.
- Per-attempt timeout (vs. overall budget) — not required by the issue;
  current overall budget is sufficient given the small retry budget.
- Promoting `fetchWithRetry` to accept an `AbortSignal.any` merge of init
  - outer signals (would need Node ≥ 20 confirmation; not needed here).
