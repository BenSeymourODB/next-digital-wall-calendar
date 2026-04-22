"use client";

import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useEffect, useState } from "react";

export type AnimatedSwapType = "fade" | "slide";
export type AnimatedSwapDirection = "forward" | "backward";

interface AnimatedSwapProps {
  /** Key whose change triggers the swap animation. */
  swapKey: string;
  /** Animation style to use. */
  type: AnimatedSwapType;
  /** Slide direction (no effect for `type="fade"`). */
  direction: AnimatedSwapDirection;
  /** Animation duration per phase in milliseconds. <=0 disables animation. */
  durationMs: number;
  /** Content to render. */
  children: React.ReactNode;
}

type SwapPhase = "idle" | "exiting" | "entering";

function exitTransform(
  type: AnimatedSwapType,
  direction: AnimatedSwapDirection
): string {
  if (type === "slide") {
    return direction === "forward" ? "translateX(-100%)" : "translateX(100%)";
  }
  return "translateX(0)";
}

function enterStartTransform(
  type: AnimatedSwapType,
  direction: AnimatedSwapDirection
): string {
  if (type === "slide") {
    return direction === "forward" ? "translateX(100%)" : "translateX(-100%)";
  }
  return "translateX(0)";
}

function exitOpacity(type: AnimatedSwapType): number {
  return type === "fade" ? 0 : 1;
}

function enterStartOpacity(type: AnimatedSwapType): number {
  return type === "fade" ? 0 : 1;
}

/**
 * Generic single-child swap animator. When `swapKey` changes, animates the
 * outgoing child out and the incoming child in using GPU-composited CSS
 * transforms / opacity. Mirrors the lifecycle pattern used by
 * `ScreenTransition` but is decoupled from router semantics so it can be
 * reused for in-page swaps (e.g. calendar view-mode and period changes).
 *
 * - `prefers-reduced-motion: reduce` → swaps instantly.
 * - `durationMs <= 0` → swaps instantly.
 * - Same `swapKey` re-render → updates children in place, no animation.
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
  const [prevSwapKey, setPrevSwapKey] = useState(swapKey);

  // React-recommended "setState during render" pattern to derive state from
  // changing props without an effect-driven cascade.
  if (swapKey !== prevSwapKey) {
    setPrevSwapKey(swapKey);

    if (skipAnimation) {
      setDisplayedChildren(children);
      setSnapshotChildren(null);
      setPhase("idle");
    } else {
      setSnapshotChildren(displayedChildren);
      setDisplayedChildren(children);
      setPhase("exiting");
    }
  } else if (phase === "idle" && displayedChildren !== children) {
    setDisplayedChildren(children);
  }

  useEffect(() => {
    if (phase !== "exiting") return;
    const timer = setTimeout(() => setPhase("entering"), durationMs);
    return () => clearTimeout(timer);
  }, [phase, durationMs]);

  useEffect(() => {
    if (phase !== "entering") return;
    const timer = setTimeout(() => {
      setSnapshotChildren(null);
      setPhase("idle");
    }, durationMs);
    return () => clearTimeout(timer);
  }, [phase, durationMs]);

  if (skipAnimation) {
    return <div data-testid="animated-swap">{children}</div>;
  }

  const durationStyle = `${durationMs}ms`;
  const transitionStyle = `transform ${durationStyle} ease-in-out, opacity ${durationStyle} ease-in-out`;

  return (
    <div data-testid="animated-swap" className="relative overflow-hidden">
      {phase === "exiting" && snapshotChildren && (
        <div
          data-testid="animated-swap-outgoing"
          className="absolute inset-0"
          style={{
            transform: exitTransform(type, direction),
            opacity: exitOpacity(type),
            transition: transitionStyle,
            willChange: "transform, opacity",
          }}
        >
          {snapshotChildren}
        </div>
      )}

      {phase === "exiting" && (
        <div
          data-testid="animated-swap-incoming"
          className="absolute inset-0"
          style={{
            transform: "translateX(0)",
            opacity: 1,
            transition: transitionStyle,
            willChange: "transform, opacity",
          }}
        >
          {displayedChildren}
        </div>
      )}

      {phase === "entering" && (
        <div
          data-testid="animated-swap-entering"
          style={{
            animation: `animated-swap-enter ${durationStyle} ease-in-out`,
            willChange: "transform, opacity",
          }}
        >
          {displayedChildren}
        </div>
      )}

      {phase === "idle" && (
        <div data-testid="animated-swap-idle">{displayedChildren}</div>
      )}

      {phase === "entering" && (
        <style>{`
          @keyframes animated-swap-enter {
            from {
              transform: ${enterStartTransform(type, direction)};
              opacity: ${enterStartOpacity(type)};
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>
      )}
    </div>
  );
}
