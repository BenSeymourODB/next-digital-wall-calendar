"use client";

import { useCallback, useState } from "react";
import type { ZoomLevel } from "./types";

/**
 * Predefined zoom levels with corresponding font sizes and line heights.
 * Each level is optimized for readability at that scale.
 */
export const ZOOM_LEVELS: ZoomLevel[] = [
  { scale: 0.75, fontSize: 14, lineHeight: 1.5 },
  { scale: 1.0, fontSize: 18, lineHeight: 1.6 },
  { scale: 1.25, fontSize: 22, lineHeight: 1.6 },
  { scale: 1.5, fontSize: 27, lineHeight: 1.7 },
  { scale: 1.75, fontSize: 31, lineHeight: 1.7 },
  { scale: 2.0, fontSize: 36, lineHeight: 1.8 },
  { scale: 2.5, fontSize: 45, lineHeight: 1.8 },
  { scale: 3.0, fontSize: 54, lineHeight: 1.9 },
];

/**
 * Find the index of a zoom level by its scale value.
 * Returns the closest matching zoom level if exact match not found.
 */
function findZoomIndex(scale: number): number {
  // Find exact match first
  const exactIndex = ZOOM_LEVELS.findIndex((z) => z.scale === scale);
  if (exactIndex !== -1) return exactIndex;

  // Find closest match
  let closestIndex = 0;
  let closestDiff = Math.abs(ZOOM_LEVELS[0].scale - scale);

  for (let i = 1; i < ZOOM_LEVELS.length; i++) {
    const diff = Math.abs(ZOOM_LEVELS[i].scale - scale);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestIndex = i;
    }
  }

  return closestIndex;
}

export interface UseZoomReturn {
  /** Current zoom level configuration */
  zoomLevel: ZoomLevel;
  /** Current index in the zoom levels array */
  zoomIndex: number;
  /** Increase zoom by one level */
  zoomIn: () => void;
  /** Decrease zoom by one level */
  zoomOut: () => void;
  /** Set zoom to a specific scale value */
  setZoom: (scale: number) => void;
  /** Whether zoom in is available */
  canZoomIn: boolean;
  /** Whether zoom out is available */
  canZoomOut: boolean;
}

/**
 * Hook for managing zoom level state.
 *
 * @param initialScale - Initial zoom scale (default: 1.0)
 * @returns Zoom state and control functions
 *
 * @example
 * ```tsx
 * const { zoomLevel, zoomIn, zoomOut, canZoomIn, canZoomOut } = useZoom(1.0);
 *
 * return (
 *   <div style={{ fontSize: `${zoomLevel.fontSize}px` }}>
 *     <button onClick={zoomOut} disabled={!canZoomOut}>-</button>
 *     <span>{Math.round(zoomLevel.scale * 100)}%</span>
 *     <button onClick={zoomIn} disabled={!canZoomIn}>+</button>
 *   </div>
 * );
 * ```
 */
export function useZoom(initialScale: number = 1.0): UseZoomReturn {
  const [currentIndex, setCurrentIndex] = useState(() =>
    findZoomIndex(initialScale)
  );

  const zoomIn = useCallback(() => {
    setCurrentIndex((prev) => Math.min(prev + 1, ZOOM_LEVELS.length - 1));
  }, []);

  const zoomOut = useCallback(() => {
    setCurrentIndex((prev) => Math.max(prev - 1, 0));
  }, []);

  const setZoom = useCallback((scale: number) => {
    const index = findZoomIndex(scale);
    setCurrentIndex(index);
  }, []);

  return {
    zoomLevel: ZOOM_LEVELS[currentIndex],
    zoomIndex: currentIndex,
    zoomIn,
    zoomOut,
    setZoom,
    canZoomIn: currentIndex < ZOOM_LEVELS.length - 1,
    canZoomOut: currentIndex > 0,
  };
}
