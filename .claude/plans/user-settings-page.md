# User Settings Page

## Overview
Create a comprehensive settings page for managing user accounts, preferences, and application configuration. Each account is tied to a Google account, with settings stored server-side in a database.

## Requirements

### Core Features

#### 1. Account Management
- **Current Account Display**:
  - User name
  - Email address
  - Profile picture (from Google)
  - Account creation date
  - Connected Google account info

- **Account Actions**:
  - Sign out
  - Delete account (with confirmation)
  - Reconnect Google account (re-authorize)

- **Multiple Accounts** (Future):
  - List all connected Google accounts
  - Switch between accounts
  - Add new account
  - Remove account

#### 2. User Preferences
- **Display Settings**:
  - Default theme (light/dark/auto)
  - Default zoom level for recipe display
  - Time format (12h/24h)
  - Date format

- **Reward System Settings**:
  - Enable/disable reward system
  - Default points per completed task
  - Display points on task completion

- **Task List Settings**:
  - Default task list view (single/multi)
  - Default sort order
  - Show/hide completed tasks by default

- **Screen Rotation Settings**:
  - Enable/disable automatic rotation
  - Default rotation interval
  - Pause duration on interaction

#### 3. Notification Preferences (Future)
- Email notifications
- Task reminders
- Calendar event reminders

#### 4. Privacy & Data
- View connected permissions/scopes
- Revoke specific permissions
- Export user data
- Delete all user data

### Visual Design

```
┌─────────────────────────────────────┐
│  Settings                           │
├─────────────────────────────────────┤
│                                     │
│  Account                            │
│  ┌─────────────────────────────┐   │
│  │  [Photo]  John Doe          │   │
│  │           john@example.com  │   │
│  │           Member since      │   │
│  │           Jan 2026          │   │
│  │                             │   │
│  │  [Sign Out] [Delete Account]│   │
│  └─────────────────────────────┘   │
│                                     │
│  Display                            │
│  ┌─────────────────────────────┐   │
│  │  Theme                      │   │
│  │  ○ Light  ● Auto  ○ Dark    │   │
│  │                             │   │
│  │  Time Format                │   │
│  │  ○ 12-hour  ● 24-hour       │   │
│  │                             │   │
│  │  Default Zoom: [====|===] │   │
│  │                      150%   │   │
│  └─────────────────────────────┘   │
│                                     │
│  Reward System                      │
│  ┌─────────────────────────────┐   │
│  │  ☑ Enable reward system     │   │
│  │                             │   │
│  │  Default points per task    │   │
│  │  [10        ]               │   │
│  │                             │   │
│  │  ☑ Show points on completion│   │
│  └─────────────────────────────┘   │
│                                     │
│  Privacy                            │
│  ┌─────────────────────────────┐   │
│  │  Connected Permissions:     │   │
│  │  • Calendar (read-only)     │   │
│  │  • Tasks (read/write)       │   │
│  │                             │   │
│  │  [Export My Data]           │   │
│  │  [Delete All Data]          │   │
│  └─────────────────────────────┘   │
│                                     │
│        [Cancel]  [Save Changes]     │
└─────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Page Structure

```
src/app/settings/
├── page.tsx                    # Main settings page
├── layout.tsx                  # Settings layout (if needed)
└── loading.tsx                 # Loading state

src/components/settings/
├── account-section.tsx         # Account management section
├── display-section.tsx         # Display preferences
├── reward-section.tsx          # Reward system settings
├── task-section.tsx            # Task list settings
├── rotation-section.tsx        # Screen rotation settings
├── privacy-section.tsx         # Privacy & data section
└── settings-section.tsx        # Reusable section wrapper

src/app/api/settings/
├── route.ts                    # GET/PUT user settings
└── delete-account/
    └── route.ts               # DELETE account
```

### 2. Data Models

```typescript
// Already defined in server-side-auth.md, but repeated here for clarity
interface UserSettings {
  id: string;
  userId: string;

