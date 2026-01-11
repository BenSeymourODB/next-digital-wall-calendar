# Voice Assistant Integration

## Overview
Integrate voice assistant support (Amazon Alexa, Google Assistant) to enable hands-free interaction with the digital wall calendar. Users can add tasks, check schedules, add grocery items, and control the calendar using voice commands, similar to Skylight's Alexa integration.

## Requirements

### Core Features

#### 1. Voice Platforms
- **Amazon Alexa**: Alexa Skills Kit integration
- **Google Assistant**: Actions on Google integration
- **Cross-Platform**: Unified backend for both platforms
- **Priority**: Start with one platform (Alexa recommended based on market share)

#### 2. Supported Voice Commands

##### Task Management
- "Alexa, add 'buy milk' to my grocery list"
- "Alexa, add task 'doctor appointment tomorrow at 2pm'"
- "Alexa, mark 'buy groceries' as complete"
- "Alexa, what tasks do I have today?"
- "Alexa, what's on Ben's task list?"

##### Calendar
- "Alexa, what's on my calendar today?"
- "Alexa, when is my next appointment?"
- "Alexa, what events does Evelyn have this week?"

##### Meal Planning
- "Alexa, what's for dinner tonight?"
- "Alexa, add spaghetti to Monday's dinner"
- "Alexa, add chicken to the grocery list"

##### Rewards/Points
- "Alexa, how many points does Liv have?"
- "Alexa, give Ben 10 points for helping with dishes"

##### General
- "Alexa, open my family calendar"
- "Alexa, show today's schedule"
- "Alexa, refresh the calendar"

#### 3. Account Linking
- **OAuth 2.0**: Link Alexa/Google account with calendar account
- **Secure**: Use existing OAuth infrastructure
- **One-Time Setup**: Link once, use everywhere
- **Multiple Devices**: Link multiple Alexa devices to same account

#### 4. Multi-Profile Voice Recognition
- **Voice Profiles**: Recognize different family members by voice
- **Context**: Commands apply to speaker's profile
- **Fallback**: Default to account owner if voice not recognized
- **Override**: "Alexa, add task for Ben..." to specify profile

#### 5. Responses and Confirmations
- **Verbal Feedback**: "I've added 'buy milk' to your grocery list"
- **Error Handling**: "I couldn't find that task. Please try again."
- **Clarification**: "Did you mean breakfast or lunch for spaghetti?"
- **Privacy**: Don't read sensitive information aloud by default

#### 6. Display Integration (Optional)
- **Echo Show/Nest Hub**: Visual cards for tasks/calendar
- **APL/Canvas**: Alexa Presentation Language for rich displays
- **Touch Support**: Tap to complete tasks on screen

### Visual Design (Alexa Skill Card)

#### Echo Show Display Card
```
┌─────────────────────────────────────┐
│  Family Calendar                    │
│  ────────────────────────────────  │
│                                     │
│  Today's Tasks (Ben)                │
│                                     │
│  ☐ Buy groceries                    │
│  ☐ Pick up kids at 3pm              │
│  ☑ Morning workout                  │
│                                     │
│  [Say: "Mark task as complete"]    │
└─────────────────────────────────────┘
```

#### Voice Interaction Flow
```
User:  "Alexa, open family calendar"
Alexa: "Welcome to your family calendar. You have 3 tasks today
        and 2 events. What would you like to do?"

User:  "Add buy milk to my grocery list"
Alexa: "I've added 'buy milk' to your grocery list."

User:  "What's for dinner tonight?"
Alexa: "Tonight's dinner is spaghetti bolognese."

User:  "Give Ben 10 points"
Alexa: "I've given Ben 10 bonus points. He now has 1,260 points."
```

## Technical Implementation Plan

### 1. Architecture Overview

```
Alexa/Google Assistant
     ↓
AWS Lambda / Cloud Function (Intent Handler)
     ↓
Your API (authenticated with OAuth token)
     ↓
Database (Tasks, Calendar, Profiles)
```

### 2. Technology Stack

