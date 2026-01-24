# PR Review: Calendar Event Database Specification (PR #25)

**Reviewer:** Claude Code
**Date:** 2026-01-24
**PR:** https://github.com/BenSeymourODB/next-digital-wall-calendar/pull/25
**Branch:** `claude/add-calendar-database-WFUPT`

---

## Overall Assessment: ✅ Approve with Suggestions

This is a comprehensive and well-structured feature plan that establishes the foundational calendar event database. The specification demonstrates strong alignment with the project's privacy-first architecture and provides clear implementation guidance.

---

## 🎯 Alignment with Existing Plans

### Strong Alignments

1. **Modular Sync Architecture** (`modular-sync-architecture.md`)
   - ✅ Correctly positions PostgreSQL as the source of truth
   - ✅ Events stored locally first, with optional sync as enhancement
   - ✅ Follows offline-first design principles
   - ✅ Includes `syncRecords` relation for future sync module integration

2. **Multi-Profile Family Support** (`multi-profile-family-support.md`)
   - ✅ `EventProfileAssignment` model matches the profile system design
   - ✅ Supports single, multiple, and unassigned (family-wide) events
   - ✅ Profile color coding for family view

3. **Server-Side Auth** (`server-side-auth.md`)
   - ✅ Correctly identified as a required dependency
   - ✅ Uses `userId` ownership pattern consistent with auth plan

---

## ⚠️ Issues and Recommendations

### 1. Schema Duplication with Modular Sync Architecture

**Issue:** The `modular-sync-architecture.md` already defines an `Event` model (lines 71-100) with similar structure. The new plan creates `CalendarEvent` which may cause confusion.

**Recommendation:** Either:
- Consolidate schemas and explicitly reference/extend the existing `Event` model from modular-sync-architecture.md
- Add a note explaining that `CalendarEvent` replaces/supersedes the `Event` model in modular-sync-architecture.md
- Update modular-sync-architecture.md to reference this new detailed specification

### 2. Missing EventSyncRecord Schema Definition

**Issue:** The `CalendarEvent` model references `syncRecords EventSyncRecord[]` relation, but `EventSyncRecord` is not defined in this plan. It's defined in modular-sync-architecture.md but should be explicitly referenced.

**Recommendation:** Add a note: "EventSyncRecord defined in modular-sync-architecture.md - see that plan for sync tracking schema."

### 3. Timeline Conflict with Modular Sync Architecture

**Issue:** The modular-sync-architecture.md explicitly states (line 7):
> "Implementation Timeline: This architecture will be implemented **after** Google Calendar and Tasks integration is working fully."

However, this new plan marks itself as "TOP" priority and states it enables development without Google OAuth.

**Recommendation:** Clarify the relationship:
- This plan can proceed as a **foundation** before Google sync, but...
- The **sync modules** described in modular-sync-architecture.md come later
- Add a note: "This plan implements Phase 2-3 of the Modular Sync Architecture timeline (Database Setup and Migration to Local Primary)"

### 4. IndexedDB Caching Strategy Missing

**Issue:** Per CLAUDE.md guidelines (Section 8), client-side caching should be used for performance:
> "IndexedDB: Caching API responses for offline/fast access... sync every 5 minutes"

The plan doesn't address client-side caching for events.

**Recommendation:** Add a section on client-side caching strategy:
- IndexedDB cache for events (similar to existing patterns)
- Cache invalidation on mutations
- Sync interval configuration

### 5. Integration with Analog Clock Calendar Plan

**Issue:** The `analog-clock-calendar.md` plan isn't referenced, though this plan explicitly mentions clock integration.

**Recommendation:** Add cross-reference to `analog-clock-calendar.md` in the "Integration with Other Features" section, noting how events will display as arcs on the clock face.

---

## 📋 Technical Debt Considerations

This plan helps address several items from `technical-debt.md`:

| Technical Debt Item | Impact |
|---------------------|--------|
| #2 Manual Testing Gap | ✅ Enables testing without Google OAuth setup |
| #4 Google Auth Missing Refresh Token | ⚠️ Doesn't resolve but reduces dependency |
| #5 Calendar Event Colors Not Persisting | ✅ Local storage resolves this |
| #6 Agenda View Date Offset Bug | ✅ Local control over timezone handling |

**Note:** The high-priority Google Auth refresh token issue (#4) remains unresolved. This plan reduces its urgency for development but doesn't eliminate the need to fix it for production sync.

---

## 🔧 Minor Suggestions

1. **Add cacheLife considerations** - For Next.js 16, consider adding cache tags for events to enable targeted revalidation.

2. **Emoji validation** - The emoji parsing logic is good but consider validating emoji are from a supported subset for consistent clock face rendering.

3. **Timezone handling** - Consider using the `Intl` API's `Temporal` proposal (or a polyfill) for more robust timezone handling as it stabilizes.

4. **Soft delete retention** - Specify a retention period for soft-deleted events (e.g., 30 days before permanent cleanup).

5. **Rate limiting** - The security section mentions rate limiting; consider specifying concrete limits (e.g., 100 events/hour per user).

---

## ✅ Summary

This is an excellent, comprehensive plan that:
- Establishes a solid foundation for the privacy-first calendar
- Enables local development without external dependencies
- Integrates well with the profile system
- Includes thorough testing strategy

**Recommended actions before merge:**
1. Add cross-reference notes to modular-sync-architecture.md relationship
2. Clarify EventSyncRecord schema dependency
3. Add IndexedDB caching strategy section
4. Consider updating modular-sync-architecture.md timeline notes for consistency

The plan is ready to merge with minor documentation clarifications. Great work on the comprehensive specification!
