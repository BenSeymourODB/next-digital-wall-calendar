# Modular Sync Architecture - Privacy-First Data Storage

## Overview

A privacy-first architecture that uses PostgreSQL as the primary data store for events and tasks, with optional sync modules for Google Calendar and Google Tasks. This allows users to choose whether to sync with external services or keep all data completely local and self-hosted.

**Implementation Timeline**: This architecture will be implemented **after** Google Calendar and Tasks integration is working fully. Initial implementation will use Google services as the primary data source, then we'll migrate to this modular architecture.

## Requirements

### Core Principles

#### 1. Privacy First

- **Local by Default**: All data stored in self-hosted PostgreSQL database
- **Opt-in Sync**: Google Calendar and Tasks sync are optional modules
- **User Control**: Users decide what data leaves their network
- **No Vendor Lock-in**: Full functionality without any external services

#### 2. Data Sovereignty

- **PostgreSQL as Source of Truth**: All events and tasks stored locally first
- **Sync as Enhancement**: External services are additional features, not requirements
- **Offline First**: Full functionality without internet connection
- **Data Portability**: Easy export of all user data

#### 3. Modular Design

- **Pluggable Sync Modules**: Enable/disable sync providers independently
- **Future Extensibility**: Easy to add new providers (Outlook, iCloud, CalDAV)
- **Graceful Degradation**: App works fully with all modules disabled
- **Per-Profile Configuration**: Each family member can choose their sync preferences

### Functional Requirements

#### 1. Core Data Storage (Always Enabled)

- **Events**: Stored in `events` table in PostgreSQL
- **Tasks**: Stored in `tasks` table in PostgreSQL
- **Full CRUD**: Create, read, update, delete without external dependencies
- **Rich Metadata**: All fields supported by app (color, attachments, reminders)
- **Multi-Profile**: Isolated data per family member profile

#### 2. Google Calendar Sync Module (Optional)

- **Two-Way Sync**: Bidirectional synchronization with Google Calendar
- **Conflict Resolution**: Last-write-wins with user override option
- **Sync Schedule**: Configurable (default: every 5 minutes when enabled)
- **Selective Sync**: Choose which calendars to sync
- **Sync Status**: Clear UI showing last sync time and status
- **Offline Queue**: Queue changes when offline, sync when reconnected

#### 3. Google Tasks Sync Module (Optional)

- **Two-Way Sync**: Bidirectional synchronization with Google Tasks
- **Conflict Resolution**: Last-write-wins with user override option
- **Sync Schedule**: Configurable (default: on change, with 30s debounce)
- **Selective Sync**: Choose which task lists to sync
- **Sync Status**: Clear UI showing last sync time and status
- **Offline Queue**: Queue changes when offline, sync when reconnected

#### 4. Module Configuration

- **Per-User Settings**: Each profile controls their own sync modules
- **Enable/Disable**: Toggle sync modules on/off at any time
- **Initial Setup Wizard**: Guide users through optional sync configuration
- **Migration Tools**: Export from Google, import to local database
- **Health Monitoring**: Alert on sync failures or conflicts

## Technical Implementation

### 1. Database Schema

#### Core Tables (Always Present)

```prisma
// Events table - Primary source of truth
model Event {
  id              String    @id @default(cuid())
  profileId       String
  title           String
  description     String?
  startTime       DateTime
  endTime         DateTime
  allDay          Boolean   @default(false)
  location        String?
  color           String?
  reminders       Json?     // Array of reminder objects
  recurrence      Json?     // Recurrence rules (RRULE format)
  attachments     Json?     // Array of attachment objects

  // Metadata
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdBy       String    // Profile ID
  lastModifiedBy  String    // Profile ID

  // Sync metadata
  syncStatus      Json?     // Per-provider sync status

  // Relations
  profile         Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  syncRecords     EventSyncRecord[]

  @@index([profileId, startTime])
  @@index([profileId, updatedAt])
}

// Tasks table - Primary source of truth
model Task {
  id              String    @id @default(cuid())
  profileId       String
  title           String
  description     String?
  dueDate         DateTime?
  completed       Boolean   @default(false)
  completedAt     DateTime?
  priority        Int       @default(0) // 0-4 (0=none, 1=low, 2=medium, 3=high, 4=urgent)
  listId          String?   // Optional task list grouping
  parentTaskId    String?   // For subtasks
  position        Int       @default(0) // Order within list
  tags            String[]

  // Metadata
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  createdBy       String    // Profile ID
  lastModifiedBy  String    // Profile ID

  // Sync metadata
  syncStatus      Json?     // Per-provider sync status

  // Relations
  profile         Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)
  parentTask      Task?     @relation("TaskSubtasks", fields: [parentTaskId], references: [id])
  subtasks        Task[]    @relation("TaskSubtasks")
  syncRecords     TaskSyncRecord[]

  @@index([profileId, dueDate])
  @@index([profileId, completed])
  @@index([profileId, listId])
}
```