**For Alexa:**
- **Alexa Skills Kit (ASK)**: Define intents, slots, utterances
- **AWS Lambda**: Serverless function to handle requests
- **ask-sdk-core**: Node.js SDK for Alexa
- **Account Linking**: OAuth 2.0 with your existing auth

**For Google Assistant:**
- **Actions on Google**: Define intents and conversation flows
- **Google Cloud Functions**: Serverless function handler
- **actions-on-google**: Node.js SDK
- **Account Linking**: OAuth 2.0

**Shared Backend:**
- **API Gateway**: Unified API for both platforms
- **Voice API Endpoints**: Specialized endpoints for voice commands
- **Existing Auth**: Reuse NextAuth.js OAuth flow

### 3. Alexa Skill Configuration

#### Interaction Model (JSON)
```json
{
  "interactionModel": {
    "languageModel": {
      "invocationName": "family calendar",
      "intents": [
        {
          "name": "AddTaskIntent",
          "slots": [
            {
              "name": "taskName",
              "type": "AMAZON.SearchQuery"
            },
            {
              "name": "profileName",
              "type": "ProfileName"
            },
            {
              "name": "dueDate",
              "type": "AMAZON.DATE"
            }
          ],
          "samples": [
            "add task {taskName}",
            "add {taskName} to my tasks",
            "add task {taskName} for {profileName}",
            "remind me to {taskName}",
            "add {taskName} due {dueDate}"
          ]
        },
        {
          "name": "GetTasksIntent",
          "slots": [
            {
              "name": "profileName",
              "type": "ProfileName"
            },
            {
              "name": "date",
              "type": "AMAZON.DATE"
            }
          ],
          "samples": [
            "what tasks do I have",
            "what's on my task list",
            "what tasks does {profileName} have",
            "what do I need to do {date}"
          ]
        },
        {
          "name": "CompleteTaskIntent",
          "slots": [
            {
              "name": "taskName",
              "type": "AMAZON.SearchQuery"
            }
          ],
          "samples": [
            "mark {taskName} as complete",
            "complete {taskName}",
            "I finished {taskName}"
          ]
        },
        {
          "name": "GetDinnerIntent",
          "slots": [
            {
              "name": "date",
              "type": "AMAZON.DATE"
            }
          ],
          "samples": [
            "what's for dinner",
            "what's for dinner {date}",
            "what are we having for dinner"
          ]
        },
        {
          "name": "GivePointsIntent",
          "slots": [
            {
              "name": "profileName",
              "type": "ProfileName"
            },
            {
              "name": "points",
              "type": "AMAZON.NUMBER"
            }
          ],
          "samples": [
            "give {profileName} {points} points",
            "award {profileName} {points} points",
            "add {points} points to {profileName}"
          ]
        }
      ],
      "types": [
        {
          "name": "ProfileName",
          "values": [
            {
              "name": {
                "value": "Ben"
              }
            },
            {
              "name": {
                "value": "Evelyn"
              }
            },
            {
              "name": {
                "value": "Liv"
              }
            }
          ]
        }
      ]
    }
  }
}
```

### 4. Lambda Function (Intent Handler)

```typescript
// alexa-skill/src/index.ts
import * as Alexa from 'ask-sdk-core';
import { RequestEnvelope, ResponseEnvelope } from 'ask-sdk-model';

// Add Task Intent Handler
const AddTaskIntentHandler: Alexa.RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'AddTaskIntent'
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope, attributesManager } = handlerInput;
    const sessionAttributes = attributesManager.getSessionAttributes();

    // Get access token from account linking
    const accessToken = requestEnvelope.context.System.user.accessToken;

    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak('Please link your account in the Alexa app to use this skill.')
        .withLinkAccountCard()
        .getResponse();
    }

    // Extract slots
    const slots = Alexa.getSlot(handlerInput.requestEnvelope, 'taskName');
    const taskName = slots?.value;
    const profileName = Alexa.getSlot(handlerInput.requestEnvelope, 'profileName')?.value;
    const dueDate = Alexa.getSlot(handlerInput.requestEnvelope, 'dueDate')?.value;

    if (!taskName) {
      return handlerInput.responseBuilder
        .speak('I didn\'t catch the task name. Please try again.')
        .reprompt('What task would you like to add?')
        .getResponse();
    }

    try {
      // Call your API
      const response = await fetch('https://your-domain.com/api/voice/tasks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          taskName,
          profileName,
          dueDate,
          source: 'alexa',
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data = await response.json();

      const speakOutput = `I've added "${taskName}" to ${profileName ? `${profileName}'s` : 'your'} task list${dueDate ? ` for ${dueDate}` : ''}.`;

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
    } catch (error) {
      console.error('Error adding task:', error);

      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble adding that task. Please try again.')
        .getResponse();
    }
  },
};

