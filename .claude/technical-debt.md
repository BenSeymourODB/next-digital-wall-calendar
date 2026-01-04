# Technical Debt - Digital Wall Calendar

This document tracks known issues, limitations, technical debt, and improvements needed for the digital wall calendar application.

## High Priority

### 1. Next.js Security Vulnerability

**Issue:** CVE-2025-66478 in Next.js 16.0.1

**Impact:** Security vulnerability affecting entire application

**Action Required:** Upgrade to patched Next.js version when available

**Timeline:** As soon as patch is released

**Dependencies:** None

**Related:** See [Security Considerations](.claude/security-considerations.md)

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

## Medium Priority

### 1. Token Storage Security

**Issue:** OAuth tokens stored in unencrypted localStorage

**Current Status:** Acceptable for home/family use (see security considerations)

**Future Improvement:**

- Move to IndexedDB with Web Crypto API encryption
- Consider httpOnly cookies (requires backend)
- Implement session timeout for inactive users

**Timeline:** Low priority (acceptable for current use case)

**Related:** See [Security Considerations](.claude/security-considerations.md)

### 2. Limited Calendar Views

**Issue:** Only month view implemented

**Missing Views:**

- Week view
- Day view
- Agenda view
- Year view

**Impact:** Users with busy schedules may find month view insufficient

**Timeline:** See [Future Enhancements](.claude/future-enhancements.md)

### 3. Hardcoded Configuration

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

### 4. Performance Optimization Opportunities

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

### 5. Accessibility Gaps

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

### 2. Component Testing

**Issue:** No unit tests for components or utilities

**Missing Coverage:**

- Calendar rendering logic
- Event transformation functions
- Storage utilities
- OAuth flow handling
- Date calculation helpers

**Improvement:**

- Add Jest + React Testing Library
- Write unit tests for utilities
- Write component tests
- Add integration tests

**Timeline:** Low priority (add when code stabilizes)

### 3. Type Definitions

**Issue:** Some external types (gapi) are manually defined

**Current Status:** Working, but may not be complete

**Improvement:**

- Verify types against official Google Calendar API docs
- Consider using official type definitions if available
- Document any custom type extensions

**Timeline:** Low priority (current types sufficient)

### 4. Documentation Gaps

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

### 5. Development Experience

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

### 1. Client-Side Only Architecture

**Current Decision:** Client-side only for privacy and simplicity

**Trade-offs:**

- ✅ Privacy: No data sent to servers
- ✅ Simplicity: Easy deployment
- ✅ Cost: No server costs
- ⚠️ Features: Limited to client-side capabilities
- ⚠️ Security: Tokens stored in browser

**Revisit If:**

- Users request server-side features (webhooks, push notifications)
- Security requirements change
- Multi-user/enterprise use cases emerge

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

### 4. OAuth Token Storage in localStorage

**Current Decision:** Store tokens in browser localStorage

**Rationale:**

- Simple implementation
- Browser-encrypted at rest
- Acceptable for home/family use

**Revisit If:**

- Security requirements change
- Multi-device sync needed
- Server-side session management added

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

- `next` - Web framework (CVE-2025-66478 pending patch)
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

- Week view, day view, agenda view (only month view)
- Event creation/editing (read-only by design)
- Recurring event special handling
- Time zone selection
- Custom color schemes (only ODBM palette)
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
