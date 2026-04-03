# Draft Follow-Up Issues: Wire UI Components to Database / Google Calendar Data

These follow-up issues track the work needed to connect UI-only components
(built with mock/static data) to real backend data sources (Google Calendar API,
local PostgreSQL database via Prisma, CalendarProvider context).

---

## Issue 1: Wire week and day views to CalendarProvider with time-range queries

**References:** #70

### Description

Once the week and day view UI components are built (#70), they need to be wired
to real calendar data. This includes:

- **Hourly event positioning**: Query events for a specific day/week range and
  map `startDate`/`endDate` to vertical time slots (e.g., 30-min or 15-min grid)
- **CalendarProvider integration**: Extend `loadEventsForDate()` to efficiently
  load narrow time ranges for day/week views without re-fetching the full month
- **Multi-day event spanning**: Handle events that span multiple days in week
  view (rendered as horizontal bars across day columns)
- **Current time indicator**: Wire a live "now" line to the current time
- **View-specific refresh**: Ensure `refreshEvents()` respects the active view's
  date range to avoid over-fetching

### Acceptance Criteria

- [ ] Day view displays events from CalendarProvider positioned in correct time slots
- [ ] Week view displays events across 7 day columns with correct time positioning
- [ ] Multi-day events render as spanning bars in week view
- [ ] Navigating between days/weeks triggers appropriate data loading
- [ ] Events respect color and user filters from CalendarProvider

### Dependencies

- #70 (UI implementation)
- CalendarProvider time-range loading logic

---

## Issue 2: Wire mini-calendar sidebar to CalendarProvider for event indicators and navigation

**References:** #80

### Description

Once the mini-calendar sidebar UI is built (#80), it needs to be wired to real
calendar data for two purposes:

- **Event dot indicators**: Query CalendarProvider for which days in the visible
  month have events, and render colored dots beneath those dates
- **Two-way date navigation**: Clicking a date in the mini-calendar should update
  `selectedDate` in CalendarProvider, which in turn updates the main calendar
  view (day/week). Conversely, navigating in the main view should highlight the
  corresponding date in the mini-calendar.
- **Event list panel**: The sidebar's "today's events" list needs to consume
  filtered events from CalendarProvider for the selected date

### Acceptance Criteria

- [ ] Days with events show colored dot indicators in mini-calendar
- [ ] Clicking a date updates the main calendar view via CalendarProvider
- [ ] Main view navigation updates the mini-calendar's highlighted date
- [ ] Today's events list shows real event data from CalendarProvider
- [ ] Dot colors reflect event colors from Google Calendar color mappings

### Dependencies

- #80 (UI implementation)
- CalendarProvider `events` and `selectedDate` context

---

## Issue 3: Wire event detail modal to Google Calendar API and local database for edit/delete

**References:** #81

### Description

Once the event detail modal UI is built (#81), the edit and delete functionality
needs to be connected to real data persistence:

- **Read path**: Display event details from CalendarProvider's `IEvent` data
  (already available via context)
- **Edit path (Google Calendar events)**: Call Google Calendar API
  `events.patch()` or `events.update()` via a new server-side API route
  (`PATCH /api/calendar/events/[id]`) to persist title, time, description, and
  color changes
- **Edit path (local events)**: Update the local PostgreSQL database via Prisma
  when the calendar-event-database feature is implemented
- **Delete path (Google Calendar)**: Call Google Calendar API `events.delete()`
  via a new server-side API route (`DELETE /api/calendar/events/[id]`)
- **Delete path (local events)**: Delete from local database via Prisma
- **Optimistic updates**: Update CalendarProvider state immediately, then
  reconcile with API response
- **Error handling**: Roll back optimistic updates on API failure, show user
  error toast

### Acceptance Criteria

- [ ] Editing a Google Calendar event persists changes via server-side API route
- [ ] Deleting a Google Calendar event removes it via server-side API route
- [ ] CalendarProvider state updates optimistically on edit/delete
- [ ] Failed API calls trigger rollback and user-visible error message
- [ ] Google Calendar events enforce read-only vs editable based on calendar permissions
- [ ] IndexedDB cache is invalidated/updated after mutations

### Dependencies

- #81 (UI implementation)
- Google Calendar API write access (OAuth scope: `calendar.events`)
- Server-side API routes for event mutation
- Calendar event database plan (for local events, future)

---

## Issue 4: Wire event creation dialog to Google Calendar API and local event database

**References:** #82

### Description

Once the event creation dialog UI is built (#82), the "Create event" action
needs to persist new events to real data stores:

- **Google Calendar write path**: Call Google Calendar API `events.insert()` via
  a new server-side API route (`POST /api/calendar/events`) with title, start/end
  times, description, and colorId
- **Local database write path**: Insert into local PostgreSQL database via Prisma
  when the calendar-event-database feature is implemented
- **Calendar selection**: If the user has multiple Google Calendars, allow
  selecting which calendar to create the event in (use existing
  `/api/calendar/calendars` endpoint for the list)
- **Optimistic creation**: Add event to CalendarProvider state immediately, then
  reconcile with API response (which provides the real event ID)
- **Validation**: Server-side validation of required fields, date range logic
  (end > start), and sanitization

### Acceptance Criteria

- [ ] Creating an event persists to Google Calendar via server-side API route
- [ ] New event appears in CalendarProvider state immediately (optimistic)
- [ ] User can select target calendar from available Google Calendars
- [ ] Server-side validation rejects invalid event data with clear error messages
- [ ] IndexedDB cache is updated with the new event
- [ ] Created event includes proper color mapping from Google Calendar colors API

### Dependencies

- #82 (UI implementation)
- Google Calendar API write access (OAuth scope: `calendar.events`)
- Server-side API route: `POST /api/calendar/events`
- Calendar event database plan (for local events, future)

---

## Issue 5: Wire year view to CalendarProvider with full-year event loading

**References:** #83

### Description

Once the year view UI is built (#83), it needs to load and display event data
across a full 12-month range:

- **Extended data range**: The current CalendarProvider loads events from -1 month
  to +6 months. Year view needs events for the full calendar year (Jan 1 - Dec 31),
  which may require extending `loadEventsForDate()` or adding a dedicated
  year-range fetch
- **Event dot aggregation**: For each day cell in the 12 month grids, determine
  if events exist and what colors to show as dot indicators. This needs efficient
  client-side grouping of potentially hundreds of events
- **Performance**: Year view may display 365 day cells each checking for events.
  Ensure the event-to-day mapping is computed efficiently (e.g., a pre-built
  `Map<dateString, IEvent[]>`)
- **Click-through navigation**: Clicking a day in year view should set
  `selectedDate` and switch to day or month view via CalendarProvider

### Acceptance Criteria

- [ ] Year view loads events for the full Jan-Dec range
- [ ] Colored dots appear on days that have events
- [ ] Dot colors reflect actual event colors
- [ ] Performance is acceptable with 250+ events across the year
- [ ] Clicking a day navigates to that date in day/month view
- [ ] Year navigation (prev/next) triggers appropriate data loading

### Dependencies

- #83 (UI implementation)
- CalendarProvider extended date-range loading
- Performance optimization for large event datasets (#72)

---

## Issue 6: Wire drag-and-drop rescheduling to Google Calendar API and local database

**References:** #84

### Description

Once the drag-and-drop UI is built (#84), dropping an event on a new date/time
needs to persist the rescheduled event:

- **Google Calendar update path**: Call Google Calendar API `events.patch()` via
  server-side API route to update `start` and `end` fields, preserving the
  original event duration
- **Local database update path**: Update event dates in local PostgreSQL database
  via Prisma when the calendar-event-database feature is implemented
- **Duration preservation**: When dragging to a new date (month view), maintain
  the original start/end time-of-day. When resizing in day/week view, update
  the end time
- **Optimistic update**: Move event in CalendarProvider state during drag,
  confirm on API success, roll back on failure
- **Permission check**: Only allow drag-and-drop for events the user has write
  access to (check Google Calendar ACL). Show visual indicator for read-only events
- **Undo support**: Consider a brief "Undo" toast after drop to revert accidental
  moves before API call completes

### Acceptance Criteria

- [ ] Dropping an event on a new date persists via Google Calendar API
- [ ] Event duration is preserved when moving between dates
- [ ] Read-only events (from shared calendars) cannot be dragged
- [ ] Optimistic update moves event immediately in UI
- [ ] Failed API calls roll back the event to its original position
- [ ] IndexedDB cache is updated after successful reschedule

### Dependencies

- #84 (UI implementation)
- #81 wiring (shares the same `PATCH /api/calendar/events/[id]` API route)
- Google Calendar API write access (OAuth scope: `calendar.events`)
- Calendar event database plan (for local events, future)