// Get Tasks Intent Handler
const GetTasksIntentHandler: Alexa.RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetTasksIntent'
    );
  },
  async handle(handlerInput) {
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;

    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak('Please link your account in the Alexa app.')
        .withLinkAccountCard()
        .getResponse();
    }

    const profileName = Alexa.getSlot(handlerInput.requestEnvelope, 'profileName')?.value;
    const date = Alexa.getSlot(handlerInput.requestEnvelope, 'date')?.value || 'today';

    try {
      const response = await fetch(
        `https://your-domain.com/api/voice/tasks?profileName=${profileName || ''}&date=${date}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      const tasks = data.tasks;

      if (tasks.length === 0) {
        return handlerInput.responseBuilder
          .speak(`${profileName ? `${profileName} has` : 'You have'} no tasks for ${date}.`)
          .getResponse();
      }

      const taskList = tasks.map((t: any) => t.title).join(', ');
      const speakOutput = `${profileName ? `${profileName} has` : 'You have'} ${tasks.length} task${tasks.length > 1 ? 's' : ''} for ${date}: ${taskList}`;

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .getResponse();
    } catch (error) {
      console.error('Error getting tasks:', error);

      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble retrieving your tasks.')
        .getResponse();
    }
  },
};

// Get Dinner Intent Handler
const GetDinnerIntentHandler: Alexa.RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'GetDinnerIntent'
    );
  },
  async handle(handlerInput) {
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;

    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak('Please link your account in the Alexa app.')
        .withLinkAccountCard()
        .getResponse();
    }

    const date = Alexa.getSlot(handlerInput.requestEnvelope, 'date')?.value || 'today';

    try {
      const response = await fetch(
        `https://your-domain.com/api/voice/meals?type=dinner&date=${date}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      const data = await response.json();
      const meal = data.meal;

      if (!meal) {
        return handlerInput.responseBuilder
          .speak(`No dinner is planned for ${date}.`)
          .getResponse();
      }

      return handlerInput.responseBuilder
        .speak(`For dinner ${date === 'today' ? 'tonight' : date}, you're having ${meal.name}.`)
        .getResponse();
    } catch (error) {
      console.error('Error getting dinner:', error);

      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble checking your meal plan.')
        .getResponse();
    }
  },
};

// Give Points Intent Handler (Admin only)
const GivePointsIntentHandler: Alexa.RequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest' &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === 'GivePointsIntent'
    );
  },
  async handle(handlerInput) {
    const accessToken = handlerInput.requestEnvelope.context.System.user.accessToken;

    if (!accessToken) {
      return handlerInput.responseBuilder
        .speak('Please link your account in the Alexa app.')
        .withLinkAccountCard()
        .getResponse();
    }

    const profileName = Alexa.getSlot(handlerInput.requestEnvelope, 'profileName')?.value;
    const points = parseInt(Alexa.getSlot(handlerInput.requestEnvelope, 'points')?.value || '0');

    if (!profileName || points <= 0) {
      return handlerInput.responseBuilder
        .speak('Please specify a profile name and a positive number of points.')
        .getResponse();
    }

    try {
      const response = await fetch('https://your-domain.com/api/voice/points', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profileName,
          points,
          source: 'alexa',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403) {
          return handlerInput.responseBuilder
            .speak('You need admin permissions to give points.')
            .getResponse();
        }
        throw new Error(error.message);
      }

      const data = await response.json();

      return handlerInput.responseBuilder
        .speak(`I've given ${profileName} ${points} bonus points. They now have ${data.newTotal} points.`)
        .getResponse();
    } catch (error) {
      console.error('Error giving points:', error);

      return handlerInput.responseBuilder
        .speak('Sorry, I had trouble awarding those points.')
        .getResponse();
    }
  },
};

