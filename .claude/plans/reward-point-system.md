# Reward Point System

## Overview

Implement a gamification system that awards points to users for completing tasks from their Google Tasks lists. The system can be enabled/disabled per user, with configurable point values and visual feedback.

## Requirements

### Core Features

#### 1. Point Tracking

- **Total Points**: Track cumulative points earned by each user
- **Point History**: Record of all point-earning activities (optional for v1)
- **Persistent Storage**: Store points in database per user
- **Real-time Updates**: Update point total when tasks are completed

#### 2. Point Awarding

- **Task Completion**: Award points when user marks task as done
- **Default Points**: User-configurable default points per task (in settings)
- **Custom Points** (Future): Specific tasks can have custom point values
- **Bonus Points** (Future): Streak bonuses, daily goals, etc.

#### 3. User Configuration

- **Enable/Disable**: Toggle reward system on/off per user
- **Default Points**: Set default points per completed task (default: 10)
- **Show Feedback**: Option to show points animation on task completion

#### 4. Visual Feedback

- **Point Display**: Show current total points in UI
- **Completion Animation**: Celebratory animation when task completed
- **Point Badge/Counter**: Persistent display of total points
- **Milestone Notifications** (Future): Alert when reaching point milestones

#### 5. Point Display Locations

- **Header/Navigation**: Show total points in app header
- **Task List Component**: Show points gained when task completed
- **Settings Page**: Show total points and reward settings
- **Dashboard** (Future): Dedicated rewards/achievements page

### Visual Design

#### Point Counter (Header)

```
┌─────────────────────────────────────┐
│  📅 Calendar  🏆 1,250 pts  👤 User │  ← Header with point badge
└─────────────────────────────────────┘
```

#### Task Completion with Points

```
Before completion:
┌─────────────────────────────────────┐
│  🔴 ☐ Buy groceries                │
└─────────────────────────────────────┘

After completion (with animation):
┌─────────────────────────────────────┐
│  🔴 ☑ Buy groceries                │
│         +10 points! 🎉              │  ← Animated, fades out
└─────────────────────────────────────┘
```

#### Settings (Reward Section)

```
┌─────────────────────────────────────┐
│  Reward System                      │
│  ┌─────────────────────────────┐   │
│  │  ☑ Enable reward system     │   │
│  │                             │   │
│  │  Total Points: 1,250 🏆     │   │
│  │                             │   │
│  │  Default points per task    │   │
│  │  [10        ]               │   │
│  │                             │   │
│  │  ☑ Show points on completion│   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Component Structure

```
src/components/rewards/
├── points-badge.tsx           # Points counter/badge
├── points-animation.tsx       # Completion animation
├── points-context.tsx         # React context for points state
└── use-points.ts              # Hook for managing points

src/components/tasks/
├── task-item.tsx              # Updated with points integration
└── task-list.tsx              # Updated with points integration

src/app/api/points/
├── route.ts                   # GET current points
└── award/
    └── route.ts               # POST to award points
```

### 2. Data Models

```typescript
// Already defined in server-side-auth.md, but expanded here
interface RewardPoints {
  id: string;
  userId: string;
  totalPoints: number;
  updatedAt: Date;
  user: User;
}

interface PointTransaction {
  id: string;
  userId: string;
  points: number;
  reason: "task_completed" | "bonus" | "manual" | "streak";
  taskId?: string;
  taskTitle?: string;
  createdAt: Date;
  user: User;
}

interface UserSettings {
  // ... other settings ...
  rewardSystemEnabled: boolean;
  defaultTaskPoints: number;
  showPointsOnCompletion: boolean;
}
```

### 3. Database Schema Updates

```prisma
// Add to schema.prisma

