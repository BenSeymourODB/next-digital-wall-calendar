"use client";

import type { AnimatedSwapDirection } from "@/components/calendar/animated-swap";
import { useState } from "react";

/**
 * Tracks a monotonic index across renders and returns the slide direction
 * implied by its movement. Use it to feed `AnimatedSwap`'s `direction` prop
 * for views that navigate by prev/next (Day, Week, Year, Month).
 *
 * Behaviour:
 * - First render returns `"forward"` (deterministic seed).
 * - Index unchanged → previous direction is retained.
 * - Index increased → `"forward"`.
 * - Index decreased → `"backward"`.
 *
 * Internally uses the React-recommended "setState during render" pattern so
 * the direction is settled in a single pass with no effect cascade — the
 * same approach `SimpleCalendar` open-codes today.
 */
export function useSlideDirection(index: number): AnimatedSwapDirection {
  const [previousIndex, setPreviousIndex] = useState(index);
  const [direction, setDirection] = useState<AnimatedSwapDirection>("forward");

  if (index !== previousIndex) {
    setDirection(index < previousIndex ? "backward" : "forward");
    setPreviousIndex(index);
  }

  return direction;
}
