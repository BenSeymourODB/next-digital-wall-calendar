/**
 * Test fixtures for Profile API tests.
 *
 * Delegates the row defaults to the shared `makePrismaProfile` /
 * `makeProfileSettings` factories under `src/test/fixtures/profile.ts` (#371)
 * so a new column on `Profile` / `ProfileSettings` only needs to be added in
 * one place. The named exports are preserved for backwards compatibility
 * with existing route-test imports.
 */
import type { ProfileRewardPoints } from "@/generated/prisma/client";
import {
  makePrismaProfile,
  makeProfileSettings,
} from "@/test/fixtures/profile";

export const mockUserId = "test-user-123";

/**
 * Mock profile with admin type
 */
export const mockAdminProfile = makePrismaProfile({
  id: "profile-admin-1",
  userId: mockUserId,
  name: "Admin User",
  avatar: { type: "initials", value: "AU", backgroundColor: "#3b82f6" },
  pinHash: "$2b$10$mockHashedPin", // Mock bcrypt hash
  pinEnabled: true,
});

/**
 * Mock profile with standard type
 */
export const mockStandardProfile = makePrismaProfile({
  id: "profile-standard-1",
  userId: mockUserId,
  name: "Child User",
  type: "standard",
  ageGroup: "child",
  color: "#22c55e",
  avatar: { type: "emoji", value: "👦" },
  createdAt: new Date("2024-01-02T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
});

/**
 * Mock profile reward points
 */
export const mockProfileRewardPoints: ProfileRewardPoints = {
  id: "reward-points-1",
  profileId: mockAdminProfile.id,
  totalPoints: 100,
  currentStreak: 5,
  longestStreak: 10,
  lastActivityDate: new Date("2024-01-15T00:00:00Z"),
  updatedAt: new Date("2024-01-15T00:00:00Z"),
};

/**
 * Mock profile settings
 */
export const mockProfileSettings = makeProfileSettings({
  id: "settings-1",
  profileId: mockAdminProfile.id,
});

/**
 * Factory function to create custom mock profiles.
 *
 * Delegates to `makePrismaProfile` but injects a sequential `id` based on the
 * current timestamp by default so multi-profile renders in a single test
 * don't collide on identical ids.
 */
export function createMockProfile(
  overrides: Parameters<typeof makePrismaProfile>[0] = {}
): ReturnType<typeof makePrismaProfile> {
  return makePrismaProfile({
    name: "Child User",
    type: "standard",
    ageGroup: "child",
    color: "#22c55e",
    avatar: { type: "emoji", value: "👦" },
    id: `profile-${Date.now()}`,
    ...overrides,
  });
}

/**
 * Create profile input for POST request
 */
export interface CreateProfileInput {
  name: string;
  type?: "admin" | "standard";
  ageGroup?: "adult" | "teen" | "child";
  color?: string;
  avatar?: {
    type: "initials" | "photo" | "emoji";
    value: string;
    backgroundColor?: string;
  };
}

export const mockCreateProfileInput: CreateProfileInput = {
  name: "New Profile",
  type: "standard",
  ageGroup: "child",
  color: "#f59e0b",
  avatar: {
    type: "initials",
    value: "NP",
    backgroundColor: "#f59e0b",
  },
};

/**
 * Array of mock profiles for list testing
 */
export const mockProfileList = [
  mockAdminProfile,
  mockStandardProfile,
  createMockProfile({
    id: "profile-3",
    name: "Teen User",
    type: "standard",
    ageGroup: "teen",
    color: "#a855f7",
    avatar: { type: "emoji", value: "👧" },
  }),
];
