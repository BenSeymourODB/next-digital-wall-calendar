# Calendar Event Database (Local-First)

## Priority: TOP (Foundational)

> **This is a foundational feature.** A local calendar event database is required for UI development, testing, and privacy-first operation. This must be implemented before other calendar-dependent features can be fully developed and tested.

## Overview

Implement a PostgreSQL-backed calendar event database that stores events independently of Google Calendar. This provides the foundation for all calendar functionality, enabling UI development and testing without external dependencies, and serving as the source of truth for the privacy-first architecture.

## Related Plans

This plan is part of a larger architecture. See these related documents:

| Plan | Relationship |
|------|-------------|
| [modular-sync-architecture.md](./modular-sync-architecture.md) | **Depends on this plan.** Sync modules sync TO/FROM this database. The `EventSyncRecord` model referenced here is defined in that plan. |
| [analog-clock-calendar.md](./analog-clock-calendar.md) | **Depends on this plan.** The analog clock component consumes events from this database via the `useClockEvents` hook. |
| [server-side-auth.md](./server-side-auth.md) | **This plan depends on.** User authentication is required for event ownership. |
| [multi-profile-family-support.md](./multi-profile-family-support.md) | **This plan depends on.** Profile system is required for event assignments. |

## Schema Relationship with Modular Sync Architecture

This plan defines `CalendarEvent` which is the **concrete implementation** of the `Event` model conceptually described in `modular-sync-architecture.md`. Key differences:

| Field | This Plan (`CalendarEvent`) | modular-sync-architecture.md (`Event`) | Rationale |
|-------|------------------------------|----------------------------------------|-----------|
| Owner field | `userId` | `profileId` | We use `userId` (account owner) + `EventProfileAssignment` junction table for multi-profile assignment. This is more flexible than single `profileId`. |
| Emoji support | `emoji` field | Not specified | Added for analog clock visual integration |
| Soft delete | `isDeleted`, `deletedAt` | Not specified | Explicit soft delete for recovery |
| Sync records | References `EventSyncRecord` | Defines `EventSyncRecord` | Sync tracking is defined in modular-sync-architecture.md |

**When implementing:** Use the schema from THIS plan for the actual Prisma migration. The `EventSyncRecord` model should be added from `modular-sync-architecture.md` when implementing sync features.

## Implementation Timeline Clarification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Phase 1: THIS PLAN (Calendar Event Database)                                │
│ ─────────────────────────────────────────────                               │
│ • PostgreSQL database with CalendarEvent model                              │
│ • Full CRUD API routes                                                      │
│ • React hooks for data access                                               │
│ • IndexedDB caching for offline/performance                                 │
│ • Enables UI development and testing                                        │
│                                                                             │
│ ↓ (Prerequisite for)                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│ Phase 2: Modular Sync Architecture                                          │
│ ─────────────────────────────────────                                       │
│ • EventSyncRecord model for tracking                                        │
│ • Google Calendar sync module                                               │
│ • Optional two-way sync                                                     │
│ • Conflict resolution                                                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

The `modular-sync-architecture.md` states it will be implemented "after Google Calendar and Tasks integration is working fully." This plan provides the **database foundation** that sync will build upon. There is no conflict—this is the prerequisite layer.

## Why This Feature is Top Priority

1. **Enables UI Testing**: Calendar components (analog clock per [analog-clock-calendar.md](./analog-clock-calendar.md), agenda view, etc.) cannot be properly tested without a reliable data source
2. **Privacy-First Foundation**: Establishes local database as the source of truth per the modular sync architecture
3. **Offline Capability**: Full calendar functionality without internet connection
4. **Profile Integration**: Events can be assigned to family members immediately
5. **Development Velocity**: No need to configure Google OAuth during development

## Requirements

### Core Features

#### 1. Event Types
- **All-Day Events**: Events without specific times (e.g., "Birthday", "Holiday")
- **Timed Events**: Events with specific start and end times (e.g., "Meeting 2pm-3pm")
- **Multi-Day Events**: Events spanning multiple days (e.g., "Vacation" from Mon-Fri)
- **Multi-Day All-Day Events**: All-day events spanning multiple days
- **Recurring Events**: Events that repeat on a schedule (Phase 2)

#### 2. Event Properties
- **Title**: Required, event name/summary
- **Description**: Optional, detailed event notes
- **Location**: Optional, physical or virtual location
- **Color**: Visual identification color
- **Emoji Prefix**: Optional emoji for visual identification on clock face
- **Reminders**: Optional reminder times before event
- **Attachments**: Optional file attachments (Phase 2)

#### 3. Profile Assignment
- **Single Profile**: Assign event to one family member
- **Multiple Profiles**: Assign event to multiple family members
- **Unassigned**: Family-wide events visible to all
- **Profile Color Coding**: Events display profile colors in family view

#### 4. Time Zone Support
- **Event Timezone**: Store event's original timezone (IANA format, e.g., "America/New_York")
- **Display Timezone**: Convert to user's local timezone for display
- **All-Day Handling**: All-day events don't shift with timezone (stored as "floating" dates)
- **Future-Proofing**: Consider `Temporal` API (Stage 3) when stable for more robust timezone handling

#### 5. CRUD Operations
- **Create**: Create new events with all properties
- **Read**: Fetch events by date range, profile, or search
- **Update**: Modify existing events
- **Delete**: Soft delete (recoverable) and hard delete

### Visual Design

