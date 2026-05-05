"use client";

/**
 * Wall-display midnight rollover hook.
 *
 * Subscribes the calling component to the next local midnight; when it
 * fires, every subscriber re-renders with a fresh `Date`. A single
 * setTimeout is shared across all subscribers and is cleared once the
 * last one unmounts, so a 24/7 always-on calendar never burns a per-
 * component interval.
 */
import { useSyncExternalStore } from "react";
import { startOfDay } from "date-fns";

let currentDate: Date = new Date();
let currentStartOfDay: Date = startOfDay(currentDate);
let timeoutId: ReturnType<typeof setTimeout> | null = null;
const subscribers = new Set<() => void>();

function msUntilNextLocalMidnight(from: Date): number {
  const next = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
    0,
    0,
    0,
    0
  );
  // Guard against a 0/negative delay if the system clock is exactly at
  // midnight: setTimeout with 0 fires synchronously which would loop.
  // DST shifts (max ±1h) are absorbed because the next interval is
  // recomputed from `new Date()` after every tick.
  return Math.max(1, next.getTime() - from.getTime());
}

function refreshDates(): void {
  currentDate = new Date();
  currentStartOfDay = startOfDay(currentDate);
}

function scheduleTick(): void {
  timeoutId = setTimeout(() => {
    timeoutId = null;
    refreshDates();
    for (const cb of [...subscribers]) cb();
    if (subscribers.size > 0) scheduleTick();
  }, msUntilNextLocalMidnight(new Date()));
}

function subscribe(cb: () => void): () => void {
  // First subscription after a quiet period: refresh in case the
  // module-loaded value has drifted across a day boundary while no
  // component was mounted.
  if (subscribers.size === 0) {
    refreshDates();
  }
  subscribers.add(cb);
  if (timeoutId === null) {
    scheduleTick();
  }
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0 && timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

function getSnapshot(): Date {
  return currentDate;
}

function getStartOfDaySnapshot(): Date {
  return currentStartOfDay;
}

/**
 * Returns the current Date and re-renders the component when the local
 * day rolls over. Use this anywhere you compare against "now" for UI
 * affordances that must stay correct across midnight on a wall display.
 */
export function useDateNow(): Date {
  // The same function is passed for both client and server snapshots
  // because this module is "use client"-only — the SSR path never
  // actually subscribes, but useSyncExternalStore still requires the
  // argument and an undefined value triggers a hydration warning.
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Like {@link useDateNow}, but returns `startOfDay(now)` so consumers
 * comparing dates with `isSameDay`, `isSameWeek`, `isSameMonth`, etc.
 * don't have to call `startOfDay` themselves.
 *
 * The returned `Date` reference is stable between midnight ticks (the
 * same object is returned across re-renders) so React Compiler can
 * skip work for components whose only changing input is `today`.
 */
export function useTodayStartOfDay(): Date {
  return useSyncExternalStore(
    subscribe,
    getStartOfDaySnapshot,
    getStartOfDaySnapshot
  );
}

/**
 * Test-only: drop all subscribers and clear the shared timer. Without
 * this, fake-timer tests bleed module state between cases.
 */
export function __resetUseDateNowForTests(): void {
  if (timeoutId !== null) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  subscribers.clear();
  refreshDates();
}
