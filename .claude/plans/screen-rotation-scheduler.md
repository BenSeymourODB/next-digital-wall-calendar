# Screen Rotation/Navigation Scheduler

## Overview
Implement a system for automatically navigating between different screens (pages) in the application based on configurable schedules. Support both interval-based rotation and time-specific navigation with pause-on-interaction functionality.

## Requirements

### Schedule Types

#### 1. Sequence Rotation
- **Definition**: Automatically navigate through a list of screens at regular intervals
- **Configuration**:
  - List of screen/page paths to rotate through
  - Interval duration (in seconds)
  - Loop behavior: restart from beginning after last screen
- **Example**:
  ```
  Screens: ["/dashboard", "/clock", "/tasks", "/recipe"]
  Interval: 60 seconds
  → Navigate to next screen every 60 seconds
  ```

#### 2. Time-Specific Navigation
- **Definition**: Navigate to a specific screen at a particular time of day
- **Configuration**:
  - Screen/page path
  - Time of day (HH:MM format)
  - Duration to stay on that screen (in minutes)
  - Priority: Interrupts sequence rotation
- **Example**:
  ```
  Screen: "/recipe"
  Time: 17:30 (5:30 PM)
  Duration: 30 minutes
  → At 5:30 PM, navigate to recipe screen and stay for 30 minutes
  ```

### User Interaction Handling
- **Pause on Interaction**: When user interacts with the app, pause automatic navigation
- **Interaction Types**:
  - Mouse clicks
  - Scrolling (mouse wheel, touch scroll)
  - Keyboard inputs
  - Touch interactions (tap, swipe)
- **Pause Duration**: Configurable (default: 2 minutes)
- **Resume Behavior**: After pause duration, resume from current position in sequence

### Navigation Controls
- **UI Elements**: Floating control bar at bottom of screen
  - Previous button (←)
  - Pause/Play toggle button (⏸/▶)
  - Next button (→)
- **Visibility**:
  - Show when sequence rotation is active
  - Auto-hide after inactivity (e.g., 5 seconds)
  - Re-appear on mouse movement
- **Manual Navigation**:
  - Previous/Next buttons navigate through the sequence
  - Reset interval timer after manual navigation
  - Pause button stops/starts automatic rotation

## Technical Implementation Plan

### 1. Architecture

```
src/components/scheduler/
├── screen-scheduler.tsx           # Main scheduler component
├── navigation-controls.tsx        # Floating prev/pause/next controls
├── use-screen-scheduler.ts        # Scheduler logic hook
├── use-interaction-detector.ts    # User interaction detection hook
└── types.ts                       # TypeScript types

src/lib/scheduler/
├── schedule-config.ts             # Schedule configuration types
├── schedule-storage.ts            # Load/save schedules (DB or localStorage)
└── time-utils.ts                  # Time calculation utilities

src/app/api/schedules/
└── route.ts                       # API routes for schedule CRUD
```

### 2. Data Models

```typescript
// Schedule configuration types
interface ScreenSequence {
  id: string;
  name: string;
  enabled: boolean;
  screens: string[];           // Page paths
  intervalSeconds: number;     // Rotation interval
  pauseOnInteractionSeconds: number; // How long to pause after interaction
}

interface TimeSpecificNavigation {
  id: string;
  enabled: boolean;
  screen: string;              // Page path
  time: string;                // "HH:MM" format
  durationMinutes: number;     // How long to stay on this screen
  days?: number[];             // Optional: days of week (0=Sunday, 6=Saturday)
}

interface ScheduleConfig {
  sequences: ScreenSequence[];
  timeSpecific: TimeSpecificNavigation[];
}

// Runtime state
interface SchedulerState {
  isActive: boolean;
  isPaused: boolean;
  currentSequenceId: string | null;
  currentIndex: number;
  timeUntilNextNav: number;    // Seconds
  pausedUntil: Date | null;
  activeTimeSpecific: TimeSpecificNavigation | null;
}
```

