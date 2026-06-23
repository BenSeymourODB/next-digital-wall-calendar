# Plan: Wire `onEdit` + `onDelete` into `AgendaList` (#451)

## Why

PR #392 (event detail edit, completes #115) wired `onEdit` + `onDelete` into
the three calendar surfaces that already passed `onDelete`:

- `SimpleCalendar` (month view)
- `AgendaCalendar` (legacy `/test/calendar?view=agenda`)
- `AnalogClockView` (clock view)

`AgendaList` — the production surface for day/week agenda mode after #264 —
was deferred and tracked as #451. Today, clicking an event in day or week
agenda mode opens the `EventDetailModal` but neither the Edit nor the Delete
button ever renders, even on writable calendars.

## What ships

1. `src/components/calendar/AgendaList.tsx`
   - Import `useEventEdit` from `@/hooks/useEventEdit`
   - Import `useEventDelete` from `@/hooks/useEventDelete`
   - Inside `AgendaList`: `const handleEdit = useEventEdit();` and
     `const handleDelete = useEventDelete();`
   - Pass `onEdit={handleEdit}` and `onDelete={handleDelete}` to the
     `<EventDetailModal>` instance at the bottom of the component.

2. `src/components/calendar/__tests__/AgendaList.test.tsx`
   - New `describe` block: `event detail modal — edit + delete wiring (#451)`.
   - Three tests:
     1. Clicking an event card opens the modal; both `Edit event` and
        `Delete event` buttons render when `getAccessRole` returns
        `undefined` (default — treated as writable).
     2. Buttons are hidden when `getAccessRole` returns `"reader"`
        (regression guard for #266 gating).
     3. Buttons are hidden when `getAccessRole` returns `"freeBusyReader"`
        (same gate; explicit second case so a future split between the two
        cannot regress the cover).

## Test strategy

- TDD: write the failing tests first; verify they fail because the buttons
  don't render today; then add the two-prop wiring and watch them go green.
- No CalendarProvider needed — the existing fixture
  `makeCalendarContext` + `CalendarContext.Provider` already mocks
  `editEvent` / `deleteEvent`, so the hooks will hand-off into the mock
  context without touching the network.
- The sonner toast inside the hooks fires only when the user actually
  invokes Save / Delete — these tests stop at button-render assertions, so
  no `Toaster` is needed in the mount.
- Use `userEvent.click` on the event card to open the modal (matches the
  existing search tests' interaction pattern in this file).
- Assert via `screen.getByRole("button", { name: /edit event/i })` and the
  delete equivalent, plus `queryByRole` for the hidden case.

## Out of scope

- Re-asserting click→`onEdit(event, patch)` plumbing — that contract is
  already exhaustively tested in `EventDetailModal.test.tsx` (the modal is
  the same instance we hand the handler to). Re-asserting here would
  shadow #266 / #265 tests without adding signal.
- Wiring the create-event path in agenda mode (#391-class follow-up) —
  out of scope for #451.

## Acceptance criteria (from #451)

- [x] `AgendaList` passes `onEdit` and `onDelete` to `EventDetailModal`
- [x] Component test renders the modal for a writable event and asserts
      both buttons are present
- [x] Same test confirms the buttons are hidden when `accessRole` is
      `reader` / `freeBusyReader`
- [x] `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` clean
