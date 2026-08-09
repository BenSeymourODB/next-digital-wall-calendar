# Plan: Wire `onEdit` + `onDelete` into `AgendaList` (#451)

## Source

[Issue #451](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/451) — follow-up to merged PR #392 (event detail edit, completes #115). PR #392 explicitly deferred the `AgendaList` wire-up as out of scope.

## Problem

After PR #392 merged, `EventDetailModal` renders Edit + Delete buttons only when the caller passes `onEdit` / `onDelete` and the event's `accessRole` is writable. Three surfaces were wired:

- `SimpleCalendar` (month view)
- `AnalogClockView` (clock view)
- `AgendaCalendar` (legacy `/test/calendar?view=agenda`)

`AgendaList` — the production surface for day/week views when `agendaMode` is on (PR #264) — was not. Result: clicking an event in day/week agenda mode opens the modal but Edit and Delete never render, even on writable calendars. This is a user-visible regression now that PR #392 is in `main`.

## Change

`src/components/calendar/AgendaList.tsx`:

1. Import `useEventEdit` from `@/hooks/useEventEdit` and `useEventDelete` from `@/hooks/useEventDelete`.
2. Call them inside the component (sibling to the existing `useCalendar()` call).
3. Pass `onEdit={handleEdit}` and `onDelete={handleDelete}` to the `<EventDetailModal>` instance (currently lines 373–381).

Mirrors the three-line addition already in `SimpleCalendar.tsx:64-65,412-413` exactly. No new components, no helpers, no abstraction.

`src/components/calendar/__tests__/AgendaList.test.tsx`:

1. Inside the existing `describe("AgendaList", …)` block, add a new `describe("event detail modal edit/delete wiring (#451)", …)` group.
2. Test 1 (writable): default fixture (`getAccessRole: () => undefined` ⇒ writable per `canWriteToCalendar`). Click an event, assert both "Edit event" and "Delete event" buttons render in the modal.
3. Test 2 (reader, regression guard for #266): `getAccessRole: () => "reader"`. Click an event, assert the modal opens but neither button renders.
4. Test 3 (freeBusyReader): same shape as test 2 with `"freeBusyReader"`. The issue's acceptance criteria call out both read-only roles; one test per role keeps the failure messages clean if Google ever adds a new read-only role.

The test file already mounts `AgendaList` under the raw `CalendarContext.Provider` via the `makeCalendarContext` factory, so `useEventEdit` / `useEventDelete` resolve through the same fixture — no provider scaffolding needed. `toast.success` / `toast.error` calls happen only after Edit/Delete is _activated_; just rendering the buttons doesn't invoke sonner, so no `<Toaster>` is required.

## Out of scope

- E2E coverage (already tracked under #335 / #272 / #279 — the production `/calendar?view=day&agenda=1` Playwright spec is part of the broader Tasks/Calendar E2E backlog).
- Refactoring `useEventEdit` / `useEventDelete` to take parameters or share a hook (deliberately kept as drop-in handlers per #392's design).

## Acceptance criteria

- [x] `AgendaList` passes `onEdit` and `onDelete` to `EventDetailModal`.
- [x] Component test renders the modal for a writable event and asserts both buttons are present.
- [x] Component test confirms the buttons are hidden when `accessRole` is `reader` / `freeBusyReader`.
- [x] `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` clean.
