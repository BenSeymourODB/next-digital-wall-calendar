# Technical Debt - Digital Wall Calendar

This document tracks known issues, limitations, technical debt, and improvements needed for the digital wall calendar application.

## High Priority

### ~~1. OAuth Refresh Token Issue~~ ✅ RESOLVED

> **Resolved in PR #27** - Server-side authentication with NextAuth.js now handles refresh tokens automatically. The application uses Authorization Code Flow with PKCE and stores refresh tokens in the PostgreSQL database.

### 2. Manual Testing Gap

**Issue:** Calendar feature not manually tested with real Google Calendar accounts

**Impact:** Unknown if OAuth flow, event fetching, and caching work correctly in production

**Blockers:**

- Requires Google Cloud project setup
- Requires OAuth 2.0 client credentials
- Requires API key creation
- Requires real Google Calendar accounts with events

**Test Coverage Needed:**

- [ ] Google Calendar integration end-to-end
- [ ] Browser storage persistence across sessions
- [ ] Multiple calendar accounts simultaneously
- [ ] Offline functionality (event cache)
- [ ] Auto-refresh behavior (15-minute intervals)
- [ ] OAuth token refresh flow (added in commit e69e5e6)
- [ ] Kiosk mode on target hardware (Raspberry Pi, etc.)

**Action Required:** Set up test environment and perform manual testing before production deployment

**Timeline:** Before production deployment

### 3. Error Recovery Flows

**Issue:** Some error scenarios don't have graceful recovery

**Examples:**

- Network errors during OAuth flow (partial fix in commit f8d49b1)
- IndexedDB quota exceeded
- Browser storage unavailable
- Multiple simultaneous auth attempts
- API rate limiting

**Impact:** Users may need to manually refresh or clear storage

**Improvements Needed:**

- Retry logic for network errors
- Quota management for IndexedDB
- Fallback to in-memory storage if IndexedDB unavailable
- Queue for simultaneous auth requests
- Rate limiting detection and backoff

**Timeline:** Medium priority (add as issues are discovered)

### ~~4. Google Auth Missing Refresh Token~~ ✅ RESOLVED

> **Resolved in PR #27** - Migrated from client-side implicit flow to server-side Authorization Code Flow with PKCE. NextAuth.js now handles:
>
> - Automatic refresh token storage in PostgreSQL database
> - Automatic token refresh when access tokens expire
> - Secure server-side token management
>
> The application no longer requires frequent re-authentication.

### 5. Calendar Event Colors Not Persisting After Refresh

**Issue:** When a user authenticates with Google and loads Google calendar events, events from different connected calendars initially load in their distinct colors. However, after refreshing the page or switching tabs and returning a few minutes later, all events display in only blue.

**Impact:** Users lose visual distinction between different calendars, making it harder to identify event sources at a glance.

**Action Required:** Investigate event color storage/retrieval logic and ensure calendar colors persist across page reloads.

**Possible Causes:**

- Calendar metadata not being cached properly
- Color mapping being lost during deserialization
- Race condition in event loading

**Timeline:** High priority (impacts core calendar functionality)

### 6. Agenda View Date Offset Bug

**Issue:** Events show on the correct days in SimpleCalendar month view, but the agenda view shows events offset one day prior to when they are scheduled.

**Impact:** Users see incorrect event dates in the agenda view, leading to confusion and potential missed appointments.

**Action Required:** Debug date handling in agenda view component and ensure timezone/date conversion is consistent with month view.

**Possible Causes:**

- Timezone conversion inconsistency
- UTC vs local time handling
- Date parsing during event transformation for agenda view

**Timeline:** High priority (data accuracy is critical)

## Medium Priority

### 1. All-Day Event Detection Logic (PR #23 Feedback)

**Issue:** The all-day event detection in `AgendaCalendar.tsx` uses duration-based logic (`>= 24 hours`) which is incorrect for multi-day events.

**Impact:** Events spanning multiple days are incorrectly marked as all-day events.

