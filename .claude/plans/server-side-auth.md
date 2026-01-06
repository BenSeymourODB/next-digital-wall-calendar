# Server-Side Authentication with Refresh Token Storage

## Overview
Transition from client-side Google Identity Services (GIS) to server-side OAuth 2.0 authentication with refresh tokens stored in a database. This enables secure, persistent access to Google APIs (Calendar, Tasks) without requiring users to re-authenticate frequently.

## Requirements

### Core Features

#### 1. OAuth 2.0 Flow
- **Authorization Code Flow**: Server-side OAuth with PKCE (recommended)
- **Scopes**:
  - `https://www.googleapis.com/auth/calendar.readonly` - Read calendar events
  - `https://www.googleapis.com/auth/tasks` - Read/write tasks
  - `openid email profile` - User identification
- **Consent Screen**: Google OAuth consent screen
- **Callback Handling**: Receive and process authorization code

#### 2. Token Management
- **Access Tokens**: Short-lived (1 hour), stored in session
- **Refresh Tokens**: Long-lived, stored in database
- **Automatic Refresh**: Refresh access tokens when expired
- **Token Revocation**: Support for revoking tokens (logout)

#### 3. Session Management
- **Options**:
  - **Option A**: NextAuth.js (recommended for ease of use)
  - **Option B**: Custom session with JWT
  - **Option C**: Custom session with server-side storage
- **Session Duration**: Configurable (default: 30 days)
- **Secure Cookies**: HttpOnly, Secure, SameSite

#### 4. Database Schema
- **Users Table**: Store user information
- **OAuth Tokens Table**: Store refresh tokens per user
- **Database Options**:
  - PostgreSQL (recommended for production)
  - SQLite (for development)
  - Prisma ORM (for type-safe database access)

#### 5. Multi-User Support
- **User Isolation**: Each user has separate data
- **Multiple Accounts**: Users can connect multiple Google accounts
- **Account Switching**: UI to switch between connected accounts

## Technical Implementation Plan

### 1. Architecture Overview

```
User Browser
     ↓
Next.js Frontend
     ↓
Next.js API Routes (protected with middleware)
     ↓
Session/JWT Verification
     ↓
Database (User + OAuth Tokens)
     ↓
Google APIs (Calendar, Tasks)
```

### 2. Technology Stack

**Recommended Stack:**
- **Auth Library**: NextAuth.js v5 (Auth.js)
- **Database**: PostgreSQL with Prisma ORM
- **Session**: JWT-based sessions (NextAuth default)
- **Deployment**: Azure Web Apps with PostgreSQL

**Alternative Stack:**
- **Auth Library**: Custom implementation
- **Database**: Azure SQL Database
- **Session**: Server-side with Redis
- **Deployment**: Azure Web Apps with Redis Cache

### 3. Database Schema (Prisma)

```prisma
// schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  emailVerified DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  settings      UserSettings?
  taskConfigs   TaskListConfig[]
  rewardPoints  RewardPoints?
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String  // "oauth"
  provider          String  // "google"
  providerAccountId String  // Google user ID
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

model UserSettings {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  defaultTaskPoints       Int      @default(10)
  rewardSystemEnabled     Boolean  @default(false)
  theme                   String   @default("light")
  defaultZoomLevel        Float    @default(1.0)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model TaskListConfig {
  id           String   @id @default(cuid())
  userId       String
  name         String
  lists        Json     // Array of TaskListSelection
  showCompleted Boolean @default(false)
  sortBy       String   @default("dueDate")

  user User @relation(fields: [userId], references: [id])
}

model RewardPoints {
  id           String   @id @default(cuid())
  userId       String   @unique
  totalPoints  Int      @default(0)
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### 4. NextAuth.js Configuration

```typescript
// src/lib/auth/auth.config.ts
import { NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';

export const authConfig: NextAuthConfig = {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/tasks',
          ].join(' '),
          access_type: 'offline',  // Request refresh token
          prompt: 'consent',        // Force consent to get refresh token
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, user }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at! * 1000,
          user,
        };
      }

      // Return previous token if access token has not expired
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // Access token has expired, try to refresh it
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.user = token.user as any;
      session.accessToken = token.accessToken as string;
      session.error = token.error as string | undefined;

      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};

async function refreshAccessToken(token: any) {
  try {
    const url =
      'https://oauth2.googleapis.com/token?' +
      new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
      });

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      throw refreshedTokens;
    }

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken,
    };
  } catch (error) {
    logger.error(error as Error, {
      context: 'RefreshAccessTokenError',
    });

    return {
      ...token,
      error: 'RefreshAccessTokenError',
    };
  }
}
```

```typescript
// src/lib/auth/auth.ts
import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
});
```

### 5. API Route Protection

```typescript
// src/middleware.ts
import { auth } from '@/lib/auth/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isAuthenticated = !!req.auth;
  const isApiRoute = req.nextUrl.pathname.startsWith('/api');
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');

  // Allow auth routes
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // Protect API routes (except auth)
  if (isApiRoute && !isAuthenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/api/:path*', '/dashboard/:path*', '/settings/:path*'],
};
```

### 6. Helper Functions for API Routes

```typescript
// src/lib/auth/helpers.ts
import { auth } from '@/lib/auth/auth';
import { NextRequest } from 'next/server';

