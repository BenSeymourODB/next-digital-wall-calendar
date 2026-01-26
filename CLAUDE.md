# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Next.js 16 Digital Wall Calendar application with full backend server architecture. The project demonstrates:

1. **Full-stack application** - Backend server with PostgreSQL database, NextAuth.js authentication, and API routes
2. **Privacy-first family hub** - Self-hosted, multi-profile support, local face recognition integration
3. **Self-hosted deployment** - Designed for Coolify and Docker-based home server deployment
4. **Windows + pnpm compatibility** - Uses hoisted node_modules (`node-linker=hoisted` in `.npmrc`)
5. **React Compiler** - Automatic memoization for performance
6. **Test-Driven Development** - All new features require tests before implementation

## Quick Reference

### Development Commands

```bash
# Local development
pnpm dev              # Start dev server with Turbopack
pnpm build            # Production build
pnpm start            # Run production build

# Testing deployment locally
pnpm build:standalone # Build + prepare for Azure
pnpm start:standalone # Test standalone server

# Code quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix lint issues
pnpm format           # Check formatting
pnpm format:fix       # Fix formatting
pnpm check-types      # TypeScript type check

# Dependencies
pnpm bump-deps        # Update to @latest (major/minor)
pnpm bump-deps-minor  # Safe minor updates only
pnpm bump-ui          # Update shadcn components
```

## Key Technologies

### Current
- **Next.js 16** with Turbopack and App Router
- **React 19** with React Compiler enabled
- **TypeScript 5** with strict mode
- **Tailwind CSS 4** with default color palette
- **shadcn/ui** components (copied, not installed)

### Planned - Core Features
- **PostgreSQL** - Primary database via Prisma ORM
- **NextAuth.js v5** - Authentication with Google OAuth 2.0
- **Google Calendar API** - Calendar integration (server-side)
- **Google Tasks API** - Task management integration
- **Frigate NVR** - Local face recognition for profile switching
- **Amazon Alexa Skills Kit** - Voice integration
- **bcrypt** - PIN hashing for profile security

### Planned - Deployment & Monitoring (Future)
- **Coolify** - Self-hosted deployment platform
- **Docker** - Containerized deployment
- **Application Insights** - Logging and telemetry (optional, Azure-based)
- **Azure Web Apps** - Cloud hosting option (alternative to self-hosting)

## Important AI Agent Instructions

### 1. Styling

This project uses **standard Tailwind CSS colors**. Use the default Tailwind color palette (gray, blue, red, green, yellow, etc.).

**Examples:**

- **Grays/Neutrals:** `gray-*` (e.g., `bg-gray-50`, `text-gray-900`, `border-gray-200`)
- **Blue/Info:** `blue-*` (e.g., `bg-blue-600`, `text-blue-700`)
- **Red/Error:** `red-*` (e.g., `bg-red-600`, `text-red-700`)
- **Yellow/Warning:** `yellow-*` (e.g., `bg-yellow-600`, `text-yellow-700`)
- **Green/Success:** `green-*` (e.g., `bg-green-600`, `text-green-700`)

**See:** [docs/styling.md](./docs/styling.md) for complete styling documentation.

### 2. Logging (Optional - Application Insights)

**Note:** Application Insights integration is optional and planned for future. The logger abstraction is in place for when telemetry is added.

**For now:** Logger calls can be added for future telemetry, but logging infrastructure is not yet implemented.

**See:** [`logger` API documentation](src/lib/logger.ts) for comprehensive developer docs (when implemented).

**Server-Side (API Routes, Server Components, Middleware):**

```typescript
import { LogLevel, logger, startTimer } from "@/lib/logger";

// ✅ Always use unified logger on server (only 4 methods)
logger.error(error as Error, { context: "details" });
logger.event("UserAction", { userId: "123" });
logger.log("Operation completed", { duration: 100 }); // Info level (default)
logger.log("Debug details", { step: 1 }, LogLevel.Debug); // Debug level
logger.log("Warning message", { cache: "miss" }, LogLevel.Warn); // Warning level

// Improved DX - pass level without properties
logger.log("Cache miss", LogLevel.Warn);
logger.log("Debug checkpoint", LogLevel.Debug);

const timer = startTimer();
// ... operation ...
timer.end("operation_name", { metadata: "here" }); // Logs as event with duration
```

