# Face Recognition Profile Switching

## Overview

Implement privacy-conscious face recognition for quick profile switching using Frigate NVR. When users press the Profile Quick Switcher button, the webcam activates briefly to detect and recognize faces, enabling seamless profile switching without typing or searching. This feature is **completely optional** and camera-on-demand (not always-on) to address privacy concerns common among tech-savvy users.

This positions the app as a customizable, privacy-first alternative to Skylight that integrates with existing smart home infrastructure (Frigate NVR), appealing to users who already run home automation systems.

## Requirements

### Core Features

#### 1. Privacy-First Design

- **Opt-In Only**: Disabled by default, requires explicit setup
- **On-Demand Camera**: Camera only activates when user triggers it
- **Trigger Button**: Camera activates ONLY when Profile Quick Switcher is pressed
- **Visual Indicator**: Clear on-screen indicator when camera is active
- **Auto-Timeout**: Camera deactivates after 10 seconds if no action taken
- **Local Processing**: Face detection happens on Frigate (local network), not cloud
- **No Always-On**: Camera never runs continuously in background

#### 2. Face Recognition Flow

1. User presses **Profile Quick Switcher** button
2. Camera activates with visual indicator (camera icon)
3. Frigate NVR detects and recognizes faces in frame
4. Three scenarios:
   - **Single recognized face**: Auto-switch to that profile (after 1-2 second confirmation)
   - **Multiple faces**: Show prompt with recognized profiles + "Family Mode" option
   - **No recognized faces**: Show manual profile switcher (existing dropdown)
5. Camera deactivates after profile switch or timeout

#### 3. Face Enrollment

- **Admin-Only**: Only admin profiles can enroll faces
- **Multi-Photo Training**: Capture 5-10 photos from different angles
- **Privacy Consent**: Clear explanation of how face data is used
- **Stored in Frigate**: Face embeddings stored in Frigate NVR, not in app database
- **Delete Anytime**: Users can remove face data from profile settings

#### 4. Recognition Quality Handling

- **Low Resolution Support**: Work with 480p or 720p webcams
- **Low FPS Support**: Work with 10-15 FPS webcams
- **Confidence Threshold**: Only switch if confidence > 85%
- **Debouncing**: Don't immediately switch if active user temporarily not recognized
- **Grace Period**: Keep current profile for 5 seconds if recognition lost
- **Lighting Tolerance**: Handle varying lighting conditions

#### 5. Multi-Face Handling

- **All Recognized Faces**: Show prompt with all detected profile names
- **Quick Select**: Tap name or use keyboard (1, 2, 3, etc.)
- **Family Mode Option**: Always include "Family Mode" button
- **Unknown Faces**: Show "Unknown" + option to identify or ignore
- **Auto-Select**: If only one known face for 2+ seconds, auto-switch

#### 6. Settings and Configuration

- **Enable/Disable**: Toggle face recognition on/off
- **Frigate Integration**: Configure Frigate NVR endpoint and credentials
- **Camera Selection**: Choose which camera/stream to use
- **Confidence Tuning**: Adjust recognition confidence threshold (advanced)
- **Debounce Duration**: Configure grace period (advanced)
- **Auto-Switch Toggle**: Enable/disable automatic switching for single face

### Visual Design

#### Profile Switcher with Camera Trigger

```
┌─────────────────────────────────────────────────────┐
│  📅 Calendar    [👤 Ben 🎥]    🏆 1,250 pts        │
│                   ↑                                 │
│         Camera icon indicates                       │
│         face recognition available                  │
│                                                     │
│  When clicked:                                      │
│  ┌──────────────────────────────────────────────┐ │
│  │  👤 Switch Profile           [🎥 Active] [×] │ │
│  │  ──────────────────────────────────────────  │ │
│  │                                               │ │
│  │  📸 Looking for faces...                      │ │
│  │                                               │ │
│  │  [████████████████░░░░] Scanning (8s left)   │ │
│  │                                               │ │
│  │  Or select manually:                          │ │
│  │  ┌────────────────────────────────────────┐  │ │
│  │  │  👤 Ben                                 │  │ │
│  │  │  👧 Evelyn                              │  │ │
│  │  │  👦 Liv                                 │  │ │
│  │  └────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

#### Single Face Recognized

```
┌─────────────────────────────────────┐
│  👤 Switch Profile      [🎥] [×]    │
│  ──────────────────────────────────│
│                                     │
│  ✅ Face Recognized!                │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  👧 Evelyn                  │   │
│  │                             │   │
│  │  Switching in 2 seconds...  │   │
│  │                             │   │
│  │  [████████░░] Auto-switching│   │
│  │                             │   │
│  │  [Switch Now] [Cancel]      │   │
│  └─────────────────────────────┘   │
│                                     │
│  Or select different profile below  │
└─────────────────────────────────────┘
```

#### Multiple Faces Recognized

```
┌─────────────────────────────────────┐
│  👤 Switch Profile      [🎥] [×]    │
│  ──────────────────────────────────│
│                                     │
│  👀 Multiple people detected!       │
│  Who is using the calendar?         │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  👤 Ben                      │   │
│  │  (Press 1)                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  👧 Evelyn                   │   │
│  │  (Press 2)                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  👨‍👩‍👧‍👦 Family Mode           │   │
│  │  (Press 3)                   │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

