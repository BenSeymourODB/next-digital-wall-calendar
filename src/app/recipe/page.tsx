"use client";

import { RecipeDisplay } from "@/components/recipe";
import { Button } from "@/components/ui/button";
import { useUserSettings } from "@/hooks/useUserSettings";
import { getRecipeById, sampleRecipes } from "@/lib/recipe/sample-recipes";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Bounded to the DisplaySection slider range, NOT the full ZOOM_LEVELS scale
// (which extends to 3.0). The clamp here is for the *initial* zoom only —
// pinch-to-zoom and Ctrl+scroll in RecipeDisplay still go up to 3.0 at
// runtime. If ZOOM_LEVELS ever gains a level below 0.5 or the slider range
// changes, sync these constants with src/components/recipe/use-zoom.ts and
// src/components/settings/display-section.tsx.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2.0;
const ZOOM_FALLBACK = 1.0;

function clampInitialZoom(value: number): number {
  if (!Number.isFinite(value)) {
    return ZOOM_FALLBACK;
  }
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export default function RecipePage() {
  const [selectedRecipeId, setSelectedRecipeId] = useState(sampleRecipes[0].id);
  const selectedRecipe = getRecipeById(selectedRecipeId) ?? sampleRecipes[0];
  const { settings, isLoading } = useUserSettings();
  const initialZoom = clampInitialZoom(settings.defaultZoomLevel);

  return (
    <div className="flex min-h-screen flex-col bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>

          <h1 className="text-lg font-semibold text-gray-900">
            Recipe Display
          </h1>

          {/* Recipe selector */}
          <select
            value={selectedRecipeId}
            onChange={(e) => setSelectedRecipeId(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm"
          >
            {sampleRecipes.map((recipe) => (
              <option key={recipe.id} value={recipe.id}>
                {recipe.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 p-4">
        <div className="mx-auto h-[calc(100vh-8rem)] max-w-4xl">
          {isLoading ? (
            <div
              className="flex h-full items-center justify-center text-sm text-gray-500"
              role="status"
              aria-live="polite"
            >
              Loading recipe…
            </div>
          ) : (
            <RecipeDisplay recipe={selectedRecipe} initialZoom={initialZoom} />
          )}
        </div>
      </main>

      {/* Footer with instructions */}
      <footer className="border-t border-gray-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-4xl text-center text-sm text-gray-500">
          <p>
            <strong>Controls:</strong> Use arrow keys (← →) to navigate pages |
            Use +/- or Ctrl+scroll to zoom | Pinch to zoom on touch devices
          </p>
        </div>
      </footer>
    </div>
  );
}
