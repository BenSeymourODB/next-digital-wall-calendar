# Phase C — Open PR Sweep (2026-05-02)

Per the plan: at execution time, gate each PR case on its current state. Skip if merged-since-plan-was-written; exercise if still open; skip if closed.

## Merge-state snapshot at run time

| PR                                     | State                        | Branch                        | Decision                                                                                                                                         |
| -------------------------------------- | ---------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| #225 useDateNow midnight-tick          | OPEN                         | `claude/loving-faraday-a9JNF` | Deferred — needs time-travel (system-clock override) for meaningful test; recommend manual mid-evening sanity check                              |
| #199 wire event create to GCal         | OPEN                         | `claude/loving-faraday-6fs7i` | **Skipped — already covered by Phase B B3 on main** which exercises the live create round-trip end-to-end (PASS). Redundant for this sweep.      |
| #200 tasks → multi-profile assignments | OPEN                         | `claude/loving-faraday-Xcyz9` | **Blocked** by Phase B Finding 4 (POST /api/tasks → 403 on signed-in account). Cannot meaningfully test until the underlying tasks-create works. |
| #196 year view full-year load          | OPEN                         | `claude/loving-faraday-7FMkv` | **Exercised — see Findings 6+7 below**                                                                                                           |
| #195 agenda toggle within Day/Week     | **MERGED 2026-05-02 18:48Z** | —                             | Implicitly covered by Phase A (agenda search test) + Phase B (ViewSwitcher Day/Week split-button observed).                                      |
| #198 rewards API + PointsContext       | OPEN                         | `claude/loving-faraday-0ho73` | Deferred — would need profile setup + UI affordance discovery; recommend manual exercise once tasks/profile flows stable                         |
| #193 meals Prisma schema               | OPEN                         | `claude/loving-faraday-FhBp9` | **Out of scope per plan §7** — backend-only schema; verify via `pnpm db:migrate:status` separately                                               |

## Exercised: PR #196 — year view full-year load

Branch checked out: `claude/loving-faraday-7FMkv` (HEAD a few days behind main; missing the post-#196 side-nav and #195 agenda-toggle changes — note the UI differs from production main).

| Case   | Status           | Notes                                                                                                                                                                      | Screenshot                  |
| ------ | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| C196.1 | PASS             | `/test/calendar?view=year&events=family` renders mock year view                                                                                                            | `C196.1-year-test-page.png` |
| C196.2 | **FAIL/PARTIAL** | `/calendar?view=year` against signed-in session — Month view rendered, NOT Year. Zero event-color dots detected. **Two console 500s** captured during load. See Finding 6. | `C196.2-year-live.png`      |
| C196.3 | SKIP             | No clickable month-name label found to drill down — possibly because we're stuck on Month view (per C196.2).                                                               |

## New findings

### Finding 6 — `/calendar?view=year` URL param appears to be IGNORED on the production page (PR #196 branch)

**Reproduce on PR branch:** sign in, visit `http://localhost:3000/calendar?view=year`.

**Observed:** page loads with **Month** view active (highlighted in ViewSwitcher), not Year. The `view=year` URL param is silently dropped. The same URL on main behaves the same way (verified via Phase B observations).

**Likely cause:** `/calendar/page.tsx` initializes the view from `CalendarProvider`'s persisted state (probably localStorage / cookie) and never reads the `view` URL search param. The test page (`/test/calendar`) correctly honors `?view=...` because it explicitly reads `useSearchParams()`, but the production page does not.

**Severity:** Medium. Bookmark/sharing of view-specific URLs on `/calendar` doesn't work as expected. Also blocks autonomous QA of #196 since we can't deep-link into the year view we're trying to test.

**Suggested next step:** in `src/app/calendar/page.tsx` (or whatever wraps `CalendarProvider` for the live route), read the `view` search param and pass it through as the provider's initial view. Mirror the test page pattern.

### Finding 7 — Two 500 Internal Server Errors on `/calendar?view=year` load (PR #196)

**Reproduce:** same as Finding 6.

**Observed:** browser console captures two `Failed to load resource: 500 Internal Server Error` entries during page load on the PR branch.

**Likely cause:** the new full-year fetch logic introduced by #196 is making API calls that fail server-side (probably to `/api/calendar/events` with a multi-month range that breaks a server invariant — date parsing, calendar-list iteration, or pagination). Could not capture URLs without re-instrumenting; recommended to re-run with full network log.

**Severity:** High for the PR — the year-view full-year load (the explicit goal of #196) is the most likely call site, so the feature is currently failing in its primary case.

**Suggested next step:** open browser DevTools Network tab on `/calendar?view=year` and inspect the failing requests. Likely fix is in `CalendarProvider`'s year-load path or `/api/calendar/events` route's range validation.

## Final tallies (Phase C only)

- 1 PR exercised (#196) → 2 findings
- 1 PR merged-during-plan (#195) → covered indirectly
- 5 PRs deferred or out of scope (with reasons listed above)
