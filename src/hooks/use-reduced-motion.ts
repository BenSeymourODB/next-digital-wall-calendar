"use client";

import { useEffect, useState } from "react";

const MEDIA_QUERY = "(prefers-reduced-motion: reduce)";

function getInitialPreference(): boolean {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return false;
  }
  return window.matchMedia(MEDIA_QUERY).matches;
}

/**
 * Subscribes to the `prefers-reduced-motion` media query and returns the
 * current preference. SSR-safe — returns `false` outside the browser.
 *
 * Live updates: re-renders whenever the OS-level preference changes.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(getInitialPreference);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mql = window.matchMedia(MEDIA_QUERY);

    const handler = (event: MediaQueryListEvent) => {
      setReduced(event.matches);
    };

    mql.addEventListener("change", handler);
    return () => {
      mql.removeEventListener("change", handler);
    };
  }, []);

  return reduced;
}