#### Event Display (Agenda View)
```
┌─────────────────────────────────────────────────────────────┐
│  Monday, January 27, 2025                                   │
├─────────────────────────────────────────────────────────────┤
│  All Day                                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🎂 Mom's Birthday                      👤 Everyone     │ │
│  │ 🏖️ Family Vacation (Day 2 of 5)        👤 Everyone     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  9:00 AM                                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🔴 📞 Client Call                      👤 Ben          │ │
│  │     9:00 AM - 10:30 AM                                 │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  2:00 PM                                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🔵 🎮 Game Night                       👤 Ben, Evelyn  │ │
│  │     2:00 PM - 4:00 PM                                  │ │
│  │     Living Room                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  6:30 PM                                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🟢 🍕 Pizza Night                      👤 Everyone     │ │
│  │     6:30 PM - 7:30 PM                                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

#### Create/Edit Event Modal
```
┌─────────────────────────────────────────────────────────────┐
│  Create Event                                    [×]         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Title *                                                     │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Team Meeting                                           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ☐ All day                                                   │
│                                                              │
│  Start                          End                          │
│  ┌────────────────────────┐    ┌────────────────────────┐   │
│  │ Jan 27, 2025  2:00 PM  │    │ Jan 27, 2025  3:00 PM  │   │
│  └────────────────────────┘    └────────────────────────┘   │
│                                                              │
│  Location                                                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Conference Room A                                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Description                                                 │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Weekly sync meeting                                    │ │
│  │                                                        │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  Color          Emoji                                        │
│  [🔴 Red ▼]     [📅 ▼]                                       │
│                                                              │
│  Assign to                                                   │
│  ☑ Ben  ☐ Evelyn  ☐ Liv  ☐ Sean Mark  ☐ Titus              │
│                                                              │
│  Reminders                                                   │
│  [+ Add reminder]                                            │
│  • 30 minutes before  [×]                                    │
│                                                              │
│                                                              │
│  [Cancel]                                    [Create Event]  │
└─────────────────────────────────────────────────────────────┘
```

#### Multi-Day Event Indicator
```
┌───────────────────────────────────────────────────────────────────────────┐
│         Mon         Tue         Wed         Thu         Fri              │
├───────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────────────┐│
│  │ 🏖️ Family Vacation ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│ │
│  │    (5 days)                                                          │ │
│  └──────────────────────────────────────────────────────────────────────┘│
│                                                                           │
│  9 AM  │ 📞 Call │         │         │         │ 📞 Call │              │
│        └─────────┘                             └─────────┘              │
└───────────────────────────────────────────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Database Schema

```prisma
// Add to schema.prisma

model CalendarEvent {
  id              String    @id @default(cuid())
  userId          String    // Account owner

  // Core fields
  title           String
  description     String?   @db.Text
  location        String?

  // Time fields
  startTime       DateTime
  endTime         DateTime
  allDay          Boolean   @default(false)
  timezone        String    @default("UTC")

  // Display fields
  color           String    @default("#3B82F6") // blue-500
  emoji           String?   // Optional emoji prefix (e.g., "🎂")

  // Recurrence (Phase 2)
  recurrenceRule  String?   // RRULE format (e.g., "FREQ=WEEKLY;BYDAY=MO,WE,FR")
  recurrenceId    String?   // For recurring event instances
  parentEventId   String?   // Links to parent recurring event

  // Reminders stored as JSON array
  reminders       Json?     // [{ minutes: 30, method: "popup" }]

  // Metadata
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdBy       String    // Profile ID that created the event
  lastModifiedBy  String    // Profile ID that last modified
  isDeleted       Boolean   @default(false)
  deletedAt       DateTime?

  // Relations
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  parentEvent     CalendarEvent?  @relation("RecurringEvents", fields: [parentEventId], references: [id])
  childEvents     CalendarEvent[] @relation("RecurringEvents")
  assignments     EventProfileAssignment[]
  syncRecords     EventSyncRecord[]

  @@index([userId, startTime, endTime])
  @@index([userId, isDeleted])
  @@index([startTime])
  @@index([endTime])
}

model EventProfileAssignment {
  id        String   @id @default(cuid())
  eventId   String
  profileId String

  // Response status (for shared events)
  status    String   @default("accepted") // "accepted", "declined", "tentative", "pending"

  createdAt DateTime @default(now())

  event     CalendarEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)
  profile   Profile       @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([eventId, profileId])
  @@index([profileId, eventId])
}

// Update Profile model to include events relation
model Profile {
  // ... existing fields ...
  eventAssignments EventProfileAssignment[]
}
```

### 2. Component Structure

```
src/components/calendar/
├── events/
│   ├── event-form.tsx              # Create/edit event form
│   ├── event-modal.tsx             # Modal wrapper for event form
│   ├── event-card.tsx              # Event display card
│   ├── event-list.tsx              # List of events
│   ├── event-details.tsx           # Full event details view
│   └── event-context.tsx           # React context for event state
├── views/
│   ├── day-view.tsx                # Single day view
│   ├── week-view.tsx               # Week view (future)
│   ├── month-view.tsx              # Month view (future)
│   └── agenda-view.tsx             # Agenda list view
├── hooks/
│   ├── use-events.ts               # Hook for fetching/managing events
│   ├── use-event-mutations.ts      # Hook for CRUD operations
│   └── use-event-filters.ts        # Hook for filtering events
└── types.ts                        # TypeScript types

src/app/api/events/
├── route.ts                        # GET (list), POST (create)
├── [id]/
│   ├── route.ts                    # GET, PATCH, DELETE single event
│   └── assign/
│       └── route.ts                # POST assign profiles to event
└── search/
    └── route.ts                    # GET search events

src/lib/calendar/
├── event-utils.ts                  # Event utility functions
├── date-utils.ts                   # Date manipulation utilities
├── recurrence.ts                   # Recurrence rule parsing (Phase 2)
└── timezone.ts                     # Timezone handling (see Timezone Utilities below)
```

### 3. Data Models (TypeScript)

```typescript
// src/components/calendar/types.ts

export interface CalendarEvent {
  id: string;
  userId: string;

  // Core fields
  title: string;
  description?: string;
  location?: string;

  // Time fields
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  timezone: string;

  // Display fields
  color: string;
  emoji?: string;

  // Recurrence (Phase 2)
  recurrenceRule?: string;
  recurrenceId?: string;
  parentEventId?: string;

  // Reminders
  reminders?: EventReminder[];

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
  isDeleted: boolean;
  deletedAt?: Date;

  // Relations (when included)
  assignments?: EventProfileAssignment[];
  parentEvent?: CalendarEvent;
  childEvents?: CalendarEvent[];
}

export interface EventReminder {
  minutes: number;        // Minutes before event
  method: 'popup' | 'email' | 'push';
}

export interface EventProfileAssignment {
  id: string;
  eventId: string;
  profileId: string;
  status: 'accepted' | 'declined' | 'tentative' | 'pending';
  createdAt: Date;
  profile?: Profile;      // When included
}

export interface CreateEventInput {
  title: string;
  description?: string;
  location?: string;
  startTime: Date;
  endTime: Date;
  allDay?: boolean;
  timezone?: string;
  color?: string;
  emoji?: string;
  reminders?: EventReminder[];
  profileIds?: string[];  // Profiles to assign
}

export interface UpdateEventInput extends Partial<CreateEventInput> {
  isDeleted?: boolean;
}

export interface EventFilters {
  startDate?: Date;
  endDate?: Date;
  profileIds?: string[];
  allDay?: boolean;
  includeDeleted?: boolean;
  search?: string;
}

export interface EventsResponse {
  events: CalendarEvent[];
  total: number;
  hasMore: boolean;
}

// Helper types for display
export interface EventWithProfiles extends CalendarEvent {
  assignedProfiles: Profile[];
  isMultiDay: boolean;
  dayIndex?: number;      // For multi-day: which day (1, 2, 3...)
  totalDays?: number;     // For multi-day: total days
}

export type EventDisplayMode = 'compact' | 'full' | 'minimal';
```

