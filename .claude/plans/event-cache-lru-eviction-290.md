# Event-cache LRU eviction on QuotaExceededError — issue #290 (sub-task 1)

Tracking issue: [#290](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/290).
Predecessor: `.claude/plans/event-cache-rework-218.md` (issue #218, PR #258).

## Slice

This plan covers **only the first of #290's three sub-tasks**: LRU eviction on
`QuotaExceededError`. The other two sub-tasks (visibility-change cleanup
sweep, TTL wired to user settings) ship in separate PRs. The TTL sub-task
specifically waits for the `useUserSettings.mutate` + `user-settings-bus`
pattern from PR #344 (issue #337) to land first.

## Goal

When `EventCache.saveEvents` causes the IndexedDB store's `put` to fail
with `QuotaExceededError`, evict least-recently-cached rows from the store
and retry the put. If we cannot free enough space, fall through to the
existing in-memory fallback path so the cache always remains functional.

## Design decisions

### Recency index

The issue body suggests "likely `lastReadAt` per row". I'm using the
existing `cachedAt` index instead, for two reasons:

1. Today's read access pattern is bulk `getAll()` — there is no
   per-row read. A `lastReadAt` field would either be (a) a no-op
   (every row touched by every getAll, so all values converge) or
   (b) require expensive per-row writes on every read. Neither
   beats `cachedAt` as a recency signal.
2. `cachedAt` is already indexed (`objectStore.createIndex("cachedAt", …)`
   at `src/lib/event-cache.ts:112`), so no schema bump is needed.

If a future access pattern surfaces per-row reads (e.g. event-detail
hover bumping recency), we can swap to `lastReadAt` then. Documented
in the implementation comment so the next reader doesn't have to
re-derive this.

### Eviction unit

Evict in **batches** rather than one row at a time. IndexedDB transactions
are heavyweight; doing N tiny transactions instead of one is wasteful and
keeps the cache in a "writes failing" state longer. Batch size of
`EVICTION_BATCH_SIZE = 50` — small enough to free meaningful space on a
typical cache, large enough that the retry loop terminates quickly.

### Termination

Three safeguards against an infinite loop:

1. **Bounded retries** — at most `MAX_EVICTION_ATTEMPTS = 5` evict-and-
   retry cycles per `saveEvents()` call. After that we give up and let
   the existing fallback path catch the error.
2. **Empty-batch break** — if `evictOldest(N)` returns 0 (nothing
   left to evict), we stop immediately. This handles the pathological
   "the rows we're trying to write are themselves bigger than the quota"
   case.
3. **Non-quota errors propagate** — only `DOMException`s with
   `name === "QuotaExceededError"` trigger the LRU path. Any other
   error short-circuits to the existing fallback handler.

### Logging

`logger.event("event-cache.lru-evicted", { evicted, attempts, retried })`
once per successful eviction-then-retry-succeeded cycle. `logger.event`
is the right tool here per `src/lib/logger.ts` — it's a structured
business event, not an error.

## Phases

### Phase 1 — `EventStore.evictOldest` + tests

- Extend the `EventStore` interface with
  `evictOldest(count: number): Promise<number>` (returns the actual
  number of rows evicted; may be `< count` if the store has fewer rows).
- Implement on `InMemoryEventStore` by sorting entries by `cachedAt`
  ascending and deleting the first `count`.
- Implement on `IndexedDBEventStore` by opening a cursor on the
  `cachedAt` index (ascending) and deleting the first `count` keys.
- Tests:
  - `evictOldest(2)` from an in-memory store of 3 rows leaves the most
    recent row, returns 2.
  - `evictOldest(10)` from a 3-row store evicts everything, returns 3.
  - `evictOldest(0)` is a no-op, returns 0.
  - Same semantics asserted on a stubbed IndexedDB-backed store (fake-
    indexeddb).

### Phase 2 — `EventCache.saveEvents` retry-after-evict

The retry loop lives in `EventCache.saveEvents` (via a private
`putWithLruRetry` helper) rather than inside `IndexedDBEventStore`.
Rationale:

- `EventStore` already exposes the only two operations the loop needs
  (`put`, `evictOldest`) — pushing the logic into the cache facade
  avoids duplicating it across every future `EventStore` backend.
- Testability: the existing test fixture uses a mock `EventStore`
  (e.g. the "in-memory fallback" test). Putting the orchestration on
  the facade lets us reuse that same mock pattern to inject quota
  errors deterministically, with no need to add `fake-indexeddb` as a
  dependency.
- The store-level `evictOldest` still belongs on `IndexedDBEventStore`
  because the cursor-on-`cachedAt`-index implementation is backend-
  specific; only the eviction policy (batch size, attempt count, what
  triggers a retry) moves up to the facade.

- Wrap `store.put` in a loop that catches `QuotaExceededError`, calls
  `store.evictOldest(EVICTION_BATCH_SIZE)`, and retries.
- Bound by `MAX_EVICTION_ATTEMPTS`.
- Emit the structured `logger.event` after a successful retry.
- Tests use the existing `EventStore` mock pattern; no IndexedDB shim
  required.

### Phase 3 — Verify the existing fallback path still wins on exhaustion

- After `MAX_EVICTION_ATTEMPTS`, `put` re-throws the original
  `QuotaExceededError`. `EventCache.withFallback` catches it and
  swaps in `InMemoryEventStore` for the lifetime of the page.
- Test asserts that:
  - The fallback path is exercised after the bounded LRU loop fails.
  - The fallback message in `logger.error` is unchanged.

## Acceptance criteria mapping

From the issue:

- [x] LRU eviction passes a unit test that simulates `QuotaExceededError`
- [x] Eviction is bounded (no infinite loops on pathological input)
- [x] Structured `logger.event` records evicted-row count on success
- [x] Defaults preserved for existing users — no schema bump, the new
      retry logic is invisible until quota is hit

Out of scope for this PR (will land separately under #290):

- Visibility-change cleanup sweep
- TTL wired to user settings (waits on PR #344 / issue #337)
