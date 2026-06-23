"use client";

import { eventCache } from "@/lib/event-cache";
import { logger } from "@/lib/logger";
import { useEffect } from "react";

/**
 * Drives the background visibility-change cleanup sweep for the IndexedDB
 * event cache (#290 sub-task 2). On mount — and again every time the tab
 * transitions back to `visible` after being hidden — fires a single
 * `eventCache.sweepExpired()` to evict rows whose TTL has elapsed. The
 * read-time eviction in `EventCache.getEvents` still handles whatever
 * surfaces during a fetch; this hook is the cold-cache complement so a
 * long-idle wall-mounted calendar doesn't accumulate stale entries.
 *
 * Errors from the sweep are logged and swallowed — the cache stays
 * consistent because the read-time path is independent of this sweep.
 */
export function useEventCacheVisibilitySweep(): void {
  useEffect(() => {
    const runSweep = () => {
      eventCache.sweepExpired().catch((error: unknown) => {
        logger.error(error as Error, {
          context: "useEventCacheVisibilitySweep",
        });
      });
    };

    if (document.visibilityState === "visible") {
      runSweep();
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runSweep();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