/**
 * Get the current user's session
 */
export async function getSession() {
  return await auth();
}

/**
 * Get access token for current user
 */
export async function getAccessToken(request?: NextRequest): Promise<string> {
  const session = await getSession();

  if (!session?.accessToken) {
    throw new Error('No access token available');
  }

  if (session.error === 'RefreshAccessTokenError') {
    throw new Error('Failed to refresh access token');
  }

  return session.accessToken;
}

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  const session = await getSession();

  if (!session?.user) {
    throw new Error('Not authenticated');
  }

  return session.user;
}

/**
 * Require authentication (throw if not authenticated)
 */
export async function requireAuth() {
  const session = await getSession();

  if (!session) {
    throw new Error('Not authenticated');
  }

  return session;
}
```

### 7. Updated API Routes

```typescript
// src/app/api/tasks/route.ts
import { getAccessToken } from '@/lib/auth/helpers';
import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const listId = searchParams.get('listId');

    if (!listId) {
      return NextResponse.json(
        { error: 'listId is required' },
        { status: 400 }
      );
    }

    // Get access token from session (automatically refreshed if needed)
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Google Tasks API error: ${response.statusText}`);
    }

    const data = await response.json();

    logger.log('Tasks fetched successfully', {
      listId,
      taskCount: data.items?.length || 0,
    });

    return NextResponse.json(data.items || []);
  } catch (error) {
    logger.error(error as Error, {
      endpoint: '/api/tasks',
      errorType: 'fetch_tasks',
    });

    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
```

### 8. Sign In Page

```tsx
// src/app/auth/signin/page.tsx
'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';

export default function SignInPage() {
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/dashboard' });
    } catch (error) {
      console.error('Sign in error:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">
          Sign in to Digital Wall Calendar
        </h1>

        <p className="text-gray-600 mb-6 text-center">
          Sign in with your Google account to access your calendar and tasks.
        </p>

        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            'Signing in...'
          ) : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                {/* Google icon SVG */}
              </svg>
              Sign in with Google
            </>
          )}
        </button>

        <p className="text-sm text-gray-500 mt-4 text-center">
          By signing in, you agree to allow this app to access your Google
          Calendar and Tasks.
        </p>
      </div>
    </div>
  );
}
```

### 9. Client-Side Session Access

```tsx
// src/components/providers/session-provider.tsx
'use client';

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}

// Usage in root layout
// src/app/layout.tsx
import { SessionProvider } from '@/components/providers/session-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
```

```tsx
// Example: Using session in a client component
'use client';

import { useSession, signOut } from 'next-auth/react';

export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  if (!session) {
    return <a href="/auth/signin">Sign in</a>;
  }

  return (
    <div>
      <p>Signed in as {session.user?.email}</p>
      <button onClick={() => signOut()}>Sign out</button>
    </div>
  );
}
```

### 10. Environment Variables

```bash
# .env.local

# NextAuth.js
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here  # Generate with: openssl rand -base64 32

# Google OAuth
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/calendar_db

# For production (Azure)
# DATABASE_URL=postgresql://user@server:password@server.postgres.database.azure.com:5432/calendar_db?sslmode=require
```

## Implementation Steps

### Phase 1: Setup (Foundation)

1. **Install dependencies**
   ```bash
   pnpm add next-auth@beta @auth/prisma-adapter prisma @prisma/client
   pnpm add -D @types/bcrypt
   ```

2. **Set up Prisma**
   - Initialize Prisma: `pnpm prisma init`
   - Update schema.prisma with models above
   - Create migration: `pnpm prisma migrate dev --name init`
   - Generate client: `pnpm prisma generate`

3. **Configure Google OAuth**
   - Go to Google Cloud Console
   - Create OAuth 2.0 credentials
   - Add authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google`
     - `https://your-domain.com/api/auth/callback/google`
   - Add required scopes to OAuth consent screen
   - Copy Client ID and Secret to .env.local

4. **Set up NextAuth.js**
   - Create auth configuration files
   - Set up API route: `src/app/api/auth/[...nextauth]/route.ts`
   - Create sign-in page
   - Add SessionProvider to root layout

### Phase 2: Migration (Update Existing Code)

5. **Update API routes**
   - Replace client-side token access with server-side
   - Use getAccessToken() helper in all API routes
   - Add error handling for auth failures
   - Test each API route

6. **Update client components**
   - Remove client-side GIS initialization
   - Use useSession() hook for session access
   - Update UI to show sign-in/sign-out
   - Test auth flows

