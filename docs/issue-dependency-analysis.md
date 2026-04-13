# Open Issue Dependency Analysis

> Generated 2026-04-03 | Updated 2026-04-12 | Covers all 12 open issues at time of analysis + newly completed issues

## Dependency Graph

```
TIER 0 — Foundation (no blockers, enables many others)
═══════════════════════════════════════════════════════
  #109  Set up Prisma migration workflow
  #92   Evaluate adopting reference calendar component sets

TIER 1a — Calendar UI Components (blocked by open UI issues, not yet in this list)
══════════════════════════════════════════════════════════════════════════════════
  These open UI issues are NOT in the 12 tracked here, but block Tier 2:
    #70  Add week and day calendar views         → blocks #113
    #80  Add mini-calendar sidebar               → blocks #114
    #81  Add event detail modal                  → blocks #115
    #82  Add event creation dialog               → blocks #116
    #83  Add year view with event dot indicators  → blocks #117
    #84  Add drag-and-drop event rescheduling    → blocks #118

TIER 1b — Scheduler Features (independent of calendar wiring)
═════════════════════════════════════════════════════════════
  #95   Add persistent scheduler status indicator
  #94   Add animated page transitions
  #108  Add user-configurable screen rotation settings

TIER 2 — Calendar API Wiring (blocked by Tier 1a UI issues)
═══════════════════════════════════════════════════════════
  #113  Wire week/day views to CalendarProvider        ← blocked by #70
  #114  Wire mini-calendar to CalendarProvider          ← blocked by #80
  #115  Wire event detail modal to API                  ← blocked by #81
  #116  Wire event creation dialog to API               ← blocked by #82
  #117  Wire year view to CalendarProvider              ← blocked by #83, benefits from #72
  #112  Wire radial clock event arcs to API             ← blocked by radial clock UI (untracked)

TIER 3 — Highest Dependencies
═════════════════════════════
  #118  Wire drag-and-drop rescheduling to API          ← blocked by #84 AND #115
```

## Detailed Connection Map

### #109 — Set up Prisma migration workflow

| Relationship | Issue                  | Nature                                                                          |
| ------------ | ---------------------- | ------------------------------------------------------------------------------- |
| **Enables**  | #108                   | #108 adds Prisma schema fields; proper migrations make this safe and repeatable |
| **Enables**  | #115, #116, #118       | All "local database write path" work depends on reliable schema migration       |
| **Enables**  | All future DB features | Profiles, rewards, meal planning, etc. all modify the schema                    |

**Priority: HIGH** — Foundation infrastructure. No blockers. Should be done first.

---

### #92 — Evaluate adopting reference calendar component sets

| Relationship           | Issue        | Nature                                                                           |
| ---------------------- | ------------ | -------------------------------------------------------------------------------- |
| **Informs**            | #70, #80–#84 | Evaluation recommends cherry-picking from Jeraidi for all calendar UI work       |
| **Informs**            | #94          | Jeraidi uses framer-motion for transitions, relevant to page transition approach |
| **Informs**            | #87          | Jeraidi has smooth view transitions, directly applicable                         |
| **Indirectly informs** | #113–#118    | UI component approach cascades to wiring work                                    |

**Priority: HIGH** — Decision issue. Reaching a decision here unblocks confident implementation of #70, #80–#84.

---

### #108 — Add user-configurable screen rotation settings ✅ IMPLEMENTED

| Relationship      | Issue | Nature                                                                                                                                          |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Benefits from** | #109  | Adding `schedulerIntervalSeconds` and `schedulerPauseOnInteractionSeconds` to Prisma schema is safer with migration workflow                    |
| **Synergy with**  | #94   | Both modify scheduler behavior; #94 adds `TransitionConfig` to `ScheduleConfig`, #108 adds interval/pause settings — coordinate the settings UI |
| **Synergy with**  | #95   | Status indicator displays the interval countdown that #108 makes configurable                                                                   |

**Status: COMPLETE** — Prisma migration, API validation, Settings UI (SchedulerSection), and scheduler integration all implemented. Defaults aligned to 10s interval / 30s pause.

---

### #95 — Add persistent scheduler status indicator

| Relationship     | Issue  | Nature                                                                                                      |
| ---------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| **Synergy with** | #108   | Indicator shows countdown based on `intervalSeconds` which #108 makes user-configurable                     |
| **Synergy with** | #94    | Both enhance the scheduler visual experience; indicator positioning may interact with transition animations |
| **Has open PR**  | PR #96 | Implementation may already be in progress                                                                   |

