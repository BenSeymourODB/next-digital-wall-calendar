# Multi-Profile Family Support

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
- **Standard Profiles**: Can only edit own tasks (children)
- **Create/Delete Profiles**: Admin only
- **Edit Tasks**: Admins can edit any task, standard only their own
- **Give Points**: Admin only

#### 7. Profile Display
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
│   └── route.ts                 # GET/PATCH/DELETE profile
├── [id]/stats/
│   └── route.ts                 # GET profile stats
└── [id]/give-points/
    └── route.ts                 # POST admin give points
```

### 2. Data Models

```typescript
// Profile types
export type ProfileType = 'admin' | 'standard';
export type AgeGroup = 'adult' | 'teen' | 'child';

interface Profile {
  id: string;
  userId: string;         // Account owner (from auth)
  name: string;
  type: ProfileType;      // admin or standard
  ageGroup: AgeGroup;     // for age-appropriate features
  color: string;          // hex color for visual distinction
  avatar: ProfileAvatar;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;      // soft delete

  // Relations
  tasks: TaskAssignment[];
  rewardPoints: ProfileRewardPoints;
  settings: ProfileSettings;
}

interface ProfileAvatar {
  type: 'initials' | 'photo' | 'emoji';
  value: string;          // initials text, photo URL, or emoji
  backgroundColor?: string; // for initials
}

interface TaskAssignment {
  id: string;
  taskId: string;         // Google Tasks ID
  profileId: string;
  assignedAt: Date;
  assignedBy: string;     // Profile ID of assigner

  profile: Profile;
}

interface ProfileRewardPoints {
  id: string;
  profileId: string;
  totalPoints: number;
  currentStreak: number;  // consecutive days with completed tasks
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
  reason: 'task_completed' | 'bonus' | 'manual' | 'streak' | 'goal';
  taskId?: string;
  taskTitle?: string;
  awardedBy?: string;     // Profile ID if manually awarded
  note?: string;          // reason for manual award
  createdAt: Date;

  profile: Profile;
}

interface ProfileSettings {
  id: string;
  profileId: string;

  // Task settings
  defaultTaskListId?: string;
  showCompletedTasks: boolean;
  taskSortOrder: 'dueDate' | 'priority' | 'manual';

  // Display settings
  theme: 'light' | 'dark' | 'auto';
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
  completionRate: number;  // percentage
  rank: number;            // position in family leaderboard
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
  id        String      @id @default(cuid())
  userId    String      // Account owner
  name      String
  type      ProfileType @default(standard)
  ageGroup  AgeGroup    @default(adult)
  color     String      @default("#3b82f6") // Tailwind blue-600
  avatar    Json        // ProfileAvatar as JSON
  isActive  Boolean     @default(true)
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

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
'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { logger } from '@/lib/logger';

export type ViewMode = 'profile' | 'family';

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
  const [viewMode, setViewMode] = useState<ViewMode>('profile');

  const refreshProfiles = async () => {
    try {
      const response = await fetch('/api/profiles');
      if (response.ok) {
        const profiles = await response.json();
        setAllProfiles(profiles);

        // Set active profile if not set
        if (!activeProfile && profiles.length > 0) {
          // Use last active or first admin profile
          const lastActive = profiles.find((p: Profile) => p.id === getStoredProfileId());
          const firstAdmin = profiles.find((p: Profile) => p.type === 'admin');
          setActiveProfileState(lastActive || firstAdmin || profiles[0]);
        }
      }
    } catch (error) {
      logger.error(error as Error, {
        context: 'RefreshProfilesFailed',
      });
    }
  };

  const setActiveProfile = async (profileId: string) => {
    const profile = allProfiles.find((p) => p.id === profileId);
    if (profile) {
      setActiveProfileState(profile);
      storeProfileId(profileId);

      logger.event('ProfileSwitched', {
        fromProfileId: activeProfile?.id,
        toProfileId: profileId,
      });
    }
  };

  // Initial load
  useEffect(() => {
    refreshProfiles();
  }, []);

  const isAdmin = activeProfile?.type === 'admin';

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
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
}

// Helper functions
function getStoredProfileId(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('activeProfileId');
  }
  return null;
}

function storeProfileId(profileId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('activeProfileId', profileId);
  }
}
```

### 5. Profile Switcher Component

```tsx
// src/components/profiles/profile-switcher.tsx
'use client';

import { useProfile } from './profile-context';
import { ProfileAvatar } from './profile-avatar';
import { useState } from 'react';

