# Event-cache background visibility-change sweep — issue #290 (sub-task 2)

Tracking issue: [#290](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/290).
Predecessors:

- `.claude/plans/event-cache-rework-218.md` (#218 / PR #258 — per-event TTL, upsert, in-memory fallback).
- `.claude/plans/event-cache-lru-eviction-290.md` (#290 sub-task 1 / PR #377 — LRU on `QuotaExceededError`).

## Slice

This plan covers **only the second of #290's three sub-tasks**: background
`visibilitychange` cleanup sweep. Sub-task 3 (TTL wired to user settings)
will ship in a separate PR once the `useUserSettings.mutate` bus pattern
(PR #344 / issue #337) is exercised by another consumer.

## Goal

When the tab returns to `visible` after being hidden — typically the
wall-mounted calendar coming back from screensaver, or a profile switch
re-mounting the calendar — proactively evict rows whose `cachedAt + TTL`
has elapsed. The existing read-time eviction in `getAll` already prevents
stale rows from surfacing, but on a cold cache (no read since the rows
went stale) the entries linger in IndexedDB and contribute toward the
storage quota. The sweep is **additive**: it must not change `getAll`'s
semantics, and must be idempotent with read-time eviction.

## Design decisions

### Sweep contract

Add `sweepExpired(now: number): Promise<number>` to `EventStore`:

- Walks the store, deletes rows where `now - cachedAt >= TTL`.
- Returns the number of rows actually evicted.
- Same eviction rule as `getAll`'s side effect — by design, calling
  `sweepExpired` then `getAll` is observationally identical to calling
  `getAll` alone.

`now` is injected for the same reason the existing API takes it: tests
need deterministic time without monkey-patching `Date.now`.

### Backend-specific implementation

- **`InMemoryEventStore`** — iterate `this.rows`, delete by id, count.
  Same loop the existing `getAll` does, factored to share neither code
  (small enough not to need it) nor allocation patterns.
- **`IndexedDBEventStore`** — open a cursor on the `cachedAt` index
  ascending. For each row whose `cachedAt + TTL <= now`, `cursor.delete()`
  and continue. Stop as soon as we see a row whose `cachedAt` is fresh
  enough that no further row can be expired (the index is ascending in
  `cachedAt`, so this is the cutoff). Resolution is deferred to
  `transaction.oncomplete` so the promise only settles after the
  deletes actually commit — same pattern PR #377 added to `evictOldest`.

### Trigger

A small `useEventCacheVisibilitySweep` hook in `src/hooks/`:

- Calls `eventCache.sweepExpired()` once on mount when the document is
  already visible (covers the first-load case for a calendar that
  opens straight into the wall-mounted view).
- Adds a `visibilitychange` listener; on `document.visibilityState === 'visible'`
  fires the sweep.
- Removes the listener on unmount.
- Swallows errors via `logger.error` — the sweep is best-effort; if it
  fails the cache is still consistent (read-time eviction is the
  belt-and-braces).

`CalendarProvider` opts into the hook in its initialization effect —
that's the existing seam where `eventCache.getEvents`/`saveEvents` are
already wired, so no new lifecycle is introduced.

### Logging

`logger.event("event-cache.visibility-swept", {context}, { evicted })`
**only when `evicted > 0`** — a zero-row sweep is uninteresting noise.
Matches the bar set by sub-task 1's `event-cache.lru-evicted` event.

## Phases

### Phase 1 — `EventStore.sweepExpired` + unit tests

- Extend the `EventStore` interface with `sweepExpired(now)`.
- Implement on `InMemoryEventStore` (mirror `getAll`'s expiry rule).
- Implement on `IndexedDBEventStore` using a cursor on the `cachedAt`
  index; deletes are committed before the promise resolves.
- Tests (vitest):
  - `sweepExpired(now)` removes only rows whose `cachedAt + TTL <= now`.
  - Returns the actual evicted count.
  - Is a no-op (returns 0) when nothing is stale.
  - Co-existence with `getAll`: sweeping first does not double-count
    when `getAll` later also runs.
  - Co-existence with `evictOldest`: a sweep that has already removed
    a row makes `evictOldest` return one fewer than the original count.

### Phase 2 — `EventCache.sweepExpired` + tests

- Public method on `EventCache` that delegates to the active store via
  the existing `withFallback` helper.
- Emits `logger.event` only when `evicted > 0`.
- Tests:
  - Returns the evicted count.
  - Emits the event when rows were swept; does NOT emit on a zero-row
    sweep.
  - Falls back to the in-memory store when the active store throws
    (uses the existing flaky-store fixture pattern from
    `event-cache.test.ts`).

### Phase 3 — `useEventCacheVisibilitySweep` + wire into CalendarProvider

- New `src/hooks/useEventCacheVisibilitySweep.ts`:
  - Effect runs once: if `document.visibilityState === 'visible'`, fire
    one sweep on mount.
  - Adds a `visibilitychange` listener that fires a sweep on transition
    to `visible`.
  - Cleanup removes the listener.
  - All sweep calls are fire-and-forget; errors are logged.
- Test the hook in isolation (RTL + `vi.spyOn(eventCache, 'sweepExpired')`
  - manual `document.dispatchEvent(new Event('visibilitychange'))`).
- Call the hook at the top of `CalendarProvider`.

## Acceptance criteria mapping

From the issue body (sub-task 2):

- [x] On `document.visibilitychange === 'visible'`, sweep expired rows
      proactively
- [x] Idempotent with read-time eviction — calling `getAll` after a
      sweep does not double-count nor surface deleted rows
- [x] Defaults preserved for existing users — sweep is invisible until
      stale rows exist

Out of scope (will land separately under #290):

- TTL wired to user settings (sub-task 3 — waits on PR #344-style
  consumer of `useUserSettings.mutate`)

## Non-goals

- Persisting a "last sweep at" stamp across reloads. The read-time
  eviction handles any rows that age past TTL between sweeps, so a
  cross-reload memory is unnecessary.
- A periodic timer-driven sweep. `visibilitychange` covers the
  long-hide → return case, which is the empirically interesting one
  on a wall-mounted calendar; adding a timer multiplies wakeups
  without measurable benefit.