### 3. Core Components

#### ScreenScheduler Component
- **Purpose**: Orchestrates automatic navigation
- **Location**: App-level wrapper (layout.tsx or providers)
- **Responsibilities**:
  - Load schedule configuration
  - Manage scheduler state
  - Trigger navigation at appropriate times
  - Coordinate with interaction detector
  - Render navigation controls

#### NavigationControls Component
- **Purpose**: Floating UI for manual control
- **Props**:
  - `onPrevious: () => void`
  - `onNext: () => void`
  - `onTogglePause: () => void`
  - `isPaused: boolean`
- **Features**:
  - Fixed positioning at bottom of viewport
  - Auto-hide/show based on mouse movement
  - Accessible keyboard controls
  - Visual indicator of current position in sequence

### 4. Hooks

#### useScreenScheduler Hook
```typescript
function useScreenScheduler(config: ScheduleConfig) {
  const [state, setState] = useState<SchedulerState>({...});
  const router = useRouter();

  // Initialize scheduler
  useEffect(() => {
    // Load active sequence
    // Set up interval timer
    // Check for time-specific navigations
  }, [config]);

  // Handle interval-based navigation
  useEffect(() => {
    if (!state.isActive || state.isPaused) return;

    const timer = setInterval(() => {
      navigateToNext();
    }, state.currentSequence.intervalSeconds * 1000);

    return () => clearInterval(timer);
  }, [state]);

  // Check for time-specific navigation
  useEffect(() => {
    const checkTimeSpecific = () => {
      const now = new Date();
      const currentTime = `${now.getHours()}:${now.getMinutes()}`;

      const match = config.timeSpecific.find(ts =>
        ts.enabled && ts.time === currentTime
      );

      if (match) {
        handleTimeSpecificNav(match);
      }
    };

    // Check every minute
    const interval = setInterval(checkTimeSpecific, 60000);
    checkTimeSpecific(); // Check immediately

    return () => clearInterval(interval);
  }, [config]);

  const navigateToNext = () => {
    // Calculate next screen in sequence
    // Navigate using Next.js router
    // Update state
  };

  const navigateToPrevious = () => {
    // Similar to navigateToNext but backwards
  };

  const pause = () => setState({ ...state, isPaused: true });
  const resume = () => setState({ ...state, isPaused: false });

  return {
    state,
    navigateToNext,
    navigateToPrevious,
    pause,
    resume,
  };
}
```

#### useInteractionDetector Hook
```typescript
function useInteractionDetector(
  onInteraction: () => void,
  pauseDurationMs: number
) {
  const [isPaused, setIsPaused] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleInteraction = useCallback(() => {
    setIsPaused(true);
    onInteraction();

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout to resume
    timeoutRef.current = setTimeout(() => {
      setIsPaused(false);
    }, pauseDurationMs);
  }, [onInteraction, pauseDurationMs]);

  useEffect(() => {
    // Add event listeners
    const events = ['click', 'scroll', 'keydown', 'touchstart', 'wheel'];

    events.forEach(event => {
      window.addEventListener(event, handleInteraction, { passive: true });
    });

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleInteraction);
      });

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleInteraction]);

  return { isPaused };
}
```

### 5. Navigation Implementation

```typescript
// Using Next.js App Router
function navigateToScreen(path: string) {
  // Client-side navigation
  router.push(path);

  // Log navigation event
  logger.event('ScreenNavigation', {
    path,
    type: 'automatic',
    timestamp: new Date().toISOString(),
  });
}

// Handle time-specific navigation
function handleTimeSpecificNav(nav: TimeSpecificNavigation) {
  // Pause current sequence
  pauseSequence();

  // Navigate to specific screen
  navigateToScreen(nav.screen);

  // Set timer to resume sequence after duration
  setTimeout(() => {
    resumeSequence();
  }, nav.durationMinutes * 60 * 1000);

  logger.event('TimeSpecificNavigation', {
    screen: nav.screen,
    time: nav.time,
    durationMinutes: nav.durationMinutes,
  });
}
```

