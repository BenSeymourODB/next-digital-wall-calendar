# Issue Cross-Reference Updates

> Append the text below to each issue's description to document dependencies and synergies.
> Generated 2026-04-03. Updated 2026-04-13.

---

## #92 — Evaluate adopting reference calendar component sets

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Informs implementation of:**

- #70, #80, #81, #82, #83, #84 — Evaluation recommends cherry-picking from Jeraidi for all calendar UI components
- ~~#94~~ ✅ — Jeraidi uses framer-motion for transitions; page transitions now implemented
- #87 — Jeraidi has smooth view transitions directly applicable to calendar view animations
- #113, #114, #115, #116, #117, #118 — UI component approach decision cascades to all API wiring issues

**Priority:** HIGH — Decision issue. Reaching a conclusion here unblocks confident implementation of all calendar UI work.

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #94 — ~~Add animated page transitions to screen rotation scheduler~~ ✅ CLOSED

> Resolved. Page transitions implemented.

---

## #95 — ~~Add persistent scheduler status indicator with composable positioning~~ ✅ CLOSED

> Resolved. Status indicator implemented.

---

## #108 — ~~Add user-configurable screen rotation settings~~ ✅ CLOSED

> Resolved. User-configurable scheduler settings implemented. "Scheduler UX Polish" cluster (#94, #95, #108) is now complete.

---

## #109 — ~~Set up Prisma migration workflow~~ ✅ CLOSED

> Resolved (PR #120). Prisma migration workflow is in place. This unblocked #108 (also now closed) and enables safe schema changes for #115, #116, #118 and future DB-dependent features.

---

## #112 — Wire radial clock event arcs to Google Calendar API and CalendarProvider

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- ~~Radial clock UI components (`analog-clock.tsx`, `clock-face.tsx`, `event-arc.tsx`) — not yet built~~ **Unblocked:** UI components are being built in PR #130.

**Independent of:**

- #113, #114, #115, #116, #117, #118 — Different UI component with different data filtering (12-hour window vs date range)

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #113 — Wire week and day views to CalendarProvider with time-range queries

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- #70 — Week/day view UI components must exist before wiring

**Synergies:**

- #114 — Mini-calendar sidebar navigates to day/week views; both extend CalendarProvider date-range loading
- #117 — Year view click-through navigates to day view; shared CalendarProvider extensions

**Cluster:** Part of "CalendarProvider Extensions" cluster with #114 and #117. Consider implementing CalendarProvider changes holistically rather than three separate refactors.

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #114 — Wire mini-calendar sidebar to CalendarProvider for event indicators and navigation

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- #80 — Mini-calendar sidebar UI must exist before wiring

**Synergies:**

- #113 — Mini-calendar navigates to day/week views; both need CalendarProvider `selectedDate` and event-by-date queries
- #117 — Both render event dot indicators per day; share the day-has-events aggregation logic

**Cluster:** Part of "CalendarProvider Extensions" cluster with #113 and #117. Consider implementing CalendarProvider changes holistically rather than three separate refactors.

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #115 — Wire event detail modal to Google Calendar API and local database for edit/delete

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- #81 — Event detail modal UI must exist before wiring

**Shared API route:**

- #118 — Both use `PATCH /api/calendar/events/[id]`; this issue should define the route first

**Synergies:**

- #116 — Complementary CRUD operations; share API route file, validation patterns, optimistic update logic
- #118 — All three (#115, #116, #118) write to Google Calendar API; share OAuth scope requirements and error handling

**Benefits from:**

- ~~#109~~ ✅ — Prisma migration workflow now in place (PR #120)

**Cluster:** Part of "Calendar CRUD API Routes" cluster with #116 and #118. Design the API route structure here first, then #116 and #118 follow the same patterns.

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #116 — Wire event creation dialog to Google Calendar API and local event database

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- #82 — Event creation dialog UI must exist before wiring

**Synergies:**

- #115 — Complementary CRUD operations; share API route file, validation patterns, optimistic update logic
- #118 — All three (#115, #116, #118) write to Google Calendar API; share OAuth scope requirements and error handling

**Benefits from:**

- ~~#109~~ ✅ — Prisma migration workflow now in place (PR #120)

**Cluster:** Part of "Calendar CRUD API Routes" cluster with #115 and #118.

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #117 — Wire year view to CalendarProvider with full-year event loading

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- #83 — Year view UI must exist before wiring

**Benefits from:**

- #72 — Year view loads 365 days of events; performance optimization directly impacts feasibility

**Synergies:**

- #114 — Both render event dot indicators per day; share the day-has-events aggregation logic
- #113 — Year view click-through navigates to day/month view via CalendarProvider

**Cluster:** Part of "CalendarProvider Extensions" cluster with #113 and #114. Consider implementing CalendarProvider changes holistically rather than three separate refactors.

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```

---

## #118 — Wire drag-and-drop rescheduling to Google Calendar API and local database

**Append to description:**

```markdown
---

### Cross-References (added 2026-04-03)

**Blocked by:**

- #84 — Drag-and-drop UI must exist before wiring
- #115 — Shares `PATCH /api/calendar/events/[id]` route; #115 should define this route first

**Synergies:**

- #115, #116 — All three are Google Calendar write operations sharing OAuth scopes, error handling, optimistic updates

**Benefits from:**

- ~~#109~~ ✅ — Prisma migration workflow now in place (PR #120)

**Cluster:** Part of "Calendar CRUD API Routes" cluster with #115 and #116.
**Priority note:** Highest dependency count of all open issues (double-blocked by #84 + #115).

See [docs/issue-dependency-analysis.md](./docs/issue-dependency-analysis.md) for full dependency graph.
```
