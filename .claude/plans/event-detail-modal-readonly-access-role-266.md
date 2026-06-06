# Plan — #266: hide EventDetailModal delete on read-only calendars (accessRole gating)

## Goal

When a user opens `EventDetailModal` for an event that lives on a read-only
Google calendar (`accessRole === "reader"` or `"freeBusyReader"`), the delete
button must not render. Google still enforces this server-side (403), but the
UI should surface the constraint up-front instead of letting the user discover
it via a toast.

## Acceptance criteria (from the issue)

- [x] Delete button hidden for events on read-only calendars
- [x] Existing 403 toast retained as backstop for race conditions
- [x] Component tests assert both `owner`/`writer` and `reader` cases

## Architecture

`accessRole` is part of the Google `CalendarListEntry` schema and already
declared on `gapi.client.calendar.CalendarListEntry` and on the slim
`UserCalendar` shape in `src/lib/google-calendar-mappers.ts`, but the
`/api/calendar/calendars` route strips it before returning. The provider
stores only calendar **IDs**, not roles. So the plumbing job is:

1. Have the API return `accessRole`.
2. Have the provider track `Record<calendarId, accessRole>` and expose a
   lookup helper.
3. Have the modal accept the role and gate its delete button.
4. Have the consumer components (`SimpleCalendar`, `AgendaCalendar`) thread
   the role through from the provider for the currently-open event.

The reason for putting the gating logic inside the modal (vs the consumers
just suppressing `onDelete`) is forward-compatibility — issue #265 will add
an edit (PATCH) button and we want a single chokepoint that knows the rule
"on `reader`/`freeBusyReader`, hide all mutating actions."

## Phases

### Phase 1 — API + provider plumbing

- `src/app/api/calendar/calendars/route.ts`
  - Add `accessRole?: "freeBusyReader" | "reader" | "writer" | "owner"` to
    `CalendarInfo` and pass it through from the raw `CalendarListEntry`.
  - Update `__tests__/route.test.ts`: add `accessRole` to the `CalendarInfo`
    test type and assert the field round-trips for each item.
- `src/components/providers/CalendarProvider.tsx`
  - New state `accessRoles: Record<string, "freeBusyReader" | "reader" | "writer" | "owner">`.
  - `fetchCalendarList` now reads `cal.accessRole` (when present) and
    populates the map; the function still returns IDs (callers don't need
    the wider shape).
  - Expose `getAccessRole(calendarId): role | undefined` on `ICalendarContext`.
- `src/components/providers/MockCalendarProvider.tsx`
  - Accept an optional `accessRolesByCalendarId` prop and expose
    `getAccessRole` on the mock context (default returns `undefined`,
    keeping existing tests passing).
- Provider tests (`CalendarProvider.test.tsx`) get a focused case asserting
  `getAccessRole("primary")` returns the role from the calendarList payload.

### Phase 2 — Modal gating + tests

- `src/components/calendar/EventDetailModal.tsx`
  - Add `accessRole?: AccessRole` prop.
  - Compute `const isReadOnly = accessRole === "reader" || accessRole === "freeBusyReader"`.
  - When `isReadOnly` is true, suppress the entire delete UI (the
    `DialogFooter` with the trash button **and** the confirmation
    `AlertDialog`), regardless of whether `onDelete` is provided.
- `src/components/calendar/__tests__/EventDetailModal.test.tsx`
  - New describe: `accessRole gating (#266)`.
  - Cases:
    - `owner` → delete button visible (existing behaviour preserved).
    - `writer` → delete button visible.
    - `reader` → delete button hidden.
    - `freeBusyReader` → delete button hidden.
    - undefined `accessRole` (e.g., from `MockCalendarProvider` default) →
      delete button visible (current behaviour, no regression).

### Phase 3 — Wire consumers

- `src/components/calendar/SimpleCalendar.tsx`
  - Pull `getAccessRole` from `useCalendar()`.
  - Pass `accessRole={selectedEvent ? getAccessRole(selectedEvent.calendarId) : undefined}`.
- `src/components/calendar/AgendaCalendar.tsx`
  - Same wiring as SimpleCalendar.
- `src/components/calendar/AgendaList.tsx` does **not** currently render a
  delete button (no `onDelete` is passed), so we leave it alone — but if the
  prop wiring gets touched as part of this change anyway, thread the role
  through for symmetry.
- Component-level tests on SimpleCalendar / AgendaCalendar exist that
  exercise the modal's delete flow; we don't need new ones at this layer
  because Phase 2 already locks the gating contract.

## Out of scope

- Edit (PATCH) button gating (#265 / #115). The modal will use the same
  `isReadOnly` flag once that button lands, but the button isn't built yet.
- Event-creation read-only gating (`AddEventButton` / `EventCreateDialog`):
  the user should still be able to create events on writable calendars
  while on a day where read-only events appear; #268's multi-calendar
  selector is a better place to enforce that constraint.
- A persistent "this calendar is read-only" badge inside the modal — the
  issue only asks for delete button hiding; a label is a separate UX call.