#### Sync Tracking Tables

```prisma
// Track sync state for each event per provider
model EventSyncRecord {
  id              String    @id @default(cuid())
  eventId         String
  provider        String    // 'google', 'outlook', 'caldav', etc.
  externalId      String    // ID in external system
  externalETag    String?   // For conflict detection
  lastSyncedAt    DateTime  @default(now())
  syncDirection   String    // 'push', 'pull', 'bidirectional'
  syncStatus      String    // 'synced', 'pending', 'conflict', 'error'
  errorMessage    String?

  event           Event     @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, provider])
  @@index([provider, lastSyncedAt])
}

// Track sync state for each task per provider
model TaskSyncRecord {
  id              String    @id @default(cuid())
  taskId          String
  provider        String    // 'google', 'outlook', etc.
  externalId      String    // ID in external system
  externalETag    String?   // For conflict detection
  lastSyncedAt    DateTime  @default(now())
  syncDirection   String    // 'push', 'pull', 'bidirectional'
  syncStatus      String    // 'synced', 'pending', 'conflict', 'error'
  errorMessage    String?

  task            Task      @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([taskId, provider])
  @@index([provider, lastSyncedAt])
}

// Sync module configuration per profile
model SyncModuleConfig {
  id              String    @id @default(cuid())
  profileId       String
  provider        String    // 'google-calendar', 'google-tasks', etc.
  enabled         Boolean   @default(false)
  config          Json      // Provider-specific config (sync interval, selected calendars, etc.)
  lastSyncAt      DateTime?
  lastSyncStatus  String?   // 'success', 'error', 'in_progress'
  lastSyncError   String?

  profile         Profile   @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@unique([profileId, provider])
}
```

### 2. Sync Module Interface

All sync modules implement a common interface for consistency:

```typescript
// src/lib/sync/types.ts

export interface SyncModule {
  readonly provider: string; // 'google-calendar', 'google-tasks', etc.
  readonly displayName: string;
  readonly description: string;
  readonly icon: string; // Icon component name or URL

  // Check if module is configured for user
  isConfigured(profileId: string): Promise<boolean>;

  // Enable module for user (may require OAuth)
  enable(profileId: string): Promise<{ success: boolean; authUrl?: string }>;

  // Disable module for user
  disable(profileId: string): Promise<void>;

  // Get module configuration
  getConfig(profileId: string): Promise<SyncModuleConfig | null>;

  // Update module configuration
  updateConfig(profileId: string, config: Partial<SyncModuleConfig>): Promise<void>;

  // Perform sync operation
  sync(profileId: string, options?: SyncOptions): Promise<SyncResult>;

  // Get sync status
  getSyncStatus(profileId: string): Promise<SyncStatus>;

  // Resolve conflicts manually
  resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void>;
}

export interface SyncOptions {
  direction?: "push" | "pull" | "bidirectional";
  force?: boolean; // Force sync even if recently synced
  itemIds?: string[]; // Sync specific items only
}

export interface SyncResult {
  success: boolean;
  itemsSynced: number;
  itemsCreated: number;
  itemsUpdated: number;
  itemsDeleted: number;
  conflicts: SyncConflict[];
  errors: SyncError[];
  duration: number; // milliseconds
}

export interface SyncStatus {
  enabled: boolean;
  lastSyncAt: Date | null;
  lastSyncStatus: "success" | "error" | "in_progress" | "never";
  lastSyncError: string | null;
  pendingChanges: number;
  conflicts: number;
}

export interface SyncConflict {
  id: string;
  itemType: "event" | "task";
  localId: string;
  externalId: string;
  localVersion: any;
  externalVersion: any;
  detectedAt: Date;
}

export interface ConflictResolution {
  strategy: "use-local" | "use-external" | "merge";
  mergedData?: any; // For manual merge
}

export interface SyncError {
  itemId: string;
  itemType: "event" | "task";
  errorCode: string;
  errorMessage: string;
  retryable: boolean;
}
```

