# Smooth view transition animations (#87)

## Goal

Add smooth, performant animations to the calendar UI when:

1. The top-level view changes (Month ↔ Agenda today; extensible to Day/Week/Year later).
2. The user navigates between periods in Month view (prev/next month → directional slide).

Animations must respect `prefers-reduced-motion` and target 60 fps for the wall display.

## Non-goals

- Panel expand/collapse animation (out of scope this slice).
- Wiring animations for views that do not yet exist (Day, Week, Year land in separate PRs).
- Changing the scheduler's `ScreenTransition` component (different concern — cross-page transitions).

## Architecture

Two new pieces, both internal to `src/components/calendar`:

1. **`useReducedMotion()`** (`src/hooks/use-reduced-motion.ts`)
   - Reads `(prefers-reduced-motion: reduce)` via `window.matchMedia`.
   - SSR-safe (returns `false` when `window` is undefined).
   - Live-updating via `change` event subscription.
   - Returned boolean is read by every animated component.

2. **`AnimatedSwap`** (`src/components/calendar/animated-swap.tsx`)
   - Generic single-child swap animator keyed by a `swapKey` string.
   - Supports `type: "fade" | "slide"`, `direction: "forward" | "backward"`, `durationMs`.
   - Renders outgoing + incoming children during the transition using CSS transforms/opacity (GPU-composited).
   - When `prefers-reduced-motion` is set, or `durationMs <= 0`, swaps children instantly — no animation frames.
   - Pattern mirrors `ScreenTransition` but decoupled from `pathname` semantics.

Integration points:

- `src/app/calendar/page.tsx` — wrap the `SimpleCalendar`/`AgendaCalendar` branch in `AnimatedSwap` keyed on `view` with fade.
- `src/components/calendar/SimpleCalendar.tsx` — wrap the grid in `AnimatedSwap` keyed on `format(selectedDate, "yyyy-MM")` with slide; pass direction based on whether the user clicked prev vs next.

No changes to `ScreenTransition`, `CalendarProvider` public API, or existing tests.

## Phases

### Phase 1 — `useReducedMotion` hook

- Unit tests (`src/hooks/__tests__/use-reduced-motion.test.ts`):
  - Returns `false` when `matchMedia.matches` is `false`.
  - Returns `true` when `matchMedia.matches` is `true`.
  - Updates on `change` event.
  - Unsubscribes on unmount.
  - SSR-safe (returns `false` when `window` is undefined, covered via mocked environment guard).
- Implement hook to make tests pass.

### Phase 2 — `AnimatedSwap` component

- Component tests (`src/components/calendar/__tests__/animated-swap.test.tsx`):
  - Renders the incoming child in the idle state.
  - On `swapKey` change, runs through exiting → entering → idle phases with configured `durationMs`.
  - `type: "fade"` applies `opacity: 0` to outgoing, no translateX.
  - `type: "slide"` applies `translateX(-100%)` forward / `translateX(100%)` backward.
  - Skips animation and swaps instantly when `prefers-reduced-motion: reduce` is set.
  - Skips animation when `durationMs === 0`.
  - Same-`swapKey` re-render updates children in place without triggering a transition.
- Implement component.

### Phase 3 — Wire into calendar surfaces

- Component test (`src/components/calendar/__tests__/calendar-view-animation.test.tsx`):
  - Toggling the view from Month to Agenda renders both views simultaneously mid-transition.
  - After the duration elapses, only the Agenda view remains.
  - With reduced motion, the swap is instant (no simultaneous render).
- Component test (`src/components/calendar/__tests__/SimpleCalendar.test.tsx`): extend with:
  - Clicking Next month sets slide direction `forward`.
  - Clicking Previous month sets slide direction `backward`.
- Edit `src/app/calendar/page.tsx` to wrap the view branch in `AnimatedSwap type="fade"`.
- Edit `src/components/calendar/SimpleCalendar.tsx` to track `direction` locally and wrap the grid in `AnimatedSwap type="slide"` keyed on month.

### Phase 4 — Playwright E2E (video capture)

- `e2e/calendar-transitions.spec.ts` with `test.use({ video: "on" })`:
  - Switching Month → Agenda via `ViewSwitcher` renders both view root containers simultaneously during the transition window.
  - Clicking Next month advances the header and runs the slide animation (the slide wrapper briefly shows two months).
  - With `Emulate reduced-motion: "reduce"`, the swap is instant — no two-view overlap frame.

## Test strategy

- Unit: `useReducedMotion` with mocked `matchMedia`.
- Component: `AnimatedSwap` lifecycle with fake timers (mirrors existing `ScreenTransition` test style).
- Integration (component): test the calendar page wiring with React Testing Library.
- E2E: Playwright with video capture on Chromium to visually verify animation behavior.

## Acceptance criteria (from #87)

- [x] Animated transitions when switching between view modes (Month ↔ Agenda covered this slice; Day/Week/Year/year slots ready for future wiring).
- [x] Slide animations when navigating prev/next month.
- [x] `prefers-reduced-motion` respected — animations skip.
- [x] CSS transforms for 60 fps.
- [x] React Compiler handles memoization (no manual `useMemo`/`useCallback`).
- [ ] Layout transitions for expanding/collapsing panels — deferred to a follow-up (no such toggles exist on the calendar page today).

## Deferred

- Wiring animations for Day / Week / Year views — those views are not yet exposed via `ViewSwitcher` (tracked in PRs #149, #145).
- Panel expand/collapse animations — no applicable panel toggles exist today.
- Animation config via user settings — currently hardcoded; can be exposed in the settings panel (#86) later.