model RewardPoints {
  id          String   @id @default(cuid())
  userId      String   @unique
  totalPoints Int      @default(0)
  updatedAt   DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model PointTransaction {
  id         String   @id @default(cuid())
  userId     String
  points     Int
  reason     String   // task_completed, bonus, manual, streak
  taskId     String?
  taskTitle  String?
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
}
```

### 4. Points Context

```tsx
// src/components/rewards/points-context.tsx
"use client";

import { logger } from "@/lib/logger";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";

interface PointsContextValue {
  totalPoints: number;
  awardPoints: (points: number, reason: string, metadata?: any) => Promise<void>;
  refreshPoints: () => Promise<void>;
  isEnabled: boolean;
}

const PointsContext = createContext<PointsContextValue | null>(null);

export function PointsProvider({ children }: { children: ReactNode }) {
  const [totalPoints, setTotalPoints] = useState(0);
  const [isEnabled, setIsEnabled] = useState(false);

  const refreshPoints = async () => {
    try {
      const response = await fetch("/api/points");
      if (response.ok) {
        const data = await response.json();
        setTotalPoints(data.totalPoints);
        setIsEnabled(data.enabled);
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "RefreshPointsFailed",
      });
    }
  };

  const awardPoints = async (points: number, reason: string, metadata?: any) => {
    try {
      const response = await fetch("/api/points/award", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          points,
          reason,
          ...metadata,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to award points");
      }

      const data = await response.json();
      setTotalPoints(data.newTotal);

      logger.event("PointsAwarded", {
        points,
        reason,
        newTotal: data.newTotal,
        ...metadata,
      });
    } catch (error) {
      logger.error(error as Error, {
        context: "AwardPointsFailed",
        points,
        reason,
      });
      throw error;
    }
  };

  // Initial load
  useEffect(() => {
    refreshPoints();
  }, []);

  return (
    <PointsContext.Provider
      value={{
        totalPoints,
        awardPoints,
        refreshPoints,
        isEnabled,
      }}
    >
      {children}
    </PointsContext.Provider>
  );
}

export function usePoints() {
  const context = useContext(PointsContext);
  if (!context) {
    throw new Error("usePoints must be used within PointsProvider");
  }
  return context;
}
```

### 5. Points Badge Component

```tsx
// src/components/rewards/points-badge.tsx
"use client";

import { usePoints } from "./points-context";

export function PointsBadge() {
  const { totalPoints, isEnabled } = usePoints();

  if (!isEnabled) return null;

  return (
    <div className="flex items-center gap-2 rounded-full bg-yellow-100 px-3 py-1 text-yellow-900">
      <span className="text-lg">🏆</span>
      <span className="font-semibold">{totalPoints.toLocaleString()}</span>
      <span className="text-sm">pts</span>
    </div>
  );
}
```

### 6. Points Animation Component

```tsx
// src/components/rewards/points-animation.tsx
"use client";

import { useEffect, useState } from "react";

interface PointsAnimationProps {
  points: number;
  show: boolean;
  onComplete?: () => void;
}

