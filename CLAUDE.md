# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Next.js 16 full-stack Digital Wall Calendar — a privacy-first, self-hosted family hub with PostgreSQL, NextAuth.js authentication, multi-profile support, and local face recognition integration. Uses pnpm with hoisted node_modules (`node-linker=hoisted` in `.npmrc`), React Compiler for automatic memoization, and Test-Driven Development for all features.

## Quick Reference

```bash
# Development
pnpm dev                 # Dev server (Turbopack)
pnpm build               # Production build
pnpm build:standalone     # Build + prepare standalone
pnpm start:standalone     # Test standalone server

# Code quality (MUST run after every change)
pnpm lint:fix && pnpm format:fix && pnpm check-types

# Testing
pnpm test                # Run all tests

# Database
pnpm db:migrate          # Create migration (dev)
pnpm db:migrate:deploy   # Apply migrations (prod)
pnpm db:migrate:reset    # Reset + reapply all
pnpm db:migrate:status   # Check status

# Dependencies
pnpm bump-deps           # Update to @latest
pnpm bump-deps-minor     # Safe minor updates only
pnpm bump-ui             # Update shadcn components
```

## Key Technologies

**Current:** Next.js 16 (Turbopack, App Router) | React 19 (React Compiler) | TypeScript 5 (strict) | Tailwind CSS 4 (default palette) | shadcn/ui (copied to `src/components/ui/`)

**Planned:** PostgreSQL (Prisma ORM) | NextAuth.js v5 (Google OAuth) | Google Calendar/Tasks APIs | Frigate NVR (face recognition) | Alexa Skills Kit | Coolify/Docker deployment | Application Insights (optional)

## AI Agent Instructions

### Starting a Task

Work is tracked in **GitHub Issues** and the
[project board](https://github.com/users/BenSeymourODB/projects/1)
("Features Before Claude Subscription Close"). The project's `Day`,
`Phase`, `Cluster`, and `Priority` fields plus GitHub's native
`Blocked by` links are the source of truth for sequencing. At the start
of every session:

1. **Identify the issue** — read the linked GitHub issue (if provided) to understand requirements and acceptance criteria, and check its `Blocked by` list on github.com
2. **Check for an existing plan** — look in `.claude/plans/` for a file matching the feature/issue
3. **If a plan exists** — read it before writing any code; it contains specs, schemas, and testing strategies
4. **If no plan exists** — enter planning mode first. Produce a plan based on the GitHub issue (or the session prompt if no issue is linked) and save it to `.claude/plans/` before implementing

Never skip straight to implementation without a plan.

### Styling

Use **standard Tailwind CSS colors** only — default palette (`gray-*`, `blue-*`, `red-*`, `green-*`, `yellow-*`, etc.). See [docs/styling.md](./docs/styling.md).

### Logging

Application Insights is **not yet implemented**. The logger abstraction exists for future telemetry. Use `logger` from `@/lib/logger` — it auto-detects server vs client context. Four methods: `logger.error()`, `logger.log()`, `logger.event()`, `logger.dependency()` (server-only). See [`src/lib/logger.ts`](src/lib/logger.ts) for full API docs.

### React Compiler

Enabled by default. **DO NOT** use manual memoization (`useMemo`, `useCallback`, `React.memo`). Write clean, simple React code. See [docs/react-compiler.md](./docs/react-compiler.md).

### shadcn/ui

Components are **copied into `src/components/ui/`**, not installed as a package. Warn the user if installing components would overwrite existing customizations. Use the Shadcn MCP server to browse and install.

### TypeScript

Strict mode enabled. No `any` types. Use type inference where possible. Export types for reusable components.

### Code Quality — MANDATORY

**After every code change, run:** `pnpm lint:fix && pnpm format:fix && pnpm check-types`

All three must pass with zero errors. Pre-commit hooks (Husky + lint-staged) auto-fix on commit and block bad commits. A task is not complete until all checks pass.

### Test-Driven Development — MANDATORY

All new features follow TDD (red-green-refactor):

1. **Write tests first** — unit, integration, component, and E2E as appropriate
2. **Implement** — minimum code to make tests pass
3. **Refactor** — improve while keeping tests green
4. **Verify** — `pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types`

**Critical rules:**

- NEVER remove or weaken tests without explicit user authorization
- ALWAYS write tests before implementation
- No feature is complete until all tests pass

### UI Changes

When making UI changes, start the dev server and verify the feature in a browser before reporting completion. Test both the golden path and edge cases.

**Screenshots in PRs:** If E2E tests produce screenshots (e.g., Playwright), include up to 4 screenshots of successful test results in the pull request description to visually document the changes.

### Client-Side Storage

**Backend (PostgreSQL) is the source of truth.** Client-side storage is for performance optimization only:

- **IndexedDB** — cache API responses (calendar events, tasks, profiles)
- **LocalStorage** — user preferences (theme, UI settings)
- **Session Storage** — temporary UI state (form drafts, modals)

Never store auth data, secrets, or canonical data client-side. Always sync writes to backend first; cache is secondary. Clear cached data on logout.

### Next.js 16 Specifics

- Turbopack for all builds (stable in Next.js 16)
- Standalone output configured for deployment
- `revalidateTag()` requires second argument: `revalidateTag('tag', 'max')`
- React Compiler requires `babel-plugin-react-compiler` (already installed)

## Project Structure

```text
src/
├── app/              # App Router pages, layouts, API routes
├── components/       # React components
│   ├── ui/          # shadcn/ui components (copied)
│   └── providers/   # Context providers
├── lib/             # Utilities and shared logic
├── styles/          # Global styles
└── types/           # TypeScript type definitions

.claude/plans/        # Feature implementation plans (READ BEFORE implementing)
docs/                 # Detailed documentation
scripts/              # Build and deployment scripts
.github/workflows/    # CI/CD workflows
```

See [Starting a Task](#starting-a-task) for the plan-first workflow.

### Key Files

- `next.config.ts` — Next.js config (standalone output, React Compiler)
- `.npmrc` — pnpm config (hoisted node_modules)
- `.nvmrc` — Node.js version (22.x required)
- `src/lib/logger.ts` — Unified logging interface
- `.mcp.json` — MCP server configuration

## MCP Servers

Automatically loaded: **Next.js DevTools** (runtime state, docs) | **Context7** (library docs) | **Shadcn** (component browsing). See [docs/mcp-servers.md](./docs/mcp-servers.md).

## Documentation

- [docs/styling.md](./docs/styling.md) — Tailwind CSS usage
- [docs/react-compiler.md](./docs/react-compiler.md) — React Compiler details
- [docs/database.md](./docs/database.md) — Prisma migrations, troubleshooting
- [docs/deployment.md](./docs/deployment.md) — Deployment workflows
- [docs/application-insights.md](./docs/application-insights.md) — Telemetry (future)
- [docs/mcp-servers.md](./docs/mcp-servers.md) — MCP server usage
- [`.claude/plans/`](./.claude/plans/) — All feature implementation plans

## Checklist — Task Completion

A task is **not complete** until:

1. All tests pass (`pnpm test`)
2. All code quality checks pass (`pnpm lint:fix && pnpm format:fix && pnpm check-types`)
3. Feature matches the plan spec (if implementing from `.claude/plans/`)
4. Never commit test output artifacts (`test-results/`, `playwright-report/`, `blob-report/`)
5. Use `pnpm db:migrate` for schema changes (never `prisma db push`). See [docs/database.md](./docs/database.md)
