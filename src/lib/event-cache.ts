/**
 * Cached calendar events.
 *
 * `EventCache` is the single public surface used by `CalendarProvider`.
 * Internally it delegates to an `EventStore` implementation; the in-memory
 * store is used when IndexedDB is unavailable (private mode, certain
 * WebViews, SSR / test envs) or when the IndexedDB-backed store rejects a
 * call at runtime.
 *
 * Per-event `cachedAt` timestamps are filtered against `EVENT_CACHE_TTL_MS`
 * on read so callers never see stale rows. Expired rows are also evicted
 * from the store as a side effect of the read so the cache does not grow
 * unbounded.
 *
 * Writes use upsert semantics (`put` keyed by event id) — there is no
 * `clear+rewrite` window during which the cache is empty.
 */
import type { GoogleCalendarEvent } from "@/lib/google-calendar";
import { logger } from "@/lib/logger";

export const EVENT_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const DB_NAME = "CalendarEventsDB";
const STORE_NAME = "events";
const DB_VERSION = 2;

interface CachedEventRow extends GoogleCalendarEvent {
  cachedAt: number;
}

function stripCachedAt(row: CachedEventRow): GoogleCalendarEvent {
  const copy: CachedEventRow = { ...row };
  delete (copy as Partial<CachedEventRow>).cachedAt;
  return copy;
}

export interface EventStore {
  put(events: GoogleCalendarEvent[], cachedAt: number): Promise<void>;
  getAll(now: number): Promise<GoogleCalendarEvent[]>;
  clear(): Promise<void>;
  /**
   * Remove up to `count` rows in least-recently-cached order
   * (smallest `cachedAt` first). Resolves with the actual number of rows
   * removed (may be less than `count` if the store has fewer rows).
   * Used by `EventCache` to recover from `QuotaExceededError` (#290).
   */
  evictOldest(count: number): Promise<number>;
}

/**
 * Recovery configuration for the `QuotaExceededError` → LRU-evict → retry
 * loop in `EventCache.saveEvents` (#290). The values are deliberately
 * conservative: enough to make a dent on a typical Chromium IndexedDB
 * quota without thrashing the cache, and bounded enough that an
 * unrecoverable quota error short-circuits to the in-memory fallback
 * quickly. See `.claude/plans/event-cache-lru-eviction-290.md`.
 */
const EVICTION_BATCH_SIZE = 50;
const MAX_EVICTION_ATTEMPTS = 5;

function isQuotaExceededError(error: unknown): boolean {
  return error instanceof Error && error.name === "QuotaExceededError";
}

export class InMemoryEventStore implements EventStore {
  private rows = new Map<string, CachedEventRow>();

  async put(events: GoogleCalendarEvent[], cachedAt: number): Promise<void> {
    for (const event of events) {
      this.rows.set(event.id, { ...event, cachedAt });
    }
  }

  async getAll(now: number): Promise<GoogleCalendarEvent[]> {
    const fresh: GoogleCalendarEvent[] = [];
    for (const [id, row] of this.rows) {
      if (now - row.cachedAt < EVENT_CACHE_TTL_MS) {
        fresh.push(stripCachedAt(row));
      } else {
        this.rows.delete(id);
      }
    }
    return fresh;
  }

  async clear(): Promise<void> {
    this.rows.clear();
  }

  async evictOldest(count: number): Promise<number> {
    if (count <= 0 || this.rows.size === 0) return 0;
    const sorted = Array.from(this.rows.entries()).sort(
      (a, b) => a[1].cachedAt - b[1].cachedAt
    );
    const toEvict = sorted.slice(0, count);
    for (const [id] of toEvict) {
      this.rows.delete(id);
    }
    return toEvict.length;
  }
}