export function PointsAnimation({ points, show, onComplete }: PointsAnimationProps) {
  const [visible, setVisible] = useState(show);

  useEffect(() => {
    if (show) {
      setVisible(true);

      // Auto-hide after 2 seconds
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  if (!visible) return null;

  return (
    <div className="animate-fade-in-up py-2 text-center">
      <span className="text-lg font-semibold text-green-600">+{points} points! 🎉</span>
    </div>
  );
}

// Add to global CSS (tailwind.config.ts or globals.css)
/*
@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fade-in-up 0.3s ease-out;
}
*/
```

### 7. Updated TaskItem with Points

```tsx
// src/components/tasks/task-item.tsx
"use client";

import { PointsAnimation } from "@/components/rewards/points-animation";
import { usePoints } from "@/components/rewards/points-context";
import { logger } from "@/lib/logger";
import { useState } from "react";

interface TaskItemProps {
  task: TaskWithMeta;
  onToggle: () => Promise<void>;
  showPoints?: boolean;
  pointsPerTask?: number;
}

export function TaskItem({ task, onToggle, showPoints = true, pointsPerTask = 10 }: TaskItemProps) {
  const { awardPoints, isEnabled } = usePoints();
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const isCompleted = task.status === "completed";

  const handleToggle = async () => {
    const wasCompleted = isCompleted;
    const willBeCompleted = !isCompleted;

    setIsUpdating(true);

    try {
      // Toggle task via parent handler
      await onToggle();

      // Award points if task was just completed and rewards enabled
      if (willBeCompleted && !wasCompleted && isEnabled) {
        await awardPoints(pointsPerTask, "task_completed", {
          taskId: task.id,
          taskTitle: task.title,
        });

        if (showPoints) {
          setShowPointsAnimation(true);
        }
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "TaskToggleFailed",
        taskId: task.id,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 transition hover:bg-gray-50">
      <div className="flex items-start gap-3">
        {/* Color indicator */}
        <div
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: task.listColor }}
          title={task.listTitle}
        />

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isCompleted}
          onChange={handleToggle}
          disabled={isUpdating}
          className="mt-1 flex-shrink-0"
        />

        {/* Task content */}
        <div className="flex-1">
          <div className={`text-gray-900 ${isCompleted ? "text-gray-500 line-through" : ""}`}>
            {task.title}
          </div>

          {task.due && (
            <div
              className={`mt-1 text-sm ${
                task.isOverdue ? "font-medium text-red-600" : "text-gray-500"
              }`}
            >
              Due: {formatDueDate(task.due)}
            </div>
          )}

          {/* Points animation */}
          {isEnabled && (
            <PointsAnimation
              points={pointsPerTask}
              show={showPointsAnimation}
              onComplete={() => setShowPointsAnimation(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

### 8. API Routes

```typescript
// src/app/api/points/route.ts
import { getCurrentUser, requireAuth } from "@/lib/auth/helpers";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { NextResponse } from "next/server";
// src/app/api/points/award/route.ts
import { NextRequest } from "next/server";

export async function GET() {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    // Get user settings to check if rewards enabled
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings?.rewardSystemEnabled) {
      return NextResponse.json({
        totalPoints: 0,
        enabled: false,
      });
    }

    // Get or create reward points record
    let rewardPoints = await prisma.rewardPoints.findUnique({
      where: { userId: user.id },
    });

    if (!rewardPoints) {
      rewardPoints = await prisma.rewardPoints.create({
        data: {
          userId: user.id,
          totalPoints: 0,
        },
      });
    }

    return NextResponse.json({
      totalPoints: rewardPoints.totalPoints,
      enabled: true,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/points",
      method: "GET",
    });

    return NextResponse.json({ error: "Failed to fetch points" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { points, reason, taskId, taskTitle } = await request.json();

    if (!points || points <= 0) {
      return NextResponse.json({ error: "Invalid points value" }, { status: 400 });
    }

    // Check if rewards enabled
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings?.rewardSystemEnabled) {
      return NextResponse.json({ error: "Reward system not enabled" }, { status: 403 });
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Update total points
      const rewardPoints = await tx.rewardPoints.upsert({
        where: { userId: user.id },
        update: {
          totalPoints: {
            increment: points,
          },
        },
        create: {
          userId: user.id,
          totalPoints: points,
        },
      });

      // Record transaction
      await tx.pointTransaction.create({
        data: {
          userId: user.id,
          points,
          reason,
          taskId,
          taskTitle,
        },
      });

      return rewardPoints;
    });

    logger.event("PointsAwarded", {
      userId: user.id,
      points,
      reason,
      newTotal: result.totalPoints,
      taskId,
    });

    return NextResponse.json({
      success: true,
      newTotal: result.totalPoints,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: "/api/points/award",
      method: "POST",
    });

    return NextResponse.json({ error: "Failed to award points" }, { status: 500 });
  }
}
```

### 9. Integration with App Layout

```tsx
// src/app/layout.tsx
import { PointsBadge } from "@/components/rewards/points-badge";
import { PointsProvider } from "@/components/rewards/points-context";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <PointsProvider>
            <header className="border-b bg-white">
              <div className="container mx-auto flex items-center justify-between px-4 py-3">
                <h1 className="text-xl font-bold">Digital Wall Calendar</h1>
                <div className="flex items-center gap-4">
                  <PointsBadge />
                  <UserMenu />
                </div>
              </div>
            </header>

            <main>{children}</main>
          </PointsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
```

## Implementation Steps

1. **Update database schema**
   - Add RewardPoints model (if not already added)
   - Add PointTransaction model
   - Run migration

2. **Create PointsContext**
   - Implement context and provider
   - Add usePoints hook
   - Test context in isolation

3. **Build PointsBadge component**
   - Display total points
   - Conditional rendering based on enabled status
   - Style and position in header

4. **Create PointsAnimation component**
   - Build animation component
   - Add CSS animations
   - Test animation timing

5. **Update TaskItem component**
   - Integrate points awarding
   - Add animation on completion
   - Handle errors gracefully

6. **Create API routes**
   - GET /api/points
   - POST /api/points/award
   - Test with various scenarios

7. **Add to settings**
   - Reward section in settings (already planned)
   - Display total points
   - Configure default points and enable/disable

8. **Integration testing**
   - Test complete flow: enable rewards → complete task → see points
   - Test disabled state
   - Test error handling

9. **Polish**
   - Add loading states
   - Improve animations
   - Add accessibility features
   - Performance optimization

## Challenges and Considerations

### Challenge 1: Race Conditions

- **Problem**: Multiple rapid task completions could cause race conditions
- **Solution**: Use database transactions for point updates

### Challenge 2: Point Inflation

- **Problem**: Users might game the system (complete/uncomplete repeatedly)
- **Solution**:
  - Only award points on first completion
  - Track point transactions to prevent duplicates
  - Add cooldown period (future)

### Challenge 3: Animation Performance

- **Problem**: Animations could impact performance with many tasks
- **Solution**:
  - Use CSS animations (GPU accelerated)
  - Limit concurrent animations
  - Debounce rapid completions

### Challenge 4: Points Display Update

- **Problem**: Need to update points badge after awarding
- **Solution**: Use React Context to share state globally

### Challenge 5: Offline Support

- **Problem**: Can't award points without internet
- **Solution**:
  - Queue point awards for later sync (future)
  - Show temporary "pending" state
  - Sync when back online

## Testing Strategy

1. **Unit Tests**:
   - Point calculation logic
   - Transaction validation
   - Context state management

2. **Integration Tests**:
   - API routes (GET points, POST award)
   - Database transactions
   - Settings integration

3. **Component Tests**:
   - PointsBadge rendering
   - PointsAnimation timing
   - TaskItem with points

4. **E2E Tests**:
   - Enable rewards in settings
   - Complete task and see points
   - Verify points in database
   - Disable rewards and verify no points awarded

5. **Manual Tests**:
   - Test animations
   - Test rapid task completions
   - Test with rewards disabled
   - Test point totals accuracy

## Accessibility

- Screen reader announcements for point awards
- Visual feedback doesn't rely solely on color
- Keyboard accessible (no changes needed)
- Animation respects prefers-reduced-motion

## Future Enhancements

### Phase 2 Features

- **Point History**: View all point-earning activities
- **Achievements/Badges**: Unlock badges for milestones
- **Leaderboards**: Compare with family members (multi-user)
- **Streak Bonuses**: Extra points for completing tasks X days in a row
- **Daily Goals**: Bonus points for completing all tasks for the day
- **Custom Point Values**: Set different points for different tasks
- **Point Redemption**: Exchange points for rewards (chores, privileges)

### Phase 3 Features

- **Analytics Dashboard**: Charts showing point trends over time
- **Point Notifications**: Email/push notifications for milestones
- **Point Decay**: Points expire after certain time (optional)
- **Family Challenges**: Collaborative or competitive challenges
- **Task Difficulty**: Harder tasks worth more points

### Gamification Ideas

- **Levels**: User levels based on total points
- **Power-ups**: Temporary boosts (2x points for 1 hour)
- **Quests**: Complete specific sets of tasks for bonus points
- **Daily Login Bonus**: Points just for opening the app
- **Random Rewards**: Surprise bonus points occasionally

## Performance Considerations

- Use database indexes on userId and createdAt for transactions
- Cache total points in memory (context)
- Debounce point updates if many tasks completed rapidly
- Consider pagination for point transaction history (future)
- Monitor database performance as transactions grow

## Security Considerations

- Validate all point award requests server-side
- Prevent negative point values
- Rate limit point award API (prevent abuse)
- Audit log for point modifications
- Admin tools to adjust points if needed (future)

## Monitoring and Analytics

Track these metrics:

- Average points per user
- Point award frequency
- Most common point reasons
- Users with rewards enabled vs disabled
- Task completion rate (with vs without rewards)
- User engagement after enabling rewards

```typescript
logger.event("PointsAwarded", {
  userId: user.id,
  points,
  reason,
  newTotal: result.totalPoints,
  taskId,
});

logger.event("RewardSystemToggled", {
  userId: user.id,
  enabled: settings.rewardSystemEnabled,
});

logger.event("PointsMilestone", {
  userId: user.id,
  milestone: 1000, // Every 1000 points
  totalPoints: result.totalPoints,
});
```

## Dependencies

- Prisma (database)
- React Context API (state management)
- Existing auth and settings infrastructure
- No additional packages required

## Integration with Other Features

- **Task List Component**: Primary integration point
- **User Settings**: Enable/disable and configuration
- **Dashboard** (Future): Display points and achievements
- **Analytics** (Future): Track point trends and statistics
