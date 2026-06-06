"use client";

import { useState } from "react";
import type { Page, PaginationState, Recipe, ZoomLevel } from "./types";

/**
 * Calculate the estimated height of an item based on type and zoom level.
 */
function calculateItemHeight(
  type: "ingredient" | "step",
  fontSize: number,
  lineHeight: number
): number {
  if (type === "ingredient") {
    // Ingredients are typically 1-2 lines
    const averageLines = 1.5;
    return fontSize * lineHeight * averageLines + 16; // +16 for padding
  } else {
    // Steps are typically 2-4 lines
    const averageLines = 3;
    return fontSize * lineHeight * averageLines + 24; // +24 for padding and spacing
  }
}

/**
 * Calculate pagination based on recipe content, zoom level, and container height.
 */
function calculatePagination(
  recipe: Recipe,
  zoomLevel: ZoomLevel,
  containerHeight: number
): PaginationState {
  const pages: Page[] = [];

  // Calculate available height for content (excluding header/footer)
  // Header: ~80px, Navigation footer: ~60px, padding: ~60px
  const availableHeight = Math.max(containerHeight - 200, 100);

  // Calculate item heights at current zoom
  const ingredientHeight = calculateItemHeight(
    "ingredient",
    zoomLevel.fontSize,
    zoomLevel.lineHeight
  );
  const stepHeight = calculateItemHeight(
    "step",
    zoomLevel.fontSize,
    zoomLevel.lineHeight
  );

  // Calculate items per page (minimum 1)
  const ingredientsPerPage = Math.max(
    1,
    Math.floor(availableHeight / ingredientHeight)
  );
  const stepsPerPage = Math.max(1, Math.floor(availableHeight / stepHeight));

  // Create ingredient pages
  for (let i = 0; i < recipe.ingredients.length; i += ingredientsPerPage) {
    pages.push({
      pageNumber: pages.length,
      type: "ingredients",
      items: recipe.ingredients.slice(i, i + ingredientsPerPage),
      startIndex: i,
      endIndex: Math.min(i + ingredientsPerPage, recipe.ingredients.length),
    });
  }

  // Create step pages
  for (let i = 0; i < recipe.steps.length; i += stepsPerPage) {
    pages.push({
      pageNumber: pages.length,
      type: "steps",
      items: recipe.steps.slice(i, i + stepsPerPage),
      startIndex: i,
      endIndex: Math.min(i + stepsPerPage, recipe.steps.length),
    });
  }

  // Handle empty recipe
  if (pages.length === 0) {
    pages.push({
      pageNumber: 0,
      type: "ingredients",
      items: [],
      startIndex: 0,
      endIndex: 0,
    });
  }

  return {
    currentPage: 0,
    totalPages: pages.length,
    itemsOnCurrentPage: pages[0]?.items.length || 0,
    pages,
  };
}

export interface UseRecipePaginationProps {
  recipe: Recipe;
  zoomLevel: ZoomLevel;
  containerHeight: number;
}

export interface UseRecipePaginationReturn {
  /** Current page number (0-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Current page content */
  currentPageContent: Page | null;
  /** All pages */
  pages: Page[];
  /** Navigate to next page */
  nextPage: () => void;
  /** Navigate to previous page */
  previousPage: () => void;
  /** Navigate to a specific page */
  goToPage: (page: number) => void;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
}

/**
 * Hook for managing recipe pagination based on zoom level and container size.
 *
 * Automatically recalculates pages when zoom level or container height changes,
 * adjusting the current page to stay within bounds.
 *
 * @example
 * ```tsx
 * const {
 *   currentPage,
 *   totalPages,
 *   currentPageContent,
 *   nextPage,
 *   previousPage,
 *   hasNextPage,
 *   hasPreviousPage,
 * } = useRecipePagination({
 *   recipe,
 *   zoomLevel,
 *   containerHeight: 600,
 * });
 * ```
 */
export function useRecipePagination({
  recipe,
  zoomLevel,
  containerHeight,
}: UseRecipePaginationProps): UseRecipePaginationReturn {
  const [rawCurrentPage, setRawCurrentPage] = useState(0);

  // React Compiler memoizes the recomputation when inputs are stable.
  const pagination = calculatePagination(recipe, zoomLevel, containerHeight);

  // Bounded current page — stays valid even when totalPages shrinks because
  // the user zoomed out. Computed inline to avoid the setState-in-effect
  // pattern that would cascade renders.
  const currentPage = Math.max(
    0,
    Math.min(rawCurrentPage, pagination.totalPages - 1)
  );

  const nextPage = () => {
    setRawCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages - 1));
  };

  const previousPage = () => {
    setRawCurrentPage((prev) => Math.max(prev - 1, 0));
  };

  const goToPage = (page: number) => {
    setRawCurrentPage(Math.max(0, Math.min(page, pagination.totalPages - 1)));
  };

  return {
    currentPage,
    totalPages: pagination.totalPages,
    currentPageContent: pagination.pages[currentPage] || null,
    pages: pagination.pages,
    nextPage,
    previousPage,
    goToPage,
    hasNextPage: currentPage < pagination.totalPages - 1,
    hasPreviousPage: currentPage > 0,
  };
}
