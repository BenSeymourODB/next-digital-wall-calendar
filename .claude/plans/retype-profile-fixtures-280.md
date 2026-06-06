# Retype Profile fixtures (#280)

Tracking issue: https://github.com/BenSeymourODB/next-digital-wall-calendar/issues/280

## Problem

Profile-shaped test fixtures across the codebase are loosely typed (no annotation, or local interface declarations that drift from the canonical types). The canonical fixtures module at `src/app/api/profiles/__tests__/fixtures.ts:9` already calls out:

> Full retype to the generated Prisma `Profile` lives in #280.

There are two canonical `Profile` shapes in the production code, and a fixture's right type depends on what it mocks:

1. **Prisma row** — `import type { Profile } from "@/generated/prisma/client"` — the DB row shape. Used by API route tests that mock `prisma.profile.findFirst/update/...` return values, and by server-side service tests. Includes `pinHash`, `failedPinAttempts`, `pinLockedUntil`, `createdAt: Date`, `updatedAt: Date`, etc.
2. **UI / API-response** — `import type { Profile } from "@/components/profiles/profile-context"` — the trimmed shape used by client components (no `pinHash`, dates as `string | undefined`). Used by component tests and any test that mocks the `/api/profiles` JSON response.

When a fixture is typed against the production shape, mismatches surface at compile time rather than as silent test drift.

## Scope

### Phase 1 — Canonical fixtures module (high leverage)

`src/app/api/profiles/__tests__/fixtures.ts`:

- Replace the local `Profile`, `ProfileRewardPoints`, `ProfileSettings` interfaces with the generated Prisma types.
- Adjust `mockAdminProfile.avatar` typing — Prisma's `avatar` field is `Prisma.JsonValue`. Keep the literal object; cast or use `satisfies` so the literal still passes through the JSON shape constraint.
- Keep field values identical; this is a type-tightening change with zero runtime delta.
- Delete the "Full retype … lives in #280" comment.

### Phase 2 — UI component fixtures

For each component test using an ad-hoc profile literal, annotate with `import type { Profile } from "@/components/profiles/profile-context"`:

- `src/components/profiles/__tests__/profile-card.test.tsx`
- `src/components/profiles/__tests__/profile-context.test.tsx`
- `src/components/profiles/__tests__/profile-grid.test.tsx`
- `src/components/profiles/__tests__/profile-switcher.test.tsx`
- `src/components/profiles/__tests__/pin-entry-modal.test.tsx`
- `src/components/profiles/__tests__/pin-setup-modal.test.tsx`
- `src/components/profiles/__tests__/pin-settings.test.tsx`
- `src/components/profiles/__tests__/profile-avatar.test.tsx` (look at what subset its component requires; may be a `Pick<>`)
- `src/components/profiles/__tests__/profile-form.test.tsx`
- `src/components/profiles/__tests__/give-points-modal.test.tsx` (already typed — verify)
- `src/components/tasks/__tests__/profile-scoped-task-list.test.tsx`
- `src/components/tasks/__tests__/task-assignment-picker.test.tsx` (uses `ProfileInfo` — verify alignment)
- `src/components/rewards/__tests__/points-context.test.tsx`
- `src/app/profiles/__tests__/page.test.tsx`
- `src/app/profiles/[id]/settings/__tests__/page.test.tsx`

Where a test only needs a couple of fields, use `Pick<Profile, …>` rather than forcing the full shape. This documents the test's actual surface area.

### Phase 3 — Prisma-row consumer fixtures

For each API/service test that mocks Prisma directly with an ad-hoc literal, annotate with the generated `Profile` type from `@/generated/prisma/client`. Many already import from `__tests__/fixtures` (covered by Phase 1), but spot-check:

- `src/app/api/profiles/[id]/reset-pin/__tests__/route.test.ts`
- `src/app/api/profiles/[id]/stats/__tests__/route.test.ts`
- `src/app/api/profiles/[id]/give-points/__tests__/route.test.ts`
- `src/app/api/points/award/__tests__/route.test.ts`
- `src/lib/services/__tests__/admin-verification.test.ts`
- `src/lib/services/__tests__/task-assignments.test.ts`
- `src/lib/test-utils/pin-test-helpers.ts` (already partial — `mockPinProfile`)

`pin-test-helpers.ts:mockPinProfile` currently returns an inferred shape. Give it a return type of the generated Prisma `Profile` (so test files using it can rely on full type-safety).

## Out of scope

- No runtime changes. Snapshots untouched.
- No new tests (the verification IS `pnpm check-types`).
- E2E test fixtures (`e2e/fixtures/` does not contain profile shapes today — `mock-events.ts`/`google-api-mocks.ts` only).
- Re-shaping the production `Profile` interfaces themselves.

## Acceptance criteria (from #280)

- [x] All profile fixtures typed against the production `Profile` type
- [x] `pnpm check-types` passes
- [x] No runtime test changes (snapshots untouched)

## Verification

```bash
pnpm check-types
pnpm test
pnpm lint:fix && pnpm format:fix
```

All four must pass. Diff should be type annotations + import reshuffling only — no value changes.
