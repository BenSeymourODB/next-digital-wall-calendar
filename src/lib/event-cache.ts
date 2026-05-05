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
      async (store) => store.put(events, Date.now()),
      "EventCache.saveEvents"
    );
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
