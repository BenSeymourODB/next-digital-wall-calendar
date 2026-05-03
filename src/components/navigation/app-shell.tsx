"use client";

/**
 * App Shell
 *
 * Client-side wrapper that adds the persistent `SideNavigation` and a
 * single `ScreenTransition` around the page content for main app routes.
 * On non-app routes (landing page, auth, scheduler-demo, API) it renders
 * children without modification so existing layouts are unaffected.
 *
 * Transition direction is derived from the position of the new route in
 * `NAV_ITEMS` relative to the previous route — moving down the list slides
 * forward, moving up slides backward.
 */
import { ScreenTransition } from "@/components/scheduler/screen-transition";
import type { TransitionDirection } from "@/components/scheduler/types";
import { DEFAULT_TRANSITION_CONFIG } from "@/lib/scheduler/schedule-config";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { NAV_ITEMS, SideNavigation } from "./side-navigation";

/** Path prefixes that should NOT be wrapped by the AppShell. */
const UNWRAPPED_PREFIXES = ["/auth", "/test", "/api"] as const;

/** Exact paths that should NOT be wrapped by the AppShell. */
const UNWRAPPED_EXACT = new Set<string>(["/"]);

function shouldWrap(pathname: string): boolean {
  if (UNWRAPPED_EXACT.has(pathname)) return false;
  return !UNWRAPPED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

function navIndex(pathname: string): number {
  // Match against the most specific nav item first (longest href wins).
  const sorted = [...NAV_ITEMS]
    .map((item, index) => ({ item, index }))
    .sort((a, b) => b.item.href.length - a.item.href.length);
  for (const { item, index } of sorted) {
    if (item.href === "/") {
      if (pathname === "/") return index;
      continue;
    }
    if (pathname === item.href || pathname.startsWith(`${item.href}/`)) {
      return index;
    }
  }
  return -1;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [previousPathname, setPreviousPathname] = useState(pathname);
  const [direction, setDirection] = useState<TransitionDirection>("forward");

  // React "setState during render" pattern: derive the transition direction
  // from the pathname change without triggering an extra effect cycle.
  if (pathname !== previousPathname) {
    const prevIdx = navIndex(previousPathname);
    const nextIdx = navIndex(pathname);
    setDirection(
      prevIdx !== -1 && nextIdx !== -1 && nextIdx < prevIdx
        ? "backward"
        : "forward"
    );
    setPreviousPathname(pathname);
  }

  if (!shouldWrap(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <SideNavigation />
      <div className="pl-16">
        <ScreenTransition
          pathname={pathname}
          direction={direction}
          transition={DEFAULT_TRANSITION_CONFIG}
        >
          {children}
        </ScreenTransition>
      </div>
    </div>
  );
}