**Client-Side (Client Components, Browser):**

```typescript
"use client";
import { logger } from "@/lib/logger";

// ✅ Use logger in client components too
logger.error(error as Error, { component: "MyComponent" });
logger.event("ButtonClick", { buttonId: "submit" });
```

**Simplified Logger API - Only 4 Methods:**

1. **`logger.error(error, properties?)`** - Log errors/exceptions
2. **`logger.log(message, level?)` or `logger.log(message, properties?, level?)`** - Diagnostic messages (level: LogLevel.Debug | LogLevel.Info | LogLevel.Warn)
3. **`logger.event(name, properties?, measurements?)`** - User actions, business events
4. **`logger.dependency(...)`** - External API calls, database queries (server-only)

**When to use each:**

- **Exceptions**: Errors, failures → `logger.error()` (works everywhere)
- **Custom Events**: User actions, button clicks, feature usage → `logger.event()`
- **Dependencies**: External API calls, database queries → `logger.dependency()`
- **Traces**: Debug info, operational logs → `logger.log(message, props, level)`
- **Metrics**: Performance KPIs → `logger.event()` with measurements parameter
- **Page Views**: Automatically tracked by browser SDK (no code needed)

**✅ Use `logger` everywhere** - it automatically detects server vs client context.

**See:** [docs/application-insights.md](./docs/application-insights.md) for detailed guidance on each telemetry type (when implemented).

### 3. React Compiler

React Compiler is **enabled by default** in this project.

**DO NOT use manual memoization** (`useMemo`, `useCallback`, `React.memo`) unless absolutely necessary.

Write clean, simple React code - the compiler handles optimization automatically.

**See:** [docs/react-compiler.md](./docs/react-compiler.md) for detailed information.

### 4. shadcn/ui Components

UI components are **copied into `src/components/ui/`** (not installed as package).

**⚠️ Notify user if components are installed and overwrite existing customizations**

- Use the Shadcn MCP server to browse and install components
- Components are fully customizable and version-controlled

**See:** [docs/mcp-servers.md](./docs/mcp-servers.md) for MCP server usage.

### 5. TypeScript

- **Strict mode enabled** - All type errors must be resolved
- **No `any` types** - Use proper type definitions
- Use type inference where possible
- Export types for reusable components

### 6. Code Quality Standards - MANDATORY

**⚠️ ALWAYS run these commands after generating or modifying code:**

```bash
pnpm lint:fix      # Auto-fix ESLint issues
pnpm format:fix    # Auto-format with Prettier
pnpm check-types   # Verify TypeScript types
```

**Requirements:**

- **ESLint** - Must pass with zero errors (flat config with typescript-eslint)
- **Prettier** - All code must be formatted (no exceptions)
- **TypeScript** - Zero type errors allowed (strict mode enabled)
- **Pre-commit hooks** - Automatically enforce code quality on commit

**Pre-commit Hooks:**

This project uses **Husky** and **lint-staged** to automatically enforce code quality before commits:

- **Auto-fixes on commit**: ESLint and Prettier run automatically on staged files
- **Blocks bad commits**: Commits are blocked if unfixable lint errors exist
- **Runs only on changed files**: Fast and efficient, only checks staged files
- **No manual steps needed**: Just commit normally - hooks run automatically

**Workflow:**

1. Generate or modify code
2. Run `pnpm lint:fix` to auto-fix linting issues
3. Run `pnpm format:fix` to format code
4. Run `pnpm check-types` to verify types
5. Fix any remaining errors manually
6. Verify all checks pass before completing the task
7. Commit your changes - pre-commit hooks will run automatically

**Note:** Do not consider a task complete until all quality checks pass.

