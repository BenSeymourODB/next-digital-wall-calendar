"use client";

/**
 * Screen Transition Component
 *
 * Wraps page content and provides smooth animated transitions between
 * scheduler screens. Uses CSS transforms for GPU-accelerated animations
 * that work across all modern browsers.
 *
 * Supports slide, fade, and slide-fade transition types with configurable
 * duration. Respects prefers-reduced-motion for accessibility.
 */
import { useEffect, useState } from "react";
import type { TransitionConfig, TransitionDirection } from "./types";

interface ScreenTransitionProps {
  /** Current pathname — change triggers transition */
  pathname: string;
  /** Navigation direction for slide animations */
  direction: TransitionDirection;
  /** Transition configuration */
  transition: TransitionConfig;
  /** Page content to render */
  children: React.ReactNode;
}

type TransitionPhase = "idle" | "exiting" | "entering";

/**
 * Returns the CSS transform for the outgoing content during exit.
 */
function getExitTransform(
  type: TransitionConfig["type"],
  direction: TransitionDirection
): string {
  if (type === "slide" || type === "slide-fade") {
    return direction === "forward" ? "translateX(-100%)" : "translateX(100%)";
  }
  return "translateX(0)";
}

/**
 * Returns the CSS transform for the incoming content start position.
 */
function getEnterStartTransform(
  type: TransitionConfig["type"],
  direction: TransitionDirection
): string {
  if (type === "slide" || type === "slide-fade") {
    return direction === "forward" ? "translateX(100%)" : "translateX(-100%)";
  }
  return "translateX(0)";
}

/**
 * Returns the CSS opacity for exit phase based on transition type.
 */
function getExitOpacity(type: TransitionConfig["type"]): number {
  if (type === "fade" || type === "slide-fade") {
    return 0;
  }
  return 1;
}

/**
 * Check if transitions should be skipped.
 */
function shouldSkipTransition(config: TransitionConfig): boolean {
  if (config.type === "none" || config.durationMs <= 0) {
    return true;
  }
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return true;
  }
  return false;
}

/**
 * ScreenTransition wraps children and animates between old and new content
 * when the pathname changes. Uses CSS transforms and opacity for
 * GPU-composited 60fps animations.
 *
 * Uses React's "setState during render" pattern to detect pathname changes
 * without triggering cascading renders from effects.
 */
export function ScreenTransition({
  pathname,
  direction,
  transition,
  children,
}: ScreenTransitionProps) {
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [displayedChildren, setDisplayedChildren] =
    useState<React.ReactNode>(children);
  const [snapshotChildren, setSnapshotChildren] =
    useState<React.ReactNode>(null);
  const [prevPathname, setPrevPathname] = useState(pathname);

  // React "setState during render" pattern: detect pathname changes
  // without effects. This is the React-recommended way to derive
  // state from changing props.
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);

    if (shouldSkipTransition(transition)) {
      // No animation — swap immediately
      setDisplayedChildren(children);
      setSnapshotChildren(null);
      setPhase("idle");
    } else {
      // Start transition: snapshot outgoing, prepare incoming
      setSnapshotChildren(displayedChildren);
      setDisplayedChildren(children);
      setPhase("exiting");
    }
  } else if (phase === "idle") {
    // Same pathname — keep children in sync (re-renders)
    if (displayedChildren !== children) {
      setDisplayedChildren(children);
    }
  }

  // Timer-driven phase transitions (exiting → entering → idle)
  useEffect(() => {
    if (phase !== "exiting") return;

    const exitTimer = setTimeout(() => {
      setPhase("entering");
    }, transition.durationMs);

    return () => clearTimeout(exitTimer);
  }, [phase, transition.durationMs]);

  useEffect(() => {
    if (phase !== "entering") return;

    const enterTimer = setTimeout(() => {
      setSnapshotChildren(null);
      setPhase("idle");
    }, transition.durationMs);

    return () => clearTimeout(enterTimer);
  }, [phase, transition.durationMs]);

  // No animation needed — render children directly
  if (transition.type === "none" || transition.durationMs <= 0) {
    return <div data-testid="screen-transition">{children}</div>;
  }

  const durationStyle = `${transition.durationMs}ms`;
  const exitTransform = getExitTransform(transition.type, direction);
  const enterStartTransform = getEnterStartTransform(
    transition.type,
    direction
  );
  const exitOpacity = getExitOpacity(transition.type);

  return (
    <div
      data-testid="screen-transition"
      className="relative overflow-hidden"
      style={{ minHeight: "100vh" }}
    >
      {/* Outgoing content (during exit phase) */}
      {phase === "exiting" && snapshotChildren && (
        <div
          data-testid="transition-outgoing"
          className="absolute inset-0"
          style={{
            transform: exitTransform,
            opacity: exitOpacity,
            transition: `transform ${durationStyle} ease-in-out, opacity ${durationStyle} ease-in-out`,
            willChange: "transform, opacity",
          }}
        >
          {snapshotChildren}
        </div>
      )}

      {/* Incoming content (during exit phase — slides in) */}
      {phase === "exiting" && (
        <div
          data-testid="transition-incoming"
          className="absolute inset-0"
          style={{
            transform: "translateX(0)",
            opacity: 1,
            transition: `transform ${durationStyle} ease-in-out, opacity ${durationStyle} ease-in-out`,
            willChange: "transform, opacity",
          }}
        >
          {displayedChildren}
        </div>
      )}

      {/* Entering content (animating into final position) */}
      {phase === "entering" && (
        <div
          data-testid="transition-entering"
          style={{
            animation: `screen-enter ${durationStyle} ease-in-out`,
            willChange: "transform, opacity",
          }}
        >
          {displayedChildren}
        </div>
      )}

      {/* Idle — normal rendering */}
      {phase === "idle" && (
        <div data-testid="transition-idle">{displayedChildren}</div>
      )}

      {/* Inline keyframes for enter animation */}
      {phase === "entering" && (
        <style>{`
          @keyframes screen-enter {
            from {
              transform: ${enterStartTransform};
              opacity: ${transition.type === "fade" || transition.type === "slide-fade" ? 0 : 1};
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