### 4. Event Utilities

```typescript
// src/lib/calendar/event-utils.ts

import { CalendarEvent, EventWithProfiles } from '@/components/calendar/types';

/**
 * Check if an event is an all-day event
 */
export function isAllDayEvent(event: CalendarEvent): boolean {
  return event.allDay;
}

/**
 * Check if an event spans multiple days
 */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  // Set to start of day for comparison
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  return endDay.getTime() > startDay.getTime();
}

/**
 * Get the number of days an event spans
 */
export function getEventDayCount(event: CalendarEvent): number {
  const startDate = new Date(event.startTime);
  const endDate = new Date(event.endTime);

  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const endDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  const diffTime = endDay.getTime() - startDay.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return Math.max(1, diffDays + 1);
}

/**
 * Check if an event falls within a date range
 */
export function eventInRange(
  event: CalendarEvent,
  rangeStart: Date,
  rangeEnd: Date
): boolean {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);

  return eventStart < rangeEnd && eventEnd > rangeStart;
}

/**
 * Check if an event falls on a specific date
 */
export function eventOnDate(event: CalendarEvent, date: Date): boolean {
  const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dateEnd = new Date(dateStart);
  dateEnd.setDate(dateEnd.getDate() + 1);

  return eventInRange(event, dateStart, dateEnd);
}

/**
 * Parse color emoji from event title
 */
export function parseEventTitle(title: string): {
  colorEmoji?: string;
  eventEmoji?: string;
  cleanTitle: string;
} {
  const colorEmojiRegex = /^(🔴|🟠|🟡|🟢|🔵|🟣|⚫|⚪|🟤)\s*/;
  const emojiRegex = /^(\p{Emoji})\s*/u;

  let cleanTitle = title;
  let colorEmoji: string | undefined;
  let eventEmoji: string | undefined;

  // Extract color emoji if present
  const colorMatch = cleanTitle.match(colorEmojiRegex);
  if (colorMatch) {
    colorEmoji = colorMatch[1];
    cleanTitle = cleanTitle.replace(colorEmojiRegex, '');
  }

  // Extract event emoji if present (after color emoji)
  const emojiMatch = cleanTitle.match(emojiRegex);
  if (emojiMatch && emojiMatch[1] !== colorEmoji) {
    eventEmoji = emojiMatch[1];
    cleanTitle = cleanTitle.replace(emojiRegex, '');
  }

  return {
    colorEmoji,
    eventEmoji,
    cleanTitle: cleanTitle.trim(),
  };
}

/**
 * Supported color emojis for event categorization
 * This is the canonical list - used for validation and UI pickers
 */
export const SUPPORTED_COLOR_EMOJIS = [
  '🔴', // red
  '🟠', // orange
  '🟡', // yellow
  '🟢', // green
  '🔵', // blue
  '🟣', // purple
  '⚫', // black
  '⚪', // white
  '🟤', // brown
] as const;

export type ColorEmoji = typeof SUPPORTED_COLOR_EMOJIS[number];

/**
 * Get hex color from color emoji
 */
export function colorEmojiToHex(emoji?: string): string | undefined {
  const colorMap: Record<ColorEmoji, string> = {
    '🔴': '#EF4444', // red-500
    '🟠': '#F97316', // orange-500
    '🟡': '#EAB308', // yellow-500
    '🟢': '#22C55E', // green-500
    '🔵': '#3B82F6', // blue-500
    '🟣': '#A855F7', // purple-500
    '⚫': '#1F2937', // gray-800
    '⚪': '#F3F4F6', // gray-100
    '🟤': '#92400E', // amber-800
  };

  return emoji && isColorEmoji(emoji) ? colorMap[emoji] : undefined;
}

/**
 * Validate if a string is a supported color emoji
 */
export function isColorEmoji(emoji: string): emoji is ColorEmoji {
  return SUPPORTED_COLOR_EMOJIS.includes(emoji as ColorEmoji);
}

/**
 * Validate emoji for event display
 * Returns true if emoji is safe for display (single grapheme, not ZWJ sequence with skin tone)
 */
export function isValidEventEmoji(emoji: string): boolean {
  // Use Intl.Segmenter for proper grapheme counting
  const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
  const segments = [...segmenter.segment(emoji)];

  // Must be exactly one grapheme
  if (segments.length !== 1) return false;

  // Reject if it contains variation selectors or skin tone modifiers
  // that might cause rendering issues
  const codePoints = [...emoji].map(c => c.codePointAt(0) || 0);
  const hasProblematicModifiers = codePoints.some(
    cp => (cp >= 0x1F3FB && cp <= 0x1F3FF) // Skin tone modifiers
  );

  return !hasProblematicModifiers;
}

/**
 * Sort events for display
 */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((a, b) => {
    // All-day events first
    if (a.allDay && !b.allDay) return -1;
    if (!a.allDay && b.allDay) return 1;

    // Then by start time
    const startDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    if (startDiff !== 0) return startDiff;

    // Then by duration (longer events first for better display)
    const aDuration = new Date(a.endTime).getTime() - new Date(a.startTime).getTime();
    const bDuration = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();

    return bDuration - aDuration;
  });
}

/**
 * Group events by date for agenda view
 */
export function groupEventsByDate(
  events: CalendarEvent[]
): Map<string, CalendarEvent[]> {
  const groups = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const startDate = new Date(event.startTime);
    const endDate = new Date(event.endTime);
    const dayCount = getEventDayCount(event);

    // Add event to each day it spans
    for (let i = 0; i < dayCount; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);

      const dateKey = currentDate.toISOString().split('T')[0];

      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }

      groups.get(dateKey)!.push(event);
    }
  }

  // Sort events within each day
  for (const [date, dayEvents] of groups) {
    groups.set(date, sortEvents(dayEvents));
  }

  return groups;
}
```

