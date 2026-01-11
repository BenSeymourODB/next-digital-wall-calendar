# Analog Clock Face Component with Calendar Events

## Overview

Create an analog clock face component that displays Google Calendar events for the current 12-hour period as colored radial arcs on the border of the clock dial.

## Requirements

### Visual Design

- **Clock Face**: Standard analog clock with hour and minute hands
- **Event Arcs**: Colored radial arcs drawn on the border of the dial
  - Arc thickness: Sufficient to display emoji (minimum ~40-60px depending on clock size)
  - Arc position: On the outer edge/border of the clock face
  - Arc angle: Calculated from event start/end times within 12-hour period

### Event Display Features

- **Color Coding**: Events can be color-coded via color dot emoji prefix
  - Example: "🟢 Team Meeting" → green arc
  - Example: "🔴 Deadline" → red arc
  - Supported: 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤
  - Default color if no prefix: Use Google Calendar event color or fallback

- **Event Emoji Display**: Show event-specific emoji on the arc
  - Extract first emoji after color prefix (if present)
  - Example: "🟢 🎮 Family Game Night" → green arc with 🎮 displayed
  - Example: "🏋️ Gym Session" → default color arc with 🏋️
  - Position emoji centrally on the arc

- **Event Text Display**: Show truncated event title on arc
  - Display after color/emoji prefixes are removed
  - Truncate with ellipsis if text too long for arc
  - Use curved text rendering if possible, otherwise use straight text rotated to match arc angle

### Time Period Logic

- **12-Hour Period Selection**:
  - If current time is 12:00 AM - 11:59 AM: Show events from 12:00 AM - 11:59 AM
  - If current time is 12:00 PM - 11:59 PM: Show events from 12:00 PM - 11:59 PM

- **Arc Positioning**:
  - 12 o'clock position = start of current 12-hour period
  - 6 o'clock position = 6 hours into period
  - Calculate arc start/end angles based on event times

### Google Calendar Integration

- **API Requirements**:
  - Fetch events from Google Calendar API
  - Filter events for current 12-hour period
  - Handle multiple calendars if user has more than one
  - Refresh data periodically (every 5-10 minutes)

- **Authentication**:
  - Use Google Identity Services (GIS) API
  - Store refresh tokens server-side (requires server-side auth implementation)
  - Handle token refresh automatically

## Technical Implementation Plan

### 1. Component Structure

```
src/components/calendar/
├── analog-clock.tsx          # Main clock component
├── clock-face.tsx            # Clock face with hands
├── event-arc.tsx             # Individual event arc
├── use-calendar-events.ts    # Hook for fetching events
└── types.ts                  # TypeScript types
```

### 2. Key Components

#### AnalogClock Component

- **Props**:
  - `size?: number` - Clock diameter in pixels (default: 600)
  - `refreshInterval?: number` - Event refresh interval in ms (default: 300000 = 5min)
  - `calendars?: string[]` - Calendar IDs to fetch from

- **State**:
  - Current time (updated every second)
  - Calendar events for current period
  - Loading/error states

#### EventArc Component

- **Props**:
  - `event: CalendarEvent` - Event data
  - `startAngle: number` - Arc start angle in degrees
  - `endAngle: number` - Arc end angle in degrees
  - `radius: number` - Clock radius
  - `thickness: number` - Arc thickness

- **Rendering**:
  - Use SVG `<path>` element for arc
  - Calculate arc path using start/end angles and radius
  - Apply color based on emoji prefix or event color
  - Render emoji and text on arc

### 3. Data Flow

```
1. Component mounts
   ↓
2. useCalendarEvents hook fetches events
   ↓
3. Filter events for current 12-hour period
   ↓
4. Parse event titles for color/emoji prefixes
   ↓
5. Calculate arc angles based on event times
   ↓
6. Render clock face with event arcs
   ↓
7. Update current time every second (re-render hands)
   ↓
8. Refresh events at specified interval
```

### 4. Color Emoji Parsing

```typescript
interface ParsedEventTitle {
  colorEmoji?: string;
  eventEmoji?: string;
  cleanTitle: string;
  color: string; // Hex color code
}

function parseEventTitle(title: string, fallbackColor: string): ParsedEventTitle {
  const colorEmojiMap = {
    "🔴": "#EF4444", // red-500
    "🟠": "#F97316", // orange-500
    "🟡": "#EAB308", // yellow-500
    "🟢": "#22C55E", // green-500
    "🔵": "#3B82F6", // blue-500
    "🟣": "#A855F7", // purple-500
    "⚫": "#1F2937", // gray-800
    "⚪": "#F3F4F6", // gray-100
    "🟤": "#92400E", // amber-800
  };

  // Extract color emoji (if first character)
  // Extract event emoji (if exists after color or as first character)
  // Return cleaned title and extracted data
}
```

### 5. Arc Angle Calculation

