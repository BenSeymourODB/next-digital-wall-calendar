# Calendar UX polish — issue #214

Three small UX items deferred across recent calendar PRs. Each is independent and ships as its own phase / commit.

## Phase 1 — Scroll Day/Week time grid to ~7am on mount

**Goal.** When the user first lands on the Day or Week view, the time grid is positioned so working hours (~7am onwards) are immediately visible, without a manual scroll.

**Approach.**

- Add a shared `WORKING_HOURS_START_HOUR` constant (default `7`) — the hour to surface on mount.
- `DayCalendar` (`HOUR_HEIGHT_PX = 48`): scroll target is `7 * 48 = 336px`.
- `WeekCalendar` (`HOUR_HEIGHT_PX = 40`): scroll target is `7 * 40 = 280px`.
- Use `useLayoutEffect` on a `useRef` attached to the scroll container. `useLayoutEffect` runs synchronously after DOM mutations but before paint, so the grid never visibly flashes at 0:00.
- The effect runs only on mount — subsequent user scrolls are not overridden.
- Each grid's existing `overflow-y-auto` div is the scroll container; capture it via `ref`.

**Tests.**

- Unit test: `getInitialScrollTop(7, 48) === 336` and `(7, 40) === 280`. Pure helper.
- Component test (DayCalendar / WeekCalendar):
  - Mount the component with mocked `scrollTop` setter.
  - Assert the scroll container's `scrollTop` is set to the expected pixel value once.
- E2E (Playwright): mount Day view, assert the 7am hour label is in the visible viewport.

**Acceptance.** Day and Week views auto-scroll to 7am on mount; user scroll behaviour unaffected.

## Phase 2 — Visible match count next to AgendaCalendar search input

**Goal.** Sighted users see a live match count while filtering. The existing `aria-live` `sr-only` announcement stays for screen readers.

**Approach.**

- Render a small badge inline with the search input, only when `searchActive` (i.e. trimmed query length > 0).
- Text: `${resultCount} matches` / `1 match` / `0 matches`. Reuse the existing `resultCount` constant.
- Place it inside the input's right padding band (left of the clear button) or as a sibling beneath, depending on what looks cleanest. Defer to inline-on-the-right since the input already has right padding for the clear icon.
- Use `text-muted-foreground text-xs` to match other secondary copy in the file.
- Keep the existing `sr-only` `aria-live` region untouched.

**Tests.**

- Component test:
  - With no query: badge is not rendered (assert `queryByTestId("agenda-search-match-count")` returns `null`).
  - With query "Standup" against a fixture with 1 matching event: badge text reads `1 match`.
  - With query "no-such-event": badge text reads `0 matches`.

**Acceptance.** Visible "N matches" badge renders next to the search input while a query is active. `sr-only` aria-live region preserved.

## Phase 3 — Restrict MiniCalendarSidebar visibility to day/week

**Goal.** Sidebar visible only when the user is in Day or Week view _and_ not in agenda mode. Hidden in Month, Year, Clock, and any agenda-mode display.

**Approach.**

- `src/app/calendar/page.tsx` line 54 currently uses an exclusion list:
  ```ts
  const showSidebar = view !== "month" && view !== "clock" && view !== "year";
  ```
- Replace with an explicit allow-list and an agenda gate:
  ```ts
  const showSidebar = (view === "day" || view === "week") && !agendaMode;
  ```
- Pull `agendaMode` from `useCalendar()`.
- The `test/calendar` page is left unchanged because it explicitly renders an `AgendaCalendar` view that no longer corresponds to the production agenda-mode model. (#195 deferred reconciling this.)

**Tests.**

- Component test on `CalendarContent` (or page-level wrapper):
  - View=day, agendaMode=false → sidebar present.
  - View=week, agendaMode=false → sidebar present.
  - View=day, agendaMode=true → sidebar hidden.
  - View=month → sidebar hidden.
  - View=year → sidebar hidden.
  - View=clock → sidebar hidden.

**Acceptance.** Sidebar appears only in day/week non-agenda displays.

## Out of scope

- Reconciling `test/calendar`'s standalone agenda view with the production agenda-mode model (#195 follow-up; not part of this issue).
- Changing the `WORKING_HOURS_START_HOUR` from a constant to a user-configurable preference. Issue spec says "configurable working-hours start, defaulting to 7"; the constant is the simplest configurable surface and tests document the contract. Wiring it through `CalendarSettingsPanel` is a separate ticket if the user wants per-user configuration.