#### Face Enrollment Flow

```
┌─────────────────────────────────────┐
│  Enroll Face for Evelyn             │
│  ──────────────────────────────────│
│                                     │
│  📸 Step 1 of 5: Look at camera     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │    [Camera Feed Here]       │   │
│  │                             │   │
│  │    ┌─────────────────┐      │   │
│  │    │   Face Outline  │      │   │
│  │    │   (Align here)  │      │   │
│  │    └─────────────────┘      │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  Instructions:                      │
│  • Look straight at the camera      │
│  • Ensure good lighting             │
│  • Align face within outline        │
│                                     │
│  [Skip]              [Capture (C)]  │
│                                     │
│  Progress: [██░░░░░░░░] 1/5 photos  │
└─────────────────────────────────────┘
```

#### Settings - Face Recognition

```
┌─────────────────────────────────────┐
│  Settings > Face Recognition        │
│  ──────────────────────────────────│
│                                     │
│  ⚙️ General                         │
│  ┌─────────────────────────────┐   │
│  │ Enable Face Recognition     │   │
│  │ [Toggle: ON]                │   │
│  └─────────────────────────────┘   │
│                                     │
│  📹 Frigate NVR Configuration       │
│  ┌─────────────────────────────┐   │
│  │ Frigate URL:                │   │
│  │ http://192.168.1.100:5000   │   │
│  │                             │   │
│  │ API Key: ****************   │   │
│  │                             │   │
│  │ Camera Name: front_door     │   │
│  │                             │   │
│  │ [Test Connection]           │   │
│  │ ✅ Connected successfully    │   │
│  └─────────────────────────────┘   │
│                                     │
│  👤 Enrolled Faces                  │
│  ┌─────────────────────────────┐   │
│  │ Ben                         │   │
│  │ Enrolled: Jan 10, 2026      │   │
│  │ [Re-enroll] [Delete]        │   │
│  └─────────────────────────────┘   │
│  ┌─────────────────────────────┐   │
│  │ Evelyn                      │   │
│  │ Enrolled: Jan 10, 2026      │   │
│  │ [Re-enroll] [Delete]        │   │
│  └─────────────────────────────┘   │
│                                     │
│  🎯 Advanced Settings               │
│  ┌─────────────────────────────┐   │
│  │ Recognition Confidence: 85% │   │
│  │ [█████████████░░] 85        │   │
│  │                             │   │
│  │ Auto-Switch Delay: 2s       │   │
│  │ [████████░░] 2              │   │
│  │                             │   │
│  │ Camera Timeout: 10s         │   │
│  │ [██████████████░░] 10       │   │
│  │                             │   │
│  │ Grace Period: 5s            │   │
│  │ [██████████░░] 5            │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

## Technical Implementation Plan

### 1. Frigate NVR Integration Overview

Frigate is an open-source NVR with built-in object detection and facial recognition capabilities. It runs locally (often on a Raspberry Pi or dedicated server) and provides:

- Real-time object detection (people, cars, etc.)
- Face recognition via CompreFace integration
- MQTT events for detections
- HTTP API for camera snapshots and events
- WebRTC/RTSP streams

**Why Frigate:**

- Already used by smart home enthusiasts (target audience)
- Local processing (privacy-first)
- Free and open-source
- Active community and good documentation

### 2. Architecture Overview

```
User Interface
     ↓
Profile Switcher Button (Click)
     ↓
Activate Camera + Start Recognition Session
     ↓
Your API (/api/face-recognition/session)
     ↓
Frigate NVR API
     ↓
CompreFace (Face Recognition Engine)
     ↓
Return Recognized Faces
     ↓
Display Prompt (Single/Multiple/None)
     ↓
User Selects Profile (or Auto-Select)
     ↓
Switch Profile
```

### 3. Data Models

```typescript
// Face recognition types
export type RecognitionStatus = "idle" | "active" | "recognized" | "timeout";

interface FaceRecognitionSettings {
  id: string;
  userId: string;
  enabled: boolean;
  frigateUrl: string; // e.g., http://192.168.1.100:5000
  frigateApiKey: string; // Encrypted
  cameraName: string; // Which Frigate camera to use
  confidenceThreshold: number; // 0-100, default 85
  autoSwitchDelay: number; // Seconds before auto-switch (default 2)
  cameraTimeout: number; // Seconds before camera deactivates (default 10)
  gracePeriod: number; // Seconds to wait before switching away (default 5)
  autoSwitchEnabled: boolean; // Auto-switch for single face (default true)
  createdAt: Date;
  updatedAt: Date;

  user: User;
}

interface ProfileFaceData {
  id: string;
  profileId: string;
  frigatePersonId: string; // ID in Frigate/CompreFace
  enrolledAt: Date;
  photoCount: number; // How many photos used for training
  lastRecognizedAt?: Date;
  isActive: boolean;

  profile: Profile;
}

interface RecognitionSession {
  id: string;
  userId: string;
  startedAt: Date;
  endedAt?: Date;
  status: RecognitionStatus;
  detectedFaces: DetectedFace[];
  selectedProfileId?: string;
  source: "manual" | "auto"; // Manual selection vs auto-switch

  user: User;
}

interface DetectedFace {
  frigatePersonId: string;
  profileId?: string; // Null if unknown
  confidence: number; // 0-100
  detectedAt: Date;
}

