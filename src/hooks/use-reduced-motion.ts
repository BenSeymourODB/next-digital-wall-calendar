"use client";

import { useSyncExternalStore } from "react";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function getSnapshot(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(MEDIA_QUERY).matches;
}

function getServerSnapshot(): boolean {
  // Returning the same value during SSR and during the client's hydration
  // pass is what eliminates the hydration mismatch reported in #306. The
  // client transitions to the live `getSnapshot()` value after mount.
  return false;
}

function subscribe(onChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => undefined;
  }
  const mql = window.matchMedia(MEDIA_QUERY);
  mql.addEventListener("change", onChange);
  return () => {
    mql.removeEventListener("change", onChange);
  };
}

/**
 * Subscribes to the `prefers-reduced-motion` media query and returns the
 * current preference.
 *
 * Built on `useSyncExternalStore` so the SSR pass and the client's hydration
 * render produce the same value (`false`), then the live preference is read
 * after mount. This is the standard fix for the SSR/CSR divergence that #306
 * surfaced as a hydration warning anchored at `SimpleCalendar`.
 *
 * Live updates: re-renders whenever the OS-level preference changes.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
