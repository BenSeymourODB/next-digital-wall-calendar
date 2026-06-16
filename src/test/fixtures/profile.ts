/**
 * Shared `Profile` / `ProfileSettings` test fixtures.
 *
 * Before these factories, ~13 test files each inlined the full Profile shape
 * (`type`, `ageGroup`, `color`, `avatar`, `pinEnabled`, …) and the API-route
 * tests inlined the full Prisma row (additionally `pinHash`,
 * `failedPinAttempts`, `pinLockedUntil`, `createdAt`, `updatedAt`). Adding one
 * column to `Profile` therefore required identical edits across every one of
 * those literals — a single one-line schema change fanning out into many
 * test diffs, plus a merge conflict in every concurrent PR.
 *
 * Two factories with distinct names express the boundary cleanly:
 *
 * - `makeProfile()` returns the lightweight app-level `Profile` from
 *   `profile-context.tsx` — used by component, page, and provider tests.
 * - `makePrismaProfile()` returns the full Prisma row (avatar typed as the
 *   schema's `JsonValue`) — used by API-route tests where the handler reads
 *   the underlying `Profile` model directly.
 *
 * `makeProfileSettings()` returns the Prisma `ProfileSettings` row; defaults
 * mirror the `@default(...)` values in `schema.prisma`.
 *
 * Issue #371.
 */
import type {
  Profile as AppProfile,
  ProfileAvatar,
} from "@/components/profiles/profile-context";
import type {
  Profile as PrismaProfile,
  ProfileSettings as PrismaProfileSettings,
} from "@/generated/prisma/client";

/**
 * App-level `Profile` (the shape `ProfileProvider` hands to consumers). The
 * sensitive PIN columns (`pinHash`, `failedPinAttempts`, `pinLockedUntil`)
 * are deliberately absent — the API never returns them to the client.
 */
export type MockProfile = AppProfile;

const DEFAULT_AVATAR: ProfileAvatar = {
  type: "initials",
  value: "TP",
  backgroundColor: "#3b82f6",
};

/**
 * Build an app-level `Profile` for tests. Defaults mirror the `@default(...)`
 * values in `schema.prisma`; pass `overrides` for fields under test.
 */
export function makeProfile(overrides: Partial<MockProfile> = {}): MockProfile {
  return {
    id: "profile-1",
    userId: "test-user-123",
    name: "Test Profile",
    type: "admin",
    ageGroup: "adult",
    color: "#3b82f6",
    avatar: DEFAULT_AVATAR,
    pinEnabled: false,
    isActive: true,
    ...overrides,
  };
}

/**
 * Build a full Prisma `Profile` row for tests. Includes the PIN security
 * columns (`pinHash`, `failedPinAttempts`, `pinLockedUntil`) that
 * `makeProfile()` omits.
 *
 * The return type is the Prisma row (avatar typed as `JsonValue`) so callers
 * can drop the result directly into places that expect a `Profile` row, e.g.
 * `mockPrisma.profile.findUnique.mockResolvedValue(makePrismaProfile())`.
 * Tests that need to assert on avatar fields can narrow with `as
 * ProfileAvatar`.
 */
export function makePrismaProfile(
  overrides: Partial<PrismaProfile> = {}
): PrismaProfile {
  return {
    id: "profile-1",
    userId: "test-user-123",
    name: "Test Profile",
    type: "admin",
    ageGroup: "adult",
    color: "#3b82f6",
    avatar: { ...DEFAULT_AVATAR },
    pinHash: null,
    pinEnabled: false,
    failedPinAttempts: 0,
    pinLockedUntil: null,
    isActive: true,
    createdAt: new Date("2024-01-01T00:00:00Z"),
    updatedAt: new Date("2024-01-01T00:00:00Z"),
    ...overrides,
  };
}

/**
 * Build a Prisma `ProfileSettings` row for tests. Defaults mirror the
 * `@default(...)` values in `schema.prisma`.
 */
export function makeProfileSettings(
  overrides: Partial<PrismaProfileSettings> = {}
): PrismaProfileSettings {
  return {
    id: "profile-settings-1",
    profileId: "profile-1",
    defaultTaskListId: null,
    showCompletedTasks: false,
    taskSortOrder: "dueDate",
    theme: "light",
    language: "en",
    enableNotifications: false,
    notificationTime: null,
    ...overrides,
  };
}
