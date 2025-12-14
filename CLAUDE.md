# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a Next.js 16 template repository for Our Daily Bread Ministries. The project demonstrates:

1. **Windows + pnpm compatibility** - Uses hoisted node_modules (`node-linker=hoisted` in `.npmrc`)
2. **Secretless Azure authentication** - OIDC-based GitHub Actions deployment
3. **Application Insights integration** - Comprehensive logging and telemetry
4. **React Compiler** - Automatic memoization for performance

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

- **Next.js 16** with Turbopack and App Router
- **React 19** with React Compiler enabled
- **TypeScript 5** with strict mode
- **Tailwind CSS 4** with custom ODBM color palette
- **shadcn/ui** components (copied, not installed)
- **Application Insights** for logging and telemetry
- **Azure Web Apps** for hosting

## Important AI Agent Instructions

### 1. Color System - CRITICAL

**⚠️ DO NOT use default Tailwind colors** like `bg-blue-600`, `text-red-500`, etc.

This project uses a **custom ODBM color palette** defined in `src/styles/odbm.css`.

**Required color usage:**

- **Grays/Neutrals:** `stone-*` (e.g., `bg-stone-50`, `text-stone-900`, `border-stone-200`)
- **Blue/Info:** `sky-*` (e.g., `bg-sky-600`, `text-sky-700`)
- **Red/Error:** `rose-*` or `poppy` (e.g., `bg-rose-600`, `text-rose-700`)
- **Orange/Warning:** `amber-*` (e.g., `bg-amber-600`, `text-amber-700`)
- **Green/Success:** `lime-*` or `donation-green` (e.g., `bg-lime-600`, `text-donation-green`)

**See:** [docs/styling.md](./docs/styling.md) for complete color system documentation.

### 2. Application Insights Logging

**Critical:** Use the correct logging method based on where your code runs.

**⚠️ Note:** Custom ESLint rules automatically enforce this - you'll get errors if you try to use `trackException` on the server.

**See:** [`logger` API documentation](src/lib/logger.ts) for comprehensive developer docs.

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

**See:** [docs/application-insights.md](./docs/application-insights.md) for detailed guidance on each telemetry type.

### 3. React Compiler

React Compiler is **enabled by default** in this project.

**DO NOT use manual memoization** (`useMemo`, `useCallback`, `React.memo`) unless absolutely necessary.

Write clean, simple React code - the compiler handles optimization automatically.

**See:** [docs/react-compiler.md](./docs/react-compiler.md) for detailed information.

### 4. shadcn/ui Components

UI components are **copied into `src/components/ui/`** (not installed as package).

\*\*⚠️ Notify user if components are installed and overwrite existing customizations

- Use the Shadcn MCP server to browse and install components
- Components are fully customizable and version-controlled
- All components use the custom ODBM color palette

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

### 7. File Organization

```text
src/
├── app/              # Next.js App Router pages and layouts
├── components/       # React components
│   ├── ui/          # shadcn/ui components (copied)
│   └── providers/   # Context providers
├── lib/             # Utility functions and shared logic
├── styles/          # Global styles and odbm.css
└── types/           # TypeScript type definitions

docs/                # Documentation (for humans, not AI agents)
scripts/             # Build and deployment scripts
.github/workflows/   # CI/CD workflows
```

### 8. Next.js 16 Specific

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
- **[Styling](./docs/styling.md)** - Color system, Tailwind usage, components
- **[MCP Servers](./docs/mcp-servers.md)** - Next.js DevTools, Context7, Shadcn

## Project Structure Context

### Key Files

- `next.config.ts` - Next.js configuration (standalone output, React Compiler)
- `.npmrc` - pnpm configuration (hoisted node_modules)
- `.nvmrc` - Node.js version (22.x required)
- `src/lib/logger.ts` - Unified logging interface
- `src/styles/odbm.css` - Custom color palette (CRITICAL)
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
      <h1 className="text-3xl font-bold text-stone-900">My Page</h1>
      {/* Use stone-* colors, not default Tailwind colors */}
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
      {/* Use stone-* for grays, sky-* for blues */}
      <p className="text-stone-600">Description text</p>
      <Button className="bg-sky-600 hover:bg-sky-700">Click me</Button>
    </div>
  );
}
```

## Important Notes

1. **Always use custom colors** - Never default Tailwind colors
2. **Use the logger** - For all errors, events, and performance tracking
3. **Let React Compiler optimize** - Don't add manual memoization
4. **ALWAYS lint and format** - Run `pnpm lint:fix && pnpm format:fix && pnpm check-types` after generating/modifying code
5. **Test locally** - Use `pnpm build:standalone && pnpm start:standalone`
6. **Consult docs/** - For detailed information on specific topics

**⚠️ Critical:** Do not consider any task complete until all code quality checks pass (ESLint, Prettier, TypeScript).

## Need More Information?

- **Application Insights:** See [docs/application-insights.md](./docs/application-insights.md)
- **React Compiler:** See [docs/react-compiler.md](./docs/react-compiler.md)
- **Deployment:** See [docs/deployment.md](./docs/deployment.md)
- **Styling:** See [docs/styling.md](./docs/styling.md)
- **MCP Servers:** See [docs/mcp-servers.md](./docs/mcp-servers.md)