### 5. Timezone Utilities

Timezone handling uses `Intl.DateTimeFormat` for current browser support, with a path to `Temporal` API when it stabilizes.

```typescript
// src/lib/calendar/timezone.ts

/**
 * Get the user's local timezone (IANA format)
 */
export function getLocalTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Convert a date from one timezone to another
 * Uses Intl.DateTimeFormat for current browser support
 *
 * Note: When Temporal API (currently Stage 3) becomes stable,
 * replace with Temporal.ZonedDateTime for more robust handling:
 *
 * ```typescript
 * // Future Temporal API usage:
 * const zdt = Temporal.ZonedDateTime.from({
 *   timeZone: fromTimezone,
 *   year, month, day, hour, minute, second
 * });
 * return zdt.withTimeZone(toTimezone);
 * ```
 */
export function convertTimezone(
  date: Date,
  fromTimezone: string,
  toTimezone: string
): Date {
  // Get the date parts in the target timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: toTimezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const getPart = (type: string) =>
    parts.find(p => p.type === type)?.value || '0';

  return new Date(
    parseInt(getPart('year')),
    parseInt(getPart('month')) - 1,
    parseInt(getPart('day')),
    parseInt(getPart('hour')),
    parseInt(getPart('minute')),
    parseInt(getPart('second'))
  );
}

/**
 * Format a date for display in a specific timezone
 */
export function formatInTimezone(
  date: Date,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {}
): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    ...options,
  }).format(date);
}

/**
 * Check if a timezone string is valid IANA timezone
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * For all-day events, treat dates as "floating" (no timezone conversion)
 * This ensures "January 15th" stays January 15th regardless of timezone
 */
export function getFloatingDate(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth(),
    day: date.getUTCDate(),
  };
}
```

### 6. API Routes

```typescript
// src/app/api/events/route.ts
import { requireAuth, getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const profileIds = searchParams.get('profileIds')?.split(',');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

    // Build query
    const where: any = {
      userId: user.id,
      isDeleted: includeDeleted ? undefined : false,
    };

    // Date range filter
    if (startDate || endDate) {
      where.AND = [];

      if (startDate) {
        where.AND.push({
          endTime: { gte: new Date(startDate) }
        });
      }

      if (endDate) {
        where.AND.push({
          startTime: { lte: new Date(endDate) }
        });
      }
    }

    // Profile filter
    if (profileIds && profileIds.length > 0) {
      where.assignments = {
        some: {
          profileId: { in: profileIds }
        }
      };
    }

    const events = await prisma.calendarEvent.findMany({
      where,
      include: {
        assignments: {
          include: {
            profile: true
          }
        }
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    logger.log('Events fetched', {
      userId: user.id,
      count: events.length,
      dateRange: { startDate, endDate }
    });

    return NextResponse.json({
      events,
      total: events.length,
      hasMore: false
    });

  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/events',
      method: 'GET'
    });

    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const body = await request.json();
    const {
      title,
      description,
      location,
      startTime,
      endTime,
      allDay,
      timezone,
      color,
      emoji,
      reminders,
      profileIds
    } = body;

    // Validation
    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Title, start time, and end time are required' },
        { status: 400 }
      );
    }

    if (new Date(endTime) < new Date(startTime)) {
      return NextResponse.json(
        { error: 'End time must be after start time' },
        { status: 400 }
      );
    }

    // Get active profile for createdBy
    const activeProfile = await prisma.profile.findFirst({
      where: {
        userId: user.id,
        isActive: true
      }
    });

    const createdBy = activeProfile?.id || user.id;

    // Create event with assignments
    const event = await prisma.calendarEvent.create({
      data: {
        userId: user.id,
        title,
        description,
        location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        allDay: allDay ?? false,
        timezone: timezone ?? 'UTC',
        color: color ?? '#3B82F6',
        emoji,
        reminders: reminders ?? [],
        createdBy,
        lastModifiedBy: createdBy,
        assignments: profileIds && profileIds.length > 0 ? {
          create: profileIds.map((profileId: string) => ({
            profileId,
            status: 'accepted'
          }))
        } : undefined
      },
      include: {
        assignments: {
          include: {
            profile: true
          }
        }
      }
    });

    logger.event('EventCreated', {
      userId: user.id,
      eventId: event.id,
      title: event.title,
      allDay: event.allDay,
      profileCount: profileIds?.length ?? 0
    });

    return NextResponse.json(event, { status: 201 });

  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/events',
      method: 'POST'
    });

    return NextResponse.json(
      { error: 'Failed to create event' },
      { status: 500 }
    );
  }
}

// src/app/api/events/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    const { id } = await params;

    const event = await prisma.calendarEvent.findFirst({
      where: {
        id,
        userId: user.id
      },
      include: {
        assignments: {
          include: {
            profile: true
          }
        },
        parentEvent: true,
        childEvents: true
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(event);

  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/events/[id]',
      method: 'GET'
    });

    return NextResponse.json(
      { error: 'Failed to fetch event' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    const { id } = await params;

    // Verify ownership
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      title,
      description,
      location,
      startTime,
      endTime,
      allDay,
      timezone,
      color,
      emoji,
      reminders,
      profileIds,
      isDeleted
    } = body;

    // Get active profile for lastModifiedBy
    const activeProfile = await prisma.profile.findFirst({
      where: {
        userId: user.id,
        isActive: true
      }
    });

    const lastModifiedBy = activeProfile?.id || user.id;

    // Update event
    const event = await prisma.$transaction(async (tx) => {
      // Update profile assignments if provided
      if (profileIds !== undefined) {
        // Remove existing assignments
        await tx.eventProfileAssignment.deleteMany({
          where: { eventId: id }
        });

        // Add new assignments
        if (profileIds.length > 0) {
          await tx.eventProfileAssignment.createMany({
            data: profileIds.map((profileId: string) => ({
              eventId: id,
              profileId,
              status: 'accepted'
            }))
          });
        }
      }

      // Update event
      return await tx.calendarEvent.update({
        where: { id },
        data: {
          ...(title !== undefined && { title }),
          ...(description !== undefined && { description }),
          ...(location !== undefined && { location }),
          ...(startTime !== undefined && { startTime: new Date(startTime) }),
          ...(endTime !== undefined && { endTime: new Date(endTime) }),
          ...(allDay !== undefined && { allDay }),
          ...(timezone !== undefined && { timezone }),
          ...(color !== undefined && { color }),
          ...(emoji !== undefined && { emoji }),
          ...(reminders !== undefined && { reminders }),
          ...(isDeleted !== undefined && {
            isDeleted,
            deletedAt: isDeleted ? new Date() : null
          }),
          lastModifiedBy
        },
        include: {
          assignments: {
            include: {
              profile: true
            }
          }
        }
      });
    });

    logger.event('EventUpdated', {
      userId: user.id,
      eventId: event.id,
      updatedFields: Object.keys(body)
    });

    return NextResponse.json(event);

  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/events/[id]',
      method: 'PATCH'
    });

    return NextResponse.json(
      { error: 'Failed to update event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    const { id } = await params;

    const { searchParams } = new URL(request.url);
    const permanent = searchParams.get('permanent') === 'true';

    // Verify ownership
    const existingEvent = await prisma.calendarEvent.findFirst({
      where: {
        id,
        userId: user.id
      }
    });

    if (!existingEvent) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    if (permanent) {
      // Hard delete
      await prisma.calendarEvent.delete({
        where: { id }
      });

      logger.event('EventDeleted', {
        userId: user.id,
        eventId: id,
        permanent: true
      });
    } else {
      // Soft delete
      await prisma.calendarEvent.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date()
        }
      });

      logger.event('EventDeleted', {
        userId: user.id,
        eventId: id,
        permanent: false
      });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/events/[id]',
      method: 'DELETE'
    });

    return NextResponse.json(
      { error: 'Failed to delete event' },
      { status: 500 }
    );
  }
}
```

