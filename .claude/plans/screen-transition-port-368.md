# Plan — Port AnimatedSwap pattern to ScreenTransition (#368)

## Background

`ScreenTransition` (`src/components/scheduler/screen-transition.tsx`) was identified
in #221 / PR #50 self-review as having a family of animation-geometry and
timer-race bugs that `AnimatedSwap` (`src/components/calendar/animated-swap.tsx`)
already fixed in PR #156. Per #367 the refactor is deferred to this issue.

## Current bugs (from #368 acceptance criteria)

1. **Two-stage timer** — `exiting → entering → idle` runs over `2 * durationMs`
   instead of `durationMs`. Rapid pathname changes mid-animation can leave the
   component stuck in `entering`.
2. **No restart key** — consecutive identical-direction swaps don't restart the
   keyframe animation cleanly.
3. **Inline `matchMedia`** instead of the shared `useReducedMotion` hook (which
   is the SSR-safe `useSyncExternalStore` version from PR #312).
4. **Hard-coded `minHeight: 100vh`** on the wrapper, rather than letting the
   incoming child dictate height (the technique `AnimatedSwap` uses).
5. **Mid-animation reduced-motion toggle** leaves the component stuck.

## External contract to preserve

- Props: `{ pathname, direction, transition, children }` — unchanged.
- Root test ID `screen-transition` — used by `app-shell.test.tsx`,
  `screen-scheduler.test.tsx`, `e2e/side-navigation.spec.ts`,
  `e2e/scheduler-transitions.spec.ts`.
- `transition-outgoing` and `transition-idle` test IDs — both used by
  `e2e/side-navigation.spec.ts` lines 96, 100.
- `transition-incoming` — only used inside the component tests; can stay or be
  renamed but I'll keep the name for diff clarity.
- `transition-entering` — only the component's own tests reference it; the new
  single-stage design has no separate "entering" phase, so this testID is
  retired and the tests that asserted on it become single-phase assertions.

## Design (mirror AnimatedSwap)

State:

- `phase: "idle" | "animating"` — collapses the two-stage exiting/entering
  into a single `animating` phase.
- `displayedChildren`, `snapshotChildren` — same as AnimatedSwap.
- `animationId: number` — bumped on every swap so React re-mounts the
  animated nodes and restarts keyframe animations on consecutive same-direction
  transitions.
- `prevPathname` — derive-state-from-props pattern, unchanged.

Hook usage:

- `useReducedMotion()` replaces inline `window.matchMedia(...)`.
- `skipAnimation = reducedMotion || transition.type === "none" || transition.durationMs <= 0`.

Layout:

- Incoming stays in normal flow → container preserves natural height.
- Outgoing is `absolute inset-0`.
- Drop `minHeight: 100vh`.

Single timer:

- `useEffect` watching `[phase, durationMs, animationId]` schedules one
  `setTimeout(durationMs)` that flips back to idle and clears the snapshot.
- Cleanup clears the pending timer; a second swap mid-flight bumps
  `animationId`, the effect re-runs, the prior timer is cleared, and a fresh
  `durationMs` timer begins. Total animation time is `durationMs`, not
  `2 * durationMs`.

Mid-animation reduced-motion:

- "setState during render" check: if `skipAnimation` flips on while
  `phase !== "idle"`, collapse to `idle` and drop the snapshot.

Geometry helper:

- One function that, given `type` and `direction`, returns
  `{ exitTo: { transform, opacity }, enterFrom: { transform, opacity } }`.
- Extends AnimatedSwap's helper to handle `slide-fade` (combined translate +
  opacity) and `none` (no-op — short-circuits via `skipAnimation`).

## Test plan (TDD)

I'll update `src/components/scheduler/__tests__/screen-transition.test.tsx`
to:

1. **Replace the entering-phase tests** with single-phase equivalents:
   - "renders both outgoing and incoming during animation"
   - "returns to idle after `durationMs` (not `2 * durationMs`)"
   - Drop `transition-entering` assertions.
2. **Keep**: idle state, "none" type bypass, slide/fade/slide-fade geometry
   on outgoing, prefers-reduced-motion bypass at mount, same-pathname re-render,
   zero-duration bypass.
3. **Add** new specs mirroring `animated-swap.test.tsx`:
   - Layout: outgoing `absolute`, incoming not `absolute`; no `minHeight: 100vh`
     on the root wrapper.
   - Slide-fade incoming keyframe matches expected slide-fade enter geometry.
   - Rapid mid-flight swap: total elapsed = `durationMs` from the second swap
     start; the first timer is cleared.
   - Reduced-motion-on-mid-animation: outgoing snapshot dropped, child swapped.
   - Hydration (SSR) regression matching the #306 / AnimatedSwap hydration spec.

After all tests pass:

```
pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test
```

## Files touched

- `src/components/scheduler/screen-transition.tsx` — full rewrite mirroring
  AnimatedSwap's structure.
- `src/components/scheduler/__tests__/screen-transition.test.tsx` — update
  per "Test plan" above.

No other files should need changes. The `screen-scheduler.tsx` and
`app-shell.tsx` callers use the public prop API, which is unchanged.

## Out of scope

- Animation-config UX surfaces (covered elsewhere).
- E2E re-recording (Playwright video) — the issue is a pure refactor of an
  existing component; existing E2E assertions on `screen-transition` /
  `transition-outgoing` / `transition-idle` continue to apply.
