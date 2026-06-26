# Merge `init.signal` and `options.signal` in `fetchWithRetry` via `AbortSignal.any` (#436)

## Problem

PR #435 closed #434 by making `withRetry`'s inter-attempt sleep signal-aware
and promoting `init.signal` to `options.signal` in `fetchWithRetry` _only when
the caller did not pass `options.signal`_. When both signals are set the
semantics are asymmetric:

- Each `fetch()` call observes `init.signal` (the "caller signal wins" rule
  pinned by the existing test at `retry.test.ts:739`).
- The inter-attempt sleep in `withRetry` observes `options.signal`.

That is an artefact of avoiding `AbortSignal.any` in #435, not a deliberate
design. Either side aborting should tear down the _entire_ operation — both
the in-flight fetch and the retry loop.

## Change

In `fetchWithRetry`, when both signals are present, merge them with
`AbortSignal.any([init.signal, options.signal])` and use the merged signal
for both the `fetch()` call and the retry loop. `AbortSignal.any` is Node
≥ 20.3 and modern browsers; `.nvmrc` pins Node 22, so the runtime is met.

```ts
const mergedSignal: AbortSignal | undefined =
  init?.signal != null && options.signal != null
    ? AbortSignal.any([init.signal, options.signal])
    : (init?.signal ?? options.signal);

const effectiveInit: RequestInit = { ...(init ?? {}) };
if (mergedSignal) effectiveInit.signal = mergedSignal;

const effectiveOptions: RetryOptions = mergedSignal
  ? { ...options, signal: mergedSignal }
  : options;
```

The JSDoc on `fetchWithRetry` that flagged the asymmetry is rewritten — the
merge eliminates it.

## Acceptance criteria (from issue #436)

- [ ] Both signals are merged when both are passed; either aborting aborts
      the entire retry loop and the in-flight fetch.
- [ ] When only one signal is passed, behaviour matches PR #435 / today
      (existing tests stay green).
- [ ] The "caller signal wins" test at `retry.test.ts:739` is updated or
      replaced to reflect the new merge semantic.
- [ ] New test covers a fired `options.signal` aborting the in-flight fetch
      / retry loop when both signals were passed.

## TDD

Test changes in `src/lib/http/__tests__/retry.test.ts`:

1. **Replace** the `does not clobber a pre-existing init.signal` test with a
   merge-semantic test:
   - The signal passed to `fetch` is _neither_ of the input signals (it is
     the merged result of `AbortSignal.any`).
   - Aborting `outerController.signal` flips `passedSignal.aborted` to true,
     proving the merge wired up the outer source.
2. **Add** a new "options.signal aborts mid-sleep when both signals are
   passed" test — mirrors the existing #434 `init.signal` test but fires the
   outer signal instead.

## Out of scope

- Changing `refreshGoogleAccessToken` or any other call site. The call site
  passes only `init.signal` (no `options.signal`), so the both-set path does
  not run for it — this PR is invisible to existing production behaviour.
- Touching `withRetry` directly. The merge happens at the `fetchWithRetry`
  boundary; `withRetry` continues to take a single signal.

## Validation

```bash
pnpm test src/lib/http/__tests__/retry.test.ts
pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test
```
