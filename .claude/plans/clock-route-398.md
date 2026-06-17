# Plan: `/clock` standalone route (Issue #398)

## Goal

A dedicated `/clock` route that renders **only** the analog clock, suitable
for mounting on an always-on wall display. No `ViewSwitcher`, no
`CalendarSettingsPanel`, no `AccountManager`, no `SideNavigation`, no
`PointsBadge`, no `ScreenTransition`.

The screen-rotation scheduler plan already enumerates `/clock` as a
rotation target — this route makes that reference real.

## Scope (this PR)

- `src/app/clock/page.tsx` — full-bleed page mounting its own
  `CalendarProvider` seeded with `initialView="clock"` and rendering
  `AnalogClockView` + `Toaster`. No header, no controls.
- `src/components/navigation/app-shell.tsx` — add `/clock` to
  `UNWRAPPED_EXACT` so `AppShell` returns `children` plainly (no nav, no
  badge, no transition).
- Tests:
  - Unit: `AppShell` does not wrap `/clock`.
  - Component: `/clock` page renders `AnalogClockView` inside a
    `CalendarProvider` and does not render `ViewSwitcher` / page header /
    settings controls.
  - E2E (unauthenticated): `/clock` redirects to `/auth/signin` (matches
    the rest of the calendar surface) — confirms the route exists and is
    auth-gated.
  - E2E (authenticated, via shared fixture from #278): visiting `/clock`
    renders `analog-clock-view` and does **not** render
    `view-switcher`, `mobile-side-nav-toggle`, or the page header.
  - Capture a screenshot of the rendered `/clock` page in the
    authenticated E2E and embed it in the PR body (per `CLAUDE.md`).

## Explicitly out of scope (deferred to existing issues)

- `?calendars=…&profiles=…` URL filter / saved-config wiring — **#399**
- Upcoming-events list + current-event "time remaining" countdown — **#400**
- Auto-rotation scheduling behaviour (already implemented; this route
  simply becomes a valid target).

If anything else surfaces during review that we choose not to ship here,
file an issue and link it from the PR body.

## AppShell decision (documented)

The issue presents two options:

1. **Unwrap** `/clock` from `AppShell` (add to `UNWRAPPED_EXACT`).
2. Wrap `/clock` with `SideNavigation`, but auto-hide the nav.

**Choice: option 1 (unwrap).** A wall display is always-on, chrome-free,
and not interacted with. The nav, points badge, and screen-transition
wrapper all add weight and visual noise (the transition's
`translate-x-full` reveal would also be jarring on a stationary
display). Unwrapping is also a single-line edit in one well-tested file
(`UNWRAPPED_EXACT.add("/clock")`) and keeps the door open to option 2
later if a user-facing reason emerges.

The `/clock` page is still client-side and still goes through
`CalendarProvider`, so event clicks → `EventDetailModal` continue to
work and the wall-projector emphasis toggle keeps its existing
behaviour.

## Files touched

- `src/app/clock/page.tsx` (new)
- `src/components/navigation/app-shell.tsx`
- `src/components/navigation/__tests__/app-shell.test.tsx`
- `src/app/clock/__tests__/page.test.tsx` (new)
- `e2e/clock-route.spec.ts` (new, unauthenticated — redirect assertion)
- `e2e/authenticated/clock-route.spec.ts` (new — full chrome-free render +
  screenshot)

## Acceptance criteria

- [ ] `/clock` renders `AnalogClockView` alone — no view switcher, page
      header, or settings/account chrome
- [ ] Route mounts its own `CalendarProvider` and loads events
      independently of `/calendar`
- [ ] `AppShell` behaviour on `/clock` is decided and documented
      (unwrapped — see above)
- [ ] Event click → `EventDetailModal` still works (covered by existing
      `AnalogClockView` tests; not regressed by route work)
- [ ] All-day aside still renders (sourced from `AnalogClockView`; not
      regressed)
- [ ] Wall-projector emphasis toggle still works on the standalone page
      (sourced from `AnalogClockView`; not regressed)
- [ ] Component + E2E coverage, with a screenshot in the PR
