"use client";

/**
 * Mounts `PointsProvider` with the active profile id sourced from
 * `ProfileProvider`. Kept separate so `PointsProvider` itself stays
 * free of any direct coupling to the profile context (and therefore
 * stays trivially unit-testable).
 */
import { useProfile } from "@/components/profiles/profile-context";
import type { ReactNode } from "react";
import { PointsProvider } from "./points-context";

export function MountedPointsProvider({ children }: { children: ReactNode }) {
  const { activeProfile } = useProfile();
  return (
    <PointsProvider profileId={activeProfile?.id ?? null}>
      {children}
    </PointsProvider>
  );
}
