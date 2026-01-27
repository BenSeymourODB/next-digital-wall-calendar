# Multi-Profile Family Support

## Implementation Status

> **Last Updated:** January 2026
> **Status:** ✅ Core Implementation Complete (Phases 1-3, 5-7)
> **Tests:** 482 passing
> **Branch:** `feature/multi-profile-support`

### Phase Summary

| Phase     | Description                 | Status                             |
| --------- | --------------------------- | ---------------------------------- |
| Phase 1   | Database and API Foundation | ✅ Complete                        |
| Phase 2   | Core Components             | ✅ Complete                        |
| Phase 3   | Profile Management UI       | ✅ Complete                        |
| Phase 4   | Task Integration            | ⏳ Blocked (requires Google Tasks) |
| Phase 5   | Advanced Features           | ✅ Complete                        |
| Phase 5.5 | PIN Security                | ✅ Complete                        |
| Phase 6   | Multiple Admin Support      | ✅ Complete                        |
| Phase 7   | Polish and Testing          | ✅ Complete\*                      |

\*Step 24 (streak tracking) blocked on Google Tasks integration

### What's Implemented

**API Routes:**

- `GET/POST /api/profiles` - List and create profiles
- `GET/PATCH/DELETE /api/profiles/[id]` - Profile CRUD
- `GET /api/profiles/[id]/stats` - Profile statistics with rank
- `POST /api/profiles/[id]/give-points` - Admin award points
- `POST /api/profiles/[id]/set-pin` - Set/update PIN
- `POST /api/profiles/[id]/verify-pin` - Verify PIN with lockout
- `POST /api/profiles/[id]/remove-pin` - Remove PIN (standard only)
- `POST /api/profiles/[id]/reset-pin` - Admin reset PIN

**Components:**

- `ProfileProvider` / `useProfile` - Context for profile state
- `ProfileSwitcher` - Header dropdown with PIN integration
- `ProfileAvatar` - Initials, photo, emoji support
- `ProfileCard` - Stats display with rank/trophy
- `ProfileGrid` - Responsive profile grid
- `ProfileForm` - Create profile with color picker
- `ColorPicker` - 10-color palette selection
- `GivePointsModal` - Admin point awarding
- `PinEntryModal` - Numeric keypad for PIN entry
- `PinSetupModal` - Two-step PIN creation
- `PinSettings` - PIN management in settings
- `NumericKeypad` - Shared keypad component
- `PinDisplay` - Visual PIN progress dots

**Pages:**

- `/profiles` - Profile management page
- `/profiles/new` - Create new profile
- `/profiles/[id]/settings` - Profile settings with PIN management

### What's Missing / Blocked

1. **Task Integration (Phase 4)** - Requires Google Tasks API implementation
   - Task assignment to profiles
   - Task filtering by profile
   - Profile-based task views

2. **Streak Tracking (Phase 7, Step 24)** - Requires task completion data
   - Track daily task completions
   - Update currentStreak on completion
   - Reset on missed days

### Files Created

```
src/app/api/profiles/
├── route.ts
├── [id]/
│   ├── route.ts
│   ├── stats/route.ts
│   ├── give-points/route.ts
│   ├── set-pin/route.ts
│   ├── verify-pin/route.ts
│   ├── remove-pin/route.ts
│   └── reset-pin/route.ts

src/components/profiles/
├── index.ts
├── profile-context.tsx
├── profile-switcher.tsx
├── profile-avatar.tsx
├── profile-card.tsx
├── profile-grid.tsx
├── profile-form.tsx
├── color-picker.tsx
├── give-points-modal.tsx
├── pin-entry-modal.tsx
├── pin-setup-modal.tsx
├── pin-settings.tsx
├── numeric-keypad.tsx
└── pin-display.tsx

src/app/profiles/
├── page.tsx
├── new/page.tsx
└── [id]/settings/page.tsx
```

---

## Overview

Implement multi-profile family support that enables multiple family members to have individual profiles with personalized views, task assignments, reward tracking, and customizable settings. This is a core feature that transforms the calendar from a single-user tool into a family hub, similar to Skylight's multi-profile system.

## Requirements

### Core Features

#### 1. Profile Management

- **Create Profiles**: Add family member profiles (name, avatar, age group)
- **Profile Types**: Adult, Teen, Child (for age-appropriate features)
- **Avatar Options**:
  - Initials (default, colored background)
  - Photo upload (optional)
  - Emoji selection (fun alternative)
- **Profile Limit**: 5-10 profiles per account (configurable)
- **Profile Settings**: Individual preferences per profile

#### 2. Profile Switching

- **Quick Switcher**: Fast profile selection from header/menu
- **Profile View**: Switch between "My View" and "Family View"
- **Active Profile Indicator**: Clear visual indicator of current profile
- **Remember Last Profile**: Persist last active profile per device
- **Family View**: See all profiles' tasks/events together

#### 3. Task Assignment

- **Assign to Profile**: Assign tasks to specific family members
- **Multiple Assignment**: Assign task to multiple profiles (shared tasks)
- **Unassigned Tasks**: Tasks visible to all (family chores)
- **Profile Filter**: Filter task list by assigned profile
- **Color Coding**: Visual distinction per profile

#### 4. Reward Points per Profile

- **Individual Points**: Each profile has separate point total
- **Point Leaderboard**: Optional family leaderboard
- **Give Points**: Parents can manually award bonus points
- **Point History**: Per-profile point transaction history
- **Goals/Rewards**: Set redemption goals per profile

#### 5. Calendar Integration

- **Profile Calendars**: Filter calendar events by profile
- **Shared Events**: Family events visible to all
- **Color Coding**: Events colored by assigned profile
- **Multiple Calendars**: Each profile can connect their own Google Calendar

#### 6. Profile Permissions

- **Admin Profiles**: Can manage other profiles (parents)
  - **Multiple Admins**: Support multiple admin profiles (both parents)
  - **Admin Actions**: Create/delete profiles, edit any task, give points, manage settings
  - **PIN Required**: All admin profiles must set a PIN for security
- **Standard Profiles**: Can only edit own tasks (children)
  - **Optional PIN**: Can optionally set PIN for privacy
  - **Limited Access**: Cannot modify other profiles or settings
- **Create/Delete Profiles**: Admin only
- **Edit Tasks**: Admins can edit any task, standard only their own
- **Give Points**: Admin only

#### 7. PIN Security

- **PIN Protection**: Optional 4-6 digit PIN per profile
- **Admin PIN Required**: Admin profiles must set PIN (cannot be skipped)
- **Standard PIN Optional**: Standard profiles can choose to set PIN
- **PIN Entry**: Required when switching to PIN-protected profile
- **Fallback Security**: Essential when face recognition is off or not working
- **PIN Reset**: Admins can reset PINs for standard profiles
- **Self-Reset**: Users can reset own PIN with account password
- **Lockout Protection**: Temporary lockout after 5 failed attempts
- **PIN Masking**: Always show dots/asterisks when entering PIN
- **No PIN Storage**: PINs hashed with bcrypt (never stored in plain text)

#### 8. Profile Display

- **Profile Avatar Grid**: Show all profiles on dashboard
- **Profile Stats**: Quick stats (tasks today, points, streak)
- **Profile Cards**: Tappable cards to switch profile or view details
- **Completion Progress**: Visual progress per profile (e.g., 3/5 tasks done)

### Visual Design

#### Profile Switcher (Header)