### 3. Sync Module Registry

```typescript
// src/lib/sync/registry.ts
import { GoogleCalendarSync } from "./providers/google-calendar";
import { GoogleTasksSync } from "./providers/google-tasks";
import { SyncModule } from "./types";

class SyncModuleRegistry {
  private modules = new Map<string, SyncModule>();

  constructor() {
    // Register available modules
    this.register(new GoogleCalendarSync());
    this.register(new GoogleTasksSync());
    // Future: this.register(new OutlookCalendarSync());
    // Future: this.register(new CalDAVSync());
  }

  register(module: SyncModule): void {
    this.modules.set(module.provider, module);
  }

  get(provider: string): SyncModule | undefined {
    return this.modules.get(provider);
  }

  getAll(): SyncModule[] {
    return Array.from(this.modules.values());
  }

  async getEnabled(profileId: string): Promise<SyncModule[]> {
    const enabled: SyncModule[] = [];
    for (const module of this.modules.values()) {
      if (await module.isConfigured(profileId)) {
        enabled.push(module);
      }
    }
    return enabled;
  }
}

export const syncRegistry = new SyncModuleRegistry();
```

### 4. Google Calendar Sync Module Implementation

```typescript
// src/lib/sync/providers/google-calendar.ts
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import { SyncModule, SyncOptions, SyncResult, SyncStatus } from "../types";

export class GoogleCalendarSync implements SyncModule {
  readonly provider = "google-calendar";
  readonly displayName = "Google Calendar";
  readonly description = "Sync events with Google Calendar";
  readonly icon = "GoogleCalendarIcon";

  async isConfigured(profileId: string): Promise<boolean> {
    const config = await prisma.syncModuleConfig.findUnique({
      where: { profileId_provider: { profileId, provider: this.provider } },
    });
    return config?.enabled ?? false;
  }

  async enable(profileId: string): Promise<{ success: boolean; authUrl?: string }> {
    // Check if user has Google OAuth tokens
    const session = await getServerSession();
    if (!session?.user?.googleTokens) {
      // Return OAuth URL for user to authorize
      const authUrl = await this.getOAuthUrl(profileId);
      return { success: false, authUrl };
    }

    // Create or update config
    await prisma.syncModuleConfig.upsert({
      where: { profileId_provider: { profileId, provider: this.provider } },
      create: {
        profileId,
        provider: this.provider,
        enabled: true,
        config: { syncInterval: 300000, calendars: ["primary"] }, // 5 min default
      },
      update: { enabled: true },
    });

    // Perform initial sync
    await this.sync(profileId, { direction: "pull" });

    return { success: true };
  }

  async disable(profileId: string): Promise<void> {
    await prisma.syncModuleConfig.update({
      where: { profileId_provider: { profileId, provider: this.provider } },
      data: { enabled: false },
    });
  }

  async sync(profileId: string, options: SyncOptions = {}): Promise<SyncResult> {
    const startTime = Date.now();
    const direction = options.direction ?? "bidirectional";

    const result: SyncResult = {
      success: true,
      itemsSynced: 0,
      itemsCreated: 0,
      itemsUpdated: 0,
      itemsDeleted: 0,
      conflicts: [],
      errors: [],
      duration: 0,
    };

    try {
      // Get OAuth client for this profile
      const oauth2Client = await this.getOAuthClient(profileId);
      const calendar = google.calendar({ version: "v3", auth: oauth2Client });

      if (direction === "pull" || direction === "bidirectional") {
        // Pull events from Google Calendar
        const pullResult = await this.pullEvents(profileId, calendar);
        result.itemsCreated += pullResult.created;
        result.itemsUpdated += pullResult.updated;
        result.itemsDeleted += pullResult.deleted;
        result.conflicts.push(...pullResult.conflicts);
      }

      if (direction === "push" || direction === "bidirectional") {
        // Push local events to Google Calendar
        const pushResult = await this.pushEvents(profileId, calendar);
        result.itemsSynced += pushResult.synced;
        result.errors.push(...pushResult.errors);
      }

      // Update last sync time
      await prisma.syncModuleConfig.update({
        where: { profileId_provider: { profileId, provider: this.provider } },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: "success",
        },
      });
    } catch (error) {
      result.success = false;
      result.errors.push({
        itemId: "sync",
        itemType: "event",
        errorCode: "SYNC_FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
        retryable: true,
      });

      // Update error status
      await prisma.syncModuleConfig.update({
        where: { profileId_provider: { profileId, provider: this.provider } },
        data: {
          lastSyncStatus: "error",
          lastSyncError: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }

    result.duration = Date.now() - startTime;
    return result;
  }

  async getSyncStatus(profileId: string): Promise<SyncStatus> {
    const config = await prisma.syncModuleConfig.findUnique({
      where: { profileId_provider: { profileId, provider: this.provider } },
    });

    if (!config) {
      return {
        enabled: false,
        lastSyncAt: null,
        lastSyncStatus: "never",
        lastSyncError: null,
        pendingChanges: 0,
        conflicts: 0,
      };
    }

    // Count pending changes and conflicts
    const pendingChanges = await prisma.eventSyncRecord.count({
      where: {
        provider: this.provider,
        syncStatus: "pending",
        event: { profileId },
      },
    });

    const conflicts = await prisma.eventSyncRecord.count({
      where: {
        provider: this.provider,
        syncStatus: "conflict",
        event: { profileId },
      },
    });

    return {
      enabled: config.enabled,
      lastSyncAt: config.lastSyncAt,
      lastSyncStatus: (config.lastSyncStatus as any) ?? "never",
      lastSyncError: config.lastSyncError,
      pendingChanges,
      conflicts,
    };
  }

  async resolveConflict(conflictId: string, resolution: ConflictResolution): Promise<void> {
    // Implementation for manual conflict resolution
    // ... (detailed implementation omitted for brevity)
  }

  // Private helper methods
  private async getOAuthClient(profileId: string) {
    // Get OAuth2 client with tokens from database
    // ... (implementation details)
  }

  private async getOAuthUrl(profileId: string): Promise<string> {
    // Generate OAuth URL for authorization
    // ... (implementation details)
  }

  private async pullEvents(profileId: string, calendar: any) {
    // Pull events from Google Calendar
    // ... (implementation details)
  }

  private async pushEvents(profileId: string, calendar: any) {
    // Push local events to Google Calendar
    // ... (implementation details)
  }
}
```