// Skill builder
export const handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    AddTaskIntentHandler,
    GetTasksIntentHandler,
    GetDinnerIntentHandler,
    GivePointsIntentHandler,
    // ... other handlers
  )
  .lambda();
```

### 5. Voice API Endpoints

```typescript
// src/app/api/voice/tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAccessToken, getCurrentUser } from '@/lib/auth/helpers';
import { prisma } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    // Authenticate using bearer token from Alexa
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromAccessToken(accessToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 401 }
      );
    }

    const { taskName, profileName, dueDate, source } = await request.json();

    // Find profile by name
    let profile = null;
    if (profileName) {
      profile = await prisma.profile.findFirst({
        where: {
          userId: user.id,
          name: {
            equals: profileName,
            mode: 'insensitive',
          },
          isActive: true,
        },
      });

      if (!profile) {
        return NextResponse.json(
          { error: `Profile "${profileName}" not found` },
          { status: 404 }
        );
      }
    }

    // Create task via Google Tasks API
    const googleAccessToken = await getAccessToken();

    // Get user's default task list
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    const taskListId = settings?.defaultTaskListId || '@default';

    const taskResponse = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: taskName,
          due: dueDate ? new Date(dueDate).toISOString() : undefined,
          notes: profile ? `Assigned to: ${profile.name}` : undefined,
        }),
      }
    );

    if (!taskResponse.ok) {
      throw new Error('Failed to create task in Google Tasks');
    }

    const task = await taskResponse.json();

    // Create task assignment if profile specified
    if (profile) {
      await prisma.taskAssignment.create({
        data: {
          taskId: task.id,
          profileId: profile.id,
          assignedBy: profile.id, // Voice commands assign to self
        },
      });
    }

    logger.event('VoiceTaskAdded', {
      userId: user.id,
      taskName,
      profileName,
      source,
    });

    return NextResponse.json({
      success: true,
      taskId: task.id,
      taskName,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/voice/tasks',
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to add task' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromAccessToken(accessToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const profileName = searchParams.get('profileName');
    const date = searchParams.get('date') || 'today';

    // Find profile if specified
    let profile = null;
    if (profileName) {
      profile = await prisma.profile.findFirst({
        where: {
          userId: user.id,
          name: {
            equals: profileName,
            mode: 'insensitive',
          },
          isActive: true,
        },
      });
    }

    // Fetch tasks from Google Tasks API
    const googleAccessToken = await getAccessToken();
    const settings = await prisma.userSettings.findUnique({
      where: { userId: user.id },
    });

    const taskListId = settings?.defaultTaskListId || '@default';
    const tasksResponse = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${taskListId}/tasks`,
      {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
        },
      }
    );

    if (!tasksResponse.ok) {
      throw new Error('Failed to fetch tasks from Google Tasks');
    }

    let tasks = await tasksResponse.json();
    tasks = tasks.items || [];

    // Filter by profile if specified
    if (profile) {
      const assignments = await prisma.taskAssignment.findMany({
        where: { profileId: profile.id },
      });

      const assignedTaskIds = new Set(assignments.map((a) => a.taskId));
      tasks = tasks.filter((t: any) => assignedTaskIds.has(t.id));
    }

    // Filter by date
    if (date === 'today') {
      const today = new Date().toISOString().split('T')[0];
      tasks = tasks.filter((t: any) => {
        if (!t.due) return false;
        return t.due.startsWith(today);
      });
    }

    return NextResponse.json({
      tasks: tasks.map((t: any) => ({
        id: t.id,
        title: t.title,
        due: t.due,
        status: t.status,
      })),
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/voice/tasks',
      method: 'GET',
    });

    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// Helper to get user from access token
async function getUserFromAccessToken(token: string) {
  // Implementation depends on your auth system
  // This would validate the JWT token and return the user
  // For NextAuth.js, you might decode the JWT and fetch the user
  return null; // Placeholder
}

// src/app/api/voice/points/route.ts
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const user = await getUserFromAccessToken(accessToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid access token' },
        { status: 401 }
      );
    }

    const { profileName, points, source } = await request.json();

    // Verify the requesting user is an admin
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

    // Find target profile
    const targetProfile = await prisma.profile.findFirst({
      where: {
        userId: user.id,
        name: {
          equals: profileName,
          mode: 'insensitive',
        },
        isActive: true,
      },
    });

    if (!targetProfile) {
      return NextResponse.json(
        { error: `Profile "${profileName}" not found` },
        { status: 404 }
      );
    }

    // Award points
    const result = await prisma.$transaction(async (tx) => {
      const rewardPoints = await tx.profileRewardPoints.upsert({
        where: { profileId: targetProfile.id },
        update: {
          totalPoints: {
            increment: points,
          },
        },
        create: {
          profileId: targetProfile.id,
          totalPoints: points,
        },
      });

      await tx.pointTransaction.create({
        data: {
          profileId: targetProfile.id,
          points,
          reason: 'manual',
          awardedBy: adminProfile.id,
          note: `Voice command via ${source}`,
        },
      });

      return rewardPoints;
    });

    logger.event('VoicePointsAwarded', {
      userId: user.id,
      profileName,
      points,
      source,
    });

    return NextResponse.json({
      success: true,
      newTotal: result.totalPoints,
    });
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/voice/points',
      method: 'POST',
    });

    return NextResponse.json(
      { error: 'Failed to award points' },
      { status: 500 }
    );
  }
}
```

### 6. Account Linking Configuration

#### OAuth 2.0 Settings (Alexa)
```
Authorization URL: https://your-domain.com/api/auth/signin
Access Token URL: https://your-domain.com/api/auth/token
Client ID: <your-alexa-client-id>
Client Secret: <your-alexa-client-secret>
Scopes: tasks, calendar, profiles
```

#### Account Linking Flow
1. User enables skill in Alexa app
2. Alexa redirects to your OAuth login page
3. User signs in with Google (existing NextAuth flow)
4. Authorization code sent back to Alexa
5. Alexa exchanges code for access token
6. Access token included in all skill requests

## Implementation Steps

### Phase 1: Foundation
1. **Set up Alexa developer account**
   - Create Alexa skill
   - Configure interaction model
   - Set up account linking

2. **Create Lambda function**
   - Set up AWS Lambda
   - Install ask-sdk-core
   - Deploy basic skill handler

3. **Implement OAuth endpoints**
   - Extend NextAuth for Alexa client
   - Test account linking flow

### Phase 2: Core Intents
4. **Implement AddTaskIntent**
   - Create voice API endpoint
   - Handle task creation
   - Test with Alexa simulator

5. **Implement GetTasksIntent**
   - Fetch and filter tasks
   - Format spoken response
   - Test various date queries

6. **Implement CompleteTaskIntent**
   - Find and complete task
   - Test task completion

### Phase 3: Advanced Features
7. **Implement meal planning intents**
   - GetDinnerIntent
   - AddMealIntent
   - Test meal queries

8. **Implement points intents**
   - GivePointsIntent
   - GetPointsIntent
   - Test admin permissions

9. **Add profile-specific commands**
   - Voice profile recognition
   - Profile name extraction
   - Test multi-profile scenarios

### Phase 4: Testing and Polish
10. **Beta testing**
    - Test with real Alexa devices
    - Gather user feedback
    - Fix bugs and edge cases

11. **Certification**
    - Submit skill for review
    - Address Amazon feedback
    - Publish to Alexa Skills Store

12. **Documentation**
    - User guide for setup
    - Supported commands list
    - Troubleshooting guide

## Challenges and Considerations

### Challenge 1: Natural Language Understanding
- **Problem**: Users phrase commands differently
- **Solution**: Provide many sample utterances, use AMAZON.SearchQuery for flexibility

### Challenge 2: Profile Disambiguation
- **Problem**: Multiple profiles with similar names
- **Solution**: Use exact matching, ask for clarification if ambiguous

### Challenge 3: Privacy
- **Problem**: Sensitive information spoken aloud
- **Solution**: Make sensitive commands opt-in, use display cards instead of voice

### Challenge 4: Latency
- **Problem**: Skill responses should be fast (<1 second)
- **Solution**: Optimize API calls, cache data in Lambda, use DynamoDB for session state

### Challenge 5: Multi-Device Sync
- **Problem**: Multiple Alexa devices in home
- **Solution**: Use account linking (not device linking), state is shared

## Testing Strategy

1. **Alexa Simulator**: Test all intents in developer console
2. **Echo Devices**: Test on real hardware (Echo, Echo Dot, Echo Show)
3. **Beta Testing**: Invite family members to test
4. **Regression Testing**: Re-test after API changes
5. **Stress Testing**: Test with many concurrent requests

## Security Considerations

1. **Access Token Security**:
   - Never log access tokens
   - Use HTTPS for all API calls
   - Rotate tokens regularly

2. **Admin Permissions**:
   - Verify admin status server-side
   - Don't allow privilege escalation via voice

3. **Input Validation**:
   - Sanitize all voice input
   - Validate slot values
   - Prevent injection attacks

4. **Rate Limiting**:
   - Limit requests per user
   - Prevent abuse of voice commands

## Monitoring and Analytics

Track these metrics:
- Intent usage frequency
- Error rates per intent
- Average response time
- Account linking success rate
- User retention

```typescript
logger.event('VoiceIntentInvoked', {
  intentName: 'AddTaskIntent',
  userId: user.id,
  source: 'alexa',
  responseTime: duration,
});

logger.event('VoiceError', {
  intentName: 'GetTasksIntent',
  errorType: 'api_failure',
  userId: user.id,
});
```

## Dependencies

- ask-sdk-core (Alexa)
- actions-on-google (Google Assistant)
- AWS Lambda (serverless hosting)
- OAuth 2.0 (account linking)

## Integration with Other Features

- **Multi-Profile Support**: Voice commands apply to speaker's profile
- **Task Management**: Add/complete tasks via voice
- **Meal Planning**: Query and modify meal plans
- **Reward Points**: Award and check points

## Future Enhancements

### Phase 2 Features
- **Google Assistant support**: Expand to Actions on Google
- **Advanced NLU**: Better understanding of complex requests
- **Routines**: "Alexa, good morning" triggers custom routine
- **Voice shopping**: "Add milk to grocery list and order from Amazon"

### Phase 3 Features
- **Voice authentication**: Security using voice biometrics
- **Multi-language support**: Spanish, French, etc.
- **Custom wake word**: "Hey Family Calendar" instead of "Alexa"
- **Voice notifications**: Proactive reminders via Alexa

### Advanced Ideas
- **Family announcements**: "Alexa, tell everyone dinner is ready"
- **Voice games**: "Alexa, start family chore challenge"
- **Voice journaling**: "Alexa, add note to family journal"
- **Smart home integration**: "Alexa, turn on calendar display"

## Cost Considerations

- **AWS Lambda**: Free tier covers most usage (1M requests/month)
- **Alexa Skills**: Free to develop and publish
- **Ongoing costs**: Lambda execution time (very low for voice skills)

## User Onboarding

### Setup Guide
1. Install Alexa app on phone
2. Search for "Family Calendar" skill
3. Enable skill
4. Link account (OAuth sign-in)
5. Test: "Alexa, open family calendar"

### Quick Start Commands
- "Alexa, ask family calendar what tasks I have today"
- "Alexa, tell family calendar to add milk to my grocery list"
- "Alexa, ask family calendar what's for dinner"

## Documentation

- **Skill Description**: Clear description in Alexa Skills Store
- **Help Intent**: "Alexa, ask family calendar for help"
- **Example Phrases**: Listed in skill details
- **FAQ**: Common questions and troubleshooting

---

Voice integration makes the family calendar more accessible and enables hands-free interaction, especially useful when cooking, cleaning, or when hands are full. Starting with Alexa provides the broadest reach, with Google Assistant as a logical next step.
