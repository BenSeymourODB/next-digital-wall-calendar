import {
  EVENT_CACHE_TTL_MS,
  EventCache,
  type EventStore,
  InMemoryEventStore,
  IndexedDBEventStore,
  selectEventStore,
} from "@/lib/event-cache";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    log: vi.fn(),
    event: vi.fn(),
    dependency: vi.fn(),
  },
}));

/**
 * Mimic the `DOMException` shape that IndexedDB throws when a write exceeds
 * the storage quota. `name === "QuotaExceededError"` is the contract; in
 * Chromium-family browsers this is a `DOMException` instance, but tests
 * just need an `Error`-shaped object with the right `name`.
 */
function quotaExceededError(message = "Quota exceeded"): Error {
  const err = new Error(message);
  err.name = "QuotaExceededError";
  return err;
}

function makeEvent(
  id: string,
  overrides?: Partial<GoogleCalendarEvent>
): GoogleCalendarEvent {
  return {
    id,
    summary: `Event ${id}`,
    start: { dateTime: "2026-05-03T10:00:00Z" },
    end: { dateTime: "2026-05-03T11:00:00Z" },
    calendarId: "primary",
    ...overrides,
  };
}

describe("InMemoryEventStore", () => {
  let store: InMemoryEventStore;

  beforeEach(() => {
    store = new InMemoryEventStore();
  });

  it("round-trips events that were just put", async () => {
    await store.put([makeEvent("a"), makeEvent("b")], 1_000);

    const got = await store.getAll(1_000);
    expect(got.map((e) => e.id).sort()).toEqual(["a", "b"]);
  });

  it("upserts by id (latest write wins, no duplicates)", async () => {
    await store.put([makeEvent("a", { summary: "first" })], 1_000);
    await store.put([makeEvent("a", { summary: "second" })], 2_000);

    const got = await store.getAll(2_000);
    expect(got).toHaveLength(1);
    expect(got[0]?.summary).toBe("second");
  });

  it("preserves untouched ids when a later put covers a disjoint set", async () => {
    await store.put([makeEvent("a"), makeEvent("b")], 1_000);
    await store.put([makeEvent("c")], 2_000);

    const got = await store.getAll(2_000);
    expect(got.map((e) => e.id).sort()).toEqual(["a", "b", "c"]);
  });

  it("filters out entries older than the TTL on read", async () => {
    await store.put([makeEvent("fresh")], 1_000);
    await store.put([makeEvent("stale")], 1_000 - EVENT_CACHE_TTL_MS - 1);

    const got = await store.getAll(1_000);
    expect(got.map((e) => e.id)).toEqual(["fresh"]);
  });

  it("evicts expired entries from the store on read", async () => {
    const expiredCachedAt = 1_000 - EVENT_CACHE_TTL_MS - 1;
    await store.put([makeEvent("stale")], expiredCachedAt);
    await store.put([makeEvent("fresh")], 1_000);

    await store.getAll(1_000);

    // After eviction, even when peeking at a "now" near the stale row's
    // original cachedAt, only the fresh row is present (proves the stale
    // row was deleted from the underlying map, not just filtered out).
    const peek = await store.getAll(expiredCachedAt + 10);
    expect(peek.map((e) => e.id)).toEqual(["fresh"]);
  });

  it("strips the cachedAt timestamp from returned events", async () => {
    await store.put([makeEvent("a")], 1_000);
    const got = await store.getAll(1_000);
    expect(got[0]).not.toHaveProperty("cachedAt");
  });

  it("clear() empties the store", async () => {
    await store.put([makeEvent("a")], 1_000);
    await store.clear();
    expect(await store.getAll(1_000)).toEqual([]);
  });

  it("returns an empty array when nothing has been written", async () => {
    expect(await store.getAll(1_000)).toEqual([]);
  });

  describe("evictOldest (#290 — LRU support)", () => {
    it("removes the N rows with the smallest cachedAt", async () => {
      await store.put([makeEvent("old1")], 1_000);
      await store.put([makeEvent("old2")], 2_000);
      await store.put([makeEvent("recent1")], 3_000);
      await store.put([makeEvent("recent2")], 4_000);

      const evicted = await store.evictOldest(2);

      expect(evicted).toBe(2);
      // Use a `now` close to the most recent write so the TTL filter does
      // not also remove rows; this isolates the LRU eviction effect.
      const remaining = await store.getAll(4_000);
      expect(remaining.map((e) => e.id).sort()).toEqual(["recent1", "recent2"]);
    });

    it("returns the actual evicted count when fewer than N rows exist", async () => {
      await store.put([makeEvent("a"), makeEvent("b")], 1_000);

      const evicted = await store.evictOldest(10);

      expect(evicted).toBe(2);
      expect(await store.getAll(1_000)).toEqual([]);
    });

    it("is a no-op when asked to evict zero rows", async () => {
      await store.put([makeEvent("a"), makeEvent("b")], 1_000);

      const evicted = await store.evictOldest(0);

      expect(evicted).toBe(0);
      const all = await store.getAll(1_000);
      expect(all.map((e) => e.id).sort()).toEqual(["a", "b"]);
    });

    it("returns 0 when the store is already empty", async () => {
      expect(await store.evictOldest(5)).toBe(0);
    });
  });

  describe("sweepExpired (#290 — visibility-sweep support)", () => {
    it("removes only rows whose cachedAt is past the TTL", async () => {
      const now = 10_000_000;
      const stale = now - EVENT_CACHE_TTL_MS - 1;
      const fresh = now - 1_000;
      await store.put([makeEvent("stale1"), makeEvent("stale2")], stale);
      await store.put([makeEvent("fresh1")], fresh);

      const evicted = await store.sweepExpired(now);

      expect(evicted).toBe(2);
      // Confirm the underlying map dropped the stale rows: peek with a `now`
      // close to their original cachedAt — only fresh1 should remain.
      const remaining = await store.getAll(stale + 10);
      expect(remaining.map((e) => e.id)).toEqual(["fresh1"]);
    });

    it("treats a row whose age is exactly the TTL as expired (matches getAll)", async () => {
      const now = 10_000_000;
      // getAll's predicate is `now - cachedAt < TTL`, so a row at exactly
      // `now - TTL` falls out. sweepExpired must agree to stay idempotent
      // with read-time eviction.
      await store.put([makeEvent("edge")], now - EVENT_CACHE_TTL_MS);

      const evicted = await store.sweepExpired(now);

      expect(evicted).toBe(1);
      expect(await store.getAll(now)).toEqual([]);
    });

    it("is a no-op (returns 0) when no rows are stale", async () => {
      const now = 10_000_000;
      await store.put([makeEvent("a"), makeEvent("b")], now - 1_000);

      expect(await store.sweepExpired(now)).toBe(0);

      const remaining = await store.getAll(now);
      expect(remaining.map((e) => e.id).sort()).toEqual(["a", "b"]);
    });

    it("returns 0 when the store is empty", async () => {
      expect(await store.sweepExpired(10_000_000)).toBe(0);
    });

    it("is idempotent with a follow-up getAll — no double-eviction", async () => {
      const now = 10_000_000;
      const stale = now - EVENT_CACHE_TTL_MS - 1;
      await store.put([makeEvent("stale")], stale);
      await store.put([makeEvent("fresh")], now - 1_000);

      const sweptCount = await store.sweepExpired(now);
      // The stale row is already gone — getAll has nothing more to evict.
      // Asserting on the returned event ids is the strongest observable
      // signal we can get without poking the internal map.
      const visible = await store.getAll(now);

      expect(sweptCount).toBe(1);
      expect(visible.map((e) => e.id)).toEqual(["fresh"]);
    });
  });
});

