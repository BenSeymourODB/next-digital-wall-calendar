"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useRef, useState } from "react";

export type AnimatedSwapType = "fade" | "slide";
export type AnimatedSwapDirection = "forward" | "backward";

interface AnimatedSwapProps {
  /** Key whose change triggers the swap animation. */
  swapKey: string;
  /** Animation style to use. */
  type: AnimatedSwapType;
  /** Slide direction (no effect for `type="fade"`). */
  direction: AnimatedSwapDirection;
  /** Animation duration in milliseconds. <=0 disables animation. */
  durationMs: number;
  /** Content to render. */
  children: React.ReactNode;
}

type SwapPhase = "idle" | "animating";

interface AnimationGeometry {
  exitTo: { transform: string; opacity: number };
  enterFrom: { transform: string; opacity: number };
}

function getAnimationGeometry(
  type: AnimatedSwapType,
  direction: AnimatedSwapDirection
): AnimationGeometry {
  if (type === "slide") {
    const exitX = direction === "forward" ? "-100%" : "100%";
    const enterX = direction === "forward" ? "100%" : "-100%";
    return {
      exitTo: { transform: `translateX(${exitX})`, opacity: 1 },
      enterFrom: { transform: `translateX(${enterX})`, opacity: 1 },
    };
  }
  // fade
  return {
    exitTo: { transform: "translateX(0)", opacity: 0 },
    enterFrom: { transform: "translateX(0)", opacity: 0 },
  };
}

/**
 * Generic single-child swap animator. When `swapKey` changes, animates the
 * outgoing child out and the incoming child in simultaneously via CSS
 * keyframe animations (GPU-composited transform/opacity). The incoming
 * child stays in normal flow so the container preserves its natural height
 * during the transition; the outgoing child is positioned absolutely so it
 * does not push layout.
 *
 * - `prefers-reduced-motion: reduce` → swaps instantly.
 * - `durationMs <= 0` → swaps instantly.
 * - Same `swapKey` re-render → updates children in place, no animation.
 * - Rapid `swapKey` changes mid-animation → previous animation is cancelled
 *   and the latest swap takes over from the previous outgoing snapshot.
 */
export function AnimatedSwap({
  swapKey,
  type,
  direction,
  durationMs,
  children,
}: AnimatedSwapProps) {
  const reducedMotion = useReducedMotion();
  const skipAnimation = reducedMotion || durationMs <= 0;

  const [phase, setPhase] = useState<SwapPhase>("idle");
  const [displayedChildren, setDisplayedChildren] =
    useState<React.ReactNode>(children);
  const [snapshotChildren, setSnapshotChildren] =
    useState<React.ReactNode>(null);
  const [activeGeometry, setActiveGeometry] = useState<AnimationGeometry>(() =>
    getAnimationGeometry(type, direction)
  );
  const [animationId, setAnimationId] = useState(0);
  const [prevSwapKey, setPrevSwapKey] = useState(swapKey);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // React-recommended "setState during render" pattern to derive state from
  // changing props without an effect-driven cascade.
  if (swapKey !== prevSwapKey) {
    setPrevSwapKey(swapKey);

    if (skipAnimation) {
      setDisplayedChildren(children);
      setSnapshotChildren(null);
      setPhase("idle");
    } else {
      // Snapshot the previously displayed children as the outgoing content.
      // If we're already animating, the previous snapshot represents an
      // earlier-still page; the latest displayed is the better outgoing
      // baseline because the user perceived it as "current" up to this tap.
      setSnapshotChildren(displayedChildren);
      setDisplayedChildren(children);
      setActiveGeometry(getAnimationGeometry(type, direction));
      setPhase("animating");
      // Bump the animation id so React re-mounts the animated nodes and
      // restarts the keyframe animations even on consecutive transitions.
      setAnimationId((n) => n + 1);
    }
  } else if (phase === "idle" && displayedChildren !== children) {
    setDisplayedChildren(children);
  } else if (skipAnimation && phase !== "idle") {
    // Reduced-motion flipped on mid-animation — collapse to idle and drop
    // the outgoing snapshot. The timer-effect's cleanup will clear any
    // pending timeout when `phase` changes back to idle.
    setPhase("idle");
    setSnapshotChildren(null);
  }

  // Single timer driven by animationId so a rapid second swap unconditionally
  // resets the schedule, regardless of whether `phase` actually changed.
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
    }, durationMs);
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phase, durationMs, animationId]);

  if (skipAnimation) {
    return <div data-testid="animated-swap">{children}</div>;
  }

  if (phase === "idle") {
    return (
      <div data-testid="animated-swap" className="relative">
        <div data-testid="animated-swap-idle">{displayedChildren}</div>
      </div>
    );
  }

  const durationStyle = `${durationMs}ms`;
  const exitKeyframeName = `animated-swap-exit-${animationId}`;
  const enterKeyframeName = `animated-swap-enter-${animationId}`;

  return (
    <div data-testid="animated-swap" className="relative overflow-hidden">
      {/* Incoming stays in normal flow so the container keeps its natural height. */}
      <div
        key={`incoming-${animationId}`}
        data-testid="animated-swap-incoming"
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
          data-testid="animated-swap-outgoing"
          className="absolute inset-0"
          style={{
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