export function ProfileSwitcher() {
  const { activeProfile, allProfiles, setActiveProfile, setViewMode, viewMode } = useProfile();
  const [isOpen, setIsOpen] = useState(false);

  if (!activeProfile) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100"
      >
        <ProfileAvatar profile={activeProfile} size="sm" />
        <span className="font-medium text-gray-900">{activeProfile.name}</span>
        <svg
          className="w-4 h-4 text-gray-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          {allProfiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => {
                setActiveProfile(profile.id);
                setViewMode('profile');
                setIsOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 ${
                profile.id === activeProfile.id ? 'bg-blue-50' : ''
              }`}
            >
              <ProfileAvatar profile={profile} size="sm" />
              <span className="text-gray-900">{profile.name}</span>
              {profile.type === 'admin' && (
                <span className="ml-auto text-xs text-gray-500">👑</span>
              )}
            </button>
          ))}

          <div className="border-t border-gray-200 my-2" />

          <button
            onClick={() => {
              setViewMode('family');
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
          >
            <span className="text-xl">👨‍👩‍👧‍👦</span>
            <span className="text-gray-900">Family View</span>
          </button>

          <a
            href="/profiles"
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50"
          >
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
'use client';

interface ProfileAvatarProps {
  profile: Profile;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

export function ProfileAvatar({ profile, size = 'md', showName = false }: ProfileAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-12 h-12 text-base',
    lg: 'w-16 h-16 text-xl',
  };

  const avatar = profile.avatar as ProfileAvatar;

  const renderAvatar = () => {
    if (avatar.type === 'photo') {
      return (
        <img
          src={avatar.value}
          alt={profile.name}
          className={`${sizeClasses[size]} rounded-full object-cover`}
        />
      );
    }

    if (avatar.type === 'emoji') {
      return (
        <div
          className={`${sizeClasses[size]} rounded-full flex items-center justify-center`}
          style={{ backgroundColor: profile.color }}
        >
          <span className="text-2xl">{avatar.value}</span>
        </div>
      );
    }

    // Default: initials
    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white`}
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
        <span className="text-gray-900 font-medium">{profile.name}</span>
      </div>
    );
  }

  return renderAvatar();
}
```

### 7. Profile Card Component

```tsx
// src/components/profiles/profile-card.tsx
'use client';

