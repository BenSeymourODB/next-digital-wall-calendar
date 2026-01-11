"use client";

import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";

interface ZoomControlsProps {
  /** Current zoom scale (e.g., 1.0 = 100%) */
  zoomScale: number;
  /** Handler for zooming in */
  onZoomIn: () => void;
  /** Handler for zooming out */
  onZoomOut: () => void;
  /** Whether zoom in is available */
  canZoomIn: boolean;
  /** Whether zoom out is available */
  canZoomOut: boolean;
}

/**
 * Zoom controls for adjusting the recipe display size.
 * Shows +/- buttons and current zoom percentage.
 */
export function ZoomControls({
  zoomScale,
  onZoomIn,
  onZoomOut,
  canZoomIn,
  canZoomOut,
}: ZoomControlsProps) {
  const percentage = Math.round(zoomScale * 100);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        className="h-8 w-8"
      >
        <Minus className="h-4 w-4" />
      </Button>

      <span className="min-w-14 text-center text-sm text-gray-600">
        {percentage}%
      </span>

      <Button
        variant="outline"
        size="icon"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        className="h-8 w-8"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}