**Root Cause:** Google Calendar API provides an explicit all-day indicator via the `date` (vs `dateTime`) field, but the current implementation checks duration instead.

**Fix Required:**

- Check for the presence of `event.start.date` (vs `event.start.dateTime`) to determine all-day status
- Or check for exactly 24 hours rather than "24 hours or more"

**Location:** `src/components/calendar/AgendaCalendar.tsx` (lines 44-49)

**Timeline:** Next iteration

### 2. Color Mappings Race Condition (PR #23 Feedback)

**Issue:** Color mappings load asynchronously after event transformation, creating a race condition on initial mount.

**Impact:** Cached events are transformed with empty `colorMappings` on mount, causing event colors to be incorrect until the next refresh.

**Root Cause:** The `useEffect` that fetches color mappings runs after the initial render, but events are transformed immediately from cache.

**Fix Required:**

- Load `colorMappings` from localStorage synchronously before first transformation
- Or defer event transformation until `colorMappings` are loaded

**Location:** `src/components/providers/CalendarProvider.tsx` (lines 307-322)

**Timeline:** Next iteration

### 3. All-Day Event Timezone Parsing (PR #23 Feedback)

**Issue:** All-day event dates stored without timezone indicators get misinterpreted by JavaScript.

**Impact:** Events may appear on the wrong day depending on user's local timezone (dates like "2026-01-05" parse as UTC midnight, which shifts to the previous day in many local timezones).

**Root Cause:** JavaScript's `Date` constructor interprets date-only strings as UTC, not local time.

**Fix Required:**

- Parse all-day event dates explicitly with local timezone handling
- Or append 'T00:00:00' to force local time interpretation

**Location:** `src/components/providers/CalendarProvider.tsx` (lines 89-97)

**Timeline:** Next iteration

### 4. Token Storage Security

**Issue:** OAuth tokens stored in unencrypted localStorage

**Current Status:** Acceptable for home/family use (see security considerations)

**Future Improvement:**

- Move to IndexedDB with Web Crypto API encryption
- Consider httpOnly cookies (requires backend)
- Implement session timeout for inactive users

**Timeline:** Low priority (acceptable for current use case)

**Related:** See [Security Considerations](.claude/security-considerations.md)

### 5. Limited Calendar Views

**Issue:** Limited calendar views implemented

**Implemented Views:**

