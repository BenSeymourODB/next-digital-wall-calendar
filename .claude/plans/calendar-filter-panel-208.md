# Calendar Filter Panel Expansion (Issue #208)

Three deferred items from PR #148:

1. Persist filter selections across reloads (per-profile)
2. Per-calendar filter (calendarIds fetched but not exposed)
3. Hidden-events badge count on filter triggers

## Phase 1 — Filter persistence (per-profile)

### Storage shape

```ts
type StoredFilterState = {
  selectedColors: TEventColor[];
  selectedUserId: string; // user id or "all"
  selectedCalendarIds: string[]; // empty = no calendar filter
};
```

Stored under `calendar-filters:${activeProfileId}`, with `${activeProfileId}` falling back to `"default"` when ProfileContext is unavailable (e.g. test pages, signed-out preview).

### Plan

- Read `useProfile()` to get `activeProfile?.id` inside `CalendarProvider`.
- On mount and on profile-id change, hydrate `selectedColors` / `selectedUserId` / `selectedCalendarIds` from storage.
- `filterEventsBySelectedColors`, `setSelectedUserId`, `filterEventsBySelectedCalendars`, and `clearFilter` write to storage.
- When session goes unauthenticated, reset the in-memory filter state. Storage is left intact so the next sign-in (same profile) brings it back.

### Tests

- Component test: render `CalendarFilterPanel` with a stub provider, set filters, remount, expect filters restored.
- Profile-A and Profile-B keys do not collide.
- `clearFilter` removes persisted state.
- Logout (status: "unauthenticated") clears in-memory state.

## Phase 2 — Per-calendar filter

### Provider changes

- Replace the `string[]` from `fetchCalendarList` with the full `CalendarInfo[]` (id + summary + backgroundColor + primary). Keep a derived `calendarIds` for backward-compat (events fetch URL still expects ids).
- Add `selectedCalendarIds: string[]`, `filterEventsBySelectedCalendars(id)` (toggle), and `calendars: CalendarInfo[]` to `ICalendarContext`.
- Filter pipeline (the `useEffect` at line ~666): when `selectedCalendarIds.length > 0`, drop events whose `calendarId` is not in the set.
- `clearFilter` also resets `selectedCalendarIds`.

### UI changes

- Add a third popover trigger in `CalendarFilterPanel`: button labeled "Calendars" with a count badge when filters are active.
- Popover lists each calendar with a color swatch (using `backgroundColor`), summary, and checkbox affordance. Clicking toggles selection.
- Empty state when `calendars.length === 0`.

### Tests

- Toggling a calendar updates `selectedCalendarIds`.
- Events with non-matching `calendarId` are filtered out.
- Intersects with color + user filters (only events passing all three remain).
- `clearFilter` resets all three dimensions.

## Phase 3 — Hidden-events badge counts

### Logic

For each dimension D ∈ {color, user, calendar}, compute the hidden count as:

> Number of events that pass every dimension _except_ D's filter, but fail D's filter.

```
hiddenByColor    = events.filter(e => passesUser(e) && passesCalendar(e) && !passesColor(e)).length
hiddenByUser     = events.filter(e => passesColor(e) && passesCalendar(e) && !passesUser(e)).length
hiddenByCalendar = events.filter(e => passesColor(e) && passesUser(e) && !passesCalendar(e)).length
```

When that dimension has no active filter, the count is undefined and no chip renders.

### UI

- Reuse the existing `Badge` component used for "N selected" counts.
- Add a separate chip with text `"{n} hidden"` next to the count badge on each trigger when applicable.
- Use a muted / outline visual variant so it reads as informational, not actionable.

### Tests

- Activating a color filter that removes 3 events makes the chip on the Colors trigger read "3 hidden", and only on Colors.
- With both color and user active, the user chip counts events filtered by user but not color.
- All chips disappear after `clearFilter`.

## Out of scope / deferred

- Server-side fetch URL doesn't change; per-calendar filter is purely client-side.
- Reduced-motion handling on the new popover.
- Saved filter presets (named filter combinations).
