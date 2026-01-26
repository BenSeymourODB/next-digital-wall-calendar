"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface RecipeNavigationProps {
  /** Current page number (0-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Handler for navigating to previous page */
  onPrevious: () => void;
  /** Handler for navigating to next page */
  onNext: () => void;
  /** Whether previous button is disabled */
  hasPreviousPage: boolean;
  /** Whether next button is disabled */
  hasNextPage: boolean;
}

/**
 * Navigation controls for the recipe display.
 * Shows previous/next buttons and current page indicator.
 */
export function RecipeNavigation({
  currentPage,
  totalPages,
  onPrevious,
  onNext,
  hasPreviousPage,
  hasNextPage,
}: RecipeNavigationProps) {
  return (
    <div className="flex items-center justify-center gap-4 border-t border-gray-200 bg-gray-50 p-4">
      <Button
        variant="outline"
        size="icon"
        onClick={onPrevious}
        disabled={!hasPreviousPage}
        aria-label="Previous page"
      >
        <ChevronLeft className="h-5 w-5" />
      </Button>

      <span className="min-w-24 text-center text-gray-700">
        <span className="font-medium">{currentPage + 1}</span>
        <span className="text-gray-400"> / </span>
        <span>{totalPages}</span>
      </span>

      <Button
        variant="outline"
        size="icon"
        onClick={onNext}
        disabled={!hasNextPage}
        aria-label="Next page"
      >
        <ChevronRight className="h-5 w-5" />
      </Button>
    </div>
  );
}