### 6. Schedule Configuration UI

**Option A: Settings Page**
- Add schedule management section to settings page
- UI for creating/editing sequences
- UI for creating/editing time-specific navigations
- Enable/disable toggle for each schedule

**Option B: Dedicated Schedule Page**
- `/settings/schedules` route
- Full CRUD interface for schedules
- Preview mode to test schedules
- Import/export schedule configurations

### 7. Data Persistence

**Database Schema** (when server-side DB is implemented):
```sql
CREATE TABLE screen_sequences (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  name VARCHAR NOT NULL,
  enabled BOOLEAN DEFAULT true,
  screens JSON NOT NULL,  -- Array of screen paths
  interval_seconds INTEGER NOT NULL,
  pause_on_interaction_seconds INTEGER DEFAULT 120,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE time_specific_navigations (
  id VARCHAR PRIMARY KEY,
  user_id VARCHAR REFERENCES users(id),
  enabled BOOLEAN DEFAULT true,
  screen VARCHAR NOT NULL,
  time VARCHAR NOT NULL,  -- "HH:MM" format
  duration_minutes INTEGER NOT NULL,
  days JSON,  -- Optional array of days [0-6]
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Temporary: LocalStorage** (before DB):
```typescript
// src/lib/scheduler/schedule-storage.ts
const STORAGE_KEY = 'screen_schedules';

function loadSchedules(): ScheduleConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored ? JSON.parse(stored) : defaultSchedules;
}