### 5. Sync Service (Orchestration)

```typescript
// src/lib/sync/service.ts
import { logger } from "@/lib/logger";
import { syncRegistry } from "./registry";

class SyncService {
  /**
   * Sync all enabled modules for a profile
   */
  async syncAll(profileId: string): Promise<void> {
    const enabled = await syncRegistry.getEnabled(profileId);

    logger.event("SyncAll_Started", { profileId, moduleCount: enabled.length });

    // Sync modules in parallel
    const results = await Promise.allSettled(enabled.map((module) => module.sync(profileId)));

    // Log results
    results.forEach((result, index) => {
      const module = enabled[index];
      if (result.status === "fulfilled") {
        logger.event("SyncModule_Success", {
          profileId,
          provider: module.provider,
          ...result.value,
        });
      } else {
        logger.error(result.reason, {
          profileId,
          provider: module.provider,
        });
      }
    });
  }

  /**
   * Sync a specific module for a profile
   */
  async syncModule(profileId: string, provider: string): Promise<void> {
    const module = syncRegistry.get(provider);
    if (!module) {
      throw new Error(`Unknown sync provider: ${provider}`);
    }

    if (!(await module.isConfigured(profileId))) {
      throw new Error(`Module ${provider} is not configured for profile ${profileId}`);
    }

    await module.sync(profileId);
  }

  /**
   * Enable auto-sync for a profile (periodic background sync)
   */
  async enableAutoSync(profileId: string): Promise<void> {
    // Set up periodic sync job (using cron or similar)
    // This would integrate with a job queue system
    logger.event("AutoSync_Enabled", { profileId });
  }

  /**
   * Disable auto-sync for a profile
   */
  async disableAutoSync(profileId: string): Promise<void> {
    // Cancel periodic sync job
    logger.event("AutoSync_Disabled", { profileId });
  }
}

export const syncService = new SyncService();
```

