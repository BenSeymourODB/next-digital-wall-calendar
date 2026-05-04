import {
  EVENT_CACHE_TTL_MS,
  EventCache,
  type EventStore,
  InMemoryEventStore,
  IndexedDBEventStore,
  selectEventStore,
} from "@/lib/event-cache";
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("re-throws when even the in-memory fallback rejects", async () => {
    const dead: EventStore = {
      put: vi.fn(async () => {
        throw new Error("dead");
      }),
      getAll: vi.fn(),
      clear: vi.fn(),
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