  // Display
  theme: 'light' | 'dark' | 'auto';
  timeFormat: '12h' | '24h';
  dateFormat: string;
  defaultZoomLevel: number;

  // Reward System
  rewardSystemEnabled: boolean;
  defaultTaskPoints: number;
  showPointsOnCompletion: boolean;

  // Task Lists
  defaultTaskView: 'single' | 'multi';
  defaultTaskSort: 'dueDate' | 'created' | 'manual';
  showCompletedByDefault: boolean;

  // Screen Rotation
  rotationEnabled: boolean;
  rotationIntervalSeconds: number;
  pauseOnInteractionSeconds: number;
}

interface UserAccount {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ConnectedAccount {
  provider: string;
  providerAccountId: string;
  scope: string;
  createdAt: Date;
}
```

### 3. Settings Page Component

```tsx
// src/app/settings/page.tsx
import { requireAuth, getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/db';
import { SettingsForm } from '@/components/settings/settings-form';

export default async function SettingsPage() {
  // Require authentication
  await requireAuth();

  // Get current user and settings
  const user = await getCurrentUser();
  const userSettings = await prisma.userSettings.findUnique({
    where: { userId: user.id },
  });

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
  });

  // Create default settings if not exists
  if (!userSettings) {
    await prisma.userSettings.create({
      data: {
        userId: user.id,
        // Defaults are defined in schema
      },
    });
  }

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Settings</h1>

      <SettingsForm
        user={user}
        settings={userSettings || getDefaultSettings()}
        accounts={accounts}
      />
    </div>
  );
}

function getDefaultSettings(): UserSettings {
  return {
    id: '',
    userId: '',
    theme: 'auto',
    timeFormat: '12h',
    dateFormat: 'MM/DD/YYYY',
    defaultZoomLevel: 1.0,
    rewardSystemEnabled: false,
    defaultTaskPoints: 10,
    showPointsOnCompletion: true,
    defaultTaskView: 'single',
    defaultTaskSort: 'dueDate',
    showCompletedByDefault: false,
    rotationEnabled: false,
    rotationIntervalSeconds: 60,
    pauseOnInteractionSeconds: 120,
  };
}
```

### 4. Settings Form Component

```tsx
// src/components/settings/settings-form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AccountSection } from './account-section';
import { DisplaySection } from './display-section';
import { RewardSection } from './reward-section';
import { TaskSection } from './task-section';
import { RotationSection } from './rotation-section';
import { PrivacySection } from './privacy-section';
import { logger } from '@/lib/logger';

interface SettingsFormProps {
  user: UserAccount;
  settings: UserSettings;
  accounts: ConnectedAccount[];
}

