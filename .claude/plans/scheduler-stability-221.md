# Plan — Issue #221: Scheduler stability and correctness bugs

Source: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/221

## Triage of the seven listed bugs

Audited against current `main`:

- **Bug 3** (midnight wraparound in `isTimeMatch`) — already fixed at `src/lib/scheduler/time-utils.ts:23` (`Math.min(diff, 1440 - diff)`); test coverage at `time-utils.test.ts:50-62`.
- **Bug 4** (time-specific check skips initial run) — already fixed at `use-screen-scheduler.ts:242` (`setTimeout(checkTimeSpecific, 0)`).
- **Bug 5** (module-level mutable `idCounter`) — already fixed; `crypto.randomUUID()` is used at `schedule-config.ts:43,62`. No `idCounter` references in tree.
- **Bug 6** (countdown drift via separate `setInterval`) — already fixed; a single 1-second tick at `use-screen-scheduler.ts:186-200` drives both countdown and navigation, eliminating drift.
- **Bug 1** (unstable `controls` object) — **remains**. `controls` is recreated each render at `use-screen-scheduler.ts:279-286` and is used as a `useEffect` dep at `screen-scheduler.tsx:81` and `:142`.
- **Bug 2** (pause/resume oscillation + manual-unpause lockout) — **remains**. `useInteractionDetector` owns its own `isPaused` state. `useScreenScheduler.resume()` clears `state.isPaused` but does not propagate into the interaction detector, so `effectivelyPaused = state.isPaused || isInteractionPaused` keeps the scheduler paused. The toggle button is functionally inert during the interaction-pause window.
- **Bug 7** (`ScreenTransition` geometry/timer race) — **remains**. Two-phase (`exiting` → `entering`) model with separate timers means the total animation runs `2 × durationMs`. During `exiting`, incoming children render at `translateX(0)` opacity 1 (so the user briefly sees the new content at final position before it snaps back to start in `entering`). `direction` is read every render with no snapshot, so a mid-flight prop change can flip the keyframe.

## Phases

### Phase 1 — Backfill regression tests for already-fixed bugs

Lock in correctness so a future refactor cannot silently regress these.

- `time-utils.test.ts` — confirm midnight tests exist (they do). Add a comment describing the regression they cover. Add a test asserting that `isTimeMatch(00:00, 23:59)` and `isTimeMatch(23:59, 00:00)` both return `true` while `isTimeMatch(00:00, 23:58)` returns `false` (already covered, double-check).
- `schedule-config.test.ts` — add a test asserting that two newly-built sequences receive distinct ids (regression for the old shared `idCounter`).
- `use-screen-scheduler.test.ts` — add a test asserting that the time-specific check runs on the next microtask after `start()`, not after a 60-second delay (regression for the deferred initial check).
- `use-screen-scheduler.test.ts` — add a test asserting that the countdown remains in lock-step with auto-rotation across N intervals (regression for the dual-interval drift).

Acceptance: all four regression tests pass without touching production code.

### Phase 2 — Bugs #1 + #2 (controls stability + manual-unpause lockout)

Tests first:

- New test in `use-screen-scheduler.test.ts`: `controls` reference is identical across renders triggered by unrelated state changes (e.g. countdown ticks).
- New test in `use-interaction-detector.test.ts`: returned `release()` clears the pause timer and resets `isPaused` to `false` immediately.
- New test in `screen-scheduler.test.tsx`: clicking the resume button while the interaction detector is paused unpauses the scheduler.

Implementation:

- `use-screen-scheduler.ts`: hold each control implementation in a ref refreshed every render via a single combined-update effect; build a `controls` object once via `useState` (init function) whose methods forward to the refs. This produces a stable identity without `useMemo`/`useCallback` (forbidden under React Compiler).
- `use-interaction-detector.ts`: extend the result with a `release()` function that clears the timeout ref and sets `isPaused` to `false`. Wrap with the same ref-trick for stable identity.
- `screen-scheduler.tsx`: when the user calls `resume` (or toggles via Space), invoke `interactionDetector.release()` immediately so the manual action terminates the interaction-pause window.

### Phase 3 — Bug #7 (ScreenTransition rewrite)

Port AnimatedSwap's single-phase model to `ScreenTransition`.

Tests first (extend `screen-transition.test.tsx`):

- Total animation duration is `durationMs` (not `2 × durationMs`). Asserted by checking that after `durationMs` the snapshot is gone and the testid `transition-idle` is rendered.
- Direction snapshot: trigger a swap with `direction="forward"`, then change `direction="backward"` mid-animation, and assert the in-flight outgoing keyframe still uses the forward exit transform.
- Rapid swaps: two pathname changes within `durationMs / 2` correctly restart the timer and animation; the final idle state arrives at start + 1.5 × durationMs (or whatever the math says), not earlier.
- Reduced-motion flipped on mid-animation collapses to idle.

Implementation:

- Replace `phase: "exiting" | "entering"` with `phase: "animating" | "idle"`.
- Snapshot geometry at swap start (`useState`).
- Use a single `useEffect` keyed on `[phase, durationMs, animationId]` driving one timer.
- Use `animationId` to suffix `@keyframes` names and re-mount keyed nodes for clean restart.
- Update incoming/outgoing markup to mirror AnimatedSwap.

## Test commands

After every phase: `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.

## Out of scope

- New scheduler features.
- Public API changes to the scheduler (signatures stay compatible).
- Visual redesign of the navigation controls.
