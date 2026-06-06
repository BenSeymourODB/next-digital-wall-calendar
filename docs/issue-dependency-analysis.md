# Issue Dependency Tracking

> **Source of truth as of 2026-04-27:** the GitHub Project
> [Features Before Claude Subscription Close](https://github.com/users/BenSeymourODB/projects/1).
> Dependencies are encoded with GitHub's native **Blocked by** relationships
> (visible on each issue and the project board). Use the `Day`, `Phase`,
> `Cluster`, and `Priority` fields on the project to navigate the work.

## Why this changed

The earlier hand-maintained graph in this file fell out of sync as PRs
landed. Native GitHub dependency tracking + the project's custom fields
replace it without the bookkeeping:

- **Blocked-by graph** — every issue surfaces its blockers and what it
  blocks under "Tracked by" / "Blocked by" on github.com.
- **9-day MVP plan** — encoded in the project's `Day` field
  (`Day 1` through `Day 9` plus `Backlog`).
- **Lifecycle** — encoded in `Phase`
  (Foundation / UI / Wiring / Tasks / Meals / Rewards / Polish / Research).
- **Synergy clusters** — encoded in `Cluster`
  (Calendar CRUD / Provider Extensions / Scheduler Polish / Tasks /
  Meals / Rewards / Tech Debt / Misc).
- **Triage** — encoded in `Priority` (P0 / P1 / P2).

## Working with the project

- **What's blocking me right now?** Filter the project by
  `Status = Blocked` and read the "Blocked by" list on each issue.
- **What can I pick up next?** Filter by `Day = Day N` and
  `Status = Todo`. Items move to `In Progress` once a PR is open.
- **What does an MVP need?** Filter by `Day != Backlog`. Items in
  `Backlog` are deliberately deferred past the 9-day MVP arc.
- **What's the synergy here?** Group by `Cluster` to see issues that
  share API routes, providers, or settings UI and should be designed
  together.

## Snapshot — 9-day MVP arc (set 2026-04-27)

```
Day 1 — Land in-flight calendar / tech-debt PRs
        #61 #68 #69 #70 #71 #76 #77 #124 #146 #152

Day 2 — Land in-flight calendar UI PRs
        #73 #81 #82 #83 #85 #86 #87 #88 #91

Day 3 — Calendar CRUD wiring (defines API contract)
        #115 #116

Day 4 — CalendarProvider extensions cluster
        #72 #112 #113 #114 #117

Day 5 — Drag-and-drop UI + agenda toggle
        #84 #150

Day 6 — DnD wiring + tech-debt batch
        #67 #74 #75 #79 #118

Day 7 — Tasks track part 1 + Rewards schema
        #162 #163 #164 #171

Day 8 — Tasks track part 2 + Rewards UI
        #165 #166 #172 #173

Day 9 — Meals MVP
        #167 #168 #169 #170

Backlog — post-MVP
        #78 #92 #131
```

The shape of the arc, not the exact numbers, is the important part — as
PRs merge and new issues appear, update the project, not this file.

## Historical record

The pre-2026-04-27 hand-rolled dependency graph and tier analysis lives
in git history at this file's parent commit. It was useful for getting
the project started, but the project board is more accurate going
forward.
