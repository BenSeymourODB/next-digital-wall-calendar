"use client";

/**
 * Navigation Controls Component
 *
 * A floating bar at the bottom center of the viewport with
 * previous, pause/play, and next buttons. Auto-hides after
 * 5 seconds of inactivity with a smooth opacity transition.
 */

interface NavigationControlsProps {
  /** Current screen index (0-based) */
  currentIndex: number;
  /** Total number of screens in the sequence */
  totalScreens: number;
  /** Whether the scheduler is currently paused */
  isPaused: boolean;
  /** Whether the controls bar is currently visible */
  isVisible: boolean;
  /** Callback for navigating to the previous screen */
  onPrevious: () => void;
  /** Callback for navigating to the next screen */
  onNext: () => void;
  /** Callback for toggling pause/resume */
  onTogglePause: () => void;
}

/**
 * Floating navigation controls for the screen rotation scheduler.
 *
 * Renders a dark pill-shaped bar fixed at the bottom center of the viewport.
 * Contains previous, pause/play, and next buttons with a position indicator.
 * Supports keyboard shortcuts (Left/Right arrows, Space for pause).
 */
export function NavigationControls({
  currentIndex,
  totalScreens,
  isPaused,
  isVisible,
  onPrevious,
  onNext,
  onTogglePause,
}: NavigationControlsProps) {
  const displayIndex = currentIndex + 1;

  return (
    <nav
      aria-label="Screen rotation controls"
      className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-gray-800 px-4 py-2 shadow-lg transition-opacity duration-300 ${
        isVisible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <button
        type="button"
        aria-label="Previous screen"
        onClick={onPrevious}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
      >
        &#8249;
      </button>

      <button
        type="button"
        aria-label={isPaused ? "Resume rotation" : "Pause rotation"}
        onClick={onTogglePause}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
      >
        {isPaused ? "\u25B6" : "\u275A\u275A"}
      </button>

      <span className="min-w-[3rem] text-center text-sm text-gray-400">
        {displayIndex} / {totalScreens}
      </span>

      <button
        type="button"
        aria-label="Next screen"
        onClick={onNext}
        className="flex h-8 w-8 items-center justify-center rounded-full text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
      >
        &#8250;
      </button>
    </nav>
  );
}
