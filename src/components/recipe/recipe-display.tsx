"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RecipeContent } from "./recipe-content";
import { RecipeNavigation } from "./recipe-navigation";
import type { Recipe } from "./types";
import { useRecipePagination } from "./use-recipe-pagination";
import { useZoom } from "./use-zoom";
import { ZoomControls } from "./zoom-controls";

interface RecipeDisplayProps {
  /** The recipe to display */
  recipe: Recipe;
  /** Initial zoom scale (default: 1.0) */
  initialZoom?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Get distance between two touch points for pinch-to-zoom calculation.
 */
function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Main recipe display component with zoom-based pagination.
 *
 * Features:
 * - Zoom in/out with buttons
 * - Pinch-to-zoom on touch devices
 * - Ctrl+scroll zoom on desktop
 * - Keyboard navigation (arrow keys)
 * - Dynamic pagination based on zoom level
 *
 * @example
 * ```tsx
 * <RecipeDisplay
 *   recipe={myRecipe}
 *   initialZoom={1.0}
 *   className="h-[600px]"
 * />
 * ```
 */
export function RecipeDisplay({
  recipe,
  initialZoom = 1.0,
  className,
}: RecipeDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(600);

  // Zoom state
  const { zoomLevel, zoomIn, zoomOut, setZoom, canZoomIn, canZoomOut } =
    useZoom(initialZoom);

  // Pagination state
  const {
    currentPage,
    totalPages,
    currentPageContent,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage,
  } = useRecipePagination({
    recipe,
    zoomLevel,
    containerHeight,
  });

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.clientHeight);
      }
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Handle pinch-to-zoom
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    let initialDistance = 0;
    let initialScale = zoomLevel.scale;

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
        initialScale = zoomLevel.scale;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scaleFactor = currentDistance / initialDistance;
        const newScale = Math.max(
          0.5,
          Math.min(3.0, initialScale * scaleFactor)
        );
        setZoom(newScale);
      }
    };

    element.addEventListener("touchstart", handleTouchStart);
    element.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
    };
  }, [zoomLevel.scale, setZoom]);

  // Handle Ctrl+Scroll zoom
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else {
          zoomOut();
        }
      }
    };

    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [zoomIn, zoomOut]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Only handle if this component is focused or no specific element is focused
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (isInputFocused) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          previousPage();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextPage();
          break;
        case "ArrowUp":
        case "+":
        case "=":
          e.preventDefault();
          zoomIn();
          break;
        case "ArrowDown":
        case "-":
          e.preventDefault();
          zoomOut();
          break;
      }
    },
    [nextPage, previousPage, zoomIn, zoomOut]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={containerRef}
      className={`flex flex-col overflow-hidden rounded-lg bg-white shadow-md ${className || ""}`}
      style={{ height: "100%" }}
      tabIndex={0}
      role="region"
      aria-label={`Recipe: ${recipe.name}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-semibold text-gray-900">
            {recipe.name}
          </h2>
          <RecipeMetadata recipe={recipe} />
        </div>

        <div className="ml-4 flex-shrink-0">
          <ZoomControls
            zoomScale={zoomLevel.scale}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            canZoomIn={canZoomIn}
            canZoomOut={canZoomOut}
          />
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <RecipeContent page={currentPageContent} zoomLevel={zoomLevel} />
      </div>

      {/* Navigation */}
      <RecipeNavigation
        currentPage={currentPage}
        totalPages={totalPages}
        onPrevious={previousPage}
        onNext={nextPage}
        hasPreviousPage={hasPreviousPage}
        hasNextPage={hasNextPage}
      />
    </div>
  );
}

interface RecipeMetadataProps {
  recipe: Recipe;
}

function RecipeMetadata({ recipe }: RecipeMetadataProps) {
  const parts: string[] = [];

  if (recipe.servings) {
    parts.push(`Makes ${recipe.servings} servings`);
  }

  if (recipe.prepTime || recipe.cookTime) {
    const times: string[] = [];
    if (recipe.prepTime) {
      times.push(`Prep: ${formatTime(recipe.prepTime)}`);
    }
    if (recipe.cookTime) {
      times.push(`Cook: ${formatTime(recipe.cookTime)}`);
    }
    parts.push(times.join(" | "));
  }

  if (parts.length === 0) return null;

  return <p className="mt-1 text-sm text-gray-600">{parts.join(" \u2022 ")}</p>;
}

function formatTime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${mins} min`;
}