### 7. Test-Driven Development (TDD) - MANDATORY

**⚠️ All new features MUST follow Test-Driven Development methodology.**

This project requires TDD for all feature development. No feature is considered complete until all tests are passing.

**TDD Workflow:**

1. **Write tests first** - Before writing any implementation code
   - Unit tests for functions and utilities
   - Integration tests for API routes and database interactions
   - Component tests for React components
   - E2E tests for critical user flows

2. **Implement feature** - Write the minimum code to make tests pass
   - Follow existing patterns and conventions
   - Keep implementation simple and focused
   - Avoid over-engineering

3. **Refactor** - Improve code while keeping tests green
   - Optimize performance
   - Improve readability
   - Remove duplication

4. **Verify** - All checks must pass before completion
   ```bash
   pnpm test          # All tests passing
   pnpm lint:fix      # Zero ESLint errors
   pnpm format:fix    # Code formatted
   pnpm check-types   # Zero TypeScript errors
   ```

**Critical TDD Rules:**

- **NEVER remove tests** without explicit user authorization
- **NEVER modify test conditions** to make tests pass without explicit user authorization
- **ALWAYS write tests before implementation** (red-green-refactor cycle)
- **NO feature is complete** until all tests pass
- **Test coverage is mandatory** for new code

**When to write tests:**

- ✅ Before adding new features
- ✅ Before fixing bugs (regression tests)
- ✅ Before refactoring existing code
- ✅ For all API routes and database operations
- ✅ For all business logic and utilities
- ✅ For critical user interactions

**Test Types:**

```typescript
// Unit tests - Pure functions, utilities
describe('calculatePoints', () => {
  it('should award correct points for task completion', () => {
    expect(calculatePoints(task, profile)).toBe(10);
  });
});

// Integration tests - API routes, database
describe('POST /api/tasks', () => {
  it('should create task and award points', async () => {
    const response = await POST(request);
    expect(response.status).toBe(201);
  });
});

// Component tests - React components
describe('TaskList', () => {
  it('should render tasks for active profile', () => {
    render(<TaskList />);
    expect(screen.getByText('My Task')).toBeInTheDocument();
  });
});

// E2E tests - Critical user flows
test('user can complete task and see points update', async ({ page }) => {
  await page.click('[data-testid="task-checkbox"]');
  await expect(page.locator('[data-testid="points"]')).toHaveText('10');
});
```

**See:** Comprehensive feature plans in [`.claude/plans/`](./.claude/plans/) all include detailed testing strategies.

### 8. Local Storage and Caching Strategy

**⚠️ Backend server is the source of truth. Client-side storage is for performance optimization ONLY.**

This project uses a full backend server with PostgreSQL database. IndexedDB and LocalStorage are used strategically for performance, not as primary data stores.

**Architecture:**

```
Backend (Source of Truth)          Client (Performance Cache)
├─ PostgreSQL Database         →   ├─ IndexedDB (structured data)
├─ NextAuth.js Sessions        →   ├─ LocalStorage (preferences)
├─ Google Calendar API         →   └─ Memory (ephemeral state)
└─ Google Tasks API
```

**When to use client-side storage:**

- ✅ **IndexedDB**: Caching API responses for offline/fast access
  - Google Calendar events (sync every 5 minutes)
  - Task lists (sync on change)
  - Profile data (sync on switch)

- ✅ **LocalStorage**: User preferences and settings
  - Theme selection (dark/light mode)
  - Screen rotation settings
  - UI preferences (collapsed sections, etc.)

- ✅ **Session Storage**: Temporary UI state
  - Form drafts (auto-save)
  - Modal state
  - Navigation history

**When NOT to use client-side storage:**

- ❌ **User authentication** - Use NextAuth.js server sessions only
- ❌ **Sensitive data** - PINs, tokens, secrets (server-side only)
- ❌ **Source of truth** - Database is always authoritative
- ❌ **Cross-device sync** - Use backend for data that needs to sync

**Best Practices:**

