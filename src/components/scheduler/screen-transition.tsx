"use client";

/**
 * ScreenTransition wraps page content and animates between old and new content
 * when the pathname changes. Uses GPU-composited CSS keyframe animations
 * (transform + opacity) for smooth 60fps transitions.
 *
 * Single-stage animation: incoming child stays in normal flow so the
 * container preserves its natural height; outgoing snapshot is absolutely
 * positioned and animated out simultaneously. Total animation time is
 * `durationMs` (not 2× as in the previous two-stage exit→enter design).
 *
 * - `prefers-reduced-motion: reduce` → swaps instantly.
 * - `type === "none"` or `durationMs <= 0` → swaps instantly.
 * - Same `pathname` re-render → updates children in place, no animation.
 * - Rapid `pathname` changes mid-animation → the in-flight timer is
 *   cleared and the latest swap takes over from the previous outgoing
 *   snapshot.
 * - `prefers-reduced-motion` flipping on mid-animation collapses to idle
 *   and drops the outgoing snapshot.
 */
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef, useState } from "react";
import type { TransitionConfig, TransitionDirection } from "./types";

interface ScreenTransitionProps {
  /** Current pathname — change triggers transition. */
  pathname: string;
  /** Navigation direction for slide animations. */
  direction: TransitionDirection;
  /** Transition configuration. */
  transition: TransitionConfig;
  /** Page content to render. */
  children: React.ReactNode;
}

type TransitionPhase = "idle" | "animating";

interface AnimationGeometry {
  exitTo: { transform: string; opacity: number };
  enterFrom: { transform: string; opacity: number };
}

function getAnimationGeometry(
  type: TransitionConfig["type"],
  direction: TransitionDirection
): AnimationGeometry {
  const slide = type === "slide" || type === "slide-fade";
  const fade = type === "fade" || type === "slide-fade";

  const exitX = slide ? (direction === "forward" ? "-100%" : "100%") : "0";
  const enterX = slide ? (direction === "forward" ? "100%" : "-100%") : "0";

  return {
    exitTo: {
      transform: `translateX(${exitX})`,
      opacity: fade ? 0 : 1,
    },
    enterFrom: {
      transform: `translateX(${enterX})`,
      opacity: fade ? 0 : 1,
    },
  };
}

export function ScreenTransition({
  pathname,
  direction,
  transition,
  children,
}: ScreenTransitionProps) {
  const reducedMotion = useReducedMotion();
  const skipAnimation =
    reducedMotion || transition.type === "none" || transition.durationMs <= 0;

  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [displayedChildren, setDisplayedChildren] =
    useState<React.ReactNode>(children);
  const [snapshotChildren, setSnapshotChildren] =
    useState<React.ReactNode>(null);
  const [activeGeometry, setActiveGeometry] = useState<AnimationGeometry>(() =>
    getAnimationGeometry(transition.type, direction)
  );
  const [animationId, setAnimationId] = useState(0);
  const [prevPathname, setPrevPathname] = useState(pathname);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React "setState during render" — derive state from changing props without
  // an effect-driven cascade.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);

    if (skipAnimation) {
      setDisplayedChildren(children);
      setSnapshotChildren(null);
      setPhase("idle");
    } else {
      // Snapshot the previously displayed children as the outgoing layer.
      // If a previous animation is in flight, the current `displayedChildren`
      // is the better outgoing baseline because that's what the user
      // perceived as "current" up to this navigation.
      setSnapshotChildren(displayedChildren);
      setDisplayedChildren(children);
      setActiveGeometry(getAnimationGeometry(transition.type, direction));
      setPhase("animating");
      // Bump the animation id so React re-mounts the animated nodes and
      // restarts the keyframe animations on consecutive same-direction swaps.
      setAnimationId((n) => n + 1);
    }
  } else if (phase === "idle" && displayedChildren !== children) {
    setDisplayedChildren(children);
  } else if (skipAnimation && phase !== "idle") {
    // Reduced-motion flipped on mid-animation — collapse to idle and drop
    // the snapshot. The timer effect's cleanup clears any pending timeout
    // when `phase` flips back to idle.
    setPhase("idle");
    setSnapshotChildren(null);
  }

  // Single timer keyed on `animationId` so a rapid second swap unconditionally
  // resets the schedule, even if `phase` doesn't change.
  useEffect(() => {
    if (phase !== "animating") {
      return;
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      setPhase("idle");
      setSnapshotChildren(null);
      timerRef.current = null;
    }, transition.durationMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, transition.durationMs, animationId]);

  if (skipAnimation) {
    return <div data-testid="screen-transition">{children}</div>;
  }

  if (phase === "idle") {
    return (
      <div data-testid="screen-transition" className="relative">
        <div data-testid="transition-idle">{displayedChildren}</div>
      </div>
    );
  }

  const durationStyle = `${transition.durationMs}ms`;
  const exitKeyframeName = `screen-transition-exit-${animationId}`;
  const enterKeyframeName = `screen-transition-enter-${animationId}`;

  return (
    <div data-testid="screen-transition" className="relative overflow-hidden">
      {/* Incoming stays in normal flow so the container keeps its natural height. */}
      <div
        key={`incoming-${animationId}`}
        data-testid="transition-incoming"
        style={{
          animation: `${enterKeyframeName} ${durationStyle} ease-in-out forwards`,
          willChange: "transform, opacity",
        }}
      >
        {displayedChildren}
      </div>

      {/* Outgoing is absolutely positioned so it does not double the height. */}
      {snapshotChildren && (
        <div
          key={`outgoing-${animationId}`}
          data-testid="transition-outgoing"
          className="absolute inset-0"
          style={{
            // Inline transform/opacity match the keyframe's `to` state so
            // they act as a forwards-fill fallback if the CSS animation
            // doesn't run (e.g. jsdom). The @keyframes `from` overrides
            // these immediately once the animation starts.
            transform: activeGeometry.exitTo.transform,
            opacity: activeGeometry.exitTo.opacity,
            animation: `${exitKeyframeName} ${durationStyle} ease-in-out forwards`,
            willChange: "transform, opacity",
          }}
        >
          {snapshotChildren}
        </div>
      )}

      <style>{`
        @keyframes ${exitKeyframeName} {
          from {
            transform: translateX(0);
            opacity: 1;
          }
          to {
            transform: ${activeGeometry.exitTo.transform};
            opacity: ${activeGeometry.exitTo.opacity};
          }
        }
        @keyframes ${enterKeyframeName} {
          from {
            transform: ${activeGeometry.enterFrom.transform};
            opacity: ${activeGeometry.enterFrom.opacity};
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