### 6. API Routes

```typescript
// src/app/api/sync/modules/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { syncRegistry } from '@/lib/sync/registry';
import { getServerSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profileId = request.nextUrl.searchParams.get('profileId');
  if (!profileId) {
    return NextResponse.json({ error: 'Profile ID required' }, { status: 400 });
  }

  // Get all available modules with their status
  const modules = await Promise.all(
    syncRegistry.getAll().map(async (module) => ({
      provider: module.provider,
      displayName: module.displayName,
      description: module.description,
      icon: module.icon,
      configured: await module.isConfigured(profileId),
      status: await module.getSyncStatus(profileId)
    }))
  );

  return NextResponse.json({ modules });
}

// src/app/api/sync/modules/[provider]/enable/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: { provider: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { profileId } = await request.json();
  const module = syncRegistry.get(params.provider);

  if (!module) {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  const result = await module.enable(profileId);
  return NextResponse.json(result);
}

// src/app/api/sync/modules/[provider]/disable/route.ts
// ... (similar structure)

// src/app/api/sync/[profileId]/route.ts
// POST - Trigger manual sync for profile
export async function POST(
  request: NextRequest,
  { params }: { params: { profileId: string } }
) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { provider } = await request.json();

  if (provider) {
    // Sync specific module
    await syncService.syncModule(params.profileId, provider);
  } else {
    // Sync all enabled modules
    await syncService.syncAll(params.profileId);
  }

  return NextResponse.json({ success: true });
}
```

### 7. UI Components