interface RecognitionResult {
  status: "single" | "multiple" | "none";
  faces: Array<{
    profileId?: string;
    profile?: Profile;
    confidence: number;
  }>;
}
```

### 4. Database Schema

```prisma
// Add to schema.prisma

model FaceRecognitionSettings {
  id                  String   @id @default(cuid())
  userId              String   @unique
  enabled             Boolean  @default(false)
  frigateUrl          String
  frigateApiKey       String   // Encrypted
  cameraName          String
  confidenceThreshold Int      @default(85)
  autoSwitchDelay     Int      @default(2)
  cameraTimeout       Int      @default(10)
  gracePeriod         Int      @default(5)
  autoSwitchEnabled   Boolean  @default(true)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ProfileFaceData {
  id               String    @id @default(cuid())
  profileId        String    @unique
  frigatePersonId  String    // ID in Frigate/CompreFace
  enrolledAt       DateTime  @default(now())
  photoCount       Int       @default(0)
  lastRecognizedAt DateTime?
  isActive         Boolean   @default(true)

  profile Profile @relation(fields: [profileId], references: [id], onDelete: Cascade)

  @@index([frigatePersonId])
}

model RecognitionSession {
  id                String   @id @default(cuid())
  userId            String
  startedAt         DateTime @default(now())
  endedAt           DateTime?
  status            String   // idle, active, recognized, timeout
  detectedFaces     Json     // Array of DetectedFace
  selectedProfileId String?
  source            String   // manual, auto

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, startedAt])
}

// Update Profile model to include face data
model Profile {
  // ... existing fields ...
  faceData ProfileFaceData?
}
```

### 5. Frigate Integration Service

```typescript
// src/lib/frigate/client.ts
import { logger } from "@/lib/logger";

export interface FrigateConfig {
  url: string;
  apiKey: string;
  cameraName: string;
}

export interface FrigateDetection {
  id: string;
  label: string; // "person"
  confidence: number;
  box: [number, number, number, number]; // x1, y1, x2, y2
  region: [number, number, number, number];
  attributes: {
    face?: {
      id: string; // Person ID from CompreFace
      name?: string; // Name if recognized
      confidence: number;
    };
  };
}

export class FrigateClient {
  private config: FrigateConfig;

  constructor(config: FrigateConfig) {
    this.config = config;
  }

