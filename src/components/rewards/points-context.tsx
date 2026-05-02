"use client";

/**
 * PointsContext - client-side state surface for the reward-points
 * system.
 *
 * Reads `/api/points?profileId=…` on mount and whenever the active
 * profile changes, exposes `awardPoints()` for callers to record a
 * point award (POST `/api/points/award`), and surfaces the
 * `alreadyAwarded` idempotency flag returned by the API so callers
 * can suppress duplicate animations.
 *
 * The provider is intentionally decoupled from `ProfileProvider`:
 * whoever mounts it forwards the active profile id as a prop. When
 * `profileId` is null the context stays in its initial disabled
 * state (zero points, isEnabled=false) and never hits the network.
 */
import { logger } from "@/lib/logger";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type PointAwardReason =
  | "task_completed"
  | "manual"
  | "bonus"
  | "streak"
  | "goal";

export interface AwardPointsMetadata {
  taskId?: string;
  taskTitle?: string;
}

export interface AwardPointsResult {
  newTotal: number;
  alreadyAwarded: boolean;
}

interface PointsContextValue {
  totalPoints: number;
  isEnabled: boolean;
  profileId: string | null;
  awardPoints: (
    points: number,
    reason: PointAwardReason,
    metadata?: AwardPointsMetadata
  ) => Promise<AwardPointsResult>;
  refreshPoints: () => Promise<void>;
}

const PointsContext = createContext<PointsContextValue | null>(null);

interface PointsProviderProps {
  profileId: string | null;
  children: ReactNode;
}

export function PointsProvider({ profileId, children }: PointsProviderProps) {
  // Stored state reflects the most recent fetch. The exposed
  // `totalPoints` / `isEnabled` are derived from it so that swapping
  // to a null profile zeros the public values without needing a
  // synchronous setState in the effect (which would trigger
  // cascading renders).
  const [fetchedTotal, setFetchedTotal] = useState(0);
  const [fetchedEnabled, setFetchedEnabled] = useState(false);

  const fetchPoints = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/points?profileId=${id}`);
      if (!response.ok) {
        setFetchedTotal(0);
        setFetchedEnabled(false);
        return;
      }
      const data = (await response.json()) as {
        totalPoints: number;
        enabled: boolean;
      };
      setFetchedTotal(data.totalPoints);
      setFetchedEnabled(data.enabled);
    } catch (error) {
      logger.error(error as Error, { context: "FetchPointsFailed" });
      setFetchedTotal(0);
      setFetchedEnabled(false);
    }
  }, []);

  useEffect(() => {
    if (!profileId) {
      return;
    }
    const run = async () => {
      await fetchPoints(profileId);
    };
    run();
  }, [profileId, fetchPoints]);

  const totalPoints = profileId ? fetchedTotal : 0;
  const isEnabled = profileId ? fetchedEnabled : false;

  const refreshPoints = useCallback(async () => {
    if (!profileId) {
      return;
    }
    await fetchPoints(profileId);
  }, [profileId, fetchPoints]);

  const awardPoints = useCallback(
    async (
      points: number,
      reason: PointAwardReason,
      metadata?: AwardPointsMetadata
    ): Promise<AwardPointsResult> => {
      if (!profileId) {
        throw new Error("No active profile");
      }

      const response = await fetch("/api/points/award", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profileId,
          points,
          reason,
          ...(metadata?.taskId ? { taskId: metadata.taskId } : {}),
          ...(metadata?.taskTitle ? { taskTitle: metadata.taskTitle } : {}),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to award points");
      }

      const data = (await response.json()) as {
        success: boolean;
        newTotal: number;
        alreadyAwarded: boolean;
      };

      setFetchedTotal(data.newTotal);

      logger.event("PointsAwarded", {
        profileId,
        points,
        reason,
        newTotal: data.newTotal,
        alreadyAwarded: data.alreadyAwarded,
      });

      return {
        newTotal: data.newTotal,
        alreadyAwarded: data.alreadyAwarded,
      };
    },
    [profileId]
  );

  const value: PointsContextValue = {
    totalPoints,
    isEnabled,
    profileId,
    awardPoints,
    refreshPoints,
  };

  return (
    <PointsContext.Provider value={value}>{children}</PointsContext.Provider>
  );
}

export function usePoints(): PointsContextValue {
  const context = useContext(PointsContext);
  if (!context) {
    throw new Error("usePoints must be used within PointsProvider");
  }
  return context;
}