1. **Always validate cached data** - Check timestamps, handle stale data
2. **Sync on write** - Update backend immediately, cache is secondary
3. **Handle cache misses** - Gracefully fallback to backend
4. **Clear on logout** - Remove all cached user data
5. **Version cache schema** - Handle migrations for cache structure changes

**Example Pattern:**

```typescript
// ✅ Good: Backend is source of truth, cache for speed
async function getTasks(profileId: string) {
  // Try cache first for fast response
  const cached = await cache.get(`tasks:${profileId}`);
  if (cached && !isStale(cached)) {
    return cached.data;
  }

  // Fetch from backend (source of truth)
  const tasks = await fetch(`/api/tasks?profileId=${profileId}`);

  // Update cache for next time
  await cache.set(`tasks:${profileId}`, tasks);

  return tasks;
}

// ❌ Bad: Client-side storage as source of truth
async function updateTask(task: Task) {
  await indexedDB.put('tasks', task); // Wrong! Backend not updated
}
```

### 9. File Organization

```text
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # React components
│   ├── ui/          # shadcn/ui components (copied)
│   └── providers/   # Context providers
├── lib/             # Utility functions and shared logic
├── styles/          # Global styles
└── types/           # TypeScript type definitions

.claude/
└── plans/           # Feature implementation plans (MUST READ before implementing)
                     # - server-side-auth.md
                     # - modular-sync-architecture.md (Privacy-first data storage)
                     # - multi-profile-family-support.md
                     # - google-tasks-todo-list.md
                     # - reward-point-system.md
                     # - meal-planning.md
                     # - face-recognition-profile-switching.md
                     # - voice-integration.md
                     # - And more...

docs/                # Documentation (for humans, not AI agents)
scripts/             # Build and deployment scripts
.github/workflows/   # CI/CD workflows
```

**⚠️ Important:** Before implementing any planned feature, ALWAYS read the corresponding plan in `.claude/plans/` first. These plans contain:
- Complete technical specifications
- Database schemas and API routes
- Visual mockups and component hierarchies
- Testing strategies
- Implementation roadmaps

### 10. Next.js 16 Specific

- **Turbopack** - Used for all builds (stable in Next.js 16)
- **Standalone output** - Configured for Azure deployment
- **No compression** - Azure Front Door handles it
- **React 19 required** - For React Compiler support

**Breaking changes:**

- `revalidateTag()` requires second argument: `revalidateTag('tag', 'max')`
- React Compiler requires `babel-plugin-react-compiler` (already installed)

## Documentation Reference

**For detailed information, refer to these documentation files:**

- **[Application Insights](./docs/application-insights.md)** - Logging, telemetry, troubleshooting
- **[React Compiler](./docs/react-compiler.md)** - How it works, best practices
- **[Deployment](./docs/deployment.md)** - Azure deployment, workflows, scripts
- **[Styling](./docs/styling.md)** - Tailwind CSS usage, components
- **[MCP Servers](./docs/mcp-servers.md)** - Next.js DevTools, Context7, Shadcn

## Project Structure Context

### Key Files

- `next.config.ts` - Next.js configuration (standalone output, React Compiler)
- `.npmrc` - pnpm configuration (hoisted node_modules)
- `.nvmrc` - Node.js version (22.x required)
- `src/lib/logger.ts` - Unified logging interface
- `.mcp.json` - MCP server configuration

### Deployment Scripts

- `scripts/copy-static-to-standalone.js` - Copies static assets for standalone build
- `scripts/lift-pnpm-standalone.js` - Resolves pnpm symlinks (legacy, mostly no-op now)

### GitHub Actions

- `.github/workflows/main_nextjs-template-build.yml` - Simple build workflow
- `.github/workflows/secretless-deploy-sample.yml` - Full deployment with OIDC auth

## MCP Server Usage

This project automatically loads these MCP servers:

- **Next.js DevTools** - Runtime errors, routes, logs, Next.js documentation
- **Context7** - Up-to-date library documentation and code examples
- **Shadcn** - Browse and install shadcn/ui components

