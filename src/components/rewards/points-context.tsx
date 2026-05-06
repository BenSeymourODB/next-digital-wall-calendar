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
import type { PointAwardReason } from "@/lib/services/reward-points";
import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

export type { PointAwardReason };

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
  /** Default points awarded for a task completion (mirrors UserSettings). */
  defaultTaskPoints: number;
  /** Whether the +N animation should be shown after a successful award. */
  showPointsOnCompletion: boolean;
  profileId: string | null;
  awardPoints: (
    points: number,
    reason: PointAwardReason,
    metadata?: AwardPointsMetadata
  ) => Promise<AwardPointsResult>;
  refreshPoints: () => Promise<void>;
}

const DEFAULT_TASK_POINTS = 10;
const DEFAULT_SHOW_POINTS_ON_COMPLETION = true;

interface PointsApiResponse {
  totalPoints: number;
  enabled: boolean;
  defaultTaskPoints?: number;
  showPointsOnCompletion?: boolean;
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
  const [fetchedDefaultTaskPoints, setFetchedDefaultTaskPoints] =
    useState(DEFAULT_TASK_POINTS);
  const [fetchedShowPointsOnCompletion, setFetchedShowPointsOnCompletion] =
    useState(DEFAULT_SHOW_POINTS_ON_COMPLETION);

  // Track the currently-mounted profile id so in-flight requests
  // started under a different profile don't write their result into
  // the new profile's displayed state when they resolve.
  const activeProfileIdRef = useRef<string | null>(profileId);
  useEffect(() => {
    activeProfileIdRef.current = profileId;
  }, [profileId]);

  useEffect(() => {
    if (!profileId) {
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      try {
        const response = await fetch(
          `/api/points?profileId=${encodeURIComponent(profileId)}`,
          { signal: controller.signal }
        );
        if (controller.signal.aborted) return;
        if (!response.ok) {
          setFetchedTotal(0);
          setFetchedEnabled(false);
          return;
        }
        const data = (await response.json()) as PointsApiResponse;
        if (controller.signal.aborted) return;
        setFetchedTotal(data.totalPoints);
        setFetchedEnabled(data.enabled);
        if (typeof data.defaultTaskPoints === "number") {
          setFetchedDefaultTaskPoints(data.defaultTaskPoints);
        }
        if (typeof data.showPointsOnCompletion === "boolean") {
          setFetchedShowPointsOnCompletion(data.showPointsOnCompletion);
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        logger.error(error as Error, { context: "FetchPointsFailed" });
        setFetchedTotal(0);
        setFetchedEnabled(false);
      }
    };
    run();
    return () => controller.abort();
  }, [profileId]);

  const totalPoints = profileId ? fetchedTotal : 0;
  const isEnabled = profileId ? fetchedEnabled : false;

  const refreshPoints = useCallback(async () => {
    if (!profileId) {
      return;
    }
    try {
      const response = await fetch(
        `/api/points?profileId=${encodeURIComponent(profileId)}`
      );
      if (activeProfileIdRef.current !== profileId) return;
      if (!response.ok) {
        setFetchedTotal(0);
        setFetchedEnabled(false);
        return;
      }
      const data = (await response.json()) as PointsApiResponse;
      if (activeProfileIdRef.current !== profileId) return;
      setFetchedTotal(data.totalPoints);
      setFetchedEnabled(data.enabled);
      if (typeof data.defaultTaskPoints === "number") {
        setFetchedDefaultTaskPoints(data.defaultTaskPoints);
      }
      if (typeof data.showPointsOnCompletion === "boolean") {
        setFetchedShowPointsOnCompletion(data.showPointsOnCompletion);
      }
    } catch (error) {
      logger.error(error as Error, { context: "FetchPointsFailed" });
      if (activeProfileIdRef.current !== profileId) return;
      setFetchedTotal(0);
      setFetchedEnabled(false);
    }
  }, [profileId]);

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

      // Only sync local state if this closure's profile is still the
      // active one — guards against a profile switch during the POST.
      if (activeProfileIdRef.current === profileId) {
        setFetchedTotal(data.newTotal);
      }

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
    defaultTaskPoints: fetchedDefaultTaskPoints,
    showPointsOnCompletion: fetchedShowPointsOnCompletion,
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

/**
 * Like {@link usePoints} but returns `null` when no provider is
 * mounted instead of throwing. Useful for components that live in
 * shells (e.g. AppShell) that may render outside the rewards
 * provider in some test contexts or future deployment splits.
 */
export function usePointsOptional(): PointsContextValue | null {
  return useContext(PointsContext);
}