export function SettingsForm({ user, settings, accounts }: SettingsFormProps) {
  const [formData, setFormData] = useState<UserSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save settings');
      }

      logger.event('SettingsSaved', {
        userId: user.id,
      });

      // Refresh the page to show updated settings
      router.refresh();

      // Show success message (could use a toast notification)
      alert('Settings saved successfully!');
    } catch (err) {
      logger.error(err as Error, {
        context: 'SaveSettingsFailed',
        userId: user.id,
      });
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.push('/dashboard');
  };

  return (
    <div className="space-y-8">
      <AccountSection user={user} accounts={accounts} />

      <DisplaySection
        settings={formData}
        onChange={(updates) => setFormData({ ...formData, ...updates })}
      />

      <RewardSection
        settings={formData}
        onChange={(updates) => setFormData({ ...formData, ...updates })}
      />

      <TaskSection
        settings={formData}
        onChange={(updates) => setFormData({ ...formData, ...updates })}
      />

      <RotationSection
        settings={formData}
        onChange={(updates) => setFormData({ ...formData, ...updates })}
      />

      <PrivacySection user={user} accounts={accounts} />

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-3 pt-6 border-t">
        <button
          onClick={handleCancel}
          className="px-6 py-2 text-gray-700 hover:bg-gray-100 rounded"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
```

### 5. Section Components

```tsx
// src/components/settings/account-section.tsx
'use client';

import { signOut } from 'next-auth/react';
import { useState } from 'react';
import { SettingsSection } from './settings-section';

interface AccountSectionProps {
  user: UserAccount;
  accounts: ConnectedAccount[];
}

export function AccountSection({ user, accounts }: AccountSectionProps) {
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/' });
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will delete all your data.'
    );

    if (!confirmed) return;

    setDeleting(true);

    try {
      const response = await fetch('/api/settings/delete-account', {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      // Sign out and redirect
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  return (
    <SettingsSection title="Account">
      <div className="flex items-start gap-4">
        {user.image && (
          <img
            src={user.image}
            alt={user.name || 'User'}
            className="w-16 h-16 rounded-full"
          />
        )}

        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {user.name || 'User'}
          </h3>
          <p className="text-gray-600">{user.email}</p>
          <p className="text-sm text-gray-500 mt-1">
            Member since {new Date(user.createdAt).toLocaleDateString()}
          </p>

          {accounts.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700">Connected accounts:</p>
              <ul className="text-sm text-gray-600">
                {accounts.map((account) => (
                  <li key={account.providerAccountId}>
                    {account.provider.charAt(0).toUpperCase() + account.provider.slice(1)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={handleSignOut}
          className="px-4 py-2 bg-gray-200 text-gray-900 hover:bg-gray-300 rounded"
        >
          Sign Out
        </button>
        <button
          onClick={handleDeleteAccount}
          disabled={deleting}
          className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {deleting ? 'Deleting...' : 'Delete Account'}
        </button>
      </div>
    </SettingsSection>
  );
}

// src/components/settings/display-section.tsx
interface DisplaySectionProps {
  settings: UserSettings;
  onChange: (updates: Partial<UserSettings>) => void;
}

export function DisplaySection({ settings, onChange }: DisplaySectionProps) {
  return (
    <SettingsSection title="Display">
      <div className="space-y-4">
        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Theme
          </label>
          <div className="flex gap-4">
            {(['light', 'auto', 'dark'] as const).map((theme) => (
              <label key={theme} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="theme"
                  value={theme}
                  checked={settings.theme === theme}
                  onChange={(e) => onChange({ theme: e.target.value as any })}
                />
                <span className="capitalize">{theme}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Time Format */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Time Format
          </label>
          <div className="flex gap-4">
            {(['12h', '24h'] as const).map((format) => (
              <label key={format} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="timeFormat"
                  value={format}
                  checked={settings.timeFormat === format}
                  onChange={(e) => onChange({ timeFormat: e.target.value as any })}
                />
                <span>{format === '12h' ? '12-hour' : '24-hour'}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Default Zoom */}
        <div>
          <label htmlFor="zoom" className="block text-sm font-medium text-gray-700 mb-2">
            Default Zoom Level: {Math.round(settings.defaultZoomLevel * 100)}%
          </label>
          <input
            id="zoom"
            type="range"
            min="0.75"
            max="3.0"
            step="0.25"
            value={settings.defaultZoomLevel}
            onChange={(e) => onChange({ defaultZoomLevel: parseFloat(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>
    </SettingsSection>
  );
}

// src/components/settings/reward-section.tsx
interface RewardSectionProps {
  settings: UserSettings;
  onChange: (updates: Partial<UserSettings>) => void;
}

export function RewardSection({ settings, onChange }: RewardSectionProps) {
  return (
    <SettingsSection title="Reward System">
      <div className="space-y-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={settings.rewardSystemEnabled}
            onChange={(e) => onChange({ rewardSystemEnabled: e.target.checked })}
          />
          <span>Enable reward system</span>
        </label>

        {settings.rewardSystemEnabled && (
          <>
            <div>
              <label htmlFor="points" className="block text-sm font-medium text-gray-700 mb-1">
                Default points per task
              </label>
              <input
                id="points"
                type="number"
                min="1"
                max="1000"
                value={settings.defaultTaskPoints}
                onChange={(e) => onChange({ defaultTaskPoints: parseInt(e.target.value) })}
                className="border border-gray-300 rounded px-3 py-2 w-32"
              />
            </div>

            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.showPointsOnCompletion}
                onChange={(e) => onChange({ showPointsOnCompletion: e.target.checked })}
              />
              <span>Show points when completing tasks</span>
            </label>
          </>
        )}
      </div>
    </SettingsSection>
  );
}

// Similar sections for Task, Rotation, Privacy...
```

### 6. API Routes

```typescript
// src/app/api/settings/route.ts
import { requireAuth, getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    return NextResponse.json(settings);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/settings',
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();
    const updates = await request.json();

    // Validate updates
    // ... validation logic ...

    const settings = await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: updates,
      create: {
        userId: user.id,
        ...updates,
      },
    });

    logger.event('SettingsUpdated', {
      userId: user.id,
      updatedFields: Object.keys(updates),
    });

    return NextResponse.json(settings);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/settings',
      method: 'PUT',
    });

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// src/app/api/settings/delete-account/route.ts
export async function DELETE() {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    // Delete user and all related data (cascades via Prisma schema)
    await prisma.user.delete({
      where: { id: user.id },
    });

    logger.event('AccountDeleted', {
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/settings/delete-account',
    });

    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
```

## Implementation Steps

1. **Create database migrations**
   - UserSettings table should already exist from server-side auth plan
   - Add any missing fields
   - Run migration

2. **Create settings page**
   - Basic page structure
   - Server-side data fetching
   - Loading states

3. **Build section components**
   - AccountSection
   - DisplaySection
   - RewardSection
   - TaskSection
   - RotationSection
   - PrivacySection

4. **Implement settings form**
   - State management
   - Form submission
   - Error handling
   - Success feedback

5. **Create API routes**
   - GET /api/settings
   - PUT /api/settings
   - DELETE /api/settings/delete-account

6. **Add validation**
   - Client-side validation
   - Server-side validation
   - Type safety

7. **Testing**
   - Test all settings updates
   - Test account deletion
   - Test sign out
   - Test error scenarios

8. **Polish**
   - Add loading indicators
   - Add success/error notifications
   - Improve accessibility
   - Responsive design

## Challenges and Considerations

### Challenge 1: Form State Management
- **Problem**: Many settings fields, complex state
- **Solution**: Use controlled components with single state object

### Challenge 2: Optimistic Updates
- **Problem**: Should UI update before server confirms?
- **Solution**: Wait for server confirmation, show loading state

### Challenge 3: Account Deletion
- **Problem**: Need to delete all user data safely
- **Solution**: Use Prisma cascade deletes, test thoroughly

### Challenge 4: Settings Validation
- **Problem**: Need to validate settings on client and server
- **Solution**: Create shared validation schema (Zod)

### Challenge 5: Theme Application
- **Problem**: How to apply theme setting immediately?
- **Solution**: Use CSS variables and update on change

## Testing Strategy

1. **Unit Tests**:
   - Settings validation
   - Form state management

2. **Integration Tests**:
   - API routes
   - Database operations
   - Cascade deletes

3. **E2E Tests**:
   - Update settings flow
   - Account deletion flow
   - Sign out flow

## Accessibility

- Proper form labels
- Keyboard navigation
- Focus indicators
- Screen reader support
- Error messages linked to inputs
- Confirmation dialogs for destructive actions

## Future Enhancements

- Import/export settings
- Settings presets (themes)
- Settings history (undo changes)
- Bulk settings update
- Settings sync across devices
- Advanced privacy controls

## Dependencies

- Prisma (database)
- NextAuth.js (authentication)
- React Hook Form (optional, for complex validation)
- Zod (optional, for validation schemas)

## Integration with Other Features

- All features read user settings
- Reward system uses reward settings
- Task lists use task settings
- Screen rotation uses rotation settings
- Recipe display uses zoom settings
