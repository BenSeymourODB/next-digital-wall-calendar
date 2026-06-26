"use client";

/**
 * ProfileContext - Provides profile state management throughout the app
 *
 * Features:
 * - Fetches profiles from /api/profiles
 * - Manages active profile selection
 * - Persists active profile to localStorage
 * - Supports profile and family view modes
 */
import {
  ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import type { Profile, ViewMode } from "./types";

/**
 * Profile context value
 */
interface ProfileContextValue {
  /** Currently active profile */
  activeProfile: Profile | null;
  /** All available profiles */
  allProfiles: Profile[];
  /** Current view mode */
  viewMode: ViewMode;
  /** Whether active profile is admin */
  isAdmin: boolean;
  /** Whether profiles are loading */
  isLoading: boolean;
  /** Set the active profile by ID */
  setActiveProfile: (profileId: string) => Promise<void>;
  /** Set the view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Refresh profiles from API */
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const STORAGE_KEY = "activeProfileId";

/**
 * ProfileProvider - Wraps the app to provide profile context
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("profile");
  const [isLoading, setIsLoading] = useState(true);

  // Fetch profiles from API
  const fetchProfiles = async () => {
    try {
      const response = await fetch("/api/profiles");
      if (!response.ok) {
        setProfiles([]);
        return;
      }
      const data = await response.json();
      setProfiles(data);
      return data as Profile[];
    } catch {
      setProfiles([]);
      return [];
    }
  };

  // Initialize profiles and restore active profile
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const fetchedProfiles = await fetchProfiles();

      if (fetchedProfiles && fetchedProfiles.length > 0) {
        // Try to restore from localStorage
        const storedId = localStorage.getItem(STORAGE_KEY);
        const storedProfile = fetchedProfiles.find((p) => p.id === storedId);

        if (storedProfile) {
          setActiveProfileId(storedId);
        } else {
          // Default to first admin profile, or first profile
          const adminProfile = fetchedProfiles.find((p) => p.type === "admin");
          const defaultProfile = adminProfile || fetchedProfiles[0];
          setActiveProfileId(defaultProfile.id);
          localStorage.setItem(STORAGE_KEY, defaultProfile.id);
        }
      }

      setIsLoading(false);
    };

    init();
    // Mount-only: `fetchProfiles` captures no per-render deps and React
    // Compiler keeps its identity stable across renders, so an empty
    // dep array preserves the original "fetch once" behavior without
    // the banned `useCallback` wrapper (#271).
  }, []);

  // Get active profile object
  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  // Check if active profile is admin
  const isAdmin = activeProfile?.type === "admin";

  // Set active profile
  const handleSetActiveProfile = async (profileId: string) => {
    const profile = profiles.find((p) => p.id === profileId);
    if (profile) {
      setActiveProfileId(profileId);
      localStorage.setItem(STORAGE_KEY, profileId);
    }
  };

  // Refresh profiles
  const refreshProfiles = async () => {
    await fetchProfiles();
  };

  const value: ProfileContextValue = {
    activeProfile,
    allProfiles: profiles,
    viewMode,
    isAdmin,
    isLoading,
    setActiveProfile: handleSetActiveProfile,
    setViewMode,
    refreshProfiles,
  };

  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

/**
 * useProfile - Hook to access profile context
 * @throws Error if used outside ProfileProvider
 */
export function useProfile(): ProfileContextValue {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used within ProfileProvider");
  }
  return context;
}

/**
 * useProfileOptional - Variant of `useProfile` that returns `null` instead
 * of throwing when no `ProfileProvider` ancestor is mounted. Use this in
 * components that work standalone in tests (with the provider absent) but
 * want to subscribe to same-tab profile switches in production. Mirrors
 * the `usePointsOptional` pattern used by `PointsBadge` / `TaskItem`.
 */
export function useProfileOptional(): ProfileContextValue | null {
  return useContext(ProfileContext);
}