```typescript
// src/components/settings/SyncModulesSettings.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface SyncModule {
  provider: string;
  displayName: string;
  description: string;
  icon: string;
  configured: boolean;
  status: {
    enabled: boolean;
    lastSyncAt: string | null;
    lastSyncStatus: string;
    lastSyncError: string | null;
    pendingChanges: number;
    conflicts: number;
  };
}

export function SyncModulesSettings({ profileId }: { profileId: string }) {
  const [modules, setModules] = useState<SyncModule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModules();
  }, [profileId]);

  async function loadModules() {
    const response = await fetch(`/api/sync/modules?profileId=${profileId}`);
    const data = await response.json();
    setModules(data.modules);
    setLoading(false);
  }

  async function toggleModule(provider: string, enable: boolean) {
    const endpoint = enable ? 'enable' : 'disable';
    const response = await fetch(`/api/sync/modules/${provider}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profileId })
    });

    const result = await response.json();

    if (!result.success && result.authUrl) {
      // Redirect to OAuth authorization
      window.location.href = result.authUrl;
      return;
    }

    // Reload modules to show updated status
    await loadModules();
  }

  async function syncNow(provider: string) {
    await fetch(`/api/sync/${profileId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider })
    });

    // Reload status
    await loadModules();
  }

  if (loading) {
    return <div>Loading sync modules...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Sync Settings</h2>
        <p className="text-gray-600 mt-2">
          Choose which external services to sync with. All your data is stored locally first.
          Sync modules are optional enhancements for connecting to your existing accounts.
        </p>
      </div>

      {modules.map((module) => (
        <Card key={module.provider} className="p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  {module.displayName}
                </h3>
                {module.status.enabled && (
                  <Badge variant={module.status.lastSyncStatus === 'success' ? 'success' : 'destructive'}>
                    {module.status.lastSyncStatus}
                  </Badge>
                )}
              </div>
              <p className="text-gray-600 mt-1">{module.description}</p>

              {module.status.enabled && module.status.lastSyncAt && (
                <p className="text-sm text-gray-500 mt-2">
                  Last synced: {new Date(module.status.lastSyncAt).toLocaleString()}
                </p>
              )}

              {module.status.lastSyncError && (
                <p className="text-sm text-red-600 mt-2">
                  Error: {module.status.lastSyncError}
                </p>
              )}

              {module.status.conflicts > 0 && (
                <p className="text-sm text-yellow-600 mt-2">
                  {module.status.conflicts} conflict{module.status.conflicts !== 1 ? 's' : ''} need resolution
                </p>
              )}
            </div>

            <div className="flex items-center gap-3 ml-4">
              {module.status.enabled && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncNow(module.provider)}
                >
                  Sync Now
                </Button>
              )}
              <Switch
                checked={module.status.enabled}
                onCheckedChange={(checked) => toggleModule(module.provider, checked)}
              />
            </div>
          </div>
        </Card>
      ))}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900">Privacy Note</h4>
        <p className="text-sm text-blue-800 mt-1">
          All your events and tasks are stored in your self-hosted database. Sync modules only copy data
          to external services when you enable them. You can disable sync at any time without losing data.
        </p>
      </div>
    </div>
  );
}
```

## Migration Strategy

### Phase 1: Current Implementation (Now - Q1)

- **Google as Primary**: Use Google Calendar and Tasks as primary data source
- **Client-Side Caching**: IndexedDB for offline access and performance
- **No Local Database**: Events and tasks only in Google services and client cache

**Why**: Get core functionality working quickly, validate UX and features.

### Phase 2: Database Setup (Q2)

- **Add PostgreSQL**: Set up database with Prisma
- **Dual Write**: Write to both Google and PostgreSQL
- **PostgreSQL as Backup**: Google still primary, database is backup

**Why**: Gradual migration, no breaking changes, users don't notice.

### Phase 3: Migrate to Local Primary (Q3)

- **PostgreSQL as Primary**: All reads/writes go to local database first
- **Automatic Sync**: Enable Google sync for all users by default
- **Migration Tool**: One-time import of all Google data to PostgreSQL

**Why**: Shift to privacy-first architecture while maintaining Google integration.

### Phase 4: Make Sync Optional (Q4)

- **Modular Architecture**: Implement sync modules as described above
- **Opt-In Sync**: Users can disable Google sync if desired
- **Full Offline**: All features work without external services

**Why**: Complete privacy-first implementation, user choice.

### Phase 5: Additional Providers (Future)

- **More Modules**: Outlook Calendar, iCloud, CalDAV/CardDAV
- **Import Tools**: Import from various calendar formats (ICS, CSV)
- **Export Tools**: Export to various formats for portability

**Why**: No vendor lock-in, maximum flexibility.

## Testing Strategy

### Unit Tests

```typescript
// Test sync module interface
describe("GoogleCalendarSync", () => {
  it("should enable module for profile", async () => {
    const module = new GoogleCalendarSync();
    const result = await module.enable("profile-123");
    expect(result.success).toBe(true);
  });

  it("should sync events bidirectionally", async () => {
    const module = new GoogleCalendarSync();
    const result = await module.sync("profile-123", { direction: "bidirectional" });
    expect(result.success).toBe(true);
    expect(result.itemsSynced).toBeGreaterThan(0);
  });

  it("should detect conflicts", async () => {
    // Create conflicting changes in local DB and Google
    // ...
    const result = await module.sync("profile-123");
    expect(result.conflicts.length).toBeGreaterThan(0);
  });
});
```

### Integration Tests

```typescript
// Test full sync flow
describe("Sync Service", () => {
  it("should sync all enabled modules", async () => {
    await syncService.syncAll("profile-123");
    // Verify all modules were called
  });

  it("should handle module failures gracefully", async () => {
    // Mock one module to fail
    await syncService.syncAll("profile-123");
    // Verify other modules still synced
  });
});
```

### E2E Tests

```typescript
// Test user flow
test("user can enable Google Calendar sync", async ({ page }) => {
  await page.goto("/settings/sync");
  await page.click('[data-testid="google-calendar-toggle"]');

  // Should redirect to Google OAuth
  await expect(page).toHaveURL(/accounts\.google\.com/);

  // After OAuth, should be enabled
  await page.goto("/settings/sync");
  await expect(page.locator('[data-testid="google-calendar-toggle"]')).toBeChecked();
});

test("events sync between local and Google", async ({ page }) => {
  // Create event in local calendar
  await page.goto("/calendar");
  await page.click('[data-testid="new-event-button"]');
  await page.fill('[data-testid="event-title"]', "Test Event");
  await page.click('[data-testid="save-event"]');

  // Trigger sync
  await page.goto("/settings/sync");
  await page.click('[data-testid="google-calendar-sync-now"]');

  // Wait for sync to complete
  await expect(page.locator('[data-testid="sync-status"]')).toHaveText("success");

  // Verify event exists in Google Calendar (via API check)
  // ... (implementation)
});
```

## Security Considerations

### 1. OAuth Token Storage

- **Encrypted at Rest**: Encrypt refresh tokens in database
- **Secure Transmission**: HTTPS only
- **Token Rotation**: Refresh tokens regularly
- **Revocation**: Support immediate token revocation

### 2. Data Access Control

- **Profile Isolation**: Users can only sync their own profile data
- **Admin Override**: Family admins can manage sync for children's profiles
- **Audit Logging**: Log all sync operations for security review

### 3. Sync Integrity

- **Checksums**: Verify data integrity during sync
- **Conflict Detection**: Use ETags/timestamps to detect conflicts
- **Rollback**: Ability to rollback failed syncs
- **Backup Before Sync**: Create backup before major sync operations

## User Documentation

### Setup Guide

**"Getting Started with Calendar Sync"**

1. **Your Data is Local**: All events and tasks are stored on your calendar server by default.
2. **Optional Google Sync**: Want to sync with Google Calendar? It's optional!
3. **How to Enable**:
   - Go to Settings → Sync
   - Toggle on "Google Calendar"
   - Sign in with Google
   - Choose which calendars to sync
4. **How it Works**: Changes you make appear on both your local calendar and Google Calendar.
5. **Turning it Off**: Toggle off anytime. Your local data stays safe.

### Privacy FAQ

**Q: Where is my calendar data stored?**
A: All your events and tasks are stored in your self-hosted PostgreSQL database. You have complete control.

**Q: Do I need a Google account?**
A: No! The calendar works fully without any Google account. Google sync is optional.

**Q: What happens if I disable Google sync?**
A: Your local data is unaffected. Events on Google Calendar stop syncing, but your local events remain.

**Q: Can I export my data?**
A: Yes! You can export all events and tasks to standard formats (ICS, CSV) anytime.

**Q: Is my data encrypted?**
A: Yes. Data is encrypted in transit (HTTPS) and at rest (database encryption).

## Future Enhancements

### Additional Sync Providers

1. **Microsoft Outlook Calendar** - Support Microsoft 365 and Outlook.com
2. **Apple iCloud Calendar** - Support iCloud calendars
3. **CalDAV/CardDAV** - Support any CalDAV-compatible calendar server
4. **Nextcloud** - Direct integration with Nextcloud calendar
5. **Office 365 Tasks** - Sync with Microsoft To Do

### Advanced Features

1. **Selective Sync** - Choose specific calendars or task lists to sync
2. **Sync Scheduling** - Custom sync intervals per module
3. **Bandwidth Management** - Sync only over WiFi option
4. **Conflict Resolution UI** - Visual diff tool for resolving conflicts
5. **Sync History** - View detailed sync history and changes
6. **Sync Statistics** - Dashboard showing sync health and metrics

### Import/Export Tools

1. **Google Takeout Import** - Import from Google Takeout archive
2. **ICS Import** - Bulk import from ICS files
3. **CSV Import** - Import from spreadsheets
4. **Recurring Export** - Scheduled automatic backups
5. **Cross-Platform Export** - Export in various formats for portability

## Success Metrics

1. **Adoption Rate**: % of users with at least one sync module enabled
2. **Sync Reliability**: % of successful syncs without errors
3. **Conflict Rate**: % of syncs with conflicts (target: <1%)
4. **Performance**: Average sync duration (target: <5 seconds)
5. **User Satisfaction**: Survey ratings for sync feature
6. **Privacy Preference**: % of users choosing local-only (no sync)

## Conclusion

This modular sync architecture provides:

✅ **Privacy First**: All data stored locally by default
✅ **User Choice**: Optional sync with external services
✅ **No Lock-in**: Full functionality without any vendor dependencies
✅ **Extensibility**: Easy to add new sync providers
✅ **Reliability**: Graceful degradation, offline-first design
✅ **Transparency**: Clear UI showing sync status and control

The phased implementation ensures we deliver value quickly while building toward a privacy-respecting, user-controlled system.