**Priority: MEDIUM** — Has an open PR (#96). Low risk, self-contained.

---

### #94 — Add animated page transitions ✅ IMPLEMENTED

| Relationship     | Issue | Nature                                                                                                                                                                         |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Related to**   | #87   | #87 covers calendar _view_ transitions (month↔week↔day); #94 covers scheduler _page_ transitions (Calendar→Tasks→Recipes). Different scope but shared animation infrastructure |
| **Synergy with** | #92   | Jeraidi reference uses framer-motion for view transitions — same library could power page transitions                                                                          |
| **Synergy with** | #108  | Both extend `ScheduleConfig`; should coordinate the settings UI to avoid duplication                                                                                           |
| **Synergy with** | #95   | Indicator must remain visible during page transitions                                                                                                                          |

**Status: COMPLETE** — ScreenTransition component with slide/fade/slide-fade types, configurable duration (200-1000ms), prefers-reduced-motion support, TransitionSection settings UI, and direction-aware animations (forward/backward). Uses CSS transforms for GPU-composited 60fps performance.

---

### #90 — Add dark/light/system theme toggle ✅ IMPLEMENTED

| Relationship     | Issue | Nature                                                                                           |
| ---------------- | ----- | ------------------------------------------------------------------------------------------------ |
| **Independent**  | —     | No blockers; uses existing `next-themes` dependency and shadcn/ui dark mode support              |
| **Synergy with** | #86   | Calendar settings panel could integrate the ThemeToggle dropdown; shares settings infrastructure |

**Status: COMPLETE** — ThemeProvider (next-themes), ThemeToggle dropdown (Sun/Moon/Monitor icons), complete shadcn/ui CSS variable definitions for light and dark themes (oklch, slate base), semantic color tokens throughout all major components (SimpleCalendar, AgendaCalendar, AccountManager, Home, Settings, Calendar page). DisplaySection wired to `setTheme()` for instant switching. Theme options changed from "auto" to "system" (next-themes standard). API accepts both "auto" and "system" for backward compatibility. localStorage persistence via next-themes.

---

### #113 — Wire week/day views to CalendarProvider

| Relationship     | Issue | Nature                                                                                             |
| ---------------- | ----- | -------------------------------------------------------------------------------------------------- |
| **Blocked by**   | #70   | UI components must exist before wiring                                                             |
| **Synergy with** | #114  | Mini-calendar sidebar navigates to day/week views; both extend CalendarProvider date-range loading |
| **Synergy with** | #117  | Year view click-through navigates to day view; shared CalendarProvider extensions                  |

**Priority: Blocked** — Waiting on #70.

---

### #114 — Wire mini-calendar sidebar to CalendarProvider

| Relationship     | Issue | Nature                                                                                                            |
| ---------------- | ----- | ----------------------------------------------------------------------------------------------------------------- |
| **Blocked by**   | #80   | UI component must exist before wiring                                                                             |
| **Synergy with** | #113  | Mini-calendar navigates to day/week views — both need CalendarProvider's `selectedDate` and event-by-date queries |
| **Synergy with** | #117  | Year view and mini-calendar both show event dot indicators using similar day-has-events logic                     |

**Priority: Blocked** — Waiting on #80.

---

### #115 — Wire event detail modal to API (edit/delete)

| Relationship              | Issue | Nature                                                                                                                         |
| ------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Blocked by**            | #81   | UI component must exist before wiring                                                                                          |
| **Shared API route with** | #118  | Both use `PATCH /api/calendar/events/[id]` — should be designed together                                                       |
| **Synergy with**          | #116  | #116 creates events (`POST`), #115 edits/deletes them (`PATCH`/`DELETE`). Same API route file, same optimistic update patterns |
| **Benefits from**         | #109  | Local database write paths need proper migration workflow                                                                      |

**Priority: Blocked** — Waiting on #81. But API route design should be planned alongside #116 and #118.

---

### #116 — Wire event creation dialog to API

| Relationship      | Issue | Nature                                                                                                        |
| ----------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| **Blocked by**    | #82   | UI component must exist before wiring                                                                         |
| **Synergy with**  | #115  | Complementary CRUD operations — share API route file, validation patterns, optimistic update logic            |
| **Synergy with**  | #118  | All three (#115, #116, #118) write to Google Calendar API — share OAuth scope requirements and error handling |
| **Benefits from** | #109  | Local database write paths need proper migration workflow                                                     |

**Priority: Blocked** — Waiting on #82.

---

### #117 — Wire year view to CalendarProvider

| Relationship      | Issue | Nature                                                                                          |
| ----------------- | ----- | ----------------------------------------------------------------------------------------------- |
| **Blocked by**    | #83   | UI component must exist before wiring                                                           |
| **Benefits from** | #72   | Year view loads 365 days of events; performance optimization (#72) directly impacts feasibility |
| **Synergy with**  | #114  | Both render event dot indicators per day — share the day-has-events aggregation logic           |
| **Synergy with**  | #113  | Year view click-through navigates to day/month view via CalendarProvider                        |

**Priority: Blocked** — Waiting on #83. Significantly benefits from #72 landing first.

---

### #112 — Wire radial clock event arcs to API

| Relationship       | Issue            | Nature                                                                                   |
| ------------------ | ---------------- | ---------------------------------------------------------------------------------------- |
| **Blocked by**     | Radial clock UI  | `analog-clock.tsx`, `clock-face.tsx`, `event-arc.tsx` don't exist yet (no tracked issue) |
| **Uses**           | CalendarProvider | Already exists — lower integration barrier than other wiring issues                      |
| **Independent of** | #113–#118        | Different UI component, different data filtering (12-hour window vs date range)          |

**Priority: Blocked** — Waiting on radial clock UI components (currently untracked as a separate issue).

---

### #118 — Wire drag-and-drop rescheduling to API

| Relationship      | Issue      | Nature                                                                                                  |
| ----------------- | ---------- | ------------------------------------------------------------------------------------------------------- |
| **Blocked by**    | #84        | Drag-and-drop UI must exist before wiring                                                               |
| **Blocked by**    | #115       | Shares `PATCH /api/calendar/events/[id]` route — #115 should define this route first                    |
| **Synergy with**  | #115, #116 | All three are Google Calendar write operations sharing OAuth scopes, error handling, optimistic updates |
| **Benefits from** | #109       | Local database write paths need proper migration workflow                                               |

**Priority: Blocked (double)** — Waiting on both #84 and #115. Highest dependency count of all open issues.

---

## Recommended Implementation Order

```
Phase 1 — Foundation (parallel)
  #109  Prisma migration workflow
  #92   Finalize reference component evaluation decision

Phase 2 — Independent scheduler enhancements (parallel, after Phase 1)
  #95   Scheduler status indicator (has PR #96) ✅ DONE
  #108  Screen rotation settings (after #109) ✅ DONE
  #94   Animated page transitions (after #92 informs animation library choice) ✅ DONE

Phase 3 — Calendar UI components (parallel, after #92 decision)
  #70   Week and day views
  #80   Mini-calendar sidebar
  #81   Event detail modal
  #82   Event creation dialog
  #83   Year view
  #84   Drag-and-drop UI

Phase 4 — Calendar API wiring (after respective Phase 3 UI)
  #113  Wire week/day views         (after #70)
  #114  Wire mini-calendar          (after #80)
  #115  Wire event detail modal     (after #81)  ← do before #118
  #116  Wire event creation dialog  (after #82)
  #117  Wire year view              (after #83 + #72)
  #112  Wire radial clock           (after radial clock UI)

Phase 5 — Final wiring
  #118  Wire drag-and-drop          (after #84 + #115)
```

## Key Synergy Clusters

### Cluster A: Calendar CRUD API Routes (#115 + #116 + #118)

These three issues all create server-side API routes for Google Calendar mutations. They should share:

- API route file structure (`/api/calendar/events/` and `/api/calendar/events/[id]/`)
- Optimistic update patterns in CalendarProvider
- Error handling and rollback logic
- Google Calendar OAuth scope requirements (`calendar.events`)
- IndexedDB cache invalidation strategy

**Recommendation:** Design the API route structure when implementing #115, then #116 and #118 follow the same patterns.

### Cluster B: CalendarProvider Extensions (#113 + #114 + #117)

These three issues all extend CalendarProvider's data loading:

- #113 needs narrow time-range queries for day/week views
- #114 needs day-has-events queries for dot indicators
- #117 needs full-year event loading

**Recommendation:** Implement CalendarProvider extensions holistically rather than three separate refactors.

### Cluster C: Scheduler UX Polish (#94 + #95 + #108)

All three enhance the screen rotation scheduler experience:

- #95 adds a status indicator widget
- #94 adds page transition animations
- #108 makes timing configurable

**Recommendation:** Can be developed in parallel but should share a settings UI section.
