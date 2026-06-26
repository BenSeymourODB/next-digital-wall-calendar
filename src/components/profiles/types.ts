/**
 * Profile component types
 *
 * Centralized type definitions shared across the profiles surface.
 * Matches the per-directory `types.ts` pattern used by `tasks`, `recipe`,
 * and `scheduler`.
 */

/**
 * Privilege level for a profile.
 */
export type ProfileType = "admin" | "standard";

/**
 * Age cohort for a profile. Drives display / interaction defaults.
 */
export type AgeGroup = "adult" | "teen" | "child";

/**
 * Profile avatar configuration.
 */
export interface ProfileAvatar {
  type: "initials" | "photo" | "emoji";
  value: string;
  backgroundColor?: string;
}

/**
 * Profile data structure.
 */
export interface Profile {
  id: string;
  userId: string;
  name: string;
  type: ProfileType;
  ageGroup: AgeGroup;
  color: string;
  avatar: ProfileAvatar;
  pinEnabled: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * View mode for the calendar — single-profile vs whole-family view.
 */
export type ViewMode = "profile" | "family";