```
┌─────────────────────────────────────────────────────┐
│  📅 Calendar    [👤 Ben ▼]    🏆 1,250 pts         │
│                                                     │
│  Dropdown when clicked:                            │
│  ┌─────────────────────┐                          │
│  │  👤 Ben (You)       │ ← Current profile        │
│  │  👧 Evelyn          │                          │
│  │  👦 Liv             │                          │
│  │  👨 Sean Mark       │                          │
│  │  👶 Titus           │                          │
│  │  ─────────────────  │                          │
│  │  👨‍👩‍👧‍👦 Family View   │                          │
│  │  ⚙️ Manage Profiles  │                          │
│  └─────────────────────┘                          │
└─────────────────────────────────────────────────────┘
```

#### Profile Cards (Dashboard)

```
┌─────────────────────────────────────────────────────┐
│  Family Dashboard                                   │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │   BEN   │  │   EVE   │  │   LIV   │           │
│  │  Blue   │  │  Pink   │  │  Green  │           │
│  │         │  │         │  │         │           │
│  │ 3/5 ✓   │  │ 2/3 ✓   │  │ 1/4 ✓   │  ← Tasks  │
│  │ 1,250⭐  │  │  850⭐   │  │  420⭐   │  ← Points │
│  │ 5 🔥    │  │ 3 🔥    │  │ 2 🔥    │  ← Streak │
│  └─────────┘  └─────────┘  └─────────┘           │
│                                                     │
│  ┌─────────┐  ┌─────────┐                         │
│  │  SEAN   │  │  TITUS  │                         │
│  │  Orange │  │  Purple │                         │
│  │         │  │         │                         │
│  │ 0/2 ✓   │  │ 1/1 ✓   │                         │
│  │  220⭐   │  │  180⭐   │                         │
│  │ 1 🔥    │  │ 7 🔥    │                         │
│  └─────────┘  └─────────┘                         │
└─────────────────────────────────────────────────────┘
```

#### Task List with Profile Assignment

```
┌─────────────────────────────────────────────────────┐
│  Tasks - Family View                    [Filter ▼] │
│                                                     │
│  🌤️ Morning                                        │
│  ┌──────────────────────────────────────────────┐ │
│  │ 🔴 ☐ Make bed                        👤 Ben  │ │
│  │ 🔵 ☐ Feed the dog               👧 Evelyn    │ │
│  │ 🟢 ☐ Brush teeth                    👦 Liv   │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ☀️ Afternoon                                      │
│  ┌──────────────────────────────────────────────┐ │
│  │ 🟠 ☐ Homework                   👨 Sean Mark  │ │
│  │ 🟣 ☑ Nap time                      👶 Titus  │ │
│  │       +10 points! 🎉                          │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  🧹 Chores (Shared)                                │
│  ┌──────────────────────────────────────────────┐ │
│  │ ⚫ ☐ Take out trash       👤👧👦 Ben, Eve, Liv │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### Profile Management Page

```
┌─────────────────────────────────────────────────────┐
│  Manage Profiles                      [+ Add New]   │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  BEN                          👑 Admin        │ │
│  │  [Photo]  Blue                                │ │
│  │  Points: 1,250  •  Tasks: 12  •  Streak: 5🔥  │ │
│  │  [Edit]  [Remove]                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  EVELYN                       👤 Standard     │ │
│  │  [Photo]  Pink                                │ │
│  │  Points: 850  •  Tasks: 8  •  Streak: 3🔥     │ │
│  │  [Edit]  [Remove]                             │ │
│  └──────────────────────────────────────────────┘ │
│                                                     │
│  ┌──────────────────────────────────────────────┐ │
│  │  LIV                          👤 Standard     │ │
│  │  [Photo]  Green                               │ │
│  │  Points: 420  •  Tasks: 5  •  Streak: 2🔥     │ │
│  │  [Edit]  [Remove]                             │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### Give Points Modal (Admin Only)

```
┌─────────────────────────────────────┐
│  Give Bonus Points                  │
│                                     │
│  Select Profile:                    │
│  ┌──────────────────────────────┐  │
│  │  👧 Evelyn                  ▼│  │
│  └──────────────────────────────┘  │
│                                     │
│  Points to award:                   │
│  ┌──────────────────────────────┐  │
│  │  [50        ]          ⭐     │  │
│  └──────────────────────────────┘  │
│                                     │
│  Reason (optional):                 │
│  ┌──────────────────────────────┐  │
│  │  Helped with dishes          │  │
│  └──────────────────────────────┘  │
│                                     │
│  [Cancel]          [Give Points]    │
└─────────────────────────────────────┘
```

#### PIN Entry Modal

```
┌─────────────────────────────────────┐
│  Switch to Ben's Profile            │
│                                     │
│  👤 Ben (Admin)                     │
│  🔒 PIN Required                    │
│                                     │
│  Enter PIN:                         │
│  ┌──────────────────────────────┐  │
│  │  [● ● ● ●]                   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌───────┬───────┬───────┐         │
│  │   1   │   2   │   3   │         │
│  ├───────┼───────┼───────┤         │
│  │   4   │   5   │   6   │         │
│  ├───────┼───────┼───────┤         │
│  │   7   │   8   │   9   │         │
│  ├───────┼───────┼───────┤         │
│  │   ←   │   0   │   ✓   │         │
│  └───────┴───────┴───────┘         │
│                                     │
│  [Forgot PIN?]        [Cancel]     │
└─────────────────────────────────────┘
```

#### Set PIN Flow (Admin Profile Creation)

```
┌─────────────────────────────────────┐
│  Create Admin Profile               │
│  Step 2 of 3: Set PIN               │
│                                     │
│  🔒 Security Required               │
│  Admin profiles must have a PIN to  │
│  protect sensitive actions.         │
│                                     │
│  Create a 4-6 digit PIN:            │
│  ┌──────────────────────────────┐  │
│  │  [● ● ● ●]                   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌───────┬───────┬───────┐         │
│  │   1   │   2   │   3   │         │
│  ├───────┼───────┼───────┤         │
│  │   4   │   5   │   6   │         │
│  ├───────┼───────┼───────┤         │
│  │   7   │   8   │   9   │         │
│  ├───────┼───────┼───────┤         │
│  │   ←   │   0   │   ✓   │         │
│  └───────┴───────┴───────┘         │
│                                     │
│  Tips:                              │
│  • Use 4-6 digits                   │
│  • Avoid obvious PINs (1234)        │
│  • Make it memorable                │
│                                     │
│  [Back]                    [Next]   │
└─────────────────────────────────────┘
```

#### PIN Confirmation

```
┌─────────────────────────────────────┐
│  Create Admin Profile               │
│  Step 2 of 3: Confirm PIN           │
│                                     │
│  🔒 Confirm Your PIN                │
│  Re-enter the PIN you just created. │
│                                     │
│  Confirm PIN:                       │
│  ┌──────────────────────────────┐  │
│  │  [● ●]                       │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌───────┬───────┬───────┐         │
│  │   1   │   2   │   3   │         │
│  ├───────┼───────┼───────┤         │
│  │   4   │   5   │   6   │         │
│  ├───────┼───────┼───────┤         │
│  │   7   │   8   │   9   │         │
│  ├───────┼───────┼───────┤         │
│  │   ←   │   0   │   ✓   │         │
│  └───────┴───────┴───────┘         │
│                                     │
│  [Back]                    [Next]   │
└─────────────────────────────────────┘
```

#### Failed PIN Attempts