function saveSchedules(config: ScheduleConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}
```

### 8. Navigation Controls UI

```tsx
// src/components/scheduler/navigation-controls.tsx
export function NavigationControls({
  onPrevious,
  onNext,
  onTogglePause,
  isPaused,
  currentIndex,
  totalScreens,
}: NavigationControlsProps) {
  const [isVisible, setIsVisible] = useState(true);
  const hideTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-hide after 5 seconds of no mouse movement
  useEffect(() => {
    const handleMouseMove = () => {
      setIsVisible(true);

      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }

      hideTimeoutRef.current = setTimeout(() => {
        setIsVisible(false);
      }, 5000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex items-center gap-2 bg-gray-800 text-white rounded-full px-4 py-2 shadow-lg">
        <button
          onClick={onPrevious}
          className="p-2 hover:bg-gray-700 rounded-full transition"
          aria-label="Previous screen"
        >
          ← {/* Or use icon */}
        </button>

        <button
          onClick={onTogglePause}
          className="p-2 hover:bg-gray-700 rounded-full transition"
          aria-label={isPaused ? 'Resume rotation' : 'Pause rotation'}
        >
          {isPaused ? '▶' : '⏸'}
        </button>

        <button
          onClick={onNext}
          className="p-2 hover:bg-gray-700 rounded-full transition"
          aria-label="Next screen"
        >
          → {/* Or use icon */}
        </button>

        <span className="text-sm ml-2">
          {currentIndex + 1} / {totalScreens}
        </span>
      </div>
    </div>
  );
}
```

## Implementation Steps

1. **Create data models and types**
   - Define TypeScript interfaces for schedules
   - Create default/example configurations
   - Set up storage utilities (localStorage initially)

2. **Implement useInteractionDetector hook**
   - Set up event listeners for user interactions
   - Test pause/resume behavior
   - Handle edge cases (rapid interactions, etc.)

3. **Implement useScreenScheduler hook**
   - Basic sequence rotation logic
   - Integration with Next.js router
   - State management for scheduler

4. **Create NavigationControls component**
   - Build UI with prev/pause/next buttons
   - Implement auto-hide behavior
   - Add keyboard shortcuts

5. **Integrate with app layout**
   - Add ScreenScheduler to root layout or provider
   - Test navigation between existing pages
   - Verify interaction detection works globally

6. **Implement time-specific navigation**
   - Add time-checking logic
   - Test interruption of sequence rotation
   - Verify resume behavior after time-specific nav ends

7. **Create schedule configuration UI**
   - Build settings page for managing schedules
   - Add CRUD operations for sequences
   - Add CRUD operations for time-specific navigations

8. **Add persistence layer**
   - Initially use localStorage
   - Later migrate to database when server-side DB is ready
   - Create API routes for schedule management

9. **Testing and polish**
   - Test edge cases (midnight crossover, DST, etc.)
   - Add loading states
   - Add error handling
   - Accessibility improvements

## Challenges and Considerations

### Challenge 1: Router State Management
- **Problem**: Next.js router doesn't provide easy way to track navigation history
- **Solution**: Maintain own state for current position in sequence

### Challenge 2: Page Transitions
- **Problem**: Page transitions may take time, affecting interval timing
- **Solution**: Reset timer after navigation completes, not when it starts

### Challenge 3: Browser Tab Visibility
- **Problem**: When tab is not visible, timers may be throttled
- **Solution**: Use Page Visibility API to pause scheduler when tab is hidden

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.hidden) {
      pause();
    } else {
      resume();
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, []);
```

### Challenge 4: Interaction Detection Performance
- **Problem**: Too many event listeners may impact performance
- **Solution**:
  - Use passive event listeners
  - Debounce interaction handler
  - Only listen when scheduler is active

### Challenge 5: Time-Specific Navigation Accuracy
- **Problem**: Checking every minute may miss exact time
- **Solution**:
  - Check at top of each minute
  - Allow small time window (±1 minute)
  - Log when time-specific nav triggers for debugging

### Challenge 6: Multiple Time-Specific Navigations
- **Problem**: What if multiple time-specific navs scheduled for same time?
- **Solution**:
  - Priority system (order in config)
  - Or: queue them sequentially
  - Or: user configures priority

## Testing Strategy

1. **Unit Tests**:
   - Schedule calculation logic
   - Time parsing and comparison
   - Interaction detection

2. **Integration Tests**:
   - Sequence rotation flow
   - Time-specific navigation triggering
   - Pause/resume behavior
   - Manual navigation controls

3. **E2E Tests**:
   - Full rotation through multiple screens
   - Interaction pausing
   - Time-specific interruption and resume
   - Control button functionality

4. **Manual Tests**:
   - Test on actual wall calendar device
   - Long-duration testing (24+ hours)
   - Different screen combinations
   - Edge cases (midnight, DST change, etc.)

## Future Enhancements

- **Smart scheduling**: ML to learn optimal rotation based on usage patterns
- **Conditional navigation**: Navigate based on external triggers (weather, time of day, etc.)
- **Transition effects**: Fade, slide, or other animations between screens
- **Screen groups**: Multiple independent rotation sequences
- **Schedule templates**: Pre-configured schedules for common use cases
- **Remote control**: Control navigation from mobile app
- **Screen preview**: See next screen before it navigates
- **Analytics**: Track which screens are viewed most/least

## Accessibility

- Keyboard shortcuts for prev/next/pause
- Screen reader announcements for navigation
- Option to disable auto-navigation
- Visual indicator of remaining time until next navigation
- High contrast mode for controls

## Performance Considerations

- Use passive event listeners for scroll/touch
- Debounce interaction handler (100ms)
- Only run scheduler when tab is visible
- Minimize re-renders using proper React optimization
- Use localStorage reads sparingly (cache in memory)

## Dependencies

- Next.js router (already in project)
- Date utilities (native Date or date-fns if needed)
- No additional packages required for core functionality
- Icons: Can use Unicode or add icon library if needed

## Integration with Other Features

- **User Accounts**: Schedules should be per-user when multi-user support is added
- **Settings Page**: Schedule management should be part of settings
- **Server-Side DB**: Migrate from localStorage to database when available
- **Logging**: Track navigation events in Application Insights