describe("EventCache facade", () => {
  let store: InMemoryEventStore;
  let cache: EventCache;

  beforeEach(() => {
    store = new InMemoryEventStore();
    cache = new EventCache(store);
  });

  it("delegates saveEvents to store.put with the current time", async () => {
    const putSpy = vi.spyOn(store, "put");
    const events = [makeEvent("a")];
    await cache.saveEvents(events);

    expect(putSpy).toHaveBeenCalledOnce();
    const [passedEvents, cachedAt] = putSpy.mock.calls[0]!;
    expect(passedEvents).toEqual(events);
    expect(cachedAt).toBeTypeOf("number");
    expect(cachedAt).toBeGreaterThan(0);
  });

  it("delegates getEvents to store.getAll", async () => {
    const getAllSpy = vi.spyOn(store, "getAll");
    await cache.saveEvents([makeEvent("a")]);
    const got = await cache.getEvents();

    expect(getAllSpy).toHaveBeenCalledOnce();
    expect(got.map((e) => e.id)).toEqual(["a"]);
  });

  it("does not surface entries older than the TTL", async () => {
    const realDateNow = Date.now;
    try {
      Date.now = () => 1_000_000_000_000;
      await cache.saveEvents([makeEvent("old")]);
      Date.now = () => 1_000_000_000_000 + EVENT_CACHE_TTL_MS + 1;
      await cache.saveEvents([makeEvent("new")]);
      const got = await cache.getEvents();
      expect(got.map((e) => e.id)).toEqual(["new"]);
    } finally {
      Date.now = realDateNow;
    }
  });

  it("falls back to the in-memory store when the underlying store rejects", async () => {
    let calls = 0;
    const flaky: EventStore = {
      put: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error("idb dead");
      }),
      getAll: vi.fn(async () => []),
      clear: vi.fn(async () => {}),
      evictOldest: vi.fn(async () => 0),
      sweepExpired: vi.fn(async () => 0),
    };
    const flakyCache = new EventCache(flaky);

    // First write fails on the flaky store, transparently retried in-memory.
    await flakyCache.saveEvents([makeEvent("a")]);
    expect(flaky.put).toHaveBeenCalledOnce();

    // Subsequent reads now go through the in-memory store, not the flaky one.
    const got = await flakyCache.getEvents();
    expect(got.map((e) => e.id)).toEqual(["a"]);
    expect(flaky.getAll).not.toHaveBeenCalled();
  });

  describe("LRU eviction on QuotaExceededError (#290)", () => {
    beforeEach(() => {
      vi.mocked(logger.event).mockClear();
    });

    it("retries the put after evicting LRU rows on QuotaExceededError", async () => {
      let putCalls = 0;
      const evictedRows = new Set<string>();
      const store: EventStore = {
        put: vi.fn(async () => {
          putCalls += 1;
          // First attempt fails with quota; second succeeds (after eviction).
          if (putCalls === 1) throw quotaExceededError();
        }),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async (count: number) => {
          for (let i = 0; i < count; i++) {
            evictedRows.add(`evicted-${evictedRows.size}`);
          }
          return count;
        }),
        sweepExpired: vi.fn(async () => 0),
      };

      const c = new EventCache(store);
      await c.saveEvents([makeEvent("new")]);

      // Two put calls: original + one retry.
      expect(store.put).toHaveBeenCalledTimes(2);
      expect(store.evictOldest).toHaveBeenCalledTimes(1);
      // The retry must NOT trigger the in-memory fallback path — the IDB
      // store stays in use after a successful eviction-then-retry.
      expect((c as unknown as { hasFallenBack: boolean }).hasFallenBack).toBe(
        false
      );
    });

    it("emits a structured logger.event after a successful eviction retry", async () => {
      let putCalls = 0;
      const store: EventStore = {
        put: vi.fn(async () => {
          putCalls += 1;
          if (putCalls === 1) throw quotaExceededError();
        }),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async (count: number) => count),
        sweepExpired: vi.fn(async () => 0),
      };

      const c = new EventCache(store);
      await c.saveEvents([makeEvent("a")]);

      // Exact positional match — pins `evicted`/`attempts` to the third
      // argument (measurements bucket) rather than the second (properties).
      // A future refactor that swaps them around will fail this test.
      expect(logger.event).toHaveBeenCalledWith(
        "event-cache.lru-evicted",
        { context: "EventCache.saveEvents" },
        {
          evicted: expect.any(Number) as number,
          attempts: expect.any(Number) as number,
        }
      );
    });

    it("bounds the eviction retry loop and falls back when quota is unrecoverable", async () => {
      const store: EventStore = {
        put: vi.fn(async () => {
          throw quotaExceededError();
        }),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async (count: number) => count),
        sweepExpired: vi.fn(async () => 0),
      };

      const c = new EventCache(store);
      // Should not throw — falls back to in-memory after the bounded loop.
      await c.saveEvents([makeEvent("a")]);

      // The retry loop attempted at most a fixed bound (the constant is
      // intentionally not pinned to a specific number in this assertion —
      // we only care that it terminated and fell back).
      expect(
        (store.put as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeGreaterThan(1);
      expect(
        (store.put as ReturnType<typeof vi.fn>).mock.calls.length
      ).toBeLessThan(20);
      expect((c as unknown as { hasFallenBack: boolean }).hasFallenBack).toBe(
        true
      );
    });

    it("breaks out of the loop as soon as evictOldest reports nothing left to evict", async () => {
      const store: EventStore = {
        put: vi.fn(async () => {
          throw quotaExceededError();
        }),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async () => 0),
        sweepExpired: vi.fn(async () => 0),
      };

      const c = new EventCache(store);
      await c.saveEvents([makeEvent("a")]);

      // One initial put, then one evict-attempt that returns 0, then the
      // loop bails out. No further put calls beyond the original attempt.
      expect(store.put).toHaveBeenCalledTimes(1);
      expect(store.evictOldest).toHaveBeenCalledTimes(1);
      // Falls back to in-memory because the quota error was never resolved.
      expect((c as unknown as { hasFallenBack: boolean }).hasFallenBack).toBe(
        true
      );
    });

    it("propagates a non-quota error thrown on the retry put (after eviction)", async () => {
      // First put: quota error. Eviction runs. Second put: non-quota error
      // (e.g. AbortError, disk corruption). The retry loop must NOT swallow
      // the non-quota error — it should propagate so `withFallback` can
      // engage the in-memory store. Catches a future refactor that
      // accidentally widens the inner `catch` to non-quota errors.
      let putCalls = 0;
      const nonQuotaError = new Error("AbortError");
      nonQuotaError.name = "AbortError";
      const store: EventStore = {
        put: vi.fn(async () => {
          putCalls += 1;
          if (putCalls === 1) throw quotaExceededError();
          throw nonQuotaError;
        }),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async (count: number) => count),
        sweepExpired: vi.fn(async () => 0),
      };

      const c = new EventCache(store);
      // `withFallback` catches the re-thrown AbortError → engages fallback.
      await c.saveEvents([makeEvent("a")]);
      expect((c as unknown as { hasFallenBack: boolean }).hasFallenBack).toBe(
        true
      );
      // Eviction was attempted exactly once before the non-quota error
      // terminated the retry loop.
      expect(store.evictOldest).toHaveBeenCalledTimes(1);
      expect(store.put).toHaveBeenCalledTimes(2);
    });

    it("does NOT invoke the eviction path for non-quota errors", async () => {
      const store: EventStore = {
        put: vi.fn(async () => {
          throw new Error("not a quota error");
        }),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async () => 0),
        sweepExpired: vi.fn(async () => 0),
      };

      const c = new EventCache(store);
      await c.saveEvents([makeEvent("a")]);

      // Goes straight to the in-memory fallback path; no eviction attempted.
      expect(store.evictOldest).not.toHaveBeenCalled();
      expect((c as unknown as { hasFallenBack: boolean }).hasFallenBack).toBe(
        true
      );
    });
  });

  describe("visibility sweep (#290 sub-task 2)", () => {
    beforeEach(() => {
      vi.mocked(logger.event).mockClear();
    });

    it("delegates sweepExpired to the active store with the current time", async () => {
      const sweepSpy = vi.spyOn(store, "sweepExpired");
      await cache.sweepExpired();

      expect(sweepSpy).toHaveBeenCalledOnce();
      const [now] = sweepSpy.mock.calls[0]!;
      expect(now).toBeTypeOf("number");
      expect(now).toBeGreaterThan(0);
    });

    it("returns the count of rows the store actually evicted", async () => {
      const swept: EventStore = {
        put: vi.fn(async () => {}),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async () => 0),
        sweepExpired: vi.fn(async () => 7),
      };
      const c = new EventCache(swept);
      expect(await c.sweepExpired()).toBe(7);
    });

    it("emits a structured logger.event when rows were swept", async () => {
      const swept: EventStore = {
        put: vi.fn(async () => {}),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async () => 0),
        sweepExpired: vi.fn(async () => 3),
      };
      const c = new EventCache(swept);
      await c.sweepExpired();

      // Pin the measurements bucket to the third positional arg, the way
      // sub-task 1's `event-cache.lru-evicted` does. A future refactor that
      // swaps properties and measurements around will fail this test.
      expect(logger.event).toHaveBeenCalledWith(
        "event-cache.visibility-swept",
        { context: "EventCache.sweepExpired" },
        { evicted: 3 }
      );
    });

    it("does NOT emit logger.event when zero rows were swept", async () => {
      // A zero-row sweep on every visibility transition would be unmissable
      // noise on a wall-mounted calendar (which goes hidden/visible many
      // times a day). The contract is: log only when there is signal.
      const swept: EventStore = {
        put: vi.fn(async () => {}),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async () => 0),
        sweepExpired: vi.fn(async () => 0),
      };
      const c = new EventCache(swept);
      await c.sweepExpired();

      expect(logger.event).not.toHaveBeenCalled();
    });

    it("falls back to the in-memory store when the active store rejects", async () => {
      const flaky: EventStore = {
        put: vi.fn(async () => {}),
        getAll: vi.fn(async () => []),
        clear: vi.fn(async () => {}),
        evictOldest: vi.fn(async () => 0),
        sweepExpired: vi.fn(async () => {
          throw new Error("idb dead");
        }),
      };
      const c = new EventCache(flaky);
      // The InMemoryEventStore the facade swaps in has nothing to sweep, so
      // the resolved count is 0 — the assertion that matters is that the
      // call did not surface the error.
      await expect(c.sweepExpired()).resolves.toBe(0);
      expect((c as unknown as { hasFallenBack: boolean }).hasFallenBack).toBe(
        true
      );
    });
  });

  it("re-throws when even the in-memory fallback rejects", async () => {
    const dead: EventStore = {
      put: vi.fn(async () => {
        throw new Error("dead");
      }),
      getAll: vi.fn(),
      clear: vi.fn(),
      evictOldest: vi.fn(async () => 0),
      sweepExpired: vi.fn(async () => 0),
    };
    const deadCache = new EventCache(new InMemoryEventStore());
    // Force the cache into a state where the active store is the failing one.
    (deadCache as unknown as { store: EventStore }).store = dead;
    (deadCache as unknown as { hasFallenBack: boolean }).hasFallenBack = true;

    await expect(deadCache.saveEvents([makeEvent("a")])).rejects.toThrow(
      "dead"
    );
  });
});

describe("selectEventStore", () => {
  const originalIndexedDb = (globalThis as { indexedDB?: IDBFactory })
    .indexedDB;

  afterEach(() => {
    if (originalIndexedDb === undefined) {
      delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    } else {
      (globalThis as { indexedDB?: IDBFactory }).indexedDB = originalIndexedDb;
    }
  });

  it("returns the in-memory store when indexedDB is undefined", () => {
    delete (globalThis as { indexedDB?: IDBFactory }).indexedDB;
    expect(selectEventStore()).toBeInstanceOf(InMemoryEventStore);
  });

  it("returns an IndexedDBEventStore when indexedDB is defined", () => {
    (globalThis as { indexedDB?: IDBFactory }).indexedDB = {
      open: vi.fn(),
    } as unknown as IDBFactory;
    expect(selectEventStore()).toBeInstanceOf(IndexedDBEventStore);
  });
});