```
┌─────────────────────────────────────┐
│  Switch to Ben's Profile            │
│                                     │
│  👤 Ben (Admin)                     │
│  ❌ Incorrect PIN                   │
│                                     │
│  Enter PIN:                         │
│  ┌──────────────────────────────┐  │
│  │  [● ● ● ●]                   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ⚠️ 2 attempts remaining            │
│  Account will lock after 5 failed   │
│  attempts.                          │
│                                     │
│  ┌───────┬───────┬───────┐         │
│  │   1   │   2   │   3   │         │
│  ├───────┼───────┼───────┤         │
│  │   4   │   5   │   6   │         │
│  ├───────┼───────┼───────┤         │
│  │   7   │   8   │   9   │         │
│  ├───────┼───────┼───────┤         │
│  │   ←   │   0   │   ✓   │         │
│  └───────┴───────┴───────┘         │
│                                     │
│  [Forgot PIN?]        [Cancel]     │
└─────────────────────────────────────┘
```

#### Profile Switcher with PIN Indicators

```
┌─────────────────────────────────────────────────────┐
│  📅 Calendar    [👤 Ben ▼]    🏆 1,250 pts         │
│                                                     │
│  Dropdown when clicked:                            │
│  ┌─────────────────────┐                          │
│  │  👤 Ben (You) 🔒    │ ← Current (Admin + PIN)  │
│  │  👧 Evelyn   🔒     │ ← Has PIN                │
│  │  👦 Liv            │ ← No PIN                 │
│  │  👨 Sean Mark 🔒    │ ← Admin (requires PIN)   │
│  │  👶 Titus          │ ← No PIN                 │
│  │  ─────────────────  │                          │
│  │  👨‍👩‍👧‍👦 Family View   │                          │
│  │  ⚙️ Manage Profiles  │                          │
│  └─────────────────────┘                          │
└─────────────────────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Component Structure

```
src/components/profiles/
├── profile-switcher.tsx         # Header profile dropdown
├── profile-card.tsx             # Individual profile card
├── profile-grid.tsx             # Dashboard grid of profiles
├── profile-avatar.tsx           # Profile avatar component
├── profile-context.tsx          # React context for active profile
├── profile-manager.tsx          # Admin profile management UI
├── profile-form.tsx             # Create/edit profile form
├── give-points-modal.tsx        # Admin give points UI
├── pin-entry-modal.tsx          # PIN entry modal with keypad
├── pin-setup-modal.tsx          # PIN setup flow (create + confirm)
├── pin-settings.tsx             # PIN management in profile settings
└── use-profile.ts               # Hook for profile operations

src/components/tasks/
├── task-item.tsx                # Updated with profile assignment
├── task-assignment-picker.tsx  # Assign task to profiles
└── task-filter.tsx              # Filter by profile

src/app/profiles/
├── page.tsx                     # Profile management page
└── [id]/
    └── page.tsx                 # Individual profile detail page

src/app/api/profiles/
├── route.ts                     # GET all profiles, POST create
├── [id]/
│   ├── route.ts                 # GET/PATCH/DELETE profile
│   ├── stats/
│   │   └── route.ts             # GET profile stats
│   ├── give-points/
│   │   └── route.ts             # POST admin give points
│   ├── set-pin/
│   │   └── route.ts             # POST set/update PIN
│   ├── verify-pin/
│   │   └── route.ts             # POST verify PIN
│   ├── remove-pin/
│   │   └── route.ts             # POST remove PIN (standard only)
│   └── reset-pin/
│       └── route.ts             # POST admin reset PIN
```

### 2. Data Models

```typescript
// Profile types
export type ProfileType = "admin" | "standard";
export type AgeGroup = "adult" | "teen" | "child";

interface Profile {
  id: string;
  userId: string; // Account owner (from auth)
  name: string;
  type: ProfileType; // admin or standard
  ageGroup: AgeGroup; // for age-appropriate features
  color: string; // hex color for visual distinction
  avatar: ProfileAvatar;
  pinHash?: string; // Hashed PIN (bcrypt), null if no PIN set
  pinEnabled: boolean; // Whether PIN is enabled for this profile
  failedPinAttempts: number; // Counter for failed PIN attempts
  pinLockedUntil?: Date; // Temporary lockout timestamp
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean; // soft delete

  // Relations
  tasks: TaskAssignment[];
  rewardPoints: ProfileRewardPoints;
  settings: ProfileSettings;
}

interface ProfileAvatar {
  type: "initials" | "photo" | "emoji";
  value: string; // initials text, photo URL, or emoji
  backgroundColor?: string; // for initials
}

interface TaskAssignment {
  id: string;
  taskId: string; // Google Tasks ID
  profileId: string;
  assignedAt: Date;
  assignedBy: string; // Profile ID of assigner

  profile: Profile;
}

interface ProfileRewardPoints {
  id: string;
  profileId: string;
  totalPoints: number;
  currentStreak: number; // consecutive days with completed tasks
  longestStreak: number;
  lastActivityDate: Date;
  updatedAt: Date;

  profile: Profile;
  transactions: PointTransaction[];
}

interface PointTransaction {
  id: string;
  profileId: string;
  points: number;
  reason: "task_completed" | "bonus" | "manual" | "streak" | "goal";
  taskId?: string;
  taskTitle?: string;
  awardedBy?: string; // Profile ID if manually awarded
  note?: string; // reason for manual award
  createdAt: Date;

  profile: Profile;
}

interface ProfileSettings {
  id: string;
  profileId: string;

  // Task settings
  defaultTaskListId?: string;
  showCompletedTasks: boolean;
  taskSortOrder: "dueDate" | "priority" | "manual";

  // Display settings
  theme: "light" | "dark" | "auto";
  language: string;

  // Notification settings (future)
  enableNotifications: boolean;
  notificationTime?: string; // HH:MM format

  profile: Profile;
}

interface ProfileStats {
  profileId: string;
  totalPoints: number;
  currentStreak: number;
  tasksToday: number;
  tasksCompleted: number;
  tasksTotal: number;
  completionRate: number; // percentage
  rank: number; // position in family leaderboard
}
```

### 3. Database Schema Updates

```prisma
// Add to schema.prisma

enum ProfileType {
  admin
  standard
}

enum AgeGroup {
  adult
  teen
  child
}

model Profile {
  id                String      @id @default(cuid())
  userId            String      // Account owner
  name              String
  type              ProfileType @default(standard)
  ageGroup          AgeGroup    @default(adult)
  color             String      @default("#3b82f6") // Tailwind blue-600
  avatar            Json        // ProfileAvatar as JSON
  pinHash           String?     // Bcrypt hashed PIN (null if no PIN)
  pinEnabled        Boolean     @default(false)
  failedPinAttempts Int         @default(0)
  pinLockedUntil    DateTime?   // Temporary lockout timestamp
  isActive          Boolean     @default(true)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  user             User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  taskAssignments  TaskAssignment[]
  rewardPoints     ProfileRewardPoints?
  settings         ProfileSettings?
  pointsAwarded    PointTransaction[]    @relation("AwardedBy")
  pointsReceived   PointTransaction[]    @relation("ReceivedBy")

  @@index([userId, isActive])
}

model TaskAssignment {
  id         String   @id @default(cuid())
  taskId     String   // Google Tasks ID
  profileId  String
  assignedAt DateTime @default(now())
  assignedBy String   // Profile ID

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([taskId, profileId])
  @@index([profileId, taskId])
}