### 6. Event Hook

```typescript
// src/components/calendar/hooks/use-events.ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { CalendarEvent, EventFilters, EventsResponse } from '../types';
import { logger } from '@/lib/logger';

interface UseEventsOptions {
  filters?: EventFilters;
  refreshInterval?: number; // ms, default: 0 (no auto-refresh)
}

export function useEvents(options: UseEventsOptions = {}) {
  const { filters, refreshInterval = 0 } = options;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (filters?.startDate) {
        params.set('startDate', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        params.set('endDate', filters.endDate.toISOString());
      }
      if (filters?.profileIds && filters.profileIds.length > 0) {
        params.set('profileIds', filters.profileIds.join(','));
      }
      if (filters?.includeDeleted) {
        params.set('includeDeleted', 'true');
      }

      const response = await fetch(`/api/events?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }

      const data: EventsResponse = await response.json();
      setEvents(data.events);

    } catch (err) {
      setError(err as Error);
      logger.error(err as Error, {
        context: 'useEvents.fetchEvents'
      });
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchEvents, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchEvents]);

  return {
    events,
    loading,
    error,
    refresh: fetchEvents
  };
}
```

### 7. Event Mutations Hook

```typescript
// src/components/calendar/hooks/use-event-mutations.ts
'use client';

import { useState, useCallback } from 'react';
import {
  CalendarEvent,
  CreateEventInput,
  UpdateEventInput
} from '../types';
import { logger } from '@/lib/logger';

