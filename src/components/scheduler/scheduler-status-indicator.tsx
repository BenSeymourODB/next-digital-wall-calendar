"use client";

/**
 * Scheduler Status Indicator
 *
 * A small circular progress ring that shows the countdown until the next
 * screen rotation. Displays remaining seconds when rotating, and a pause
 * icon when paused. Always visible while the scheduler is active.
 *
 * Accepts a className prop for composable positioning — the default places
 * it fixed at bottom-left, but it can be repositioned (e.g. inside a sidebar).
 */

interface SchedulerStatusIndicatorProps {
  /** Whether the scheduler is actively counting down */
  isRotating: boolean;
  /** Whether the scheduler is paused (manual or interaction) */
  isPaused: boolean;
  /** Seconds remaining until next navigation */
  timeUntilNextNav: number;
  /** Total interval in seconds (for progress calculation) */
  intervalSeconds: number;
  /** Optional className override for positioning (default: fixed bottom-left) */
  className?: string;
}

const SIZE = 44;
const INNER_SIZE = 36;
const ACTIVE_COLOR = "rgb(59, 130, 246)"; // blue-500
const PAUSED_COLOR = "rgb(75, 85, 99)"; // gray-600
const TRACK_COLOR = "rgb(55, 65, 81)"; // gray-700
const BG_COLOR = "rgb(31, 41, 55)"; // gray-800

export function SchedulerStatusIndicator({
  isRotating,
  isPaused,
  timeUntilNextNav,
  intervalSeconds,
  className,
}: SchedulerStatusIndicatorProps) {
  // Don't render if neither rotating nor paused
  if (!isRotating && !isPaused) {
    return null;
  }

  // Calculate progress angle (0-360)
  const elapsed = intervalSeconds - timeUntilNextNav;
  const progress =
    intervalSeconds > 0
      ? Math.min(Math.max(elapsed / intervalSeconds, 0), 1)
      : 0;
  const angle = Math.round(progress * 360);

  const fillColor = isPaused ? PAUSED_COLOR : ACTIVE_COLOR;

  const ringStyle = {
    width: SIZE,
    height: SIZE,
    borderRadius: "50%",
    background: `conic-gradient(from 0deg, ${fillColor} ${angle}deg, ${TRACK_COLOR} ${angle}deg)`,
  };

  const innerStyle = {
    width: INNER_SIZE,
    height: INNER_SIZE,
    borderRadius: "50%",
    backgroundColor: BG_COLOR,
  };

  const ariaLabel = isPaused
    ? "Screen rotation paused"
    : `Next screen in ${Math.ceil(timeUntilNextNav)} seconds`;

  const positionClass = className ?? "fixed bottom-6 left-6";

  return (
    <div
      role="status"
      aria-label={ariaLabel}
      aria-live="polite"
      className={`${positionClass} z-50 shadow-lg`}
    >
      <div
        data-testid="progress-ring"
        className="flex items-center justify-center"
        style={ringStyle}
      >
        <div className="flex items-center justify-center" style={innerStyle}>
          {isPaused ? (
            <span className="text-xs text-gray-400">&#10074;&#10074;</span>
          ) : (
            <span className="text-xs font-medium text-gray-200">
              {Math.ceil(timeUntilNextNav)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