7. **Add middleware**
   - Create middleware.ts for route protection
   - Test protected routes
   - Test unauthorized access

### Phase 3: Testing and Refinement

8. **Test authentication flows**
   - Sign in with Google
   - Token refresh after 1 hour
   - Sign out
   - Session persistence
   - Multiple users

9. **Test API integration**
   - Calendar API calls
   - Tasks API calls
   - Error handling
   - Token expiration scenarios

10. **Production preparation**
    - Set up production database (Azure PostgreSQL)
    - Configure production environment variables
    - Test deployment
    - Set up database backups
    - Monitor logs for auth issues

## Challenges and Considerations

### Challenge 1: Token Refresh Complexity
- **Problem**: Access tokens expire every hour, need automatic refresh
- **Solution**: NextAuth.js handles this automatically via JWT callback

### Challenge 2: Multiple Google Accounts
- **Problem**: Users may want to connect multiple Google accounts
- **Solution**:
  - Phase 1: Support one account per user
  - Phase 2: Add support for multiple accounts with account switching UI

### Challenge 3: Migration from Client-Side
- **Problem**: Existing users may have client-side sessions
- **Solution**:
  - No migration needed (client-side is stateless)
  - Users will need to sign in again

### Challenge 4: Database Hosting
- **Problem**: Need to host PostgreSQL database
- **Solution**:
  - Development: Local PostgreSQL or SQLite
  - Production: Azure Database for PostgreSQL
  - Alternative: Supabase (managed PostgreSQL)

### Challenge 5: Secret Management
- **Problem**: Storing client secret and NextAuth secret securely
- **Solution**:
  - Development: .env.local (gitignored)
  - Production: Azure App Settings or Key Vault

### Challenge 6: Session Security
- **Problem**: JWT tokens can be large, need to secure session cookies
- **Solution**:
  - Use HttpOnly cookies (NextAuth default)
  - Enable Secure flag in production
  - Set SameSite=Lax or Strict

## Testing Strategy

1. **Unit Tests**:
   - Token refresh logic
   - Session validation
   - Helper functions

2. **Integration Tests**:
   - OAuth flow
   - API route authentication
   - Token expiration handling

3. **E2E Tests**:
   - Complete sign-in flow
   - API calls with authentication
   - Sign-out flow
   - Session persistence across page reloads

4. **Manual Tests**:
   - Test on real Google account
   - Verify refresh token storage in database
   - Test token refresh after 1 hour
   - Test session expiration after 30 days

## Security Considerations

1. **Secrets Management**:
   - Never commit .env files to git
   - Use environment variables for all secrets
   - Rotate secrets periodically

2. **Token Storage**:
   - Store refresh tokens encrypted in database (optional but recommended)
   - Never expose tokens to client-side
   - Use HttpOnly cookies for session tokens

3. **Session Security**:
   - Set secure cookie attributes
   - Implement CSRF protection (NextAuth.js does this)
   - Use short access token lifetime (1 hour)
   - Use reasonable session lifetime (30 days)

4. **Database Security**:
   - Use SSL/TLS for database connections
   - Implement database access controls
   - Regular database backups
   - Monitor for suspicious activity

## Deployment Considerations

### Azure Deployment

1. **Database**:
   - Azure Database for PostgreSQL (Flexible Server)
   - Configure firewall rules
   - Enable SSL
   - Set up connection pooling

2. **App Service**:
   - Configure environment variables in App Settings
   - Enable Always On (if needed for long-running sessions)
   - Configure custom domain
   - Enable HTTPS only

3. **Secrets**:
   - Store in Azure Key Vault (optional)
   - Or use App Settings (encrypted at rest)

## Monitoring and Logging

- Log all authentication events (sign in, sign out, token refresh)
- Monitor token refresh failures
- Alert on high error rates
- Track session durations
- Monitor database performance

```typescript
// Example logging
logger.event('UserSignedIn', {
  userId: user.id,
  email: user.email,
  provider: 'google',
});

logger.event('TokenRefreshed', {
  userId: user.id,
  success: true,
});

logger.error(error, {
  context: 'TokenRefreshFailed',
  userId: user.id,
});
```

## Dependencies

- next-auth (v5 / Auth.js)
- @auth/prisma-adapter
- prisma
- @prisma/client
- PostgreSQL database

## Integration with Other Features

All features that use Google APIs depend on this:
- Analog Clock Calendar component
- Google Tasks to-do list
- New task modal
- Any future Google API integrations

User-specific features also depend on this:
- User settings page
- Reward points system
- Task list configurations
- Screen rotation schedules (per-user)

## Future Enhancements

- Support for other OAuth providers (Microsoft, Apple)
- Two-factor authentication
- Magic link authentication (passwordless)
- Account linking (connect multiple providers)
- API key generation for third-party access
- Webhook support for real-time updates
