"use client";

/**
 * PointsBadge - persistent total-points indicator.
 *
 * Reads from `usePoints()`. Renders nothing when rewards are disabled
 * or when no profile is active, so the badge is a no-op for users who
 * have not opted into the reward system.
 */
import { usePointsOptional } from "./points-context";

export function PointsBadge() {
  const points = usePointsOptional();

  if (!points || !points.profileId || !points.isEnabled) {
    return null;
  }

  const { totalPoints } = points;

  const formatted = totalPoints.toLocaleString();

  return (
    <div
      role="status"
      aria-label={`${totalPoints} reward points`}
      className="flex items-center gap-1.5 rounded-full bg-yellow-100 px-3 py-1 text-yellow-900 shadow-sm"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {"\u{1F3C6}"}
      </span>
      <span className="text-sm font-semibold tabular-nums">{formatted}</span>
      <span className="text-xs">pts</span>
    </div>
  );
}