**When to use:**

- Next.js DevTools: Before implementing changes, check runtime state first
- Context7: When you need library documentation or setup instructions
- Shadcn: When adding UI components or searching for examples

**See:** [docs/mcp-servers.md](./docs/mcp-servers.md) for detailed MCP server information.

## Common Patterns

### Adding a New Page

```tsx
// src/app/my-page/page.tsx
export default function MyPage() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold text-gray-900">My Page</h1>
    </div>
  );
}
```

### Adding API Route with Error Handling and Logging

```tsx
// src/app/api/users/route.ts
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

// Custom error types for specific handling
class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("id");

    // Validate input
    if (!userId || userId.length === 0) {
      throw new ValidationError("User ID is required");
    }

    // Fetch data
    const user = await database.users.findUnique({ where: { id: userId } });

    if (!user) {
      logger.log("User not found", { userId, endpoint: "/api/users" }, "warn");
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    logger.log("User fetched successfully", { userId, endpoint: "/api/users" });
    return NextResponse.json({ user });
  } catch (error) {
    // Handle specific error types with user-friendly messages
    if (error instanceof ValidationError) {
      logger.log(
        "Validation error",
        {
          error: error.message,
          endpoint: "/api/users",
        },
        "warn"
      );
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof DatabaseError) {
      logger.error(error, {
        endpoint: "/api/users",
        errorType: "database",
      });
      return NextResponse.json(
        { error: "Unable to retrieve user data. Please try again later." },
        { status: 503 }
      );
    }

    // Handle unexpected errors
    logger.error(error as Error, {
      endpoint: "/api/users",
      errorType: "unexpected",
    });
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
```

### Adding a UI Component

```tsx
// src/components/my-component.tsx
import { Button } from "@/components/ui/button";

export function MyComponent() {
  return (
    <div className="space-y-4">
      <p className="text-gray-600">Description text</p>
      <Button className="bg-blue-600 hover:bg-blue-700">Click me</Button>
    </div>
  );
}
```

## Important Notes

1. **Follow TDD methodology** - Write tests first, never remove tests without authorization
2. **Read feature plans first** - Check `.claude/plans/` before implementing planned features
3. **Backend is source of truth** - Use IndexedDB/LocalStorage for performance only, not as primary data store
4. **Use standard Tailwind colors** - Default color palette (gray, blue, red, etc.)
5. **Use the logger** - For all errors, events, and performance tracking
6. **Let React Compiler optimize** - Don't add manual memoization
7. **ALWAYS lint and format** - Run `pnpm lint:fix && pnpm format:fix && pnpm check-types` after generating/modifying code
8. **Test locally** - Use `pnpm build:standalone && pnpm start:standalone`
9. **Consult docs/** - For detailed information on specific topics

**⚠️ Critical:** Do not consider any task complete until:
- All tests are passing (`pnpm test`)
- All code quality checks pass (ESLint, Prettier, TypeScript)
- Feature matches the plan specification (if implementing from `.claude/plans/`)

## Need More Information?

### Documentation
- **React Compiler:** See [docs/react-compiler.md](./docs/react-compiler.md)
- **Styling:** See [docs/styling.md](./docs/styling.md)
- **MCP Servers:** See [docs/mcp-servers.md](./docs/mcp-servers.md)

### Future Documentation (Optional)
- **Application Insights:** See [docs/application-insights.md](./docs/application-insights.md) - Optional telemetry (Azure-based)
- **Cloud Deployment:** See [docs/deployment.md](./docs/deployment.md) - Azure deployment (alternative to self-hosting)

### Feature Plans
- **All Features:** See [`.claude/plans/`](./.claude/plans/) for comprehensive implementation plans
  - Server-Side Authentication
  - Modular Sync Architecture (Privacy-first data storage)
  - Multi-Profile Family Support
  - Task Management (Google Tasks)
  - Reward Point System
  - Meal Planning
  - Face Recognition Profile Switching
  - Voice Integration (Alexa/Google)
  - And more...
