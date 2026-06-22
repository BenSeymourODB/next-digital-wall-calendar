# Signal-aware sleep in `withRetry` (#434)

## Problem

`withRetry` in `src/lib/http/retry.ts` accepts an `AbortSignal` via `options.signal` but only checks it (a) before the first attempt, (b) immediately before/after the inter-attempt sleep. The sleep itself is _not_ abortable — once it starts, it runs to completion. The abort is observed only when the next iteration begins.

When `refreshGoogleAccessToken` (post-#430) passes `AbortSignal.timeout(N)` via `init.signal`, the per-flight signal aborts the in-flight `fetch()` but cannot interrupt the wait between attempts. Worst-case wall time is `timeout + maxDelayMs` (~15s with defaults), not `timeout`.

Additionally, `fetchWithRetry` never propagates `init.signal` into `withRetry` via `options.signal`. So even with a signal-aware sleep, the timeout signal in `refreshGoogleAccessToken`'s call site is invisible to the retry loop.

## Scope of this change

1. **Make `withRetry`'s inter-attempt sleep signal-aware**, with proper listener cleanup so listeners do not leak on success or non-abort failure paths.
2. **Promote `init.signal` to `options.signal` in `fetchWithRetry`** when the caller did not pass `options.signal`. Preserves the existing "init.signal wins over options.signal in the both-set case" contract.
3. **TDD**: new unit tests in `src/lib/http/__tests__/retry.test.ts` covering:
   - Sleep rejects immediately when the signal aborts mid-sleep.
   - Abort listener is removed when the sleep completes naturally (no leak).
   - Abort listener is removed when retries succeed (no leak).
   - `fetchWithRetry` threads `init.signal` into `withRetry`'s sleep when `options.signal` is unset.

## Out of scope

- Touching `refreshGoogleAccessToken` (PR #430 does that). When both #430 and this issue ship, the worst-case wall-time bound is tightened automatically.
- Switching to `AbortSignal.any` to merge `init.signal` and `options.signal` — would break the existing "caller signal wins" contract documented in the test at retry.test.ts:625. If desirable in future, file a follow-up.

## Design notes

Helper inside `retry.ts`:

```ts
async function abortableSleep(
  ms: number,
  sleep: (ms: number) => Promise<void>,
  signal: AbortSignal | undefined
): Promise<void> {
  if (!signal) return sleep(ms);
  if (signal.aborted) throw abortError();

  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<never>((_, reject) => {
    onAbort = () => reject(abortError());
    signal.addEventListener("abort", onAbort);
  });

  try {
    await Promise.race([sleep(ms), abortPromise]);
  } finally {
    if (onAbort) signal.removeEventListener("abort", onAbort);
  }
}
```

`{ once: true }` would auto-remove on fire but leak on the sleep-wins path. Always manually `removeEventListener` in a `finally` block — `removeEventListener` is a no-op if the listener already auto-removed, so this is safe in every branch.

`fetchWithRetry` change:

```ts
const effectiveOptions: RetryOptions =
  options.signal == null && init?.signal != null ? { ...options, signal: init.signal } : options;
```

## Validation

- `pnpm test src/lib/http/__tests__/retry.test.ts` — new tests green, all existing tests still green.
- `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.
