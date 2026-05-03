# `/test/tasks` page — list-agnostic by default (Issue #236)

## Problem

`src/app/test/tasks/page.tsx` always renders `TaskList` against a hard-coded
mock config containing `listId: "list-groceries"`. Playwright suites work
because they mock every `/api/tasks*` call, but a real signed-in user gets
the inline error _"Failed to fetch tasks from list Groceries"_ because the
list does not exist in their Google Tasks account.

## Goal

Make `/test/tasks` work for any signed-in user by defaulting to a "live"
mode that fetches the user's real task lists, auto-selects the first
available one, and exposes a picker so they can switch between lists.
Preserve the existing `?lists=single` / `?lists=multi` mock harnesses
unchanged so the existing Playwright suite keeps passing.

## Phases

### Phase 1 — Add live mode + UI affordances

Refactor `page.tsx`:

- Mode resolved from `?lists=` query param:
  - `?lists=single` → existing single-list mock (unchanged)
  - `?lists=multi` → existing multi-list mock (unchanged)
  - **default (no param) → new live mode**
- Live mode is a small client component that:
  - Fetches `GET /api/tasks/lists` on mount
  - Renders a loading skeleton while the fetch is in-flight
  - Renders an error card with a "Try again" button if the fetch fails
  - Renders an empty-state card when the user has no task lists
  - Otherwise renders a `<select>` list-picker (auto-selected to the first
    list) plus the existing `TaskList` for the chosen list
- A small `data-testid` per state so component tests + Playwright can
  assert deterministically.
- Update `e2e/new-task-modal.spec.ts` to explicitly use `?lists=single`
  (the variant the existing assertions describe). This is not a test
  weakening — the same behaviour is still asserted, just under the
  explicit URL that documents the mock harness.

Mapping `GoogleTaskList[]` → `TaskListSelection[]`: cycle through
`DEFAULT_LIST_COLORS` so each list gets a distinct swatch. This keeps
the live-mode picker visually consistent with the existing settings UI.

### Phase 2 — Component test + Playwright E2E

- New Vitest spec `src/app/test/tasks/__tests__/page.test.tsx` covering
  the page component:
  1. Renders single-list mock when `?lists=single`
  2. Renders multi-list mock when `?lists=multi`
  3. Live mode shows loading skeleton while `/api/tasks/lists` is in-flight
  4. Live mode shows error card on fetch failure; "Try again" refetches
  5. Live mode shows empty state when the user has zero lists
  6. Live mode auto-selects the first list and renders `TaskList`
  7. Switching the picker swaps the rendered list
- New Playwright spec `e2e/test-tasks-live-mode.spec.ts` (video: on)
  intercepts `/api/tasks/lists` and `/api/tasks*` and asserts:
  - Loading → list-picker visible → first list auto-selected → TaskList renders
  - Switching the picker re-fetches against the new listId
  - Empty state when the user has no lists
  - Error state with retry when the fetch fails
- Existing `e2e/new-task-modal.spec.ts` updated to use `?lists=single` /
  `?lists=multi`. No assertion changes — just URL prefix.

## Acceptance criteria

- [ ] `/test/tasks` (no query param) renders the user's real task lists
      with a picker, auto-selecting the first
- [ ] Loading, error, and empty states all render with helpful copy
- [ ] `/test/tasks?lists=single` and `/test/tasks?lists=multi` continue
      to render the existing mock harnesses unchanged
- [ ] All existing tests still pass
- [ ] New Vitest + Playwright tests cover the live mode states + picker
- [ ] No `test-results/` / `playwright-report/` / `blob-report/` committed
- [ ] `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types` clean

## Out of scope / deferred

- Persisting the picker selection to localStorage (probably worth a
  follow-up alongside #208's filter-persistence work).
- Surfacing the live mode at the production tasks UI (`/test/tasks` is
  explicitly a developer harness; the production wiring lives elsewhere
  and is tracked under #166 / #200).