import { ProfileAvatar } from './profile-avatar';
import { useProfile } from './profile-context';
import { useEffect, useState } from 'react';

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
    setViewMode('profile');
  };

  if (!stats) return null;

  return (
    <button
      onClick={handleClick}
      className="bg-white rounded-lg p-6 shadow hover:shadow-lg transition border-2 border-transparent hover:border-blue-500 text-left w-full"
    >
      <div className="flex flex-col items-center gap-3">
        <ProfileAvatar profile={profile} size="lg" />

        <div className="text-center">
          <h3 className="font-bold text-gray-900 text-lg">{profile.name}</h3>
          {profile.type === 'admin' && (
            <span className="text-xs text-gray-500">Admin</span>
          )}
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
          <div className="w-full bg-gray-200 rounded-full h-2">
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
            <span className="font-medium text-gray-900">
              {stats.currentStreak}🔥
            </span>
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
'use client';

import { useProfile } from './profile-context';
import { ProfileCard } from './profile-card';

export function ProfileGrid() {
  const { allProfiles } = useProfile();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
```

### 10. Integration with Task System

```tsx
// Updated task-item.tsx with profile assignment
'use client';

import { useProfile } from '@/components/profiles/profile-context';
import { ProfileAvatar } from '@/components/profiles/profile-avatar';

interface TaskItemProps {
  task: TaskWithMeta;
  onToggle: () => Promise<void>;
  assignments: TaskAssignment[];  // profiles assigned to this task
}

export function TaskItem({ task, onToggle, assignments }: TaskItemProps) {
  const { viewMode, activeProfile } = useProfile();
  const [showPointsAnimation, setShowPointsAnimation] = useState(false);

  // Filter: in profile view, only show tasks assigned to active profile
  // In family view, show all tasks
  const isVisibleInCurrentView = () => {
    if (viewMode === 'family') return true;
    if (!activeProfile) return false;

    // Show if assigned to active profile or unassigned (family tasks)
    return (
      assignments.length === 0 ||
      assignments.some((a) => a.profileId === activeProfile.id)
    );
  };

  if (!isVisibleInCurrentView()) return null;

  const assignedProfiles = assignments.map((a) => a.profile);

  return (
    <div className="p-4 hover:bg-gray-50 transition">
      <div className="flex items-start gap-3">
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: task.listColor }}
        />

        {/* Checkbox */}
        <input
          type="checkbox"
          checked={task.status === 'completed'}
          onChange={onToggle}
          className="mt-1"
        />

        {/* Task content */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={task.status === 'completed' ? 'line-through text-gray-500' : 'text-gray-900'}>
              {task.title}
            </span>

            {/* Show assigned profile avatars */}
            {assignedProfiles.length > 0 && (
              <div className="flex items-center gap-1 ml-auto">
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

### Phase 1: Database and API Foundation

1. **Update database schema**
   - Add Profile, ProfileRewardPoints, ProfileSettings models
   - Add TaskAssignment, PointTransaction models
   - Update User model with profiles relation
   - Run migration: `pnpm prisma migrate dev --name add_profiles`

2. **Create API routes**
   - `/api/profiles` - GET all, POST create
   - `/api/profiles/[id]` - GET, PATCH, DELETE
   - `/api/profiles/[id]/stats` - GET stats
   - `/api/profiles/[id]/give-points` - POST admin award
   - Test with API client (Postman/Insomnia)

### Phase 2: Core Components

3. **Build ProfileContext**
   - Implement context and provider
   - Add profile state management
   - Add view mode switching (profile/family)
   - Test context in isolation

4. **Create ProfileAvatar component**
   - Support initials, photo, emoji types
   - Size variants (sm, md, lg)
   - Color customization
   - Test different avatar types

5. **Build ProfileSwitcher**
   - Dropdown menu in header
   - Profile list with avatars
   - Family view option
   - Manage profiles link
   - Test switching and persistence

### Phase 3: Profile Management UI

6. **Create ProfileCard component**
   - Display profile info and avatar
   - Show task stats and progress
   - Show points and streak
   - Click to switch profile
   - Test with mock data

7. **Build ProfileGrid**
   - Responsive grid layout
   - Multiple profile cards
   - Test on different screen sizes

8. **Create profile management page**
   - List all profiles
   - Create new profile form
   - Edit profile form
   - Delete profile (soft delete)
   - Admin badge indicator
   - Test CRUD operations

### Phase 4: Integration

9. **Update TaskItem component**
   - Add profile assignment display
   - Show assigned profile avatars
   - Filter by active profile in profile view
   - Show all in family view
   - Test filtering

10. **Integrate reward points**
    - Award points to specific profile
    - Update ProfileRewardPoints table
    - Create PointTransaction records
    - Test points per profile

11. **Add profile filtering**
    - Filter tasks by profile
    - Toggle family/profile view
    - Update UI based on view mode
    - Test view switching

### Phase 5: Advanced Features

12. **Build give points modal**
    - Admin-only modal
    - Select profile dropdown
    - Enter points amount
    - Optional reason/note
    - Test admin permissions

13. **Add profile stats calculation**
    - Calculate completion rate
    - Track streaks (consecutive days)
    - Rank profiles (leaderboard)
    - Test stats accuracy

14. **Profile settings**
    - Per-profile theme
    - Per-profile default task list
    - Per-profile preferences
    - Test settings isolation

### Phase 6: Polish and Testing

15. **Add profile colors**
    - Color picker in profile form
    - Use profile color in UI
    - Test color contrast and accessibility

16. **Implement streak tracking**
    - Track daily task completions
    - Update currentStreak on completion
    - Reset on missed days
    - Test streak logic

17. **Add family leaderboard**
    - Sort profiles by points
    - Display rank on profile cards
    - Optional leaderboard page
    - Test ranking accuracy

18. **Accessibility and UX**
    - Keyboard navigation
    - Screen reader support
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

## Testing Strategy

1. **Unit Tests**:
   - Profile CRUD operations
   - Point calculation logic
   - Streak tracking
   - Permission checks
   - Stats calculations

2. **Integration Tests**:
   - API routes (all endpoints)
   - Database transactions
   - Profile switching flow
   - Point awarding flow

3. **Component Tests**:
   - ProfileCard rendering
   - ProfileSwitcher dropdown
   - ProfileGrid layout
   - Avatar variants
   - Forms (create/edit)

4. **E2E Tests**:
   - Create profile flow
   - Switch profiles and verify view
   - Assign task to profile
   - Complete task and earn points
   - Admin give bonus points
   - Delete profile

5. **Manual Tests**:
   - Test with 5-10 profiles
   - Test on mobile devices
   - Test family scenarios (parent + kids)
   - Test permission boundaries
   - Test edge cases (0 profiles, max profiles)

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

## Monitoring and Analytics

Track these metrics:
- Profiles per account (average, distribution)
- Profile type distribution (admin vs standard)
- Profile switching frequency
- Most active profile per account
- Points distribution across profiles
- Family view vs profile view usage

```typescript
logger.event('ProfileCreated', {
  profileId: profile.id,
  userId: user.id,
  type: profile.type,
  ageGroup: profile.ageGroup,
});

logger.event('ProfileSwitched', {
  fromProfileId: activeProfile?.id,
  toProfileId: profileId,
  userId: user.id,
});

logger.event('ViewModeChanged', {
  viewMode: mode,  // 'profile' or 'family'
  userId: user.id,
});

logger.event('BonusPointsAwarded', {
  profileId: targetProfile.id,
  awardedBy: adminProfile.id,
  points: amount,
});
```

## Dependencies

- Prisma (database ORM)
- React Context API
- Existing auth system (user accounts)
- No additional packages required

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
