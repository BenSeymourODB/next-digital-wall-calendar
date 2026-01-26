/**
 * Test fixtures for Profile API tests
 */

// Define local types for testing (matches Prisma schema)
interface Profile {
  id: string;
  userId: string;
  name: string;
  type: "admin" | "standard";
  ageGroup: "adult" | "teen" | "child";
  color: string;
  avatar: unknown;
  pinHash: string | null;
  pinEnabled: boolean;
  failedPinAttempts: number;
  pinLockedUntil: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface ProfileRewardPoints {
  id: string;
  profileId: string;
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: Date;
  updatedAt: Date;
}

interface ProfileSettings {
  id: string;
  profileId: string;
  defaultTaskListId: string | null;
  showCompletedTasks: boolean;
  taskSortOrder: string;
  theme: string;
  language: string;
  enableNotifications: boolean;
  notificationTime: string | null;
}

export const mockUserId = "test-user-123";

/**
 * Mock profile with admin type
 */
export const mockAdminProfile: Profile = {
  id: "profile-admin-1",
  userId: mockUserId,
  name: "Admin User",
  type: "admin",
  ageGroup: "adult",
  color: "#3b82f6",
  avatar: {
    type: "initials",
    value: "AU",
    backgroundColor: "#3b82f6",
  },
  pinHash: "$2b$10$mockHashedPin", // Mock bcrypt hash
  pinEnabled: true,
  failedPinAttempts: 0,
  pinLockedUntil: null,
  isActive: true,
  createdAt: new Date("2024-01-01T00:00:00Z"),
  updatedAt: new Date("2024-01-01T00:00:00Z"),
};

/**
 * Mock profile with standard type
 */
export const mockStandardProfile: Profile = {
  id: "profile-standard-1",
  userId: mockUserId,
  name: "Child User",
  type: "standard",
  ageGroup: "child",
  color: "#22c55e",
  avatar: {
    type: "emoji",
    value: "👦",
  },
  pinHash: null,
  pinEnabled: false,
  failedPinAttempts: 0,
  pinLockedUntil: null,
  isActive: true,
  createdAt: new Date("2024-01-02T00:00:00Z"),
  updatedAt: new Date("2024-01-02T00:00:00Z"),
};

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
export const mockProfileSettings: ProfileSettings = {
  id: "settings-1",
  profileId: mockAdminProfile.id,
  defaultTaskListId: null,
  showCompletedTasks: false,
  taskSortOrder: "dueDate",
  theme: "light",
  language: "en",
  enableNotifications: false,
  notificationTime: null,
};

/**
 * Factory function to create custom mock profiles
 */
export function createMockProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    ...mockStandardProfile,
    id: `profile-${Date.now()}`,
    ...overrides,
  };
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
export const mockProfileList: Profile[] = [
  mockAdminProfile,
  mockStandardProfile,
  createMockProfile({
    id: "profile-3",
    name: "Teen User",
    type: "standard",
    ageGroup: "teen",
    color: "#a855f7",
    avatar: {
      type: "emoji",
      value: "👧",
    },
  }),
];
