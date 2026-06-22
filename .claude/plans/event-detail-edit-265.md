# Plan: Event Detail Edit (PATCH) — #265

Completes the edit half of #115. The delete half landed via #197; this issue adds the PATCH path and the edit form on `EventDetailModal`.

## Scope

- `PATCH /api/calendar/events/[id]?calendarId=...` — forwards to Google Calendar `events.patch`, mirroring the auth / error shape established by the sibling DELETE handler.
- `CalendarProvider.editEvent(eventId, calendarId, input)` — server-bound, optimistic local update + rollback on failure. Sits alongside `createEvent` / `deleteEvent` (the existing context-level `updateEvent` is a pure local setter and stays untouched).
- `EventDetailModal` gains an "Edit" trigger that swaps the read-only view for a form mirroring `EventCreateDialog` (title, all-day, start/end, color, description). Save calls `onEdit` (a new optional prop, gated by `accessRole` exactly like delete). Cancel restores the read-only view.
- `/calendar` page provides the `onEdit` handler that calls `editEvent` and surfaces a toast on failure (mirroring the existing delete handler).

## Out of scope

- Attendees / reminders / recurrence — tracked in #212 / #213.
- Calendar-id move (PATCH only changes the same-calendar event; relocating between calendars is a separate move flow).
- Local Postgres write path — Google is the source of truth until the database lands.

## Wire format

`PATCH /api/calendar/events/[id]?calendarId=<id>`

Body mirrors the POST validator's `CreateEventBody` minus `calendarId` (carried in the query string for symmetry with DELETE):

```ts
interface PatchEventBody {
  title: string;
  startDate: string; // YYYY-MM-DD for all-day; ISO datetime for timed
  endDate: string;
  color: TEventColor;
  description?: string;
  isAllDay?: boolean;
}
```

The PATCH validator shares the same parser as POST (extracted into a helper) so behaviour is symmetric and the unit tests don't need to assert the same shape twice. The `start.date` / `end.date` vs `start.dateTime` / `end.dateTime` switching, the exclusive-end `addOneDay`, and the Tailwind→Google colorId mapping all reuse the existing helpers verbatim.

On success: 200 with `{ event: GoogleCalendarEvent }`, normalised through `normalizeFetchedEvent`. Error shape (401/403/404/502/500) matches DELETE.

## Phases

### Phase 1 — server (TDD red → green)

1. `src/app/api/calendar/events/[id]/__tests__/route.test.ts` — add a `describe("PATCH …")` block covering: 401 / refresh-token / missing-calendarId / missing-id / 200 happy path (timed + all-day) / 400 invalid body / 403 / 404 / 502 / 500. Run, watch them fail (no PATCH export).
2. Extract the create-event validator out of `events/route.ts` into a `validateEventBody` helper shared between POST and PATCH. The signature stays pure (`(body: unknown) => ValidationResult`) — no behavioural change for POST.
3. Implement `PATCH` in `events/[id]/route.ts` using the shared validator + `buildGoogleInsertBody` (renamed `buildGoogleEventBody`). Forward to `events.patch` instead of `events.insert`. All tests go green.

### Phase 2 — provider + modal (TDD red → green)

1. `src/components/providers/__tests__/CalendarProvider.test.tsx` — add `describe("editEvent")` for: happy path replaces the local row with the reconciled response, 502 throws and restores the original row, network error throws and restores the original row.
2. Add `editEvent` to `ICalendarContext` and the provider impl alongside `createEvent` / `deleteEvent`. Test fixture (`src/test/fixtures/calendar-context.ts`) gains the new field.
3. `src/components/calendar/__tests__/EventDetailModal.test.tsx` — add tests for: an "Edit" button rendering only when `onEdit` is supplied and the calendar is writable, opening the form, editing the title and saving calls `onEdit(event, patch)`, cancel restores the read-only view without firing `onEdit`, error from `onEdit` keeps the form open.
4. Implement the edit form in `EventDetailModal` (factor the form fields into a `EventEditForm` subcomponent if it stays under ~150 lines; otherwise inline). Reuse `parseDateOnly` / `parseDateTimeLocal` / `toDateTimeLocal` / `toDateOnly` helpers from `EventCreateDialog` by extracting them into `src/lib/calendar/date-input.ts` so both consumers share one source of truth.

### Phase 3 — wire-up + manual smoke

1. `src/app/calendar/page.tsx` — pass an `onEdit` handler down to the modal that calls `editEvent` and surfaces a toast on failure (mirroring `handleDelete`).
2. Run `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types` — must all be green.

## Risk

- **Validator extraction can regress POST.** Mitigated by leaving the POST tests untouched and running them after each step.
- **All-day positive/negative-offset edits.** The `startDate` / `endDate` wire format is the same as POST (YYYY-MM-DD for all-day, ISO datetime for timed), so the same `transformGoogleEvent` round-trip applies and there is no new tz code to write.
- **`updateEvent` local setter is exposed but unused.** Don't refactor it as part of this slice — that's a separate cleanup.

## Acceptance criteria mapping

| Acceptance                     | Where                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Editing event PATCHes Google   | Phase 1, route impl                                                                     |
| Optimistic update + rollback   | Phase 2, provider                                                                       |
| All-day +/- offset correctness | Phase 1 — shared validator (the existing POST tests already cover this; PATCH inherits) |
| Unit + component happy/403/5xx | Phases 1 + 2                                                                            |
| Closes #115                    | PR body                                                                                 |