export function useEventMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createEvent = useCallback(async (
    input: CreateEventInput
  ): Promise<CalendarEvent | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create event');
      }

      const event = await response.json();

      logger.event('EventCreated_Client', {
        eventId: event.id,
        title: event.title
      });

      return event;

    } catch (err) {
      setError(err as Error);
      logger.error(err as Error, {
        context: 'useEventMutations.createEvent'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateEvent = useCallback(async (
    eventId: string,
    input: UpdateEventInput
  ): Promise<CalendarEvent | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update event');
      }

      const event = await response.json();

      logger.event('EventUpdated_Client', {
        eventId: event.id,
        updatedFields: Object.keys(input)
      });

      return event;

    } catch (err) {
      setError(err as Error);
      logger.error(err as Error, {
        context: 'useEventMutations.updateEvent'
      });
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteEvent = useCallback(async (
    eventId: string,
    permanent = false
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const params = permanent ? '?permanent=true' : '';
      const response = await fetch(`/api/events/${eventId}${params}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete event');
      }

      logger.event('EventDeleted_Client', {
        eventId,
        permanent
      });

      return true;

    } catch (err) {
      setError(err as Error);
      logger.error(err as Error, {
        context: 'useEventMutations.deleteEvent'
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    createEvent,
    updateEvent,
    deleteEvent,
    loading,
    error
  };
}
```

### 8. Client-Side Caching Strategy (IndexedDB)

Per CLAUDE.md guidelines, the backend server is the source of truth, but IndexedDB is used for offline performance and fast access.

```typescript
// src/lib/cache/event-cache.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { CalendarEvent } from '@/components/calendar/types';

interface EventCacheDB extends DBSchema {
  events: {
    key: string;
    value: CachedEvent;
    indexes: {
      'by-date': string;
      'by-profile': string;
      'by-updated': number;
    };
  };
  metadata: {
    key: string;
    value: CacheMetadata;
  };
}

interface CachedEvent extends CalendarEvent {
  _cachedAt: number;
  _cacheVersion: number;
}

interface CacheMetadata {
  lastSyncAt: number;
  version: number;
}

const CACHE_VERSION = 1;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const CACHE_DB_NAME = 'calendar-events-cache';

class EventCache {
  private db: IDBPDatabase<EventCacheDB> | null = null;

  async init(): Promise<void> {
    this.db = await openDB<EventCacheDB>(CACHE_DB_NAME, CACHE_VERSION, {
      upgrade(db) {
        // Events store
        const eventStore = db.createObjectStore('events', { keyPath: 'id' });
        eventStore.createIndex('by-date', 'startTime');
        eventStore.createIndex('by-profile', 'assignments');
        eventStore.createIndex('by-updated', '_cachedAt');

        // Metadata store
        db.createObjectStore('metadata', { keyPath: 'key' });
      },
    });
  }

  /**
   * Get events from cache, returns null if stale or missing
   */
  async getEvents(
    startDate: Date,
    endDate: Date
  ): Promise<CalendarEvent[] | null> {
    if (!this.db) await this.init();

    const metadata = await this.db!.get('metadata', 'events');
    if (!metadata || Date.now() - metadata.lastSyncAt > CACHE_TTL_MS) {
      return null; // Cache miss or stale
    }

    // Query by date range using index
    const events = await this.db!.getAllFromIndex(
      'events',
      'by-date',
      IDBKeyRange.bound(
        startDate.toISOString(),
        endDate.toISOString()
      )
    );

    return events;
  }

  /**
   * Store events in cache
   */
  async setEvents(events: CalendarEvent[]): Promise<void> {
    if (!this.db) await this.init();

    const tx = this.db!.transaction(['events', 'metadata'], 'readwrite');
    const eventStore = tx.objectStore('events');
    const metaStore = tx.objectStore('metadata');

    // Store each event with cache metadata
    for (const event of events) {
      await eventStore.put({
        ...event,
        _cachedAt: Date.now(),
        _cacheVersion: CACHE_VERSION,
      });
    }

    // Update sync timestamp
    await metaStore.put({
      key: 'events',
      lastSyncAt: Date.now(),
      version: CACHE_VERSION,
    });

    await tx.done;
  }

  /**
   * Invalidate cache (after mutations)
   */
  async invalidate(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('metadata', 'events');
  }

  /**
   * Clear all cached data (on logout)
   */
  async clear(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.clear('events');
    await this.db!.clear('metadata');
  }
}

export const eventCache = new EventCache();
```

**Cache Usage in useEvents Hook:**

```typescript
// Updated useEvents hook with caching
export function useEvents(options: UseEventsOptions = {}) {
  const { filters, refreshInterval = 0 } = options;

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try cache first for instant response
      if (filters?.startDate && filters?.endDate) {
        const cached = await eventCache.getEvents(
          filters.startDate,
          filters.endDate
        );

        if (cached) {
          setEvents(cached);
          setFromCache(true);
          setLoading(false);
          // Continue to fetch fresh data in background
        }
      }

      // Fetch from server (source of truth)
      const params = new URLSearchParams();
      // ... build params ...

      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch events');

      const data: EventsResponse = await response.json();
      setEvents(data.events);
      setFromCache(false);

      // Update cache
      await eventCache.setEvents(data.events);

    } catch (err) {
      // If we have cached data, use it despite error
      if (fromCache && events.length > 0) {
        logger.log('Using cached events due to fetch error', LogLevel.Warn);
        return;
      }
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // ... rest of hook
}
```

**Cache Invalidation Strategy:**

| Action | Cache Behavior |
|--------|---------------|
| Create event | Invalidate cache, refetch |
| Update event | Invalidate cache, refetch |
| Delete event | Invalidate cache, refetch |
| Logout | Clear all cached data |
| Tab focus | Check TTL, refetch if stale |
| Background sync | Update cache silently |

### 9. Next.js Cache Tags and Revalidation

Use Next.js cache tags for server-side caching and on-demand revalidation:

```typescript
// src/app/api/events/route.ts
import { revalidateTag, unstable_cache } from 'next/cache';

// Cache event queries with tags
const getCachedEvents = unstable_cache(
  async (userId: string, startDate: string, endDate: string) => {
    return prisma.calendarEvent.findMany({
      where: {
        userId,
        isDeleted: false,
        endTime: { gte: new Date(startDate) },
        startTime: { lte: new Date(endDate) },
      },
      include: {
        assignments: { include: { profile: true } }
      },
      orderBy: { startTime: 'asc' }
    });
  },
  ['events'],
  {
    tags: ['events'],
    revalidate: 60, // Revalidate every 60 seconds
  }
);

// In mutation handlers, invalidate cache:
export async function POST(request: NextRequest) {
  // ... create event ...

  // Invalidate cache for this user's events
  revalidateTag('events');
  revalidateTag(`events:${user.id}`);

  return NextResponse.json(event, { status: 201 });
}
```

**Cache Tag Strategy:**

| Tag | Scope | Invalidated By |
|-----|-------|----------------|
| `events` | All events | Any event mutation |
| `events:${userId}` | User's events | User's event mutations |
| `events:${profileId}` | Profile's events | Profile assignment changes |
| `events:date:${YYYY-MM}` | Month's events | Events in that month |

### 10. Integration with Analog Clock Component

The analog clock component (see [analog-clock-calendar.md](./analog-clock-calendar.md)) can fetch events from the local database:

```typescript
// src/components/calendar/use-calendar-events.ts
'use client';

import { useEvents } from './hooks/use-events';
import { eventInRange } from '@/lib/calendar/event-utils';

/**
 * Hook for fetching events for the analog clock display
 * Returns events for the current 12-hour period
 */
export function useClockEvents() {
  const now = new Date();
  const isAM = now.getHours() < 12;

  // Calculate 12-hour period
  const periodStart = new Date(now);
  periodStart.setHours(isAM ? 0 : 12, 0, 0, 0);

  const periodEnd = new Date(periodStart);
  periodEnd.setHours(periodStart.getHours() + 12);

  const { events, loading, error, refresh } = useEvents({
    filters: {
      startDate: periodStart,
      endDate: periodEnd
    },
    refreshInterval: 5 * 60 * 1000 // 5 minutes
  });

  // Filter events that actually fall within the display period
  const displayEvents = events.filter(event =>
    eventInRange(event, periodStart, periodEnd)
  );

  return {
    events: displayEvents,
    loading,
    error,
    refresh,
    periodStart,
    periodEnd,
    isAM
  };
}
```

## Implementation Steps

### Phase 1: Database Foundation

1. **Update Prisma schema**
   - Add CalendarEvent model
   - Add EventProfileAssignment model
   - Update Profile model with events relation
   - Run migration: `pnpm prisma migrate dev --name add_calendar_events`

2. **Create event utility functions**
   - Date/time utilities
   - Event filtering and sorting
   - Multi-day event handling
   - Emoji parsing

3. **Create type definitions**
   - TypeScript interfaces for all event types
   - Input/output types for API
   - Filter and response types

### Phase 2: API Layer

4. **Create API routes**
   - GET /api/events (list with filters)
   - POST /api/events (create)
   - GET /api/events/[id] (get single)
   - PATCH /api/events/[id] (update)
   - DELETE /api/events/[id] (soft/hard delete)

5. **Add API validation**
   - Input validation for all endpoints
   - Date range validation
   - Required field checks

6. **Write API tests**
   - Unit tests for each endpoint
   - Integration tests with database
   - Edge case handling

### Phase 3: React Hooks

7. **Create useEvents hook**
   - Fetch events with filters
   - Auto-refresh support
   - Error handling

8. **Create useEventMutations hook**
   - Create, update, delete operations
   - Optimistic updates (optional)
   - Error handling

9. **Create useClockEvents hook**
   - 12-hour period filtering
   - Integration with analog clock

### Phase 4: UI Components

10. **Create EventCard component**
    - Display single event
    - Color and emoji support
    - Profile avatars

11. **Create EventForm component**
    - Create/edit form
    - Date/time pickers
    - Profile assignment
    - Validation

12. **Create EventModal component**
    - Modal wrapper for form
    - Create and edit modes

13. **Create EventList component**
    - List of events
    - Grouping by date
    - All-day section

### Phase 5: Integration

14. **Integrate with analog clock**
    - Replace mock data with real events
    - Arc rendering from database events
    - Real-time updates

15. **Integrate with profile system**
    - Profile assignment UI
    - Profile filtering
    - Family view

16. **Add event seeding for development**
    - Create seed script with sample events
    - Different event types (all-day, timed, multi-day)
    - Multiple profile assignments

### Phase 6: Polish

17. **Add loading states**
    - Skeleton loaders
    - Optimistic updates
    - Error boundaries

18. **Add accessibility**
    - ARIA labels
    - Keyboard navigation
    - Screen reader support

19. **Performance optimization**
    - Query optimization
    - Index verification
    - Caching strategy

## Testing Strategy

### Unit Tests

```typescript
// Tests for event utilities
describe('event-utils', () => {
  describe('isMultiDayEvent', () => {
    it('should return false for single-day timed event', () => {
      const event = createEvent({
        startTime: new Date('2025-01-27T09:00:00'),
        endTime: new Date('2025-01-27T10:00:00'),
      });
      expect(isMultiDayEvent(event)).toBe(false);
    });

    it('should return true for event spanning two days', () => {
      const event = createEvent({
        startTime: new Date('2025-01-27T20:00:00'),
        endTime: new Date('2025-01-28T02:00:00'),
      });
      expect(isMultiDayEvent(event)).toBe(true);
    });

    it('should return true for multi-day all-day event', () => {
      const event = createEvent({
        startTime: new Date('2025-01-27T00:00:00'),
        endTime: new Date('2025-01-31T23:59:59'),
        allDay: true,
      });
      expect(isMultiDayEvent(event)).toBe(true);
    });
  });

  describe('getEventDayCount', () => {
    it('should return 1 for single-day event', () => {
      const event = createEvent({
        startTime: new Date('2025-01-27T09:00:00'),
        endTime: new Date('2025-01-27T17:00:00'),
      });
      expect(getEventDayCount(event)).toBe(1);
    });

    it('should return 5 for 5-day vacation', () => {
      const event = createEvent({
        startTime: new Date('2025-01-27T00:00:00'),
        endTime: new Date('2025-01-31T23:59:59'),
        allDay: true,
      });
      expect(getEventDayCount(event)).toBe(5);
    });
  });

  describe('parseEventTitle', () => {
    it('should extract color emoji', () => {
      const result = parseEventTitle('🔴 Important Meeting');
      expect(result.colorEmoji).toBe('🔴');
      expect(result.cleanTitle).toBe('Important Meeting');
    });

    it('should extract event emoji after color', () => {
      const result = parseEventTitle('🟢 🎮 Game Night');
      expect(result.colorEmoji).toBe('🟢');
      expect(result.eventEmoji).toBe('🎮');
      expect(result.cleanTitle).toBe('Game Night');
    });

    it('should extract event emoji without color', () => {
      const result = parseEventTitle('🏋️ Gym Session');
      expect(result.colorEmoji).toBeUndefined();
      expect(result.eventEmoji).toBe('🏋️');
      expect(result.cleanTitle).toBe('Gym Session');
    });
  });
});
```

### Integration Tests

```typescript
// Tests for API routes
describe('/api/events', () => {
  describe('POST', () => {
    it('should create a new event', async () => {
      const input = {
        title: 'Team Meeting',
        startTime: '2025-01-27T14:00:00Z',
        endTime: '2025-01-27T15:00:00Z',
        profileIds: ['profile-1']
      };

      const response = await POST(createRequest(input));
      expect(response.status).toBe(201);

      const event = await response.json();
      expect(event.title).toBe('Team Meeting');
      expect(event.assignments).toHaveLength(1);
    });

    it('should reject event with end before start', async () => {
      const input = {
        title: 'Invalid Event',
        startTime: '2025-01-27T15:00:00Z',
        endTime: '2025-01-27T14:00:00Z',
      };

      const response = await POST(createRequest(input));
      expect(response.status).toBe(400);
    });
  });

  describe('GET', () => {
    it('should filter events by date range', async () => {
      // Create events for different dates
      await createTestEvent({ startTime: '2025-01-25' });
      await createTestEvent({ startTime: '2025-01-27' });
      await createTestEvent({ startTime: '2025-01-29' });

      const response = await GET(createRequest({
        searchParams: {
          startDate: '2025-01-26',
          endDate: '2025-01-28'
        }
      }));

      const data = await response.json();
      expect(data.events).toHaveLength(1);
    });

    it('should filter events by profile', async () => {
      await createTestEvent({ profileIds: ['profile-1'] });
      await createTestEvent({ profileIds: ['profile-2'] });

      const response = await GET(createRequest({
        searchParams: {
          profileIds: 'profile-1'
        }
      }));

      const data = await response.json();
      expect(data.events).toHaveLength(1);
    });
  });
});
```

### E2E Tests

```typescript
// E2E tests for event management
test('user can create and view an all-day event', async ({ page }) => {
  await page.goto('/calendar');

  // Click add event button
  await page.click('[data-testid="add-event-button"]');

  // Fill event form
  await page.fill('[data-testid="event-title"]', 'Family Vacation');
  await page.check('[data-testid="all-day-checkbox"]');
  await page.click('[data-testid="start-date-picker"]');
  await page.click('text=27'); // Select day 27
  await page.click('[data-testid="end-date-picker"]');
  await page.click('text=31'); // Select day 31

  // Assign to all profiles
  await page.check('[data-testid="assign-all"]');

  // Submit
  await page.click('[data-testid="create-event-button"]');

  // Verify event appears
  await expect(page.locator('[data-testid="event-card"]')).toContainText('Family Vacation');
  await expect(page.locator('[data-testid="event-card"]')).toContainText('5 days');
});

test('user can create timed event with profile assignment', async ({ page }) => {
  await page.goto('/calendar');

  await page.click('[data-testid="add-event-button"]');

  await page.fill('[data-testid="event-title"]', 'Team Meeting');
  await page.selectOption('[data-testid="start-time"]', '14:00');
  await page.selectOption('[data-testid="end-time"]', '15:00');
  await page.click('[data-testid="profile-select-ben"]');

  await page.click('[data-testid="create-event-button"]');

  await expect(page.locator('[data-testid="event-card"]')).toContainText('Team Meeting');
  await expect(page.locator('[data-testid="event-card"]')).toContainText('2:00 PM');
});
```

## Challenges and Considerations

### Challenge 1: Multi-Day Event Display
- **Problem**: Multi-day events need to appear on each day they span
- **Solution**: Group events by date, include event on each day with day index indicator

### Challenge 2: Timezone Handling
- **Problem**: All-day events should not shift with timezone
- **Solution**: Store timezone with event, treat all-day events as "floating" dates

### Challenge 3: Recurring Events
- **Problem**: Complex recurrence rules, exception handling
- **Solution**: Phase 2 feature - use RRULE format, generate instances on-demand

### Challenge 4: Profile Assignment Permissions
- **Problem**: Who can assign events to whom?
- **Solution**: Admin profiles can assign to anyone, standard profiles can only assign to self

### Challenge 5: Event Overlap Display
- **Problem**: Multiple events at same time need visual distinction
- **Solution**: Stack events, use color coding, show count indicator

## Performance Considerations

- Database indexes on userId, startTime, endTime
- Paginate results for large date ranges
- Cache frequently accessed date ranges
- Use database transactions for profile assignments
- Consider denormalization for read-heavy operations

## Security Considerations

### Data Ownership
- Validate `userId` ownership on all operations
- Sanitize event titles and descriptions (prevent XSS via DOMPurify)
- Escape special characters in database queries

### Rate Limiting

| Endpoint | Limit | Window | Rationale |
|----------|-------|--------|-----------|
| `POST /api/events` | 60 requests | 1 minute | Prevent spam event creation |
| `PATCH /api/events/[id]` | 120 requests | 1 minute | Allow rapid edits |
| `DELETE /api/events/[id]` | 30 requests | 1 minute | Prevent mass deletion |
| `GET /api/events` | 300 requests | 1 minute | Higher for reads |

Implementation using `@upstash/ratelimit` or similar:

```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: true,
});

// In API route:
const { success, limit, remaining } = await ratelimit.limit(
  `events:${user.id}:create`
);

if (!success) {
  return NextResponse.json(
    { error: 'Rate limit exceeded. Try again later.' },
    { status: 429, headers: { 'X-RateLimit-Remaining': remaining.toString() } }
  );
}
```

### Soft Delete Retention Policy

| Stage | Duration | Action |
|-------|----------|--------|
| Soft deleted | 0-30 days | Event hidden but recoverable via `?includeDeleted=true` |
| Retention period | 30 days | User can restore event from "Trash" UI |
| Permanent deletion | After 30 days | Scheduled job permanently deletes (`isDeleted=true` AND `deletedAt < 30 days ago`) |

**Cleanup Job (run daily):**

```typescript
// src/lib/jobs/cleanup-deleted-events.ts
const RETENTION_DAYS = 30;

export async function cleanupDeletedEvents() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

  const result = await prisma.calendarEvent.deleteMany({
    where: {
      isDeleted: true,
      deletedAt: { lt: cutoffDate }
    }
  });

  logger.event('DeletedEventsCleanup', {
    deletedCount: result.count,
    cutoffDate: cutoffDate.toISOString()
  });
}
```

### Audit Logging
- Log all create, update, delete operations
- Include `userId`, `profileId`, `eventId`, timestamp
- Store audit logs separately for compliance

## Dependencies

- Prisma (database ORM) - already planned
- date-fns (date manipulation) - optional, can use native Date
- No additional packages required

## Integration with Other Features

**Required Dependencies:**
- Server-Side Auth (for user identification)
- Multi-Profile System (for profile assignments)

**Features That Depend on This:**
- Analog Clock Calendar Component (display events)
- Agenda View (list events)
- Google Calendar Sync Module (optional sync)
- Event Reminders (notifications)
- Calendar Sharing (future)

## Future Enhancements

### Phase 2
- **Recurring Events**: RRULE support for repeating events
- **Event Templates**: Quick-create from templates
- **Bulk Operations**: Create/edit multiple events
- **Attachments**: File attachments on events
- **Event Import**: Import from ICS files

### Phase 3
- **Calendar Sharing**: Share calendars between users
- **Event Comments**: Add comments to events
- **Event History**: Track event modifications
- **Smart Suggestions**: AI-powered event suggestions
- **Conflict Detection**: Warn about overlapping events

## Success Metrics

1. **Data Integrity**: Zero data loss or corruption
2. **Query Performance**: < 100ms for date range queries
3. **API Reliability**: 99.9% uptime for event operations
4. **Test Coverage**: > 90% coverage for event utilities and API routes
5. **Developer Experience**: Ability to develop/test UI without external services
