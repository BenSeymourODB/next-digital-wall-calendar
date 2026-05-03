# Plan — feat(calendar): add `IEvent.category` field and group-by-category agenda mode (#211)

## Goal

Surface a per-event `category` (a free-form string carried on Google Calendar's `extendedProperties`) on `IEvent`, then expose a third group-by mode in `AgendaCalendar` so users can browse upcoming events by category. Events without a category fall under an "Uncategorised" bucket.

## Phases

### Phase 1 — Data model + mapper

Files:

- `src/types/calendar.ts` — extend `IEvent` with `category?: string`.
- `src/lib/calendar-transform.ts` — read `extendedProperties.shared.category` (preferred) or `extendedProperties.private.category` (fallback). Trim; treat empty/whitespace-only as absent.
- `src/lib/__tests__/calendar-transform.test.ts` — new "Category mapping" describe block covering:
  - shared.category present → mapped
  - private.category present (no shared) → mapped
  - both present → shared wins
  - extendedProperties absent → `category` absent on IEvent
  - whitespace-only category → absent
  - empty extendedProperties.shared / .private → absent

Tests must fail first, then implement the minimum to pass.

### Phase 2 — Provider union widening + AgendaCalendar UI

Files:

- `src/components/providers/CalendarProvider.tsx` — widen `agendaModeGroupBy` union and `setAgendaModeGroupBy` arg type from `"date" | "color"` to `"date" | "color" | "category"`. Same widening on `CalendarSettings.agendaModeGroupBy`.
- `src/components/providers/MockCalendarProvider.tsx` — mirror widening so test fixtures compile.
- `src/components/providers/__tests__/CalendarProvider.test.tsx` — verify the new value persists round-trip.
- `src/components/calendar/AgendaCalendar.tsx`:
  - Add `groupEventsByCategory(events: IEvent[]): Map<string, IEvent[]>` helper. Buckets by category; events without a category land under literal `"Uncategorised"`.
  - Build sorted entries: alphabetical (case-insensitive, locale-aware), `"Uncategorised"` last.
  - Add a third toggle button: "Group by category".
  - Render category groups using existing `AgendaGroup` component for visual parity.
- `src/components/calendar/__tests__/AgendaCalendar.test.tsx` — extend the "Group by" describe block:
  - alphabetical category headers
  - "Uncategorised" bucket appears last when present
  - count badges per category
  - search filter applied within categories
  - clicking the new toggle calls `setAgendaModeGroupBy("category")`

### Phase 3 — Sweep + final

- `grep` the repo for any other consumer of the union (settings UI, persisted-storage migration, type re-exports). Widen as needed.
- Run `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test`.
- Verify the existing E2E specs (`agenda-toggle.spec.ts`, `week-day-views.spec.ts`) still pass — no functional change for date/color paths.

## Out of scope

- Editing an event's category in-app (write path lives behind PR #199 / #115 and would belong to a follow-up).
- Persisting category-based filters; group-by is a transient UI mode.
- E2E coverage for category mode (component tests are sufficient for the scope; E2E sweep deferred to QA).

## Risks

- Google API does **not** expose a first-class "category" field for calendar events — we are conventionalising `extendedProperties.shared.category`. Documented in code comments. Events created elsewhere (Google Calendar UI, third-party clients) won't carry a category until the user migrates them via API; this is acceptable for an MVP self-hosted family hub.
- Settings stored in localStorage with the previous `"date" | "color"` literal will continue to validate against the widened union (TypeScript-only widening; no runtime decoder).
