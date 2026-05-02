# Phase A — Autonomous QA Regression Results (2026-05-02)

Spec: `e2e/qa-regression-2026-05-02.spec.ts` (chromium project, dev server :3000, headed=false)
Browser: chromium (Playwright Desktop Chrome profile)
Run: 26 tests, **24 passed, 2 failed** (~92% pass)

Screenshots: this directory.

## Summary table

| Case  | Description                                                                   | Verdict                      | Screenshot                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1.1  | month / default                                                               | PASS                         | `cal-month-default.png`                                                                                                                                     |
| A1.2  | week / default                                                                | **FAIL** — see Finding 1     | (test failed before fullPage shot; see `test-results/qa-regression-2026-05-02-Q-8734c-dar-views-A1-2-week-default-chromium/test-failed-1.png`)              |
| A1.3  | day / overflow                                                                | PASS                         | `cal-day-overflow.png`                                                                                                                                      |
| A1.4  | year / family                                                                 | PASS                         | `cal-year-family.png`                                                                                                                                       |
| A1.5  | agenda / family                                                               | PASS                         | `cal-agenda-family.png`                                                                                                                                     |
| A1.6  | clock / default (top-level)                                                   | PASS                         | `cal-clock-top-level.png`                                                                                                                                   |
| A1.7  | month / empty                                                                 | PASS                         | `cal-month-empty.png`                                                                                                                                       |
| A1.8  | week / multiDay                                                               | PASS (with Finding 1 caveat) | `cal-week-multiday.png`                                                                                                                                     |
| A2.1  | view transitions month→week→day→year→agenda→clock                             | **FAIL** — see Finding 2     | `transition-month-to-week.png` (only first transition captured before failure)                                                                              |
| A3.\* | analog clock — 7 scenarios                                                    | PASS (all 7)                 | `clock-default.png`, `clock-overlap.png`, `clock-colors.png`, `clock-empty.png`, `clock-dense-large.png`, `clock-all-day-mix.png`, `clock-with-seconds.png` |
| A4    | mini-cal sidebar shown on week, hidden on month/year/clock, returns on agenda | PASS                         | `sidebar-week.png`, `sidebar-hidden-on-{month,year,clock}.png`, `sidebar-shown-on-agenda.png`                                                               |
| A5    | filter panel renders                                                          | PASS                         | `filters-initial.png`                                                                                                                                       |
| A6    | agenda search "Piano" + empty results                                         | PASS                         | `agenda-search-piano.png`, `agenda-empty-results.png`                                                                                                       |
| A7    | event detail modal open + Escape close                                        | PASS                         | `event-detail-modal-open.png`, `event-detail-modal-closed.png`                                                                                              |
| A8    | ARIA snapshot of month grid                                                   | PASS                         | `aria-month-grid-screenshot.png`, `aria-month-grid.txt`                                                                                                     |
| A9    | /test/settings renders                                                        | PASS                         | `settings-form.png`                                                                                                                                         |
| A10.1 | /test/scheduler renders                                                       | PASS                         | `scheduler-initial.png`                                                                                                                                     |
| A10.2 | /test/scheduler-demo renders                                                  | PASS                         | `scheduler-demo-a.png`                                                                                                                                      |
| A11.1 | mobile agenda 390x844                                                         | PASS                         | `mobile-agenda.png`                                                                                                                                         |
| A11.2 | tablet month 1024x768                                                         | PASS                         | `tablet-month.png`                                                                                                                                          |

## Findings

### Finding 1 — WeekCalendar event-count header reports 0 events when events exist on the boundary day (likely PR #176 regression)

**Reproduce:** `http://localhost:3000/test/calendar?view=week&events=default`

**Observed:**

- Header reads `Apr 26, 2026 – May 2, 2026   0 events`.
- The `default` mock event set places 4 timed events on today (Sat May 2): Morning Standup 09:00, Team Lunch 12:00, Project Review 14:00, One-on-One 16:00.
- The `MiniCalendarSidebar` (rendered alongside in `?sidebar=true`) correctly shows colored dots on Sat May 2 and Sun May 3 / Mon May 4 / Tue May 5, proving events ARE in the provider.
- The week time-grid is empty in the viewport — at minimum, the 09:00 Morning Standup chip should be visible at the bottom edge.
- Day view of the same provider on the same date works (`cal-day-overflow.png` shows "10 events" header + Event 1 chip).

**Likely cause:** `WeekCalendar` event filtering range is exclusive of the week's end-of-day, OR the week range is computed with a start/end mismatch when today falls on the last day of the week (Sat). #176 wired the time-grid to the provider — this looks like a bound regression introduced in that wiring.

**Severity:** High. Visible regression on the primary calendar view for a common case (today is the last day of the displayed week).

**Suggested next step:** Inspect `src/components/calendar/WeekCalendar.tsx` event filter — likely an `endOfWeek` vs `startOfWeek` boundary with `<` instead of `<=`, or a UTC/local timezone slip in the day-bucket computation.

**Evidence:**

- Failing-test auto-screenshot: `test-results/qa-regression-2026-05-02-Q-8734c-dar-views-A1-2-week-default-chromium/test-failed-1.png` (shows "0 events" header)
- `sidebar-week.png` (mini-cal sidebar shows events ARE in provider; week grid empty)
- `cal-day-overflow.png` (control: day view of same data type works)

### Finding 2 — ViewSwitcher Week/Day buttons are split-buttons; clicking the button label opens a Grid/Agenda dropdown instead of switching view (likely PR #195 / #150 interaction)

**Reproduce:** Navigate to `/test/calendar?view=month&events=default`. Click the "Week" button in the ViewSwitcher.

**Observed:**

- Clicking "Week" opens a popover with "Grid / Agenda" options instead of switching to week view.
- This is the #195 agenda-toggle-within-day-and-week feature, BUT the discovery model isn't obvious — there's no visible affordance signaling that Week is now a split-button. Day and Week buttons render with chevrons (likely the dropdown trigger) but the entire button surface opens the dropdown.
- This is a **UX/affordance issue**, not a functional bug. View switching presumably works via a different click target (caret only, or the icon, or selecting "Grid" from dropdown).
- Side effect on automation: existing E2E specs and naive test interactions that click `getByRole("button", { name: "Week" })` will fail or open the wrong UI.

**Severity:** Medium. The feature works as designed for the agenda toggle, but the entry point for plain view-switching is ambiguous and breaks existing test selectors.

**Suggested next step:** Either (a) split into a primary "switch view" button + a separate caret for the agenda toggle (clearer affordance + preserves test selectors), or (b) bump the existing E2E specs that click ViewSwitcher buttons to the new selector, and add docs.

**Evidence:**

- `test-results/qa-regression-2026-05-02-Q-a6fee-day-→-year-→-agenda-→-clock-chromium/test-failed-1.png` (visible Grid/Agenda popover open after clicking Month button trying to navigate to Day)

## Console / network

- All 24 PASSing cases recorded **zero** console errors or warnings (after filtering known noise: AppInsights, Fast Refresh, React DevTools tip, HMR, Suspense fallback).
- All 24 PASSing cases recorded **zero** 4xx/5xx responses against `localhost:3000`.

## Out of scope this run

- Per plan §7: backend-only PRs (#158 token encryption, #160 retry, #155 dup-account full coverage, #193 meal schema), visual-regression baselines, cross-browser.

## Phase B

Pending — requires user to sign into Google. Auto-clean of all `QA-AUTOTEST-*` objects per user direction.

## Phase C

Pending — open PR sweep with merge gate at execution time.
