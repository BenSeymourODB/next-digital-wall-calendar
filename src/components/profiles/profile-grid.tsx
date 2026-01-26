"use client";

/**
 * ProfileGrid - Displays a responsive grid of profile cards
 *
 * Features:
 * - Responsive grid layout (2 cols on mobile, 3 on md, 5 on lg)
 * - Maps profiles to ProfileCard components
 * - Shows empty state when no profiles
 * - Indicates active profile
 */
import { ProfileCard, ProfileCardSkeleton } from "./profile-card";
import type { Profile } from "./profile-context";

interface ProfileGridProps {
  profiles: Profile[];
  activeProfileId: string | null;
  setActiveProfile: (profileId: string) => Promise<void>;
}

/**
 * ProfileGrid - Grid of profile cards
 */
export function ProfileGrid({
  profiles,
  activeProfileId,
  setActiveProfile,
}: ProfileGridProps) {
  if (profiles.length === 0) {
    return (
      <div
        data-testid="profile-grid"
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
      >
        <div className="col-span-full py-8 text-center text-gray-500">
          No profiles found. Add a profile to get started.
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="profile-grid"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
    >
      {profiles.map((profile) => (
        <ProfileCard
          key={profile.id}
          profile={profile}
          setActiveProfile={setActiveProfile}
          isActive={profile.id === activeProfileId}
        />
      ))}
    </div>
  );
}

interface ProfileGridSkeletonProps {
  count?: number;
}

/**
 * ProfileGridSkeleton - Loading placeholder for ProfileGrid
 */
export function ProfileGridSkeleton({ count = 3 }: ProfileGridSkeletonProps) {
  return (
    <div
      data-testid="profile-grid-skeleton"
      className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5"
    >
      {Array.from({ length: count }).map((_, index) => (
        <ProfileCardSkeleton key={index} />
      ))}
    </div>
  );
}
