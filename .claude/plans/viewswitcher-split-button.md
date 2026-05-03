# ViewSwitcher Split Button + Popover Pointer Fix — Implementation Plan

> Addresses GitHub Issue #235.

## Goal

Replace the Day/Week single-button-as-dropdown UI in `ViewSwitcher` with a
proper split-button UX (primary "switch view" button + caret that opens the
Grid/Agenda menu). Eliminate the Radix-popover pointer-events leak that was
blocking subsequent clicks after the popover closed.

## Problem recap

`ViewSwitcher` (post-#150) makes the entire Day/Week button a dropdown trigger.
That:

1. Hides the primary "switch view" affordance — sighted users have no signal
   that there is a sub-menu, even though the button has a chevron.
2. Breaks any test or naïve user interaction that clicks
   `view-switcher-day` expecting to switch views, since clicking opens a
   popover with Grid/Agenda options.
3. After the popover closes, pointer-events on the body remain trapped under
   the Radix modal overlay, so the next click on (e.g.) Year/Month is
   intercepted.

## Design — Option (a) from the issue

Split each Day/Week control into two adjacent buttons sharing visual borders:

```
┌─────────────┬───┐
│ ☐ Day · …   │ ▾ │
└─────────────┴───┘
   primary    caret
```

- **Primary button** (`data-testid="view-switcher-day"` / `…-week"`) — plain
  `Button`, switches the view via `setView(view)`. Preserves the user's
  current `agendaMode` setting (it is global state, set deliberately).
- **Caret button** (`data-testid="view-switcher-day-mode"` / `…-week-mode"`) —
  `DropdownMenu` trigger that opens a `Grid`/`Agenda` `RadioGroup`. Picking an
  option both `setView(view)` and `setAgendaMode(mode === "agenda")`.
- **`aria-label`** on the caret describes its purpose for screen readers
  (e.g. `"Choose day display mode"`), since its visible content is just an
  icon.
- **`modal={false}`** on the `DropdownMenu` to stop Radix from installing the
  body-level pointer-blocking overlay. This is the root fix for the
  "popover doesn't release pointer cleanly" complaint.

The primary button keeps the existing visible label that reflects the current
mode (`Day` vs `Day · Agenda`) so sighted users still see the sub-mode at a
glance.

## Phases

1. **Component tests + implementation.** Update
   `src/components/calendar/__tests__/ViewSwitcher.test.tsx` to assert the
   new behaviour (primary click switches view, caret click opens menu, primary
   button has no `aria-haspopup`, caret has `aria-haspopup="menu"` and an
   accessible label). Implement the split-button structure in
   `ViewSwitcher.tsx`.
2. **E2E spec updates.** Update existing Playwright specs that exercised the
   broken affordance to click the caret instead of the primary button:
   - `e2e/agenda-toggle.spec.ts`
   - `e2e/week-day-views.spec.ts`
   - `e2e/calendar.spec.ts`
     Add a focused regression spec proving:
   - Primary `view-switcher-week` click switches to week view (no menu).
   - Primary click followed by an immediate Year click does not get
     intercepted (regression for the pointer-events leak).
3. **Verification + PR.** `pnpm test`, `pnpm lint:fix`, `pnpm format:fix`,
   `pnpm check-types`. Push, open draft PR, mark ready when green.

## Acceptance criteria (from issue + plan)

- [ ] Day and Week render as split buttons (primary + caret).
- [ ] Clicking the primary button switches view without opening the menu.
- [ ] Clicking the caret opens the Grid/Agenda menu.
- [ ] Caret has `aria-haspopup="menu"` and a screen-reader-friendly label.
- [ ] `DropdownMenu` opened from the caret uses `modal={false}` to prevent
      pointer-events leakage onto sibling buttons.
- [ ] No regression in existing E2E specs (after they are updated to click
      the caret where they were exercising the menu).
- [ ] `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types`
      pass.
