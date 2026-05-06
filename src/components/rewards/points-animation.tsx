"use client";

/**
 * PointsAnimation - transient "+N points! 🎉" banner shown after a
 * task-completion award.
 *
 * Visibility is fully prop-driven: the parent passes `show={true}`, we
 * render the banner, and after ~2s we fire `onComplete()` so the parent
 * can flip `show` back to false. This keeps the component free of
 * internal visibility state and side-effectful setState calls.
 *
 * When the user prefers reduced motion the banner still renders (the
 * award is still announced) but skips the motion classes.
 */
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { cn } from "@/lib/utils";
import { useEffect } from "react";

const DISMISS_AFTER_MS = 2000;

export interface PointsAnimationProps {
  /** Number of points awarded (rendered as `+N`). */
  points: number;
  /** Whether the banner should currently be shown. */
  show: boolean;
  /** Fired ~2s after `show` becomes true. Parent should flip `show` to false. */
  onComplete?: () => void;
}

export function PointsAnimation({
  points,
  show,
  onComplete,
}: PointsAnimationProps) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!show) {
      return;
    }
    const timer = setTimeout(() => {
      onComplete?.();
    }, DISMISS_AFTER_MS);
    return () => clearTimeout(timer);
  }, [show, onComplete]);

  if (!show) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "py-1 text-center text-sm font-semibold text-green-600",
        !reducedMotion && "animate-in fade-in-0 slide-in-from-bottom-1"
      )}
    >
      +{points} points! {"\u{1F389}"}
    </div>
  );
}
