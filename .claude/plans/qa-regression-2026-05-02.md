# QA Regression Test Plan — Recently Merged + Ready Open PRs

## 1. Context

Recent merges to `main` span calendar UI (#176, #175, #156, #154, #145, #148, #147, #144, #139, #149, #73), tasks (#194, #190), auth/backend (#155, #158, #160, #136), settings (#157), and the latest event-detail delete + create flows (#197, #143). Several non-draft open PRs are also QA-ready (#225, #200, #199, #198, #196, #195) and worth a sweep.

This run is a regression sweep, executed by me via the project's `browser-qa` skill / Playwright MCP — **not** by adding new committed e2e specs. It splits into:

- **Phase A** — fully autonomous, mock-data UI exercises against the `/test/*` pages (no Google auth, no DB seeding).
- **Phase B** — auth-gated round-trips against `/calendar`, `/profiles`, `/settings`, and the Tasks UI, after the user signs into Google. **Per user direction: I create QA-tagged events / tasks / profiles and clean them up at end of run** (full round-trip is preferred over read-only).
- **Phase C** — open PR sweep: at execution time, for each open PR listed in §6, check `gh pr view <N> --json state` and run its case only if still open (skip if already merged into main and covered by Phase A/B; skip if closed). Branch-switching protocol is in §6.

Goal of each phase: catch visible regressions, missing ARIA, console errors, broken Google round-trips, and behavior changes introduced since the last clean baseline.

## 2. Before Starting

1. Confirm dev server is up on **port 3000** (`pnpm dev`). `playwright.config.ts` and the 20+ existing specs in `e2e/` assume `http://localhost:3000`. Only fall back to `--port 3099` if 3000 is genuinely occupied; if so, override `baseURL` per-call.
2. Verify the page loads: GET `http://localhost:3000/test/calendar` returns 200 with no console errors.
3. Default viewport `1440x900` desktop. Mobile viewport (`390x844`) only on cases that call it out.
4. Screenshot output dir: `docs/screenshots/qa-regression-2026-05-02/`. Do **not** put them in `test-results/` (gitignored, also dropped by Playwright reruns).
5. Drive the browser via Playwright MCP. Honor `playwright.config.ts`'s `x-test-mode: true` request header.
6. Persist a running results table to `docs/screenshots/qa-regression-2026-05-02/RESULTS.md` (kept locally, **not committed** — this matches the "never commit test output artifacts" CLAUDE.md rule). Each row: case ID, PASS/FAIL/SKIP, screenshot path, notes.

## 3. Phase A — Autonomous (mock data, no Google)

For every case: (i) navigate, (ii) take a `fullPage` screenshot at the listed filename, (iii) capture console + network logs, (iv) run the listed assertions.

### A1. Calendar views render — #176, #149, #145, #144, #154, #139

| #    | URL                                        | Actions                                              | Verify                                                                                      |
| ---- | ------------------------------------------ | ---------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A1.1 | `/test/calendar?view=month&events=default` | Wait for grid; screenshot `cal-month-default.png`    | `[data-testid=calendar-display]` visible; today's cell highlighted; ≥14 events rendered     |
| A1.2 | `/test/calendar?view=week&events=default`  | Screenshot `cal-week-default.png`; scroll to 9am row | Time grid renders 24 hour labels; "Morning Standup" chip visible at ~9am column             |
| A1.3 | `/test/calendar?view=day&events=overflow`  | Screenshot `cal-day-overflow.png`                    | 10 stacked event chips visible; no chip clipped past container                              |
| A1.4 | `/test/calendar?view=year&events=family`   | Screenshot `cal-year-family.png`                     | 12 month mini-grids; multi-color dots per day for days with events; today emphasized (#145) |
| A1.5 | `/test/calendar?view=agenda&events=family` | Screenshot `cal-agenda-family.png`                   | Search input present; events grouped by date heading (#144)                                 |
| A1.6 | `/test/calendar?view=clock&events=default` | Screenshot `cal-clock-top-level.png`                 | Analog clock renders as primary view (#154); event arcs visible                             |
| A1.7 | `/test/calendar?view=month&events=empty`   | Screenshot `cal-month-empty.png`                     | Grid renders, no event chips, no JS error                                                   |
| A1.8 | `/test/calendar?view=week&events=multiDay` | Screenshot `cal-week-multiday.png`                   | Multi-day event spans correctly; all-day pinned to all-day row                              |

### A2. View transition animations — #156

| #    | URL                                        | Actions                                                                                                   | Verify                                                                                                                    |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A2.1 | `/test/calendar?view=month&events=default` | Click ViewSwitcher → Week → Day → Year → Agenda → Clock → Month, screenshot `transition-*.png` after each | After each: AnimatedSwap key changes, target view in DOM, no console errors, no orphan duplicate views in DOM after 500ms |

### A3. Analog clock variants — #154

| #    | URL                                                               | Actions                                      | Verify                                                                                              |
| ---- | ----------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A3.1 | `/test/analog-clock?scenario=default&hour=10&min=15`              | Screenshot `clock-default.png`               | Colored arcs render; hour/min hands at 10:15; legend lists events                                   |
| A3.2 | `/test/analog-clock?scenario=overlap&hour=3`                      | Screenshot `clock-overlap.png`               | Overlapping arcs render at distinguishable radii                                                    |
| A3.3 | `/test/analog-clock?scenario=colors&hour=0`                       | Screenshot `clock-colors.png`                | All standard event colors render distinctly                                                         |
| A3.4 | `/test/analog-clock?scenario=empty`                               | Screenshot `clock-empty.png`                 | Clock face renders; legend hidden; no error                                                         |
| A3.5 | `/test/analog-clock?scenario=dense&size=800`                      | Screenshot `clock-dense-large.png`           | Many arcs render; clock at 800px square                                                             |
| A3.6 | `/test/analog-clock?scenario=all-day-mix&hour=9&input=raw`        | Screenshot `clock-all-day-mix.png`           | Raw events list shows inputs with `all-day` badge; clock face shows only in-period non-all-day arcs |
| A3.7 | `/test/analog-clock?scenario=default&seconds=true&hour=10&min=15` | Wait 3s; screenshot `clock-with-seconds.png` | Second hand visible; advances visibly across two captures                                           |

### A4. Mini-cal sidebar + sidebar-hide rule — #175, #147

| #    | URL                                                   | Actions                                  | Verify                                                                               |
| ---- | ----------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| A4.1 | `/test/calendar?view=week&sidebar=true&events=family` | Screenshot `sidebar-week.png`            | `MiniCalendarSidebar` rendered; multi-color dots for days with multiple event colors |
| A4.2 | Switch view to `month` via ViewSwitcher               | Screenshot `sidebar-hidden-on-month.png` | Sidebar **not** in DOM when view=month                                               |
| A4.3 | Switch view to `year`                                 | Screenshot `sidebar-hidden-on-year.png`  | Sidebar not in DOM                                                                   |
| A4.4 | Switch view to `clock`                                | Screenshot `sidebar-hidden-on-clock.png` | Sidebar not in DOM                                                                   |
| A4.5 | Switch view back to `agenda`                          | Screenshot `sidebar-shown-on-agenda.png` | Sidebar reappears                                                                    |
| A4.6 | In sidebar, click a date in next month                | —                                        | Main view's selected date updates to the clicked date (provider wired, #175)         |

### A5. Filter panel — #148

| #    | URL                                                    | Actions                           | Verify                                                                  |
| ---- | ------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------- |
| A5.1 | `/test/calendar?view=month&filters=true&events=family` | Screenshot `filters-initial.png`  | `CalendarFilterPanel` visible; lists distinct colors and distinct users |
| A5.2 | Toggle off color "green"                               | Screenshot `filters-no-green.png` | Green-coded events disappear from grid                                  |
| A5.3 | Click "Clear Filters"                                  | Screenshot `filters-cleared.png`  | All events return                                                       |
| A5.4 | Toggle off user "Jack"                                 | Screenshot `filters-no-jack.png`  | Jack's events removed; others remain                                    |

### A6. Agenda search + group-by — #144

| #    | URL                                              | Actions                                                        | Verify                                                       |
| ---- | ------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| A6.1 | `/test/calendar?view=agenda&events=family`       | Type "Piano" into search; screenshot `agenda-search-piano.png` | Only "Piano Lesson" row visible; group header still rendered |
| A6.2 | Clear search; toggle group-by control if exposed | Screenshot `agenda-grouped.png`                                | Events grouped by date headings, chronological order         |
| A6.3 | Type "zzznomatch"                                | Screenshot `agenda-empty-results.png`                          | Empty-state copy shown; no exceptions                        |

### A7. Event detail modal (read-only) — #139

| #    | URL                                        | Actions                                        | Verify                                                                                                        |
| ---- | ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| A7.1 | `/test/calendar?view=month&events=default` | Click "Project Review" event chip              | EventDetailModal opens; title, time range, color, description visible; no Edit/Delete enabled (mock provider) |
| A7.2 | Press Escape                               | Modal closes; focus returns to triggering chip |
| A7.3 | Re-open modal; Tab through                 | Focus stays trapped within modal               |

### A8. ARIA + keyboard nav — #73

| #    | URL                                                                                             | Actions                                                               | Verify                                                                         |
| ---- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| A8.1 | `/test/calendar?view=month&events=default`                                                      | Inspect grid root                                                     | `role="grid"`, `role="row"`, `role="gridcell"`, `aria-current="date"` on today |
| A8.2 | Focus today's cell; press ArrowRight, ArrowDown, Home, End, PageUp, PageDown, Shift+PageUp/Down | Focused cell moves correctly; `aria-selected` updates; no scroll jump |
| A8.3 | Press Enter on a cell with an event                                                             | EventDetailModal opens (same as A7.1)                                 |
| A8.4 | Capture full ARIA snapshot of grid                                                              | Saved to `aria-month-grid.json` in screenshots dir                    |

### A9. Settings form (UI-only) — #157

| #    | URL                           | Actions                                                                | Verify                                                                                                                           |
| ---- | ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A9.1 | `/test/settings`              | Screenshot `settings-form.png`                                         | All previously hardcoded values now editable: refresh interval, fetch months ahead/behind, max events per day, 24h format, theme |
| A9.2 | Change each field; click Save | Mock save handler shows confirmation; values persist on form re-render |

### A10. Scheduler / scheduler-demo (rotating screens)

| #     | URL                                                                                      | Actions                                                                  | Verify                                                         |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------- |
| A10.1 | `/test/scheduler`                                                                        | Watch ~30s; screenshot at each rotation `scheduler-screen-{a,b,c,d}.png` | 4 screens cycle in order; no console errors during transitions |
| A10.2 | `/test/scheduler-demo`, `/test/scheduler-demo/screen-b`, `/test/scheduler-demo/screen-c` | Screenshot each                                                          | Layout renders; sub-routes render distinct content             |

### A11. Mobile & tablet smoke

| #     | URL                                                    | Actions                        | Verify                                                          |
| ----- | ------------------------------------------------------ | ------------------------------ | --------------------------------------------------------------- |
| A11.1 | `/test/calendar?view=agenda&events=family` at 390x844  | Screenshot `mobile-agenda.png` | No horizontal scroll; sidebar collapsed; ViewSwitcher reachable |
| A11.2 | `/test/calendar?view=month&events=default` at 1024x768 | Screenshot `tablet-month.png`  | Grid fits without overflow                                      |

## 4. Phase B — Auth-Required (Google sign-in)

Order chosen so the user authenticates **once** and all Google round-trips run in a single session. **Per user: Create + auto-clean is the desired mode.** Every test object uses the prefix `QA-AUTOTEST-<timestamp>` so any leftover from a failed run is greppable and removable.

### B0. Sign-in handshake — one-time user step

User actions (I'll instruct):

1. In a fresh Chrome window, visit `http://localhost:3000`.
2. Click "Sign in with Google", complete OAuth as the primary test account.
3. Confirm `authjs.session-token` cookie at `localhost:3000` (DevTools → Application).
4. Tell me "ready". I attach via Playwright MCP to the existing Chrome profile so requests carry the live session.

### B1. Calendar live data render — #176, #175

| #    | Action                                            | Verify                                                                  | Cleanup |
| ---- | ------------------------------------------------- | ----------------------------------------------------------------------- | ------- |
| B1.1 | Navigate `/calendar` (default month)              | Real GCal events render in current month; no 4xx/5xx; no console errors | —       |
| B1.2 | Switch through Day → Week → Year → Agenda → Clock | Each view loads real data; sidebar shows/hides per #147                 | —       |

### B2. Event detail modal → real GCal event — #139

| #    | Action                        | Verify                                                               | Cleanup |
| ---- | ----------------------------- | -------------------------------------------------------------------- | ------- |
| B2.1 | Click any existing real event | Modal title, attendees if any, description match google.com/calendar | —       |

### B3. Event create dialog round-trip — #143 (and #199 if still open)

| #    | Action                                                                                             | Verify                                                                                          | Cleanup       |
| ---- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------- |
| B3.1 | On `/calendar`, open create dialog ("+" / "New Event")                                             | Dialog opens                                                                                    | —             |
| B3.2 | Fill title `QA-AUTOTEST-CREATE-<timestamp>`, today 14:00–14:15, color blue, primary calendar, save | POST returns 200; event appears in grid within 5s; visible on google.com/calendar after refresh | Delete via B4 |

### B4. Event detail modal → delete to Google — #197

| #    | Action                                         | Verify                                                                  | Cleanup              |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------------- | -------------------- |
| B4.1 | Click the `QA-AUTOTEST-CREATE-*` event from B3 | Modal opens                                                             | —                    |
| B4.2 | Click Delete; confirm                          | DELETE 200/204; event disappears from grid; gone on google.com/calendar | Done — event removed |

### B5. Tasks list + create — #194, #190

| #    | Action                                                                 | Verify                                                      | Cleanup                                                                                                  |
| ---- | ---------------------------------------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| B5.1 | Navigate to Tasks UI surface (sidebar/toolbar entry from `/calendar`)  | Real Google Tasks list loads; no 4xx                        | —                                                                                                        |
| B5.2 | Open NewTaskModal; create `QA-AUTOTEST-TASK-<timestamp>`, due tomorrow | POST 200; task appears in list; visible on tasks.google.com | Delete via UI; if delete UI not exposed, complete-then-clear from list, and note for manual confirmation |

### B6. Settings persistence — #157

| #    | Action                                                       | Verify                                   | Cleanup                  |
| ---- | ------------------------------------------------------------ | ---------------------------------------- | ------------------------ |
| B6.1 | `/settings`                                                  | Form loads with current persisted values | —                        |
| B6.2 | Change one safe field (e.g. default view), Save, hard reload | Persisted value still shown after reload | Revert to original value |

### B7. Multi-profile + PIN — #136

| #    | Action                                                                            | Verify                                                 | Cleanup                |
| ---- | --------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------- |
| B7.1 | `/profiles`                                                                       | Profile list renders                                   | —                      |
| B7.2 | `/profiles/new`, create profile `QA-AUTOTEST-PROFILE-<timestamp>`, set PIN `1234` | Profile created; appears in list                       | Delete profile in B7.5 |
| B7.3 | Switch to QA profile; PIN prompt                                                  | Wrong PIN rejected with error copy; correct PIN admits | —                      |
| B7.4 | `/profiles/<id>/settings`                                                         | Settings form scoped to that profile loads             | —                      |
| B7.5 | Delete `QA-AUTOTEST-PROFILE-*` profile                                            | Profile removed; no orphan rows in `/profiles`         | Done                   |

### B8. Auth UX — #155 (light touch)

| #    | Action                                                                      | Verify                                                                                                                                                                 |
| ---- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B8.1 | While signed in as account A, attempt to link the same Google account again | Backend rejects with friendly error toast; no duplicate `Account` row created. (If only one Google account is available, mark **SKIP — needs second Google account**.) |

## 5. Phase C — Open PR Sweep (gated on merge state at execution time)

For each row: at run time, `gh pr view <N> --json state,mergedAt` and only execute if the PR is still open. If merged-since-plan-was-written, skip and rely on Phase A/B coverage. Branch-switching protocol below the table.

| PR   | Branch                        | Title (short)                               | Test Approach                                                                                                                                          | URL / Action                                                                                                                  | Auth needed? |
| ---- | ----------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ------------ |
| #225 | `claude/loving-faraday-a9JNF` | `useDateNow` w/ midnight-tick refresh       | On `/test/calendar`, capture screen at 23:59 (mock via system clock or browser-time override). Verify date/today cell flips at midnight without reload | `/test/calendar?view=month&events=default` (use `Date.now` shim if MCP supports it; otherwise note as **manual time-travel**) | No           |
| #199 | `claude/loving-faraday-6fs7i` | Wire event creation to GCal                 | Same as B3 above (create round-trip). If #199 still open and B3 already covered the same code path on main, skip. Otherwise run on the PR branch.      | `/calendar` create flow                                                                                                       | YES          |
| #200 | `claude/loving-faraday-Xcyz9` | Tasks → multi-profile assignments           | Create task with assignment to a non-default profile; verify assignment persists; verify it shows on the assigned profile's view                       | `/calendar` tasks UI w/ profile switch                                                                                        | YES          |
| #196 | `claude/loving-faraday-7FMkv` | Year view → CalendarProvider full-year load | Year view renders dots for every month, not just current; cross-year nav fetches additional years                                                      | `/test/calendar?view=year&events=family` (mock) + `/calendar?view=year` (live)                                                | Mock + auth  |
| #195 | `claude/loving-faraday-JWftH` | Agenda toggle within Day & Week             | Day & Week views expose an "Agenda" toggle that reveals a chronological list overlay/panel                                                             | `/test/calendar?view=day&events=family` then `view=week`, look for agenda toggle                                              | No           |
| #198 | `claude/loving-faraday-0ho73` | Rewards API + PointsContext                 | Verify `/profiles/<id>/give-points` UI affordance (button to award) increments stats; PointsContext exposes points to children                         | `/profiles/<id>/settings` or wherever Give Points lives                                                                       | YES          |
| #193 | `claude/loving-faraday-FhBp9` | Meals Prisma schema                         | Backend-only (schema). Out of scope for browser QA — verify migration applies cleanly via `pnpm db:migrate:status` and skip otherwise                  | —                                                                                                                             | N/A          |

**Branch-switching protocol for Phase C:**

1. Stash any plan/screenshots changes (`git stash --keep-index` if needed; this branch is `claude/analog-clock-ievent-input` — stay clean).
2. Per PR: `gh pr checkout <N>`; restart dev server (`pnpm dev`); run that row's case set; capture results; `git checkout claude/analog-clock-ievent-input` to return.
3. After all rows: `git status` clean; no leftover branches with uncommitted state.

## 6. Verification — How I Know It Worked

For each Phase A/C-mock case:

- Screenshot file in `docs/screenshots/qa-regression-2026-05-02/<name>.png`.
- Console log captured; assert **zero** entries with severity `error` or `warning` from app code (filter known noise: AppInsights "not configured", browser-extension chatter).
- Network log captured; assert **zero** responses with status ≥400 against `localhost:3000` origin.
- Listed DOM/ARIA assertions pass.

For each Phase B/C-live case, all of the above plus:

- Cross-check on google.com/calendar or tasks.google.com tab where applicable.
- All `QA-AUTOTEST-*` objects removed by end of run; final `gh pr view` of relevant calendar URL shows no leftover items.

End-of-run deliverable: a Markdown report (returned in chat, also saved to `docs/screenshots/qa-regression-2026-05-02/RESULTS.md` locally) listing every case A1.1 → C row with PASS / FAIL / SKIP, screenshot path, and any console/network anomaly. Failures get a one-line repro and the closing PR # they regress.

## 7. Out of Scope

- **#158 OAuth token encryption at rest** — backend-only; verify separately via direct DB inspection of `Account.access_token` showing ciphertext.
- **#160 HTTP retry with backoff** — backend-only; covered by unit tests, not browser-testable without a fault injector.
- **#155 dup-account guard full coverage** — needs a second Google account; light touch only in B8.1.
- **#193 Meals Prisma schema** — schema-only; verified separately via `pnpm db:migrate:status`.
- **Visual regression baselines** — this run produces fresh screenshots only; no committed `toHaveScreenshot()` baseline updates.
- **Cross-browser** — Chromium only this run. Firefox / WebKit / mobile-chrome / tablet projects in `playwright.config.ts` are reserved for per-PR `browser-qa` runs.

## 8. Critical Files / Utilities

- `.claude/commands/browser-qa.md` — the project's browser-qa slash-command; this plan is a regression-sweep adaptation of its mindset.
- `src/app/test/calendar/page.tsx` — Phase A workhorse; URL params: `events`=default|empty|single|colors|overflow|family|multiDay; `view`=day|week|month|year|agenda|clock; `loading`, `loadingDelay`, `controls`, `24hour`, `sidebar`, `filters`.
- `src/app/test/analog-clock/page.tsx` — Phase A clock cases (A3); params: `scenario`, `size`, `seconds`, `hour`, `min`, `input`; scenarios: `default|overlap|colors|family|empty|single|dense|all-day-mix`.
- `src/app/test/settings/page.tsx` — Phase A settings UI (A9).
- `src/app/test/scheduler/page.tsx`, `src/app/test/scheduler-demo/page.tsx` (+ `screen-b`, `screen-c`) — Phase A A10.
- `playwright.config.ts` — `baseURL`, `x-test-mode: true` header, browser projects.
- `e2e/auth/auth-setup.ts` — `createTestUser()` seeds a DB-backed NextAuth session by cookie. Useful for any case that gates only on `authjs.session-token` (raw page-loads of `/calendar`, `/settings`, `/profiles`), but Google-API round-trips (B1.1, B3, B4, B5) need live OAuth tokens — DB-seeded sessions return 401/empty from `/api/calendar/*`.
- `e2e/*.spec.ts` — 20+ existing specs (`calendar.spec.ts`, `event-create.spec.ts`, `event-detail-modal.spec.ts`, `agenda-search.spec.ts`, `analog-clock-view.spec.ts`, `year-calendar.spec.ts`, `calendar-filter-panel.spec.ts`, `calendar-keyboard.spec.ts`, `mini-calendar-sidebar.spec.ts`, `settings-calendar.spec.ts`). Read for the assertion patterns each feature already uses; mirror those in MCP-driven checks.