```typescript
function calculateArcAngles(
  eventStart: Date,
  eventEnd: Date,
  periodStart: Date
): { startAngle: number; endAngle: number } {
  // Convert times to minutes from period start
  const startMinutes = (eventStart.getTime() - periodStart.getTime()) / 60000;
  const endMinutes = (eventEnd.getTime() - periodStart.getTime()) / 60000;

  // Convert to degrees (720 minutes = 360 degrees)
  const startAngle = (startMinutes / 720) * 360;
  const endAngle = (endMinutes / 720) * 360;

  return { startAngle, endAngle };
}
```

### 6. SVG Arc Rendering

- Use SVG viewBox for responsive sizing
- Layer order:
  1. Clock face background circle
  2. Hour markers
  3. Event arcs (bottom layer)
  4. Clock hands (top layer)

- Arc path calculation using polar coordinates:
  ```
  Start point: (centerX + radius * cos(startAngle), centerY + radius * sin(startAngle))
  End point: (centerX + radius * cos(endAngle), centerY + radius * sin(endAngle))
  ```

### 7. Google Calendar API Integration

```typescript
// src/lib/google/calendar.ts
interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime: string };
  end: { dateTime: string };
  colorId?: string;
}

async function fetchCalendarEvents(
  accessToken: string,
  calendarId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  // Call Google Calendar API v3
  // GET https://www.googleapis.com/calendar/v3/calendars/{calendarId}/events
}
```

### 8. Dependencies

- **Required packages**:
  - Google Calendar API client library or direct fetch
  - Date manipulation: Use built-in Date or date-fns for timezone handling
  - No additional UI libraries needed (use SVG)

## Implementation Steps

1. **Create basic analog clock component**
   - SVG clock face with hour/minute hands
   - Update hands every second based on current time
   - Test with different sizes

2. **Implement arc rendering**
   - Create EventArc component
   - Test arc drawing with mock data (different start/end times)
   - Ensure arcs position correctly around clock

3. **Add emoji parsing logic**
   - Implement parseEventTitle function
   - Test with various title formats
   - Handle edge cases (no emoji, multiple emoji, etc.)

4. **Implement calendar API integration**
   - Create API route for fetching calendar events
   - Implement authentication flow (requires server-side auth setup)
   - Add error handling and loading states

5. **Connect data to UI**
   - Fetch real calendar events
   - Filter for current 12-hour period
   - Map events to arc components
   - Test with various event scenarios

6. **Add text rendering on arcs**
   - Implement curved text or rotated text
   - Handle truncation for long titles
   - Ensure emoji renders properly on arcs

7. **Polish and optimize**
   - Add smooth transitions for hand movement
   - Implement proper event refresh logic
   - Add accessibility attributes
   - Test responsive behavior

## Challenges and Considerations

### Challenge 1: Curved Text Rendering

- **Problem**: SVG doesn't natively support text following a circular path easily
- **Solutions**:
  - Option A: Use `<textPath>` with arc path definition
  - Option B: Rotate individual characters and position them
  - Option C: Use straight text rotated to match arc center angle (simpler)

### Challenge 2: Overlapping Events

- **Problem**: Multiple events at same time will overlap
- **Solutions**:
  - Option A: Stack arcs at different radii (inner/outer rings)
  - Option B: Make arcs semi-transparent when overlapping
  - Option C: Show only primary event, indicate others with counter

### Challenge 3: Very Short Events

- **Problem**: Events under ~15 minutes may have arcs too small for text/emoji
- **Solutions**:
  - Minimum arc size of X degrees
  - Show only emoji (no text) for short events
  - On hover/click, show full event details in tooltip

### Challenge 4: Server-Side Auth Requirement

- **Problem**: Component needs server-side auth infrastructure
- **Dependencies**:
  - Requires "server-side auth with refresh token storage" feature to be implemented first
  - Create API routes for calendar access
  - Handle token refresh transparently

### Challenge 5: Timezone Handling

- **Problem**: Google Calendar events have timezones, need to convert to local time
- **Solution**:
  - Use Google Calendar API timezone fields
  - Convert all times to user's local timezone
  - Handle DST transitions

## Testing Strategy

1. **Unit Tests**:
   - parseEventTitle function with various inputs
   - calculateArcAngles with edge cases (midnight crossover, etc.)
   - Color emoji mapping

2. **Integration Tests**:
   - Calendar API mocking
   - Event filtering logic
   - Arc rendering with different event counts

3. **Visual Tests**:
   - Clock face appearance at different sizes
   - Arc positioning accuracy
   - Emoji and text rendering quality
   - Overlapping event handling

4. **Manual Tests**:
   - Test with real Google Calendar
   - Various event types and durations
   - Multiple calendars
   - Edge cases (no events, all-day events, etc.)

## Future Enhancements

- Click on arc to show full event details
- Hover tooltips for event information
- Support for all-day events (shown differently)
- Animation when transitioning between 12-hour periods
- Multiple timezone support
- Recurring event indicators
- Event creation from clock interface

## Accessibility

- Add ARIA labels for clock components
- Ensure event information is available to screen readers
- Keyboard navigation for event details
- High contrast mode support
- Consider alternative views for users who can't perceive colors

## Performance Considerations

- Minimize re-renders (only update hands, not entire clock)
- Memoize event arc calculations
- Debounce API calls
- Use requestAnimationFrame for smooth hand animation
- Consider virtualization if many events (>20)
