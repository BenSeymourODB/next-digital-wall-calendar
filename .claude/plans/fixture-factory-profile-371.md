# Profile / ProfileSettings fixture factory — plan for #371

## Intent

Eliminate the "one new Profile field forces ~13 near-identical test diffs" problem by introducing `makeProfile()` / `makePrismaProfile()` / `makeProfileSettings()` factories under `src/test/fixtures/`, mirroring `makeUserSettings` (PR #354) and `makeCalendarContext` (PR #304).

The duplication exists in two layers and the factory needs to serve both:

- **App-level `Profile`** (`src/components/profiles/profile-context.tsx`) — lightweight shape (no `pinHash`, dates optional ISO strings). Used by every component/page test that mounts a `ProfileProvider` or renders a profile.
- **Prisma-level `Profile`** (`@/generated/prisma/client`) — full row with `pinHash`, `failedPinAttempts`, `pinLockedUntil`, `createdAt: Date`, `updatedAt: Date`. Used by every API route test.

Two factories with distinct names cleanly express that boundary and keep type errors localized.

## Module surface

`src/test/fixtures/profile.ts`:

```ts
import type { Profile, ProfileAvatar } from "@/components/profiles/profile-context";
import type {
  Profile as PrismaProfile,
  ProfileSettings as PrismaProfileSettings,
} from "@/generated/prisma/client";

/** App-level Profile (lightweight, UI-facing). */
export type MockProfile = Profile;
export function makeProfile(overrides?: Partial<MockProfile>): MockProfile;

/**
 * Prisma row, with `avatar` retyped from `JsonValue` to `ProfileAvatar` so the
 * factory's return value matches what real route handlers store/return.
 */
export type MockPrismaProfile = Omit<PrismaProfile, "avatar"> & {
  avatar: ProfileAvatar;
};
export function makePrismaProfile(overrides?: Partial<MockPrismaProfile>): MockPrismaProfile;

export function makeProfileSettings(
  overrides?: Partial<PrismaProfileSettings>
): PrismaProfileSettings;
```

Defaults mirror the `@default(...)` values in `schema.prisma`. `avatar` defaults
to a stable `{ type: "initials", value: "TP", backgroundColor: "#3b82f6" }`
(matching the default `name: "Test Profile"`) so multi-profile renders never
collide on identical avatars. `id`s are constant (`"profile-1"` /
`"profile-settings-1"`) — tests that need uniqueness pass `id` via overrides.

## Phases

### Phase 1 — factory + unit tests (TDD)

1. Write `src/test/fixtures/__tests__/profile.test.ts` first. Tests cover:
   - `makeProfile()` defaults are assignable to app-level `Profile`
   - `makeProfile({ pinEnabled: true })` overrides applied
   - `makePrismaProfile()` defaults are assignable to Prisma `Profile` (with the narrowed `avatar`)
   - `makePrismaProfile({ pinHash: "h", pinLockedUntil: new Date() })` overrides applied
   - `makeProfileSettings()` defaults align with `schema.prisma @default(...)`
   - `makeProfileSettings({ theme: "dark" })` overrides applied
2. Implement `src/test/fixtures/profile.ts` to make tests pass.
3. `pnpm test src/test/fixtures && pnpm lint:fix && pnpm format:fix && pnpm check-types`.

### Phase 2 — migrate app-level component tests

Replace inline Profile literals with `makeProfile({ ... })` calls. Each file
gains an `import { makeProfile } from "@/test/fixtures/profile"`.

- `src/components/profiles/__tests__/profile-context.test.tsx`
- `src/components/profiles/__tests__/profile-card.test.tsx`
- `src/components/profiles/__tests__/profile-grid.test.tsx`
- `src/components/profiles/__tests__/profile-switcher.test.tsx`
- `src/components/profiles/__tests__/give-points-modal.test.tsx`
- `src/components/profiles/__tests__/pin-settings.test.tsx`
- `src/components/tasks/__tests__/profile-scoped-task-list.test.tsx`
- `src/components/settings/__tests__/settings-form.test.tsx`
- `src/app/profiles/__tests__/page.test.tsx`
- `src/app/profiles/[id]/settings/__tests__/page.test.tsx`

`pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types` after each
sub-batch.

### Phase 3 — re-express the static `fixtures.ts` + migrate API route tests

- `src/app/api/profiles/__tests__/fixtures.ts` — rewrite `mockAdminProfile`,
  `mockStandardProfile`, `mockProfileSettings`, `mockProfileList` to delegate
  to `makePrismaProfile` / `makeProfileSettings`. Keep the named exports so
  importers don't need to change yet.
- `src/app/api/profiles/__tests__/route.test.ts`
- `src/app/api/profiles/[id]/reset-pin/__tests__/route.test.ts`
- `src/app/api/profiles/[id]/give-points/__tests__/route.test.ts`

`pnpm test && pnpm lint:fix && pnpm format:fix && pnpm check-types` to confirm
no behavioural drift.

### Phase 4 — finalize

- Full suite green: `pnpm test`
- `pnpm lint:fix && pnpm format:fix && pnpm check-types`
- Push, open draft PR, mark ready, request review.

## Out of scope (deferred follow-ups)

- Session/auth mock factory (`getServerSession` mocks vary across files but the
  shape is small enough that the savings are marginal; defer until a real fan-
  out happens).
- Google API payload factories (mentioned in the issue body as future scope).
- Deriving `UserSettings` defaults + Zod schema from a single source (separate
  follow-up issue already filed: #372).
- `pin-setup-modal.test.tsx`, `pin-entry-modal.test.tsx` etc. — these tests
  don't inline Profile literals; they reference profile data via props from
  parent mocks and don't suffer the fan-out problem.

## Risk / rollback

Pure refactor, behaviour-preserving. The factory pattern is already proven in
this repo for `UserSettings` and `ICalendarContext`. If a migration introduces
a regression, the static `fixtures.ts` exports remain (rewritten internally to
call the factory) so API tests continue to import the same names.

Rollback = revert the PR.