- ✅ Month view
- ✅ Agenda view (PR #23)

**Missing Views:**

- Week view
- Day view
- Year view

**Impact:** Users with busy schedules may find current views insufficient

**Timeline:** See [Future Enhancements](.claude/future-enhancements.md)

### 6. Hardcoded Configuration

**Issue:** Some settings are hardcoded and not configurable via UI

**Examples:**

- Auto-refresh interval (15 minutes)
- Event fetch window (6 months)
- Max events displayed per day (3 + "more")
- Cache expiration (none currently)

**Improvement:**

- Add settings panel
- Make key values configurable
- Persist settings to localStorage
- Provide sensible defaults

**Timeline:** Medium priority (near-term enhancement)

### 7. Performance Optimization Opportunities

**Issue:** Not optimized for very large event datasets

**Potential Issues:**

- Rendering hundreds of events in a month
- Large IndexedDB datasets
- Slow event filtering/search

**Improvements:**

- Virtualized rendering for long lists
- IndexedDB pagination
- Web Worker for event processing
- Memoization where appropriate (React Compiler may handle this)

**Timeline:** Low priority (wait for user feedback on performance)

### 8. Accessibility Gaps

**Known Issues:**

- No keyboard navigation for calendar grid
- Limited screen reader support for calendar events
- No focus management for modals
- Color contrast not verified for all states
- No text size adjustment controls

**Improvements Needed:**

- Implement arrow key navigation
- Add proper ARIA labels and roles
- Focus trap for modals
- WCAG 2.1 AA compliance audit
- Font scaling controls

**Timeline:** Medium priority (accessibility should not be overlooked)

## Low Priority

### 1. Code Duplication

**Issue:** Some code patterns repeated across components

**Examples:**

- Event color mapping logic
- Date formatting
- Error handling patterns
- Toast notification calls

**Improvement:**

- Extract shared utilities
- Create custom hooks for common patterns
- Centralize error handling

**Timeline:** Ongoing refactoring as code evolves

### 2. Component Testing (Partially Addressed)

**Issue:** Limited unit tests for components and utilities

**Current Test Coverage:**

- ✅ API route tests (calendar, tasks, auth endpoints)
- ✅ Auth helper function tests
- ✅ Calendar helper tests
- ❌ Calendar UI component tests
- ❌ Event transformation function tests (some covered)
- ❌ Full E2E test coverage

**Improvement:**

- Add component tests with React Testing Library
- Expand utility test coverage
- Add E2E tests for critical user flows

**Timeline:** Medium priority (expand as features stabilize)

### 3. Type Definitions

**Issue:** Some external types (gapi) are manually defined

**Current Status:** Working, but may not be complete

**Improvement:**

- Verify types against official Google Calendar API docs
- Consider using official type definitions if available
- Document any custom type extensions

**Timeline:** Low priority (current types sufficient)

### 4. ColorId Field Comment Clarity (PR #23 Feedback)

**Issue:** The `colorId` field comment in `google-calendar.ts` is unclear about why it's set to an empty string.

**Current Code:** Sets `colorId: ""` with a comment that could be clearer.

**Fix Required:**

- Clarify comment to explain "Intentionally empty: calendarList items do not include an event-level colorId"

**Location:** `src/lib/google-calendar.ts`

**Timeline:** When next editing the file

### 5. Documentation Gaps

**Known Gaps:**

- No API documentation for exported functions
- Limited inline comments in complex logic
- No architecture decision records (ADRs)
- No troubleshooting guide for common issues (partially addressed in docs)

**Improvement:**

- Add JSDoc comments
- Document complex algorithms
- Create ADRs for major decisions
- Expand troubleshooting guide based on user feedback

**Timeline:** Ongoing as code evolves

### 6. Development Experience

**Issues:**

- No Storybook for component development
- No debug mode for verbose logging
- No development tools panel
- Limited error messages in development

**Improvements:**

- Set up Storybook
- Add debug mode toggle
- Create developer tools panel (show cache, trigger refresh, clear storage)
- Enhanced error messages with stack traces in dev

**Timeline:** Low priority (nice to have)

## Technical Decisions to Revisit

### ~~1. Client-Side Only Architecture~~ ✅ MIGRATED TO FULL-STACK

> **Updated in PR #27** - The application now has a full backend server architecture:
>
> - **PostgreSQL database** via Prisma ORM
> - **NextAuth.js v5** for server-side authentication
> - **OAuth tokens** stored securely in database (not localStorage)
> - **API routes** for all Google Calendar/Tasks operations
> - **Server-side session management** with automatic token refresh
>
> This enables multi-user support, secure token storage, and future features like profile management.

### 2. IndexedDB for Event Cache

**Current Decision:** IndexedDB for offline event storage

**Trade-offs:**

- ✅ Offline support
- ✅ Large storage capacity
- ✅ Efficient queries
- ⚠️ Complexity: More complex than localStorage
- ⚠️ Browser support: Not universally supported (but good coverage)

**Revisit If:**

- Browser support issues arise
- Simpler solution identified
- Server-side caching becomes available

### 3. 15-Minute Auto-Refresh Interval

**Current Decision:** Hardcoded 15-minute interval

**Rationale:**

- Balances event freshness with API quota limits
- Acceptable for most use cases

**Revisit If:**

- Users report events are stale
- Users hit API quota limits
- Configurable interval added to UI

### ~~4. OAuth Token Storage in localStorage~~ ✅ MIGRATED

> **Updated in PR #27** - OAuth tokens are now stored securely in PostgreSQL database:
>
> - **Refresh tokens** stored encrypted in Account table
> - **Access tokens** managed by NextAuth.js JWT session
> - **HttpOnly cookies** used for session management
> - No sensitive tokens exposed to client-side JavaScript

## Monitoring & Metrics

### Application Insights Integration

**Current Status:** ✅ Logging integrated

**Tracked Events:**

- User sign-in/sign-out
- Event fetching
- Cache operations
- Errors and exceptions

**Not Yet Tracked:**

- User engagement metrics (page views, time on page)
- Feature usage (which calendars viewed most)
- Performance metrics (event fetch time, render time)
- Error rates over time

**Improvement:**

- Add custom events for feature usage
- Track performance metrics
- Set up dashboards in Application Insights
- Create alerts for error spikes

**Timeline:** Low priority (add when needed for monitoring)

## Dependencies to Watch

### Security Vulnerabilities

Monitor these dependencies for security updates:

- `next` - Web framework
- `react` / `react-dom` - UI library
- `gapi-script` - Google API client
- `date-fns` - Date utilities

**Process:**

- Run `pnpm audit` regularly
- Update dependencies with `pnpm bump-deps`
- Test thoroughly after updates
- Monitor GitHub Dependabot alerts

### Breaking Changes

Watch for breaking changes in:

- Next.js (following 16.x release cycle)
- React (React 19 is current, watch for 20.x)
- TypeScript (currently 5.x)
- Tailwind CSS (currently 4.x)

**Process:**

- Read release notes before upgrading
- Test in development environment first
- Update documentation if APIs change
- Consider version pinning for stability

## Known Limitations

### Feature Limitations

From the original PR review:

**Not Yet Implemented:**

- Week view, day view (month and agenda views available)
- Event creation/editing (read-only by design)
- Recurring event special handling
- Time zone selection
- Weather integration
- Smart reminders
- Conflict detection

**Design Decisions (Not Bugs):**

- Client-side only (no backend) - privacy-focused trade-off
- OAuth tokens in localStorage - acceptable for single-device home use
- 15-minute auto-refresh - balances freshness with API quotas
- 6-month event window - balances performance with usefulness
- Read-only calendar access - security best practice

### Browser Compatibility

**Supported:**

- Chrome/Edge (Chromium-based) - ✅ Recommended
- Firefox - ✅ Supported
- Safari - ⚠️ Not tested

**Known Issues:**

- IndexedDB support varies by browser
- OAuth popup may be blocked by popup blockers
- Kiosk mode implementation varies by browser

**Timeline:** Test and document Safari support if needed

### Platform Limitations

**Designed For:**

- Desktop/laptop browsers
- Raspberry Pi (Chrome/Firefox)
- Wall-mounted displays

**Not Designed For:**

- Mobile browsers (not optimized)
- Small screens (requires minimum width)
- Print layouts
- Email clients

**Timeline:** Mobile support is a future enhancement

## Maintenance Tasks

### Regular Maintenance

**Weekly:**

- [ ] Check for Next.js security patches
- [ ] Review GitHub Dependabot alerts
- [ ] Monitor Application Insights errors

**Monthly:**

- [ ] Run `pnpm audit` and fix vulnerabilities
- [ ] Update dependencies with `pnpm bump-deps-minor`
- [ ] Review and triage new issues/feature requests
- [ ] Update documentation if needed

**Quarterly:**

- [ ] Full dependency update with `pnpm bump-deps`
- [ ] Review technical debt list and prioritize
- [ ] Security audit using checklist
- [ ] Performance testing and optimization review

**Annually:**

- [ ] Major version updates (Next.js, React, etc.)
- [ ] Architecture review
- [ ] Documentation refresh
- [ ] Accessibility audit

## Related Documents

- [Future Enhancements](.claude/future-enhancements.md)
- [Security Considerations](.claude/security-considerations.md)
- [PR Summary](.claude/pr-summary.md)
- [Implementation Summary](../IMPLEMENTATION_SUMMARY.md)