export class IndexedDBEventStore implements EventStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  private init(): Promise<void> {
    if (this.db) {
      return Promise.resolve();
    }
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = new Promise((resolve, reject) => {
      let request: IDBOpenDBRequest;
      try {
        request = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (error) {
        this.initPromise = null;
        reject(error);
        return;
      }

      request.onerror = () => {
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        let objectStore: IDBObjectStore;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          objectStore = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          objectStore.createIndex("calendarId", "calendarId", {
            unique: false,
          });
        } else {
          objectStore = request.transaction!.objectStore(STORE_NAME);
        }
        if (!objectStore.indexNames.contains("cachedAt")) {
          objectStore.createIndex("cachedAt", "cachedAt", { unique: false });
        }
      };
    });
    return this.initPromise;
  }

  async put(events: GoogleCalendarEvent[], cachedAt: number): Promise<void> {
    await this.init();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      for (const event of events) {
        const row: CachedEventRow = { ...event, cachedAt };
        objectStore.put(row);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getAll(now: number): Promise<GoogleCalendarEvent[]> {
    await this.init();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();
      request.onsuccess = () => {
        const rows = request.result as CachedEventRow[];
        const fresh: GoogleCalendarEvent[] = [];
        const expiredIds: string[] = [];
        for (const row of rows) {
          if (now - row.cachedAt < EVENT_CACHE_TTL_MS) {
            fresh.push(stripCachedAt(row));
          } else {
            expiredIds.push(row.id);
          }
        }
        for (const id of expiredIds) {
          objectStore.delete(id);
        }
        resolve(fresh);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async evictOldest(count: number): Promise<number> {
    if (count <= 0) return 0;
    await this.init();
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], "readwrite");
      const objectStore = transaction.objectStore(STORE_NAME);
      const index = objectStore.index("cachedAt");
      // Ascending cursor over `cachedAt` — first key is the oldest row.
      const cursorRequest = index.openCursor(null, "next");
      let evicted = 0;
      cursorRequest.onsuccess = () => {
        const cursor = cursorRequest.result;
        // Stop iterating either at end-of-range or once we've evicted N.
        // Resolution itself is deferred to `transaction.oncomplete` so the
        // promise only settles after every `cursor.delete()` has actually
        // committed — otherwise the caller could open a follow-up `put`
        // before the disk space is reclaimed (#290 review).
        if (!cursor || evicted >= count) return;
        cursor.delete();
        evicted += 1;
        cursor.continue();
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
      transaction.oncomplete = () => resolve(evicted);
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

/**
 * Pick the best-available store at construction time. When `indexedDB` is
 * not present at all, return the in-memory implementation directly.
 * Otherwise return the IndexedDB-backed store; the `EventCache` facade is
 * responsible for catching any runtime failures and swapping in the
 * in-memory store on the fly.
 */
export function selectEventStore(): EventStore {
  if (typeof globalThis.indexedDB === "undefined") {
    return new InMemoryEventStore();
  }
  return new IndexedDBEventStore();
}

export class EventCache {
  private store: EventStore;
  private hasFallenBack = false;

  constructor(store?: EventStore) {
    this.store = store ?? selectEventStore();
  }

  async saveEvents(events: GoogleCalendarEvent[]): Promise<void> {
    return this.withFallback(
      async (store) => this.putWithLruRetry(store, events),
      "EventCache.saveEvents"
    );
  }

  /**
   * Attempt `store.put`; on `QuotaExceededError`, evict the least-recently-
   * cached rows in bounded batches and retry. Non-quota errors propagate
   * immediately so the existing `withFallback` path handles them. Loop
   * terminates on success, on `MAX_EVICTION_ATTEMPTS`, or when
   * `evictOldest` reports nothing left to evict (#290).
   */
  private async putWithLruRetry(
    store: EventStore,
    events: GoogleCalendarEvent[]
  ): Promise<void> {
    // `cachedAt` is re-sampled before every `store.put` attempt so the row's
    // recency reflects when it was actually written — otherwise the eviction
    // loop's `evictOldest` latency could backdate the eventual successful
    // write by hundreds of ms, which would make it look LRU-eligible
    // sooner than it deserves on the next quota event.
    try {
      await store.put(events, Date.now());
      return;
    } catch (error) {
      if (!isQuotaExceededError(error)) throw error;

      let totalEvicted = 0;
      for (let attempt = 1; attempt <= MAX_EVICTION_ATTEMPTS; attempt++) {
        const evicted = await store.evictOldest(EVICTION_BATCH_SIZE);
        totalEvicted += evicted;
        if (evicted === 0) {
          // Nothing left to evict — propagate so the in-memory fallback
          // can take over. The thrown error is the original quota error,
          // preserved so logs upstream stay accurate.
          throw error;
        }
        try {
          await store.put(events, Date.now());
          logger.event(
            "event-cache.lru-evicted",
            { context: "EventCache.saveEvents" },
            { evicted: totalEvicted, attempts: attempt }
          );
          return;
        } catch (retryError) {
          if (!isQuotaExceededError(retryError)) throw retryError;
          // Still quota-bound — loop and evict another batch.
        }
      }
      // Exhausted the bounded retry budget. Propagate the original quota
      // error so `withFallback` switches to the in-memory store.
      throw error;
    }
  }

  async getEvents(): Promise<GoogleCalendarEvent[]> {
    return this.withFallback(
      async (store) => store.getAll(Date.now()),
      "EventCache.getEvents"
    );
  }

  private async withFallback<T>(
    op: (store: EventStore) => Promise<T>,
    context: string
  ): Promise<T> {
    try {
      return await op(this.store);
    } catch (error) {
      if (this.hasFallenBack || this.store instanceof InMemoryEventStore) {
        logger.error(error as Error, { context });
        throw error;
      }
      logger.error(error as Error, {
        context: `${context} (falling back to in-memory cache)`,
      });
      this.store = new InMemoryEventStore();
      this.hasFallenBack = true;
      return op(this.store);
    }
  }
}

export const eventCache = new EventCache();
