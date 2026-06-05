# Scheduler Stability and Correctness Bugs (Issue #221)

## Context

PR #50 (screen rotation scheduler) was merged with a self-review listing seven deferred technical issues. PR #156 also flagged that `ScreenTransition` inherits the same animation-geometry/timer-race issues that PR #156 fixed for calendar `AnimatedSwap`.

## Findings on current `main`

After auditing the code:

| Bug                                                          | Status on `main`     | Evidence                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------ | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Unstable `controls` object                                | **Open**             | `useScreenScheduler` returns `controls` as a fresh object literal on every render (`use-screen-scheduler.ts:279-286`). Consumers (`screen-scheduler.tsx:81, 142`) depend on `controls` in `useEffect`, so those effects re-run on every internal state change — including every 1-second countdown tick. |
| 2. Manual-unpause lockout while interaction detection active | **Open**             | The window-level `click` listener in `use-interaction-detector.ts` fires on every user click, including clicks on the navigation controls themselves. So when the user clicks the pause/resume button to resume, the same click immediately re-pauses the scheduler via `setIsPaused(true)`.             |
| 3. Midnight wraparound in `isTimeMatch`                      | **Fixed**            | `time-utils.ts:23` uses `Math.min(diff, 1440 - diff)`. Test coverage exists in `time-utils.test.ts` lines 50–63.                                                                                                                                                                                         |
| 4. Time-specific check skips initial run                     | **Fixed (untested)** | `use-screen-scheduler.ts:242` calls `setTimeout(checkTimeSpecific, 0)` before starting the 60s interval. No explicit regression test.                                                                                                                                                                    |
| 5. Module-level `idCounter`                                  | **Fixed**            | Search shows no `idCounter` anywhere; IDs are generated via `crypto.randomUUID()` in `schedule-config.ts:43,62`.                                                                                                                                                                                         |
| 6. Countdown drift                                           | **Fixed (untested)** | `use-screen-scheduler.ts:188-200` uses a single 1s tick that decrements countdown and triggers navigation when it hits zero. No separate `setInterval` exists for the countdown.                                                                                                                         |
| 7. `ScreenTransition` geometry/race                          | **Open (deferred)**  | `screen-transition.tsx` still uses a 2-stage `exiting → entering` timer chain, no animation-id restart, no reduced-motion hook, hard-coded `minHeight: 100vh`. Mirrors the pre-PR-156 `AnimatedSwap` design. Substantial refactor; defer to follow-up.                                                   |

## Scope for this session

**In scope:**

- Add regression tests covering bugs 4, 5, 6 (lock in the already-applied fixes).
- Verify bug 3's regression test already exists (it does); leave as is.
- Fix bug 1 — stable `controls` reference returned from `useScreenScheduler`.
- Fix bug 2 — let user manually unpause via the toggle button while the interaction detector is active.

**Out of scope (deferred):**

- Bug 7 — `ScreenTransition` refactor to mirror `AnimatedSwap` (animationId-driven single timer, reduced-motion hook, height-stable layout). Will be filed as a follow-up issue and PR. Substantial enough to warrant its own implementation and review cycle.

## Phases

### Phase 1: Lock-in regression tests for already-fixed bugs (4, 5, 6)

Add tests that fail if the fix is regressed:

- **Bug 4**: `useScreenScheduler` calls the time-specific check immediately on activation, not after a 60s wait. Test by setting `config.timeSpecific[0].time` to "now" and asserting `router.push` is called within one microtask flush (no fake-timer advance needed).
- **Bug 5**: `crypto.randomUUID()` is the only ID source in `schedule-config.ts`. Test by spying / generating multiple configs and asserting their IDs are non-numeric, non-sequential, and unique across calls. (Or simply: call `createDefaultConfig` twice and assert IDs differ.)
- **Bug 6**: countdown decrements once per second and triggers navigation exactly when it reaches zero — no separate `setInterval`. Test with `vi.useFakeTimers()`: start scheduler with `intervalSeconds: 3`, advance 3000ms, assert exactly one `router.push`.

### Phase 2: Fix bug 1 — stable `controls` reference

The pattern that complies with the React-Compiler-no-manual-memoization rule and gives a stable identity: store the latest "live" controls in a ref and expose stable wrapper functions held in `useState`'s initializer.

```ts
const liveControls = { start, stop, pause, resume, navigateToNext, navigateToPrevious };
const liveRef = useRef(liveControls);
liveRef.current = liveControls;

const [stableControls] = useState<SchedulerControls>(() => ({
  start: () => liveRef.current.start(),
  stop: () => liveRef.current.stop(),
  pause: () => liveRef.current.pause(),
  resume: () => liveRef.current.resume(),
  navigateToNext: () => liveRef.current.navigateToNext(),
  navigateToPrevious: () => liveRef.current.navigateToPrevious(),
}));
```

`useState` with an initializer runs once; the resulting `stableControls` object identity is preserved across renders. This is idiomatic and not "manual memoization" — there is no memo cache, just a one-time creation.

Test by rendering `ScreenScheduler`, asserting the returned `controls` is `===` across re-renders triggered by a state change in the hook (e.g. `currentIndex`). Concretely: spy on `useEffect` re-runs via a sentinel — the keyboard-shortcut effect in `screen-scheduler.tsx:115-142` lists `controls` in deps and should NOT re-attach window listeners when only countdown ticks.

### Phase 3: Fix bug 2 — manual-unpause lockout

Wire an "ignore container" ref into the interaction detector so that any interaction that originated within the navigation-controls subtree is ignored. The semantic: interacting with the scheduler's own controls is an explicit command, not a generic user-attention signal.

API addition to `useInteractionDetector`:

```ts
interface UseInteractionDetectorOptions {
  pauseDurationMs: number;
  enabled: boolean;
  /**
   * Interactions whose event.target falls within this element are ignored.
   * Use to exempt the scheduler's own navigation controls.
   */
  ignoreRef?: React.RefObject<HTMLElement | null>;
}
```

Implementation: inside `handleInteraction`, early-return if `ignoreRef?.current?.contains(event.target as Node)`.

Wiring in `screen-scheduler.tsx`: create a `controlsContainerRef`, pass to `useInteractionDetector`, attach to a wrapping `<div ref=...>` around `NavigationControls`. (Don't need to wrap `SchedulerStatusIndicator` — it's a display, not a control.)

Tests:

1. `useInteractionDetector` ignores `click` events whose target is inside `ignoreRef.current`.
2. `useInteractionDetector` still pauses on `click` events outside `ignoreRef.current`.
3. Integration in `ScreenScheduler`: starting paused-by-interaction, clicking the resume button (inside controls container) resumes; effective state is not re-paused.

## Acceptance criteria mapping

- [x] Bug 3 already fixed; existing tests cover it.
- [x] Bug 5 already fixed; new test locks it in.
- [x] Bug 6 already fixed; new test locks it in.
- [x] Bug 4 already fixed; new test locks it in.
- [ ] Bug 1: `controls` is a stable reference (Phase 2).
- [ ] Bug 2: user can manually unpause while interaction detection is active (Phase 3).
- [ ] Bug 7: deferred to follow-up; new issue filed referencing this PR.

## Commit plan

1. `test(scheduler): regression tests for already-fixed bugs (idCounter, countdown drift, immediate time-specific check)` — Phase 1.
2. `fix(scheduler): expose stable controls reference from useScreenScheduler` — Phase 2.
3. `fix(scheduler): exempt nav controls from interaction-detector pause` — Phase 3.

PR closes #221 partially; the deferred bug 7 will land in a follow-up PR referencing a new issue.
