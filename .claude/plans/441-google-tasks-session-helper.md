# Plan: Extract requireGoogleTasksSession (Issue #441 slice 1 of 3)

Issue: [#441 Repeated auth/token/PIN validation patterns duplicated across API routes](https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/441)

## Scope (this PR)

Issue #441 calls out **three** distinct duplications:

1. **Session existence + `RefreshTokenError` 401 + Google-Tasks access-token acquisition** repeated across 4 task routes and 1 auth route.
2. **Profile-ownership check** repeated across PIN routes (set/reset/verify).
3. **PIN lockout + bcrypt** logic inlined in `verify-pin` route — should be a service.

**This PR delivers slice 1 only.** Slices 2 and 3 are deferred to follow-up issues filed alongside this PR, to keep the diff focused and reviewable.

## Pattern being extracted

Every Google-Tasks route opens with this 15-line preamble:

```ts
const session = await getSession();
if (!session?.user) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

if (session.error === "RefreshTokenError") {
  return NextResponse.json(
    {
      error: "Session expired. Please sign in again.",
      requiresReauth: true,
    },
    { status: 401 }
  );
}

const accessToken = await requireGoogleTasksAccessToken(session);
```

Plus a duplicated `catch` arm for `AuthError`:

```ts
if (error instanceof AuthError) {
  const requiresReauth = error.status === 401 || error.status === 403;
  return NextResponse.json({ error: error.message, requiresReauth }, { status: error.status });
}
```

That's ~20 lines repeated across 4 task routes (`tasks/route.ts`, `tasks/[taskId]/route.ts`, `tasks/[taskId]/complete/route.ts`, `tasks/lists/route.ts`) and the first half (~10 lines) in `auth/account/route.ts`.

## Design

### `AuthError` extension

Add an explicit `requiresReauth?: boolean` property + constructor option. When set, the catch block uses it verbatim; when unset, the catch block keeps the current `status === 401 || 403` fallback so existing throw-sites are unchanged.

```ts
export class AuthError extends Error {
  status: number;
  requiresReauth?: boolean;

  constructor(message: string, status: number = 401, options?: { requiresReauth?: boolean }) {
    super(message);
    this.name = "AuthError";
    this.status = status;
    this.requiresReauth = options?.requiresReauth;
  }
}
```

### Two new helpers in `src/lib/auth/helpers.ts`

```ts
// Session existence + RefreshTokenError. Throws AuthError tagged with
// the correct requiresReauth flag.
export async function requireAuthenticatedSession(): Promise<{
  session: Session & { user: { id: string } };
}> {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new AuthError("Unauthorized", 401, { requiresReauth: false });
  }
  if (session.error === "RefreshTokenError") {
    throw new AuthError("Session expired. Please sign in again.", 401, {
      requiresReauth: true,
    });
  }
  return { session };
}

// Composes the above with the existing requireGoogleTasksAccessToken.
export async function requireGoogleTasksSession(): Promise<{
  session: Session & { user: { id: string } };
  accessToken: string;
}> {
  const { session } = await requireAuthenticatedSession();
  const accessToken = await requireGoogleTasksAccessToken(session);
  return { session, accessToken };
}
```

### Route catch-block update

The migrated routes change their `AuthError` catch arm from:

```ts
const requiresReauth = error.status === 401 || error.status === 403;
return NextResponse.json({ error: error.message, requiresReauth }, { status: error.status });
```

to:

```ts
const requiresReauth = error.requiresReauth ?? (error.status === 401 || error.status === 403);
const body: Record<string, unknown> = { error: error.message };
if (requiresReauth) body.requiresReauth = true;
return NextResponse.json(body, { status: error.status });
```

This is **observably equivalent** for every existing throw-site:

- Missing-session response: `{ error: "Unauthorized" }` (no `requiresReauth` field, because the new helper sets the flag to `false` explicitly). Existing tests assert `data.error === "Unauthorized"` without an opinion on the field's presence.
- `RefreshTokenError` response: `{ error: "Session expired. Please sign in again.", requiresReauth: true }` — same as today.
- Scope-missing (403) response: `{ error: "...", requiresReauth: true }` — same as today (no flag set, status falls back to 403 → true).
- Other AuthErrors from `requireGoogleTasksAccessToken`: same as today.

## Files

### Phase 1 — helper + AuthError extension (TDD)

- `src/lib/auth/helpers.ts` (modify)
- `src/lib/auth/__tests__/helpers.test.ts` (add tests for the two new helpers + `AuthError.requiresReauth`)

### Phase 2 — migrate 5 routes

- `src/app/api/tasks/route.ts`
- `src/app/api/tasks/[taskId]/route.ts`
- `src/app/api/tasks/[taskId]/complete/route.ts`
- `src/app/api/tasks/lists/route.ts`
- `src/app/api/auth/account/route.ts`

Existing tests in each route's `__tests__/route.test.ts` must pass **without modification** — they encode the public contract this refactor must preserve.

## Out of scope (follow-up issues to file alongside this PR)

1. **PIN routes — extract `withProfileOwnershipCheck`** (#441 item 2). Covers `profiles/[id]/set-pin/route.ts`, `.../reset-pin/route.ts`, `.../verify-pin/route.ts`.
2. **PIN routes — extract `pinVerificationService`** (#441 item 3). Move bcrypt + `MAX_FAILED_ATTEMPTS` + `LOCKOUT_DURATION_MS` out of `verify-pin/route.ts` into `lib/services/pin-verification.ts`.

Both are deliberately deferred to keep this PR's diff small and the auth helper change isolated from the PIN-specific logic.

## Acceptance criteria

- `pnpm lint:fix && pnpm format:fix && pnpm check-types && pnpm test` all green.
- Existing route tests pass without modification.
- Helper tests cover: missing session → `AuthError("Unauthorized", 401, { requiresReauth: false })`; `RefreshTokenError` → `AuthError("Session expired. ...", 401, { requiresReauth: true })`; happy path returns `{ session }` / `{ session, accessToken }`; `requireGoogleTasksSession` delegates scope failure to `requireGoogleTasksAccessToken`.
- Net LOC reduction across the 5 migrated routes.
- Follow-up issues filed and linked from PR body.
