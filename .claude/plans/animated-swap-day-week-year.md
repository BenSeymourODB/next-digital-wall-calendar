# Wire AnimatedSwap into Day / Week / Year (#207)

## Goal

Bring intra-view slide animation to `DayCalendar`, `WeekCalendar`, and
`YearCalendar` so prev/next navigation feels continuous on the wall display —
matching the slide already in place for Month view (`SimpleCalendar`).

## Non-goals

- User-configurable transition speed (Off/Fast/Normal/Slow) via the
  `userSettings` API. That's a separate slice that needs Prisma + settings UI
  work; deferred to a follow-up.
- Refactoring `SimpleCalendar` to consume the new shared hook. Possible
  follow-up; keeping this PR diff focused on the new wiring.
- Cross-view animation. Already handled by the page-level `AnimatedSwap` in
  `src/app/calendar/page.tsx` (PR #156).

## Architecture

One new hook plus three view-component edits:

1. **`useSlideDirection(index: number)`** — `src/hooks/use-slide-direction.ts`
   - Returns `"forward" | "backward"` (typed as
     `AnimatedSwapDirection`).
   - Internally uses the existing "setState during render" pattern from
     `SimpleCalendar` so the direction is settled in a single render with no
     effect cascade.
   - Initial render returns `"forward"`. On re-render with the same index,
     direction is unchanged. On increasing index → `"forward"`. On decreasing
     index → `"backward"`.

2. **`DayCalendar`** — wrap the day's content body in `AnimatedSwap`
   - `swapKey={format(selectedDate, "yyyy-MM-dd")}`
   - `direction={useSlideDirection(absoluteDayIndex(selectedDate))}`
   - `type="slide"` `durationMs={300}`

3. **`WeekCalendar`** — wrap the week's content body in `AnimatedSwap`
   - `swapKey={format(weekStart, "yyyy-MM-dd")}`
   - `direction={useSlideDirection(absoluteWeekIndex(weekStart))}`
   - `type="slide"` `durationMs={300}`

4. **`YearCalendar`** — wrap the months grid in `AnimatedSwap`
   - `swapKey={String(year)}`
   - `direction={useSlideDirection(year)}`
   - `type="slide"` `durationMs={300}`

`prefers-reduced-motion` is short-circuited by `AnimatedSwap` itself, so the
off-path is inherited for free.

### Helpers

- `absoluteDayIndex(d)` — `Math.floor(startOfDay(d).getTime() / 86_400_000)`.
  Stable across DST because we operate on `startOfDay` UTC ms; ordering is
  what matters, not absolute count.
- `absoluteWeekIndex(start)` — `Math.floor(startOfDay(start).getTime() /
(86_400_000 * 7))`. Computed off the week's start date so it changes only
  when the user crosses a week boundary.
- Year is already an integer.

These helpers can stay private in their respective components — they're
trivial one-liners and don't merit a shared module.

## Phases

### Phase 1 — `useSlideDirection` hook + unit tests

Tests in `src/hooks/__tests__/use-slide-direction.test.ts` covering:

- First render with any seed index → `"forward"`.
- Re-render with the same index → unchanged.
- Re-render with a larger index → `"forward"`.
- Re-render with a smaller index → `"backward"`.
- Sequence: `0 → 1 → 1 → 0 → 5` → `forward, forward, forward (unchanged),
backward, forward` (rapid alternation lands deterministically).

Implement the hook to make the tests pass.

### Phase 2 — Wire `AnimatedSwap` into Day / Week / Year + component tests

For each view, add a focused component test that:

- Asserts the body is rendered inside `[data-testid="animated-swap"]`.
- Triggers prev navigation, waits for the animation phase, asserts both
  `[data-testid="animated-swap-incoming"]` and `[data-testid="animated-swap-outgoing"]`
  render simultaneously during transition.
- Asserts forward navigation produces `direction="forward"` (snapshot the
  outgoing-element transform style — should be `translateX(-100%)`) and
  backward produces the inverse.
- With reduced motion (`window.matchMedia` mocked), navigation produces no
  outgoing snapshot and only the new content renders.

Implement the wrapping in each of `DayCalendar`, `WeekCalendar`, `YearCalendar`.

### Phase 3 — Playwright E2E with video capture

`e2e/intra-view-transitions.spec.ts` with `test.use({ video: "on" })`:

- One scenario per view: navigate Day → next → previous → today; Week →
  next → previous → today; Year → next → previous → today.
- Each test enters the corresponding view, presses the navigation control,
  and asserts the new heading text. Video record captures the slide.
- Uses the public `/test/calendar?view=…&events=default` fixture so no auth
  is required.

`test-results/`, `playwright-report/`, and `blob-report/` are git-ignored —
verify before committing.

## Acceptance criteria mapped from #207

- [x] Switching between any pair of (Month, Agenda, Year, Week, Day)
      animates with the same `AnimatedSwap` API — already in place at
      `src/app/calendar/page.tsx` (PR #156).
- [ ] Setting "Off" disables animations entirely (instant swap) —
      **deferred**, requires settings panel work.
- [ ] Custom duration persists via existing `userSettings` API route —
      **deferred**.
- [x] `prefers-reduced-motion` still forces the off path regardless of
      setting — inherited from `AnimatedSwap`.
- [ ] Component test verifies setting flips the duration prop — **deferred**
      with the configurable-duration slice.

This PR delivers the Day / Week / Year intra-view animation; the deferred
items become a clean follow-up issue once landed.

## Files touched (estimate)

- `src/hooks/use-slide-direction.ts` (new)
- `src/hooks/__tests__/use-slide-direction.test.ts` (new)
- `src/components/calendar/DayCalendar.tsx`
- `src/components/calendar/WeekCalendar.tsx`
- `src/components/calendar/YearCalendar.tsx`
- `src/components/calendar/__tests__/DayCalendar.test.tsx`
- `src/components/calendar/__tests__/WeekCalendar.test.tsx`
- `src/components/calendar/__tests__/YearCalendar.test.tsx`
- `e2e/intra-view-transitions.spec.ts` (new)