  /**
   * Test connection to Frigate NVR
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/api/stats`, {
        headers: {
          "X-Frigate-API-Key": this.config.apiKey,
        },
      });

      return response.ok;
    } catch (error) {
      logger.error(error as Error, {
        context: "FrigateConnectionTest",
      });
      return false;
    }
  }

  /**
   * Get latest snapshot from camera
   */
  async getSnapshot(): Promise<Blob | null> {
    try {
      const response = await fetch(`${this.config.url}/api/${this.config.cameraName}/latest.jpg`, {
        headers: {
          "X-Frigate-API-Key": this.config.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`Frigate snapshot error: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      logger.error(error as Error, {
        context: "FrigateGetSnapshot",
      });
      return null;
    }
  }

  /**
   * Get current detections from camera
   */
  async getDetections(): Promise<FrigateDetection[]> {
    try {
      const response = await fetch(
        `${this.config.url}/api/events?camera=${this.config.cameraName}&limit=10`,
        {
          headers: {
            "X-Frigate-API-Key": this.config.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Frigate detections error: ${response.statusText}`);
      }

      const events = await response.json();

      // Filter to only person detections with faces
      return events
        .filter((e: any) => e.label === "person" && e.data?.face)
        .map((e: any) => ({
          id: e.id,
          label: e.label,
          confidence: e.data.score,
          box: e.data.box,
          region: e.data.region,
          attributes: {
            face: e.data.face,
          },
        }));
    } catch (error) {
      logger.error(error as Error, {
        context: "FrigateGetDetections",
      });
      return [];
    }
  }

  /**
   * Recognize faces in current camera frame
   */
  async recognizeFaces(): Promise<Array<{ personId: string; name?: string; confidence: number }>> {
    const detections = await this.getDetections();

    return detections
      .filter((d) => d.attributes.face)
      .map((d) => ({
        personId: d.attributes.face!.id,
        name: d.attributes.face!.name,
        confidence: d.attributes.face!.confidence,
      }));
  }

  /**
   * Enroll a new face for a person
   */
  async enrollFace(personId: string, name: string, imageBlob: Blob): Promise<boolean> {
    try {
      const formData = new FormData();
      formData.append("file", imageBlob);

      // CompreFace API (integrated with Frigate)
      const response = await fetch(
        `${this.config.url}/api/compreface/api/v1/recognition/faces?subject=${name}`,
        {
          method: "POST",
          headers: {
            "X-Frigate-API-Key": this.config.apiKey,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`Face enrollment error: ${response.statusText}`);
      }

      logger.event("FaceEnrolled", {
        personId,
        name,
      });

      return true;
    } catch (error) {
      logger.error(error as Error, {
        context: "FrigateEnrollFace",
        personId,
      });
      return false;
    }
  }

  /**
   * Delete face data for a person
   */
  async deleteFace(name: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.config.url}/api/compreface/api/v1/recognition/faces?subject=${name}`,
        {
          method: "DELETE",
          headers: {
            "X-Frigate-API-Key": this.config.apiKey,
          },
        }
      );

      return response.ok;
    } catch (error) {
      logger.error(error as Error, {
        context: "FrigateDeleteFace",
      });
      return false;
    }
  }
}
```

### 6. Face Recognition Session Manager

```typescript
// src/lib/face-recognition/session-manager.ts
import { prisma } from "@/lib/db";
import { FrigateClient } from "@/lib/frigate/client";
import { logger } from "@/lib/logger";

export class RecognitionSessionManager {
  private sessionId: string;
  private userId: string;
  private frigateClient: FrigateClient;
  private settings: FaceRecognitionSettings;
  private recognitionInterval?: NodeJS.Timeout;
  private lastRecognizedProfiles: Set<string> = new Set();
  private recognitionStartTime: number = 0;

  constructor(
    sessionId: string,
    userId: string,
    frigateClient: FrigateClient,
    settings: FaceRecognitionSettings
  ) {
    this.sessionId = sessionId;
    this.userId = userId;
    this.frigateClient = frigateClient;
    this.settings = settings;
  }

  /**
   * Start recognition session
   */
  async start(): Promise<void> {
    this.recognitionStartTime = Date.now();

    // Update session status
    await prisma.recognitionSession.update({
      where: { id: this.sessionId },
      data: { status: "active" },
    });

    // Start polling for faces every 500ms
    this.recognitionInterval = setInterval(() => {
      this.pollForFaces();
    }, 500);

    // Auto-timeout after configured duration
    setTimeout(() => {
      this.stop("timeout");
    }, this.settings.cameraTimeout * 1000);

    logger.event("RecognitionSessionStarted", {
      sessionId: this.sessionId,
      userId: this.userId,
    });
  }

  /**
   * Poll Frigate for face detections
   */
  private async pollForFaces(): Promise<void> {
    try {
      const faces = await this.frigateClient.recognizeFaces();

      if (faces.length === 0) {
        return;
      }

      // Filter faces above confidence threshold
      const recognizedFaces = faces.filter(
        (f) => f.confidence >= this.settings.confidenceThreshold
      );

      if (recognizedFaces.length === 0) {
        return;
      }

      // Map Frigate person IDs to profile IDs
      const profileFaceData = await prisma.profileFaceData.findMany({
        where: {
          frigatePersonId: {
            in: recognizedFaces.map((f) => f.personId),
          },
          isActive: true,
        },
        include: {
          profile: true,
        },
      });

      const detectedProfiles = profileFaceData.map((pfd) => ({
        profileId: pfd.profileId,
        profile: pfd.profile,
        confidence: recognizedFaces.find((f) => f.personId === pfd.frigatePersonId)!.confidence,
      }));

      // Update session with detected faces
      await prisma.recognitionSession.update({
        where: { id: this.sessionId },
        data: {
          detectedFaces: detectedProfiles.map((dp) => ({
            frigatePersonId: profileFaceData.find((pfd) => pfd.profileId === dp.profileId)!
              .frigatePersonId,
            profileId: dp.profileId,
            confidence: dp.confidence,
            detectedAt: new Date(),
          })),
        },
      });

      // Emit recognition event
      this.emitRecognitionResult({
        status: detectedProfiles.length === 1 ? "single" : "multiple",
        faces: detectedProfiles,
      });

      logger.event("FacesRecognized", {
        sessionId: this.sessionId,
        faceCount: detectedProfiles.length,
        profiles: detectedProfiles.map((dp) => dp.profile.name),
      });
    } catch (error) {
      logger.error(error as Error, {
        context: "PollForFacesFailed",
        sessionId: this.sessionId,
      });
    }
  }

  /**
   * Stop recognition session
   */
  async stop(reason: "completed" | "timeout" | "cancelled"): Promise<void> {
    if (this.recognitionInterval) {
      clearInterval(this.recognitionInterval);
      this.recognitionInterval = undefined;
    }

    await prisma.recognitionSession.update({
      where: { id: this.sessionId },
      data: {
        status: reason === "completed" ? "recognized" : reason,
        endedAt: new Date(),
      },
    });

    logger.event("RecognitionSessionStopped", {
      sessionId: this.sessionId,
      reason,
      duration: Date.now() - this.recognitionStartTime,
    });
  }

  /**
   * Emit recognition result to client (via WebSocket or Server-Sent Events)
   */
  private emitRecognitionResult(result: RecognitionResult): void {
    // This would emit to the client via WebSocket or SSE
    // For now, we'll store in session and poll from client
  }
}
```

### 7. API Routes

```typescript
// src/app/api/face-recognition/settings/route.ts
import { requireAuth, getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt, decrypt } from '@/lib/encryption';

export async function GET() {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const settings = await prisma.faceRecognitionSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings) {
      return NextResponse.json({
        enabled: false,
      });
    }

    // Decrypt API key for display (masked)
    const decryptedApiKey = decrypt(settings.frigateApiKey);
    const maskedApiKey = decryptedApiKey.slice(0, 4) + '*'.repeat(12);

    return NextResponse.json({
      ...settings,
      frigateApiKey: maskedApiKey,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/face-recognition/settings',
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const {
      enabled,
      frigateUrl,
      frigateApiKey,
      cameraName,
      confidenceThreshold,
      autoSwitchDelay,
      cameraTimeout,
      gracePeriod,
      autoSwitchEnabled,
    } = await request.json();

    // Validate required fields if enabling
    if (enabled && (!frigateUrl || !frigateApiKey || !cameraName)) {
      return NextResponse.json(
        { error: 'Frigate URL, API key, and camera name are required' },
        { status: 400 }
      );
    }

    // Encrypt API key
    const encryptedApiKey = frigateApiKey ? encrypt(frigateApiKey) : undefined;

    const settings = await prisma.faceRecognitionSettings.upsert({
      where: { userId: user.id },
      update: {
        enabled,
        ...(frigateUrl && { frigateUrl }),
        ...(encryptedApiKey && { frigateApiKey: encryptedApiKey }),
        ...(cameraName && { cameraName }),
        ...(confidenceThreshold !== undefined && { confidenceThreshold }),
        ...(autoSwitchDelay !== undefined && { autoSwitchDelay }),
        ...(cameraTimeout !== undefined && { cameraTimeout }),
        ...(gracePeriod !== undefined && { gracePeriod }),
        ...(autoSwitchEnabled !== undefined && { autoSwitchEnabled }),
      },
      create: {
        userId: user.id,
        enabled: enabled || false,
        frigateUrl: frigateUrl || '',
        frigateApiKey: encryptedApiKey || '',
        cameraName: cameraName || '',
        confidenceThreshold: confidenceThreshold || 85,
        autoSwitchDelay: autoSwitchDelay || 2,
        cameraTimeout: cameraTimeout || 10,
        gracePeriod: gracePeriod || 5,
        autoSwitchEnabled: autoSwitchEnabled !== false,
      },
    });

    logger.event('FaceRecognitionSettingsUpdated', {
      userId: user.id,
      enabled: settings.enabled,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/face-recognition/settings',
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}

// src/app/api/face-recognition/session/route.ts
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    // Get settings
    const settings = await prisma.faceRecognitionSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings || !settings.enabled) {
      return NextResponse.json(
        { error: 'Face recognition not enabled' },
        { status: 400 }
      );
    }

    // Create session
    const session = await prisma.recognitionSession.create({
      data: {
        userId: user.id,
        status: 'idle',
        detectedFaces: [],
        source: 'manual',
      },
    });

    // Initialize Frigate client
    const frigateClient = new FrigateClient({
      url: settings.frigateUrl,
      apiKey: decrypt(settings.frigateApiKey),
      cameraName: settings.cameraName,
    });

    // Start recognition
    const sessionManager = new RecognitionSessionManager(
      session.id,
      user.id,
      frigateClient,
      settings
    );

    await sessionManager.start();

    return NextResponse.json({
      sessionId: session.id,
      timeout: settings.cameraTimeout,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/face-recognition/session',
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to start recognition session' },
      { status: 500 }
    );
  }
}

// src/app/api/face-recognition/session/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    const session = await prisma.recognitionSession.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get profiles for detected faces
    const detectedFaces = session.detectedFaces as DetectedFace[];
    const profileIds = detectedFaces
      .map((f) => f.profileId)
      .filter((id): id is string => id !== undefined && id !== null);

    const profiles = await prisma.profile.findMany({
      where: {
        id: { in: profileIds },
        isActive: true,
      },
    });

    const result: RecognitionResult = {
      status: profileIds.length === 0 ? 'none' : profileIds.length === 1 ? 'single' : 'multiple',
      faces: detectedFaces.map((df) => ({
        profileId: df.profileId,
        profile: profiles.find((p) => p.id === df.profileId),
        confidence: df.confidence,
      })),
    };

    return NextResponse.json({
      sessionId: session.id,
      status: session.status,
      result,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/face-recognition/session/${params.id}`,
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch session' },
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

    // Stop session (cancel)
    const session = await prisma.recognitionSession.findFirst({
      where: {
        id: params.id,
        userId: user.id,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Update session
    await prisma.recognitionSession.update({
      where: { id: params.id },
      data: {
        status: 'timeout',
        endedAt: new Date(),
      },
    });

    logger.event('RecognitionSessionCancelled', {
      sessionId: params.id,
      userId: user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: `/api/face-recognition/session/${params.id}`,
      method: 'DELETE',
    });

    return NextResponse.json(
      { error: 'Failed to cancel session' },
      { status: 500 }
    );
  }
}

// src/app/api/face-recognition/enroll/route.ts
export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const user = await getCurrentUser();

    // Verify admin permissions
    const adminProfile = await prisma.profile.findFirst({
      where: {
        userId: user.id,
        type: 'admin',
      },
    });

    if (!adminProfile) {
      return NextResponse.json(
        { error: 'Admin permissions required' },
        { status: 403 }
      );
    }

    const formData = await request.formData();
    const profileId = formData.get('profileId') as string;
    const imageFile = formData.get('image') as File;

    if (!profileId || !imageFile) {
      return NextResponse.json(
        { error: 'Profile ID and image are required' },
        { status: 400 }
      );
    }

    // Get profile
    const profile = await prisma.profile.findFirst({
      where: {
        id: profileId,
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

    // Get settings
    const settings = await prisma.faceRecognitionSettings.findUnique({
      where: { userId: user.id },
    });

    if (!settings || !settings.enabled) {
      return NextResponse.json(
        { error: 'Face recognition not enabled' },
        { status: 400 }
      );
    }

    // Initialize Frigate client
    const frigateClient = new FrigateClient({
      url: settings.frigateUrl,
      apiKey: decrypt(settings.frigateApiKey),
      cameraName: settings.cameraName,
    });

    // Convert File to Blob
    const imageBlob = new Blob([await imageFile.arrayBuffer()], { type: imageFile.type });

    // Generate Frigate person ID (use profile ID)
    const frigatePersonId = `profile_${profile.id}`;

    // Enroll face
    const success = await frigateClient.enrollFace(frigatePersonId, profile.name, imageBlob);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to enroll face' },
        { status: 500 }
      );
    }

    // Update or create ProfileFaceData
    const faceData = await prisma.profileFaceData.upsert({
      where: { profileId: profile.id },
      update: {
        photoCount: {
          increment: 1,
        },
      },
      create: {
        profileId: profile.id,
        frigatePersonId,
        photoCount: 1,
      },
    });

    logger.event('FaceEnrolled', {
      userId: user.id,
      profileId: profile.id,
      photoCount: faceData.photoCount,
    });

    return NextResponse.json({
      success: true,
      photoCount: faceData.photoCount,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/face-recognition/enroll',
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to enroll face' },
      { status: 500 }
    );
  }
}
```

### 8. Client Components

```tsx
// src/components/face-recognition/face-recognition-switcher.tsx
"use client";

import { ProfileAvatar } from "@/components/profiles/profile-avatar";
import { useProfile } from "@/components/profiles/profile-context";
import { useEffect, useState } from "react";

interface RecognitionResult {
  status: "single" | "multiple" | "none";
  faces: Array<{
    profileId?: string;
    profile?: Profile;
    confidence: number;
  }>;
}

export function FaceRecognitionSwitcher() {
  const { setActiveProfile, allProfiles, setViewMode } = useProfile();
  const [isActive, setIsActive] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [countdown, setCountdown] = useState(10);
  const [autoSwitchCountdown, setAutoSwitchCountdown] = useState<number | null>(null);

  // Start recognition session
  const startRecognition = async () => {
    setIsActive(true);
    setResult(null);
    setCountdown(10);

    try {
      const response = await fetch("/api/face-recognition/session", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to start recognition");
      }

      const data = await response.json();
      setSessionId(data.sessionId);
      setCountdown(data.timeout);

      // Start polling for results
      pollSession(data.sessionId);
    } catch (error) {
      console.error("Recognition error:", error);
      setIsActive(false);
    }
  };

  // Poll session for results
  const pollSession = async (sessionId: string) => {
    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/face-recognition/session/${sessionId}`);

        if (!response.ok) {
          clearInterval(pollInterval);
          return;
        }

        const data = await response.json();

        if (data.status === "active") {
          // Update result
          if (data.result && data.result.faces.length > 0) {
            setResult(data.result);

            // Start auto-switch countdown for single face
            if (data.result.status === "single") {
              setAutoSwitchCountdown(2);
            }
          }
        } else {
          // Session ended
          clearInterval(pollInterval);
          setIsActive(false);
        }
      } catch (error) {
        console.error("Poll error:", error);
        clearInterval(pollInterval);
        setIsActive(false);
      }
    }, 500);

    // Cleanup after timeout
    setTimeout(() => {
      clearInterval(pollInterval);
      setIsActive(false);
    }, countdown * 1000);
  };

  // Handle countdown
  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive]);

  // Handle auto-switch countdown
  useEffect(() => {
    if (autoSwitchCountdown === null) return;

    if (autoSwitchCountdown === 0 && result?.status === "single") {
      // Auto-switch
      const profile = result.faces[0].profile;
      if (profile) {
        setActiveProfile(profile.id);
        cancelRecognition();
      }
      return;
    }

    const timer = setTimeout(() => {
      setAutoSwitchCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => clearTimeout(timer);
  }, [autoSwitchCountdown, result]);

  // Cancel recognition
  const cancelRecognition = async () => {
    if (sessionId) {
      await fetch(`/api/face-recognition/session/${sessionId}`, {
        method: "DELETE",
      });
    }
    setIsActive(false);
    setSessionId(null);
    setResult(null);
    setAutoSwitchCountdown(null);
  };

  // Select profile manually
  const selectProfile = (profileId: string) => {
    setActiveProfile(profileId);
    cancelRecognition();
  };

  if (!isActive) {
    return (
      <button
        onClick={startRecognition}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-white hover:bg-blue-700"
      >
        <span className="text-xl">🎥</span>
        <span>Switch with Face</span>
      </button>
    );
  }

  return (
    <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="w-full max-w-md rounded-lg bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900">Switch Profile</h3>
          <div className="flex items-center gap-2">
            <span className="text-xl">🎥</span>
            <span className="text-sm text-gray-600">{countdown}s left</span>
            <button onClick={cancelRecognition} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>
        </div>

        {/* Recognition status */}
        {!result && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <div className="animate-pulse">
                <span className="text-4xl">📸</span>
              </div>
            </div>
            <p className="text-center text-gray-600">Looking for faces...</p>
            <div className="h-2 w-full rounded-full bg-gray-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${((10 - countdown) / 10) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Single face recognized */}
        {result?.status === "single" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <span className="text-2xl">✅</span>
              <p className="font-medium text-gray-900">Face Recognized!</p>

              {result.faces[0].profile && (
                <>
                  <ProfileAvatar profile={result.faces[0].profile} size="lg" />
                  <p className="text-xl font-bold text-gray-900">{result.faces[0].profile.name}</p>
                  <p className="text-sm text-gray-600">
                    {autoSwitchCountdown !== null
                      ? `Switching in ${autoSwitchCountdown} seconds...`
                      : "Ready to switch"}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => selectProfile(result.faces[0].profile!.id)}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                    >
                      Switch Now
                    </button>
                    <button
                      onClick={cancelRecognition}
                      className="rounded-lg bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Multiple faces recognized */}
        {result?.status === "multiple" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <span className="text-2xl">👀</span>
              <p className="font-medium text-gray-900">Multiple people detected!</p>
              <p className="text-sm text-gray-600">Who is using the calendar?</p>
            </div>

            <div className="space-y-2">
              {result.faces.map((face, index) =>
                face.profile ? (
                  <button
                    key={face.profile.id}
                    onClick={() => selectProfile(face.profile!.id)}
                    className="flex w-full items-center gap-3 rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                  >
                    <ProfileAvatar profile={face.profile} size="md" />
                    <div className="flex-1 text-left">
                      <p className="font-medium text-gray-900">{face.profile.name}</p>
                      <p className="text-xs text-gray-500">Press {index + 1}</p>
                    </div>
                  </button>
                ) : null
              )}

              <button
                onClick={() => setViewMode("family")}
                className="flex w-full items-center gap-3 rounded-lg bg-blue-50 p-3 hover:bg-blue-100"
              >
                <span className="text-2xl">👨‍👩‍👧‍👦</span>
                <div className="flex-1 text-left">
                  <p className="font-medium text-gray-900">Family Mode</p>
                  <p className="text-xs text-gray-500">Press {result.faces.length + 1}</p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* No faces recognized */}
        {result?.status === "none" && (
          <div className="space-y-4">
            <p className="text-center text-gray-600">No recognized faces detected.</p>
            <p className="text-center text-sm text-gray-500">Select profile manually below:</p>

            <div className="space-y-2">
              {allProfiles.map((profile) => (
                <button
                  key={profile.id}
                  onClick={() => selectProfile(profile.id)}
                  className="flex w-full items-center gap-3 rounded-lg bg-gray-50 p-3 hover:bg-gray-100"
                >
                  <ProfileAvatar profile={profile} size="md" />
                  <p className="font-medium text-gray-900">{profile.name}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

### 9. Encryption Utilities

```typescript
// src/lib/encryption.ts
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-change-in-production";
const ALGORITHM = "aes-256-gcm";

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);

  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(":");

  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
```

## Implementation Steps

### Phase 1: Foundation (Frigate Integration)

1. **Install dependencies** (none needed - use fetch API)
2. **Create FrigateClient service**
3. **Implement settings API routes**
4. **Create settings UI page**
5. **Test Frigate connection**

### Phase 2: Face Enrollment

6. **Build face enrollment UI** (camera preview, capture flow)
7. **Implement enrollment API endpoint**
8. **Test enrollment with CompreFace**
9. **Add delete face functionality**
10. **Test with multiple profiles**

### Phase 3: Recognition Sessions

11. **Create RecognitionSessionManager**
12. **Implement session API routes** (start, poll, cancel)
13. **Build FaceRecognitionSwitcher component**
14. **Test single face recognition**
15. **Test multiple face recognition**

### Phase 4: Integration

16. **Integrate with ProfileSwitcher** (add camera icon)
17. **Implement auto-switch logic with countdown**
18. **Add debouncing for poor quality cameras**
19. **Test grace period for temporary recognition loss**
20. **Test camera timeout**

### Phase 5: Polish and Testing

21. **Add visual indicators** (camera active, countdown)
22. **Improve error handling**
23. **Add loading states**
24. **Performance optimization** (reduce polling frequency)
25. **Accessibility improvements**

## Challenges and Considerations

### Challenge 1: Frigate Setup Complexity

- **Problem**: Users need to set up Frigate NVR first
- **Solution**: Provide clear documentation, wizard-style setup, test connection before saving

### Challenge 2: Camera Quality Variability

- **Problem**: Low resolution/FPS webcams may not work well
- **Solution**: Adjustable confidence threshold, grace period, clear requirements documentation

### Challenge 3: Privacy Concerns

- **Problem**: Users worried about always-on camera
- **Solution**: On-demand only, visual indicators, clear privacy policy, local processing

### Challenge 4: Network Latency

- **Problem**: Frigate may be on local network, API calls have latency
- **Solution**: Debouncing, polling interval optimization, timeout handling

### Challenge 5: Multi-Face Ambiguity

- **Problem**: If multiple people always in frame, can't auto-switch
- **Solution**: Always prompt user to select, include "Family Mode" option

### Challenge 6: Face Data Management

- **Problem**: Face embeddings stored in Frigate, need to link to profiles
- **Solution**: Use profile ID as Frigate person ID, store mapping in database

## Testing Strategy

1. **Unit Tests**:
   - FrigateClient methods
   - Encryption/decryption
   - RecognitionSessionManager logic

2. **Integration Tests**:
   - Frigate API connection
   - Face enrollment flow
   - Recognition session lifecycle

3. **E2E Tests**:
   - Full enrollment flow (5 photos)
   - Single face auto-switch
   - Multiple face selection
   - Cancel/timeout scenarios

4. **Manual Tests**:
   - Test with real Frigate instance
   - Test with low-quality webcam
   - Test in different lighting conditions
   - Test with multiple family members
   - Test grace period (walk away temporarily)

## Security and Privacy Considerations

1. **Data Storage**:
   - Face embeddings stored in Frigate (not app database)
   - API keys encrypted at rest
   - No face images stored permanently

2. **Camera Access**:
   - On-demand only (never always-on)
   - Clear visual indicator when active
   - Auto-timeout after 10 seconds
   - User-initiated (button press required)

3. **Network Security**:
   - Frigate should be on local network (not exposed to internet)
   - Use HTTPS if Frigate is remote
   - API key never logged or exposed

4. **Privacy Controls**:
   - Opt-in feature (disabled by default)
   - Easy to disable/delete face data
   - Clear privacy explanation during setup
   - Compliance with privacy regulations (GDPR, etc.)

5. **Access Control**:
   - Admin-only face enrollment
   - User can only delete their own face data
   - Session tied to authenticated user

## Monitoring and Analytics

Track these metrics:

- Face recognition success rate
- Average recognition time
- Single vs multiple face scenarios
- Auto-switch vs manual selection
- Confidence score distribution
- Session timeout rate

```typescript
logger.event("FaceRecognitionUsed", {
  userId: user.id,
  result: "single" | "multiple" | "none",
  autoSwitched: boolean,
  confidenceScore: number,
  recognitionTime: number,
});

logger.event("FaceEnrollmentCompleted", {
  userId: user.id,
  profileId: profile.id,
  photoCount: number,
});

logger.error(error, {
  context: "FrigateConnectionFailed",
  frigateUrl: settings.frigateUrl,
});
```

## Dependencies

- **Frigate NVR**: External service (user-managed)
- **CompreFace**: Integrated with Frigate (automatically available)
- **crypto**: Node.js built-in (for encryption)
- **fetch API**: Browser/Node.js built-in

## Integration with Other Features

**Required Integration:**

- **Multi-Profile Support**: Profiles need face data field
- **Profile Switcher**: Add camera trigger button

**Optional Integration:**

- **Settings Page**: Face recognition settings section
- **User Onboarding**: Guided setup wizard
- **Dashboard**: Show enrolled face count per profile

## Future Enhancements

### Phase 2 Features

- **Continuous Recognition**: Optional always-on mode for kiosks
- **Face Detection Zones**: Only recognize faces in certain areas of frame
- **Multiple Camera Support**: Use different cameras for different scenarios
- **Voice Confirmation**: "Switch to Ben's profile?" for accessibility

### Phase 3 Features

- **Emotion Detection**: Detect mood and adjust UI (future AI feature)
- **Age Estimation**: Automatically categorize profiles by age
- **Gesture Recognition**: Switch profiles with hand gestures
- **Activity Tracking**: Log when each family member uses the calendar

### Advanced Ideas

- **Smart Reminders**: Show reminders when specific person detected
- **Context-Aware UI**: Adjust shown tasks based on who's looking
- **Presence Detection**: Log family member presence for automation
- **Security Mode**: Alert if unknown face detected

## User Onboarding

### Setup Wizard

1. **Prerequisites Check**: "Do you have Frigate NVR running?"
2. **Frigate Connection**: Enter URL, API key, camera name
3. **Test Connection**: Verify Frigate is accessible
4. **Privacy Explanation**: Clear explanation of how face data is used
5. **First Enrollment**: Walk through enrolling first face
6. **Test Recognition**: Test switching with enrolled face

### Documentation

- **Frigate Setup Guide**: Link to Frigate documentation
- **Camera Requirements**: Minimum resolution, FPS, lighting
- **Troubleshooting**: Common issues and solutions
- **Privacy Policy**: How face data is stored and used

## Cost Considerations

- **Frigate NVR**: Free and open-source (user-hosted)
- **CompreFace**: Free and open-source (integrated with Frigate)
- **Hardware**: Raspberry Pi 4 or similar ($50-100) for Frigate
- **Camera**: USB webcam ($20-50) if not already available
- **No Cloud Costs**: All processing is local

## Positioning as Skylight Alternative

This feature reinforces the app's positioning as a **tech-savvy, privacy-first, cost-effective alternative to Skylight**:

✅ **Free vs Paid**: No subscription, one-time hardware cost
✅ **Local vs Cloud**: Face recognition runs locally (Frigate)
✅ **Customizable**: Users configure their own Frigate instance
✅ **Privacy-First**: On-demand camera, no always-on surveillance
✅ **Smart Home Integration**: Works with existing home automation (Frigate)
✅ **Open Source**: Built on open-source stack (Frigate, CompreFace)

**Target Audience**: Users who already run home automation (Home Assistant, Frigate) and value privacy and customization over simplicity.

---

This feature combines convenience (quick profile switching) with privacy (on-demand, local processing) to create a unique selling point for tech-savvy users who want a free, customizable family calendar integrated with their smart home ecosystem.