model ProfileRewardPoints {
  id               String   @id @default(cuid())
  profileId        String   @unique
  totalPoints      Int      @default(0)
  currentStreak    Int      @default(0)
  longestStreak    Int      @default(0)
  lastActivityDate DateTime @default(now())
  updatedAt        DateTime @updatedAt

  profile      Profile            @relation(fields: [profileId], references: [id], onDelete: Cascade)
  transactions PointTransaction[]
}

model PointTransaction {
  id        String   @id @default(cuid())
  profileId String
  points    Int
  reason    String   // task_completed, bonus, manual, streak, goal
  taskId    String?
  taskTitle String?
  awardedBy String?  // Profile ID if manually awarded (admin)
  note      String?  // reason for manual award
  createdAt DateTime @default(now())

  profile       Profile              @relation("ReceivedBy", fields: [profileId], references: [id], onDelete: Cascade)
  awardedByProfile Profile?          @relation("AwardedBy", fields: [awardedBy], references: [id])
  rewardPoints  ProfileRewardPoints @relation(fields: [profileId], references: [profileId], onDelete: Cascade)

  @@index([profileId, createdAt])
}

model ProfileSettings {
  id                  String  @id @default(cuid())
  profileId           String  @unique
  defaultTaskListId   String?
  showCompletedTasks  Boolean @default(false)
  taskSortOrder       String  @default("dueDate")
  theme               String  @default("light")
  language            String  @default("en")
  enableNotifications Boolean @default(false)
  notificationTime    String?

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)
}

// Update existing User model
model User {
  // ... existing fields ...
  profiles Profile[]

  // Add account-level settings
  maxProfiles Int @default(10)
  activeProfileId String? // Last active profile
}
```

### 4. Profile Context

```tsx
// src/components/profiles/profile-context.tsx
"use client";

import { logger } from "@/lib/logger";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";

export type ViewMode = "profile" | "family";

interface ProfileContextValue {
  activeProfile: Profile | null;
  allProfiles: Profile[];
  viewMode: ViewMode;
  setActiveProfile: (profileId: string) => Promise<void>;
  setViewMode: (mode: ViewMode) => void;
  refreshProfiles: () => Promise<void>;
  isAdmin: boolean;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [activeProfile, setActiveProfileState] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("profile");

  const refreshProfiles = async () => {
    try {
      const response = await fetch("/api/profiles");
      if (response.ok) {
        const profiles = await response.json();
        setAllProfiles(profiles);

        // Set active profile if not set
        if (!activeProfile && profiles.length > 0) {
          // Use last active or first admin profile
          const lastActive = profiles.find((p: Profile) => p.id === getStoredProfileId());
          const firstAdmin = profiles.find((p: Profile) => p.type === "admin");
          setActiveProfileState(lastActive || firstAdmin || profiles[0]);
        }
      }
    } catch (error) {
      logger.error(error as Error, {
        context: "RefreshProfilesFailed",
      });
    }
  };

  const setActiveProfile = async (profileId: string) => {
    const profile = allProfiles.find((p) => p.id === profileId);
    if (profile) {
      setActiveProfileState(profile);
      storeProfileId(profileId);

      logger.event("ProfileSwitched", {
        fromProfileId: activeProfile?.id,
        toProfileId: profileId,
      });
    }
  };

  // Initial load
  useEffect(() => {
    refreshProfiles();
  }, []);

  const isAdmin = activeProfile?.type === "admin";

  return (
    <ProfileContext.Provider
      value={{
        activeProfile,
        allProfiles,
        viewMode,
        setActiveProfile,
        setViewMode,
        refreshProfiles,
        isAdmin,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}

// Helper functions
function getStoredProfileId(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem("activeProfileId");
  }
  return null;
}

function storeProfileId(profileId: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("activeProfileId", profileId);
  }
}
```

### 5. Profile Switcher Component

```tsx
// src/components/profiles/profile-switcher.tsx
"use client";

import { useState } from "react";
import { ProfileAvatar } from "./profile-avatar";
import { useProfile } from "./profile-context";

export function ProfileSwitcher() {
  const { activeProfile, allProfiles, setActiveProfile, setViewMode, viewMode } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  if (!activeProfile) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-100"
      >
        <ProfileAvatar profile={activeProfile} size="sm" />
        <span className="font-medium text-gray-900">{activeProfile.name}</span>
        <svg
          className="h-4 w-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
          {allProfiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                setActiveProfile(profile.id);
                setViewMode("profile");
                setIsOpen(false);
              }}
              className={`flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50 ${
                profile.id === activeProfile.id ? "bg-blue-50" : ""
              }`}
            >
              <ProfileAvatar profile={profile} size="sm" />
              <span className="text-gray-900">{profile.name}</span>
              {profile.type === "admin" && (
                <span className="ml-auto text-xs text-gray-500">👑</span>
              )}
            </button>
          ))}

          <div className="my-2 border-t border-gray-200" />

          <button
            onClick={() => {
              setViewMode("family");
              setIsOpen(false);
            }}
            className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50"
          >
            <span className="text-xl">👨‍👩‍👧‍👦</span>
            <span className="text-gray-900">Family View</span>
          </button>

          <a href="/profiles" className="flex w-full items-center gap-3 px-4 py-2 hover:bg-gray-50">
            <span className="text-xl">⚙️</span>
            <span className="text-gray-900">Manage Profiles</span>
          </a>
        </div>
      )}
    </div>
  );
}
```

### 6. Profile Avatar Component

```tsx
// src/components/profiles/profile-avatar.tsx
"use client";

interface ProfileAvatarProps {
  profile: Profile;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

export function ProfileAvatar({ profile, size = "md", showName = false }: ProfileAvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-16 h-16 text-xl",
  };

  const avatar = profile.avatar as ProfileAvatar;

  const renderAvatar = () => {
    if (avatar.type === "photo") {
      return (
        <img
          src={avatar.value}
          alt={profile.name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      );
    }

    if (avatar.type === "emoji") {
      return (
        <div
          className={`${sizeClasses[size]} flex items-center justify-center rounded-full`}
          style={{ backgroundColor: profile.color }}
        >
          <span className="text-2xl">{avatar.value}</span>
        </div>
      );
    }

    // Default: initials
    return (
      <div
        className={`${sizeClasses[size]} flex items-center justify-center rounded-full font-semibold text-white`}
        style={{ backgroundColor: avatar.backgroundColor || profile.color }}
      >
        {avatar.value}
      </div>
    );
  };

  if (showName) {
    return (
      <div className="flex items-center gap-2">
        {renderAvatar()}
        <span className="font-medium text-gray-900">{profile.name}</span>
      </div>
    );
  }

  return renderAvatar();
}
```

### 7. Profile Card Component

```tsx
// src/components/profiles/profile-card.tsx
"use client";

import { useEffect, useState } from "react";
import { ProfileAvatar } from "./profile-avatar";
import { useProfile } from "./profile-context";

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  const { setActiveProfile, setViewMode } = useProfile();
  const [stats, setStats] = useState<ProfileStats | null>(null);

