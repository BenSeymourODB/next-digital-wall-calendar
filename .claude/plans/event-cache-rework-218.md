# Event cache rework (slice 1) — issue #218

Tracking issue: [#218](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/218).

## Goal

Replace the existing `EventCache` clear-and-rewrite IndexedDB layer with an
upsert-based, TTL-aware cache that transparently falls back to an in-memory
`Map` when IndexedDB is unavailable.

## Scope

| Item                                        | In this PR | Deferred                    |
| ------------------------------------------- | ---------- | --------------------------- |
| Per-event `cachedAt` timestamp              | yes        | —                           |
| Read-time TTL filter (default 24h)          | yes        | wiring TTL to user settings |
| Upsert (`put`) instead of `clear` + `add`   | yes        | —                           |
| In-memory fallback when IDB unavailable     | yes        | —                           |
| LRU eviction on `QuotaExceededError`        | —          | follow-up issue             |
| Background `visibilitychange` cleanup sweep | —          | follow-up issue             |
| User-settings UI for cache TTL              | —          | follow-up issue             |

The TTL stays a constant in this slice. Today's read-time filter already
prevents stale data from surfacing; LRU eviction and background cleanup are
additive optimisations that don't block the cache being correct.

## Phases

### Phase 1 — Data model: per-event TTL + tests

Introduce `cachedAt` per stored row, default `EVENT_CACHE_TTL_MS = 24 *
60 * 60 * 1000`, and filter on read.

- New file `src/lib/event-cache.ts` containing the public `EventCache`
  surface plus an internal `EventStore` interface.
- Two implementations: `InMemoryEventStore` (test-friendly, also the
  fallback) and `IndexedDBEventStore` (production path).
- Move `eventCache` export from `calendar-storage.ts` to the new module
  and re-export from `calendar-storage.ts` for backward compatibility
  (so `CalendarProvider.tsx` keeps its existing import path; we sweep
  it in a later slice).
- Tests:
  - `InMemoryEventStore`: put + getAll round-trip, getAll filters
    expired entries, expired entries are evicted from the store on
    read, multiple writes upsert by id.
  - `EventCache` (front facade): selects the in-memory backend in jsdom
    (no IndexedDB), accepts injected store for tests.

### Phase 2 — Upsert semantics

The current implementation does `objectStore.clear()` then `add()` per
event. Replace with `put()` (upsert) so partial-range refreshes don't
blow away rows from other ranges and so there's never a brief
"cache empty" window between `clear` and the puts completing.

- `EventStore.put(events)` becomes the single write entry point.
- Drop `clearEvents()` from the public surface; keep `clear()` on the
  store interface for explicit nukes (`logout` flows might want it
  later, but no caller needs it today).
- Tests assert that a second put with a disjoint id set leaves the
  earlier rows intact, and that overlapping ids are overwritten.

### Phase 3 — In-memory fallback wiring

- `selectEventStore()` chooses `IndexedDBEventStore` when
  `typeof indexedDB !== "undefined"` and `indexedDB.open` is callable;
  otherwise returns `InMemoryEventStore`.
- IDB construction errors (e.g. private mode where `open` rejects)
  log a warning via `logger` and fall through to the in-memory store
  for the lifetime of the page.
- Tests: stub `globalThis.indexedDB` to assert selection, and assert
  the in-memory fallback is used when `indexedDB` is undefined.

## Acceptance criteria mapping

From the issue:

- [x] Per-event TTL respected on read; expired rows are filtered out
      and queued for cleanup → expired rows are filtered AND deleted
      from the store on read (single pass, no separate queue).
- [x] Wholesale clear-and-rewrite is gone; cache is upsert-only.
- [ ] QuotaExceededError triggers least-recently-used eviction —
      **deferred**.
- [x] In-memory fallback transparently substitutes when IndexedDB is
      unavailable; no caller code changes.
- [x] Unit tests for TTL expiry, upsert, and the fallback path.

## Risk / caller impact

The only production caller is `CalendarProvider.tsx`. It uses
`eventCache.saveEvents(googleEvents)` and `eventCache.getEvents()` —
the new facade keeps both methods and the same Promise-returning
shape, so the caller is unchanged. The existing `vi.mock` in
`CalendarProvider.test.tsx` continues to work.
