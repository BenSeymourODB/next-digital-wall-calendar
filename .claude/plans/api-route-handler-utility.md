# Plan: API Route Handler Utility (Issue #74 slice)

Issue: [#74 Code duplication across components](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/74)

## Scope

Issue #74 calls out broad "code duplication across components" with several concrete examples (event color mapping, date formatting, toast notification calls, error-handling patterns). Each is its own slice.

This PR delivers the **API route try/catch + auth + error-response** slice: extract the boilerplate that repeats verbatim across `src/app/api/**/route.ts` handlers, and migrate three high-traffic routes to use it. Other categories are deferred to follow-up PRs.

## Pattern being extracted

Every API route handler today repeats this shape:

```ts
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // ... business logic
    return NextResponse.json(result);
  } catch (error) {
    logger.error(error as Error, { endpoint: "...", method: "..." });
    return NextResponse.json({ error: "Failed to ..." }, { status: 500 });
  }
}
```

That's 6+ lines of duplicated try/catch + auth check + error logging in every handler.

## Design

New file `src/lib/api/handler.ts`:

```ts
// Typed thrown errors that the wrapper turns into NextResponse.json with the right status.
export class ApiError extends Error {
  constructor(message: string, public status: number) { ... }
}

// Unauthenticated -> throws ApiError("Unauthorized", 401). Returns a session
// narrowed to require user.id, so callers don't need their own null checks.
export async function requireUserSession(): Promise<AuthedSession> { ... }

// Wraps an async route handler with try/catch.
//   - If the handler throws ApiError -> JSON response with its message + status
//   - If the handler throws anything else -> logger.error + 500 with options.errorMessage
//   - Otherwise -> handler's own NextResponse passes through
export function withApiHandler<TArgs extends unknown[]>(
  options: { endpoint: string; method: string; errorMessage: string },
  handler: (...args: TArgs) => Promise<NextResponse>,
): (...args: TArgs) => Promise<NextResponse> { ... }
```

Why this shape:

- `ApiError` lets handlers throw 4xx with custom messages (`"Profile not found"`, `"Name is required"`) without nesting another `if` ladder around `NextResponse.json`.
- `requireUserSession` collapses the 401 boilerplate to one line. It throws `ApiError(401)`, which `withApiHandler` then renders as the same `{ error: "Unauthorized" }` response existing tests assert.
- `withApiHandler` is a wrapper rather than a decorator so it composes cleanly with Next.js's `(request, context)` signature for dynamic routes.

## Files

### Phase 1 — utility + unit tests (TDD)

- `src/lib/api/handler.ts` (new)
- `src/lib/api/__tests__/handler.test.ts` (new)

### Phase 2 — migrate three high-traffic routes

- `src/app/api/profiles/route.ts` — GET, POST
- `src/app/api/profiles/[id]/route.ts` — GET, PATCH, DELETE
- `src/app/api/settings/route.ts` — GET, PUT

Existing tests for these routes (`src/app/api/profiles/__tests__/route.test.ts`, `src/app/api/profiles/[id]/__tests__/route.test.ts`, `src/app/api/settings/__tests__/route.test.ts`) already verify exact response shapes:

- 401 with `{ error: "Unauthorized" }`
- 500 with `{ error: "Failed to <verb> <thing>" }`
- 4xx with the route-specific message (`"Profile not found"`, `"Name is required"`, etc.)

Migrations must keep those tests green without modification.

## Out of scope (deferred follow-ups)

- Migrating remaining API routes (`tasks/*`, `calendar/*`, `auth/*`, profiles admin operations, `settings/delete-account`)
- Client-side fetch + toast + error hook
- Shared event-color-mapping utility
- Shared date-formatting utility

These will land in subsequent #74 slices once the pattern proves out.

## Acceptance criteria

- `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` all green
- Existing route tests pass without modification
- Net LOC reduction across the three migrated route files
- New utility has unit tests covering: `ApiError` shape, `requireUserSession` happy path + 401, `withApiHandler` success path + ApiError path + unknown-error path