  useEffect(() => {
    fetch(`/api/profiles/${profile.id}/stats`)
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);
  }, [profile.id]);

  const handleClick = () => {
    setActiveProfile(profile.id);
    setViewMode("profile");
  };

  if (!stats) return null;

  return (
    <button
      onClick={handleClick}
      className="w-full rounded-lg border-2 border-transparent bg-white p-6 text-left shadow transition hover:border-blue-500 hover:shadow-lg"
    >
      <div className="flex flex-col items-center gap-3">
        <ProfileAvatar profile={profile} size="lg" />

        <div className="text-center">
          <h3 className="text-lg font-bold text-gray-900">{profile.name}</h3>
          {profile.type === "admin" && <span className="text-xs text-gray-500">Admin</span>}
        </div>

        <div className="w-full space-y-2">
          {/* Task completion */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Tasks</span>
            <span className="font-medium text-gray-900">
              {stats.tasksCompleted}/{stats.tasksTotal}
            </span>
          </div>

          {/* Progress bar */}
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${stats.completionRate}%`,
                backgroundColor: profile.color,
              }}
            />
          </div>

          {/* Points */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Points</span>
            <span className="font-medium text-gray-900">
              {stats.totalPoints.toLocaleString()}⭐
            </span>
          </div>

          {/* Streak */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Streak</span>
            <span className="font-medium text-gray-900">{stats.currentStreak}🔥</span>
          </div>
        </div>
      </div>
    </button>
  );
}
```

### 8. Profile Grid Component

```tsx
// src/components/profiles/profile-grid.tsx
"use client";

import { ProfileCard } from "./profile-card";
import { useProfile } from "./profile-context";

export function ProfileGrid() {
  const { allProfiles } = useProfile();

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
      {allProfiles.map((profile) => (
        <ProfileCard key={profile.id} profile={profile} />
      ))}
    </div>
  );
}
```

### 9. API Routes

```typescript
// src/app/api/profiles/route.ts
import { requireAuth, getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const profiles = await prisma.profile.findMany({
      where: {
        userId: user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    return NextResponse.json(profiles);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/profiles',
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { name, type, ageGroup, color, avatar } = await request.json();

    // Validate input
    if (!name || name.length < 1) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Check profile limit
    const existingCount = await prisma.profile.count({
      where: {
        userId: user.id,
        isActive: true,
      },
    });

    const userSettings = await prisma.user.findUnique({
      where: { id: user.id },
      select: { maxProfiles: true },
    });

    if (existingCount >= (userSettings?.maxProfiles || 10)) {
      return NextResponse.json(
        { error: 'Profile limit reached' },
        { status: 400 }
      );
    }

    // Create profile with reward points
    const profile = await prisma.profile.create({
      data: {
        userId: user.id,
        name,
        type: type || 'standard',
        ageGroup: ageGroup || 'adult',
        color: color || '#3b82f6',
        avatar: avatar || {
          type: 'initials',
          value: name.substring(0, 2).toUpperCase(),
          backgroundColor: color || '#3b82f6',
        },
        rewardPoints: {
          create: {
            totalPoints: 0,
          },
        },
        settings: {
          create: {
            showCompletedTasks: false,
            taskSortOrder: 'dueDate',
            theme: 'light',
            language: 'en',
          },
        },
      },
      include: {
        rewardPoints: true,
        settings: true,
      },
    });

    logger.event('ProfileCreated', {
      profileId: profile.id,
      userId: user.id,
      name: profile.name,
    });

    return NextResponse.json(profile, { status: 201 });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/profiles',
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to create profile' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const profile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
        settings: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(profile);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}`,
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { name, color, avatar, type, ageGroup } = await request.json();

    // Verify ownership
    const existingProfile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!existingProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Update profile
    const profile = await prisma.profile.update({
      where: { id: params.id },
      data: {
        ...(name && { name }),
        ...(color && { color }),
        ...(avatar && { avatar }),
        ...(type && { type }),
        ...(ageGroup && { ageGroup }),
      },
      include: {
        rewardPoints: true,
        settings: true,
      },
    });

    logger.event('ProfileUpdated', {
      profileId: profile.id,
      userId: user.id,
    });

    return NextResponse.json(profile);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}`,
      method: 'PATCH',
    });

    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    // Soft delete (set isActive = false)
    const profile = await prisma.profile.updateMany({
      where: {
        id: params.id,
        userId: user.id,
      },
      data: {
        isActive: false,
      },
    });

    if (profile.count === 0) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    logger.event('ProfileDeleted', {
      profileId: params.id,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}`,
      method: 'DELETE',
    });

    return NextResponse.json(
      { error: 'Failed to delete profile' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/stats/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    // Verify profile ownership
    const profile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
      include: {
        rewardPoints: true,
        taskAssignments: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Get task stats (would require Google Tasks API integration)
    // For now, return mock data structure
    const stats: ProfileStats = {
      profileId: profile.id,
      totalPoints: profile.rewardPoints?.totalPoints || 0,
      currentStreak: profile.rewardPoints?.currentStreak || 0,
      tasksToday: 0,  // TODO: Calculate from Google Tasks
      tasksCompleted: 0,  // TODO: Calculate from Google Tasks
      tasksTotal: profile.taskAssignments.length,
      completionRate: 0,  // TODO: Calculate
      rank: 1,  // TODO: Calculate from family leaderboard
    };

    return NextResponse.json(stats);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}/stats`,
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch profile stats' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/give-points/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { points, note, awardedByProfileId } = await request.json();

    if (!points || points <= 0) {
      return NextResponse.json(
        { error: 'Invalid points value' },
        { status: 400 }
      );
    }

    // Verify the awarding profile is an admin
    const awardingProfile = await prisma.profile.findFirst({
      where: {
        id: awardedByProfileId,
        userId: user.id,
        type: 'admin',
      },
    });

    if (!awardingProfile) {
      return NextResponse.json(
        { error: 'Unauthorized - admin access required' },
        { status: 403 }
      );
    }

    // Verify target profile exists
    const targetProfile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Award points in transaction
    const result = await prisma.$transaction(async (tx) => {
      const rewardPoints = await tx.profileRewardPoints.upsert({
        where: { profileId: params.id },
        update: {
          totalPoints: {
            increment: points,
          },
        },
        create: {
          profileId: params.id,
          totalPoints: points,
        },
      });

      await tx.pointTransaction.create({
        data: {
          profileId: params.id,
          points,
          reason: 'manual',
          awardedBy: awardedByProfileId,
          note,
        },
      });

      return rewardPoints;
    });

    logger.event('BonusPointsAwarded', {
      profileId: params.id,
      awardedBy: awardedByProfileId,
      points,
      newTotal: result.totalPoints,
    });

    return NextResponse.json({
      success: true,
      newTotal: result.totalPoints,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}/give-points`,
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to award points' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/set-pin/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { pin, currentPin } = await request.json();

    // Validate PIN format (4-6 digits)
    if (!pin || !/^\d{4,6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'PIN must be 4-6 digits' },
        { status: 400 }
      );
    }

    // Get profile
    const profile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // If profile already has a PIN, verify current PIN
    if (profile.pinEnabled && profile.pinHash) {
      if (!currentPin) {
        return NextResponse.json(
          { error: 'Current PIN required' },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(currentPin, profile.pinHash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Current PIN is incorrect' },
          { status: 401 }
        );
      }
    }

    // Hash new PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Update profile
    await prisma.profile.update({
      where: { id: params.id },
      data: {
        pinHash,
        pinEnabled: true,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    logger.event('ProfilePinSet', {
      userId: user.id,
      profileId: params.id,
      isUpdate: profile.pinEnabled,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}/set-pin`,
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to set PIN' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/verify-pin/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json(
        { error: 'PIN required' },
        { status: 400 }
      );
    }

    // Get profile
    const profile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Check if profile is locked
    if (profile.pinLockedUntil && profile.pinLockedUntil > new Date()) {
      const remainingSeconds = Math.ceil(
        (profile.pinLockedUntil.getTime() - Date.now()) / 1000
      );

      return NextResponse.json(
        {
          error: 'Profile locked due to too many failed attempts',
          lockedFor: remainingSeconds,
        },
        { status: 429 }
      );
    }

    // Check if PIN is set
    if (!profile.pinEnabled || !profile.pinHash) {
      return NextResponse.json({ success: true }); // No PIN required
    }

    // Verify PIN
    const isValid = await bcrypt.compare(pin, profile.pinHash);

    if (isValid) {
      // Reset failed attempts
      await prisma.profile.update({
        where: { id: params.id },
        data: {
          failedPinAttempts: 0,
          pinLockedUntil: null,
        },
      });

      logger.event('ProfilePinVerified', {
        userId: user.id,
        profileId: params.id,
      });

      return NextResponse.json({ success: true });
    } else {
      // Increment failed attempts
      const failedAttempts = profile.failedPinAttempts + 1;
      const lockout = failedAttempts >= 5;
      const pinLockedUntil = lockout
        ? new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
        : null;

      await prisma.profile.update({
        where: { id: params.id },
        data: {
          failedPinAttempts: failedAttempts,
          pinLockedUntil,
        },
      });

      logger.event('ProfilePinFailed', {
        userId: user.id,
        profileId: params.id,
        failedAttempts,
        locked: lockout,
      });

      return NextResponse.json(
        {
          error: 'Incorrect PIN',
          attemptsRemaining: Math.max(0, 5 - failedAttempts),
          locked: lockout,
        },
        { status: 401 }
      );
    }
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}/verify-pin`,
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to verify PIN' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/remove-pin/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { currentPin } = await request.json();

    // Get profile
    const profile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Admin profiles cannot remove PIN
    if (profile.type === 'admin') {
      return NextResponse.json(
        { error: 'Admin profiles must have a PIN' },
        { status: 403 }
      );
    }

    // Verify current PIN
    if (profile.pinEnabled && profile.pinHash) {
      if (!currentPin) {
        return NextResponse.json(
          { error: 'Current PIN required' },
          { status: 400 }
        );
      }

      const isValid = await bcrypt.compare(currentPin, profile.pinHash);
      if (!isValid) {
        return NextResponse.json(
          { error: 'Current PIN is incorrect' },
          { status: 401 }
        );
      }
    }

    // Remove PIN
    await prisma.profile.update({
      where: { id: params.id },
      data: {
        pinHash: null,
        pinEnabled: false,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    logger.event('ProfilePinRemoved', {
      userId: user.id,
      profileId: params.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}/remove-pin`,
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to remove PIN' },
      { status: 500 }
    );
  }
}

// src/app/api/profiles/[id]/reset-pin/route.ts
// Admin can reset PIN for standard profiles
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const { adminProfileId, adminPin, newPin } = await request.json();

    // Validate new PIN format (4-6 digits)
    if (!newPin || !/^\d{4,6}$/.test(newPin)) {
      return NextResponse.json(
        { error: 'New PIN must be 4-6 digits' },
        { status: 400 }
      );
    }

    // Verify admin profile
    const adminProfile = await prisma.profile.findFirst({
      where: {
        id: adminProfileId,
        userId: user.id,
        type: 'admin',
      },
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin profile not found' },
        { status: 404 }
      );
    }

    // Verify admin PIN
    if (!adminProfile.pinHash || !adminPin) {
      return NextResponse.json(
        { error: 'Admin PIN required' },
        { status: 400 }
      );
    }

    const isAdminPinValid = await bcrypt.compare(adminPin, adminProfile.pinHash);
    if (!isAdminPinValid) {
      return NextResponse.json(
        { error: 'Admin PIN is incorrect' },
        { status: 401 }
      );
    }

    // Get target profile
    const targetProfile = await prisma.profile.findFirst({
      where: {
        id: params.id,
        userId: user.id,
        isActive: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      );
    }

    // Cannot reset another admin's PIN
    if (targetProfile.type === 'admin' && targetProfile.id !== adminProfileId) {
      return NextResponse.json(
        { error: 'Cannot reset another admin\'s PIN' },
        { status: 403 }
      );
    }

    // Hash new PIN
    const pinHash = await bcrypt.hash(newPin, 10);

    // Update profile
    await prisma.profile.update({
      where: { id: params.id },
      data: {
        pinHash,
        pinEnabled: true,
        failedPinAttempts: 0,
        pinLockedUntil: null,
      },
    });

    logger.event('ProfilePinReset', {
      userId: user.id,
      profileId: params.id,
      resetBy: adminProfileId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/profiles/${params.id}/reset-pin`,
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to reset PIN' },
      { status: 500 }
    );
  }
}
```

### 10. Integration with Task System

```tsx
// Updated task-item.tsx with profile assignment
"use client";

import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { useProfile } from "@/components/profiles/profile-context";

interface TaskItemProps {
  task: TaskWithMeta;
  onToggle: () => Promise<void>;
  assignments: TaskAssignment[]; // profiles assigned to this task
}

export function TaskItem({ task, onToggle, assignments }: TaskItemProps) {
  const { viewMode, activeProfile } = useProfile();
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);

  // Filter: in profile view, only show tasks assigned to active profile
  // In family view, show all tasks
  const isVisibleInCurrentView = () => {
    if (viewMode === "family") return true;
    if (!activeProfile) return false;

    // Show if assigned to active profile or unassigned (family tasks)
    return assignments.length === 0 || assignments.some((a) => a.profileId === activeProfile.id);
  };

  if (!isVisibleInCurrentView()) return null;

  const assignedProfiles = assignments.map((a) => a.profile);

  return (
    <div className="p-4 transition hover:bg-gray-50">
      <div className="flex items-start gap-3">
        {/* Color indicator */}
        <div
          className="mt-1 h-3 w-3 flex-shrink-0 rounded-full"
          style={{ backgroundColor: task.listColor }}
        />

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.status === "completed"}
          onChange={onToggle}
          className="mt-1"
        />

        {/* Task content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span
              className={
                task.status === "completed" ? "text-gray-500 line-through" : "text-gray-900"
              }
            >
              {task.title}
            </span>

            {/* Show assigned profile avatars */}
            {assignedProfiles.length > 0 && (
              <div className="ml-auto flex items-center gap-1">
                {assignedProfiles.map((profile) => (
                  <ProfileAvatar key={profile.id} profile={profile} size="sm" />
                ))}
              </div>
            )}
          </div>

          {/* Points animation */}
          {showPointsAnimation && (
            <PointsAnimation
              points={10}
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

## Implementation Steps

### Phase 1: Database and API Foundation ✅

1. ✅ **Update database schema**
   - Add Profile, ProfileRewardPoints, ProfileSettings models
   - Add TaskAssignment, PointTransaction models
   - Update User model with profiles relation
   - Run migration: `pnpm prisma migrate dev --name add_profiles`

2. ✅ **Create API routes**
   - `/api/profiles` - GET all, POST create
   - `/api/profiles/[id]` - GET, PATCH, DELETE
   - `/api/profiles/[id]/stats` - GET stats
   - `/api/profiles/[id]/give-points` - POST admin award
   - Test with API client (Postman/Insomnia)

### Phase 2: Core Components ✅

3. ✅ **Build ProfileContext**
   - Implement context and provider
   - Add profile state management
   - Add view mode switching (profile/family)
   - Test context in isolation

4. ✅ **Create ProfileAvatar component**
   - Support initials, photo, emoji types
   - Size variants (sm, md, lg)
   - Color customization
   - Test different avatar types

5. ✅ **Build ProfileSwitcher**
   - Dropdown menu in header
   - Profile list with avatars
   - Family view option
   - Manage profiles link
   - Test switching and persistence

### Phase 3: Profile Management UI ✅

6. ✅ **Create ProfileCard component**
   - Display profile info and avatar
   - Show task stats and progress
   - Show points and streak
   - Click to switch profile
   - Test with mock data

7. ✅ **Build ProfileGrid**
   - Responsive grid layout
   - Multiple profile cards
   - Test on different screen sizes

8. ✅ **Create profile management page**
   - List all profiles
   - Create new profile form
   - Edit profile form
   - Delete profile (soft delete)
   - Admin badge indicator
   - Test CRUD operations

### Phase 4: Task Integration ⏳ (Blocked - requires Google Tasks)

9. ⏳ **Update TaskItem component**
   - Add profile assignment display
   - Show assigned profile avatars
   - Filter by active profile in profile view
   - Show all in family view
   - Test filtering

10. ⏳ **Integrate reward points**
    - Award points to specific profile
    - Update ProfileRewardPoints table
    - Create PointTransaction records
    - Test points per profile

11. ⏳ **Add profile filtering**
    - Filter tasks by profile
    - Toggle family/profile view
    - Update UI based on view mode
    - Test view switching

### Phase 5: Advanced Features ✅

12. ✅ **Build give points modal**
    - Admin-only modal
    - Select profile dropdown
    - Enter points amount
    - Optional reason/note
    - Test admin permissions

13. ✅ **Add profile stats calculation**
    - Calculate completion rate
    - Track streaks (consecutive days)
    - Rank profiles (leaderboard)
    - Test stats accuracy

14. ✅ **Profile settings**
    - Per-profile theme
    - Per-profile default task list
    - Per-profile preferences
    - Test settings isolation

### Phase 5.5: PIN Security ✅

15. ✅ **Add PIN management API routes**
    - `/api/profiles/[id]/set-pin` - Create/update PIN
    - `/api/profiles/[id]/verify-pin` - Verify PIN on profile switch
    - `/api/profiles/[id]/remove-pin` - Remove PIN (standard profiles only)
    - `/api/profiles/[id]/reset-pin` - Admin reset PIN
    - Install bcrypt: `pnpm add bcrypt && pnpm add -D @types/bcrypt`
    - Test PIN hashing and verification

16. ✅ **Build PIN entry modal**
    - Numeric keypad UI (0-9, backspace, submit)
    - PIN masking (show dots)
    - Failed attempt counter
    - Lockout timer display
    - "Forgot PIN?" link
    - Test modal UX

17. ✅ **Implement PIN verification flow**
    - Check if profile has PIN before switching
    - Show PIN modal if required
    - Verify PIN via API
    - Handle failed attempts and lockout
    - Test PIN verification

18. ✅ **Add PIN setup flow**
    - Require PIN during admin profile creation
    - Optional PIN for standard profiles
    - PIN confirmation step
    - PIN strength indicators
    - Test admin mandatory PIN requirement

19. ✅ **Add PIN management UI**
    - "Set PIN" button in profile settings
    - "Change PIN" flow (requires current PIN)
    - "Remove PIN" option (standard profiles only)
    - Admin PIN reset for child profiles
    - Show lock icon on profiles with PINs
    - Test all PIN management flows

20. ✅ **Add lockout handling**
    - Temporary 5-minute lockout after 5 failed attempts
    - Display remaining time
    - Reset attempts on successful verification
    - Test lockout behavior

### Phase 6: Multiple Admin Support ✅

21. ✅ **Update profile creation validation**
    - Allow multiple admin profiles
    - Validate first profile must be admin
    - Test creating multiple admins

22. ✅ **Update admin permission checks**
    - Check for admin type (not just single admin)
    - Test admin actions with multiple admins
    - Verify both admins can perform admin actions

### Phase 7: Polish and Testing ✅

23. ✅ **Add profile colors**
    - Color picker in profile form
    - Use profile color in UI
    - Test color contrast and accessibility

24. ⏳ **Implement streak tracking** (Blocked - requires Google Tasks)
    - Track daily task completions
    - Update currentStreak on completion
    - Reset on missed days
    - Test streak logic

25. ✅ **Add family leaderboard**
    - Sort profiles by points
    - Display rank on profile cards
    - Optional leaderboard page
    - Test ranking accuracy

26. ✅ **Accessibility and UX**
    - Keyboard navigation (tab through profiles, arrow keys in PIN pad)
    - Screen reader support (announce PIN entry, profile switches)
    - Loading states
    - Error handling
    - Test with assistive technologies

## Challenges and Considerations

### Challenge 1: Profile vs Account Confusion

- **Problem**: Users might confuse profiles with user accounts
- **Solution**:
  - Clear onboarding explaining one account = multiple profiles
  - Use terms like "family member" instead of "user"
  - Visual distinction (avatars vs account settings)

### Challenge 2: Task Assignment Logic

- **Problem**: Determining which tasks belong to which profile
- **Solution**:
  - Explicit assignment via UI
  - Unassigned tasks = family tasks (visible to all)
  - Filter tasks by profile in "My View"
  - Show all in "Family View"

### Challenge 3: Point Isolation

- **Problem**: Ensuring points don't mix between profiles
- **Solution**:
  - Separate ProfileRewardPoints table
  - Foreign key constraints
  - Database-level isolation
  - Transaction-based updates

### Challenge 4: Admin Permissions

- **Problem**: Preventing children from modifying other profiles
- **Solution**:
  - Profile types (admin vs standard)
  - Server-side permission checks
  - Hide admin UI for non-admins
  - Audit log for admin actions

### Challenge 5: Profile Limit

- **Problem**: Need to limit number of profiles per account
- **Solution**:
  - Configurable max (default 10)
  - Check limit before create
  - Display remaining slots
  - Soft delete for recovery

### Challenge 6: Google Calendar Integration

- **Problem**: Each profile might have their own Google Calendar
- **Solution**:
  - Phase 1: Share account owner's calendar
  - Phase 2: Allow profiles to connect own Google account
  - Filter events by profile (color/tag based)

### Challenge 7: PIN Security and Usability

- **Problem**: Balancing security (PIN required) with usability (not too annoying)
- **Solution**:
  - Admin profiles require PIN (mandatory for security)
  - Standard profiles have optional PIN
  - PIN timeout/grace period (don't require every switch)
  - Lockout protection prevents brute force
  - Face recognition as alternative to PIN entry
  - Clear "Forgot PIN?" recovery flow

### Challenge 8: Multiple Admin Coordination

- **Problem**: Two parents both admins, need to coordinate
- **Solution**:
  - Both admins have equal permissions
  - Either admin can reset child PINs
  - Activity log shows which admin made changes
  - No hierarchy among admins

## Testing Strategy

1. **Unit Tests**:
   - Profile CRUD operations
   - Point calculation logic
   - Streak tracking
   - Permission checks
   - Stats calculations
   - PIN hashing and verification (bcrypt)
   - Failed attempt counter logic
   - Lockout timer calculation

2. **Integration Tests**:
   - API routes (all endpoints)
   - Database transactions
   - Profile switching flow
   - Point awarding flow
   - PIN set/verify/remove/reset flows
   - Lockout mechanism
   - Multiple admin creation

3. **Component Tests**:
   - ProfileCard rendering
   - ProfileSwitcher dropdown
   - ProfileGrid layout
   - Avatar variants
   - Forms (create/edit)
   - PIN entry modal
   - PIN keypad interaction

4. **E2E Tests**:
   - Create profile flow (with mandatory PIN for admin)
   - Switch profiles and verify view
   - Switch to PIN-protected profile (PIN entry)
   - Assign task to profile
   - Complete task and earn points
   - Admin give bonus points
   - Delete profile
   - Set PIN flow (create, confirm)
   - Failed PIN attempts and lockout
   - Admin reset child PIN
   - Create second admin profile

5. **Manual Tests**:
   - Test with 5-10 profiles
   - Test on mobile devices (PIN keypad UX)
   - Test family scenarios (2 parents + kids)
   - Test permission boundaries (admin vs standard)
   - Test edge cases (0 profiles, max profiles)
   - Test PIN UX (easy to enter, not annoying)
   - Test with face recognition fallback

## Accessibility

- **Screen Reader Support**:
  - Proper ARIA labels on profile switcher
  - Announce profile changes
  - Label profile cards clearly

- **Keyboard Navigation**:
  - Tab through profile cards
  - Arrow keys in profile dropdown
  - Enter to select profile

- **Visual Accessibility**:
  - High contrast avatars
  - Color is not sole indicator
  - Text labels in addition to icons
  - Respect prefers-reduced-motion

- **Touch Accessibility**:
  - Large touch targets (44x44px minimum)
  - No hover-only features
  - Clear tap feedback

## Performance Considerations

- Use database indexes on userId, profileId
- Cache active profile in localStorage
- Lazy load profile stats (load on demand)
- Optimize avatar images (resize, compress)
- Pagination for point transaction history (future)
- Consider profile data in session to reduce DB queries

## Security Considerations

1. **Data Isolation**:
   - Verify userId matches on all profile operations
   - Never expose other users' profiles
   - Filter by userId in all queries

2. **Permission Enforcement**:
   - Server-side permission checks (don't trust client)
   - Validate admin status before destructive actions
   - Audit log for admin actions

3. **Input Validation**:
   - Validate profile name length
   - Sanitize profile data
   - Validate avatar URLs (if photo type)
   - Prevent XSS in profile names

4. **Privacy**:
   - Profile data stays within account
   - No public profile pages
   - Avatar photos stored securely
   - Option to delete profile permanently (future)

5. **PIN Security**:
   - PINs hashed with bcrypt (never stored in plain text)
   - Salt rounds: 10 (balances security and performance)
   - PINs are 4-6 digits (sufficient for family use)
   - Lockout after 5 failed attempts (prevents brute force)
   - Temporary 5-minute lockout (not permanent)
   - Admin profiles require PIN (mandatory, cannot be disabled)
   - Standard profiles have optional PIN
   - Admin can reset child PINs (with admin PIN verification)
   - Failed attempt counter stored in database (not client)
   - Lockout timer enforced server-side

6. **Multi-Admin Security**:
   - Multiple admins supported (both parents)
   - No hierarchy among admins (equal permissions)
   - Either admin can perform admin actions
   - Either admin can reset child PINs
   - Admin cannot reset another admin's PIN
   - Activity log shows which admin made changes

## Monitoring and Analytics

Track these metrics:

- Profiles per account (average, distribution)
- Profile type distribution (admin vs standard)
- Profile switching frequency
- Most active profile per account
- Points distribution across profiles
- Family view vs profile view usage
- PIN usage (how many profiles have PINs enabled)
- PIN verification success/failure rates
- Lockout frequency
- Admin count per account (single vs dual-admin households)

```typescript
logger.event("ProfileCreated", {
  profileId: profile.id,
  userId: user.id,
  type: profile.type,
  ageGroup: profile.ageGroup,
});

logger.event("ProfileSwitched", {
  fromProfileId: activeProfile?.id,
  toProfileId: profileId,
  userId: user.id,
});

logger.event("ViewModeChanged", {
  viewMode: mode, // 'profile' or 'family'
  userId: user.id,
});

logger.event("BonusPointsAwarded", {
  profileId: targetProfile.id,
  awardedBy: adminProfile.id,
  points: amount,
});

logger.event("ProfilePinSet", {
  userId: user.id,
  profileId: profile.id,
  isUpdate: boolean, // true if changing existing PIN
});

logger.event("ProfilePinVerified", {
  userId: user.id,
  profileId: profile.id,
});

logger.event("ProfilePinFailed", {
  userId: user.id,
  profileId: profile.id,
  failedAttempts: number,
  locked: boolean, // true if now locked
});

logger.event("ProfilePinReset", {
  userId: user.id,
  profileId: profile.id,
  resetBy: adminProfile.id,
});
```

## Dependencies

- Prisma (database ORM)
- React Context API
- Existing auth system (user accounts)
- bcrypt (PIN hashing) - `pnpm add bcrypt @types/bcrypt`

## Integration with Other Features

**Required Integration:**

- **Server-side Auth**: Profiles belong to authenticated users
- **Reward Points System**: Per-profile point tracking
- **Google Tasks**: Task assignment per profile

**Optional Integration:**

- **Calendar Component**: Filter events by profile
- **Settings Page**: Per-profile settings
- **Screen Rotation**: Different rotations per profile (future)
- **Meal Planner**: Assign meals to profiles (future)

## Future Enhancements

### Phase 2 Features

- **Profile Themes**: Custom color schemes per profile
- **Profile Photos**: Upload and crop photo avatars
- **Family Challenges**: Collaborative point goals
- **Profile Export**: Export profile data (tasks, points history)
- **Profile Groups**: Group profiles (kids, adults, etc.)

### Phase 3 Features

- **Multi-Calendar**: Each profile connects own Google Calendar
- **Profile Notifications**: Per-profile notification settings
- **Guest Profiles**: Temporary profiles for visitors
- **Profile Templates**: Preset profile types (Parent, Teen, Child)
- **Profile Insights**: Analytics per profile (completion trends, peak productivity times)

### Gamification Ideas

- **Family Leaderboard**: Competitive or collaborative
- **Profile Badges**: Achievements per profile
- **Profile Streaks**: Visualize streak in profile card
- **Family Goals**: Pool points for family rewards
- **Profile Levels**: XP and levels based on points

## Migration Plan

### For Existing Users (No Profiles)

1. On first profile feature access, show onboarding
2. Create default admin profile using user's name
3. Migrate existing reward points to profile
4. Assign all existing tasks to default profile
5. Prompt to create additional profiles

### For Multi-User Households

1. Create profile for each family member
2. Assign avatar and color
3. Set one adult as admin
4. Redistribute tasks if needed
5. Zero out points or keep existing (user choice)

## User Onboarding

### First-Time Setup

1. **Welcome Screen**: "Add your family members"
2. **Create First Profile**: User creates profile for themselves (auto-admin)
3. **Add Family**: Prompt to add additional profiles
4. **Assign Tasks**: Quick tutorial on assigning tasks
5. **Tour Complete**: Show family dashboard

### Quick Start Guide

- "Create a profile for each family member"
- "Assign tasks to specific people or leave unassigned for everyone"
- "Switch profiles to see personalized views"
- "Track points individually and compete (or collaborate!) as a family"

## Documentation

- User guide: "How to use profiles"
- FAQ: "What's the difference between profiles and accounts?"
- Video tutorial: "Setting up your family calendar"
- Help text: In-app tooltips and hints

---

This multi-profile feature transforms the calendar into a true family hub, enabling personalized experiences while maintaining simplicity for single users. It's the foundation for advanced family features like meal planning, chores, and collaborative scheduling.
